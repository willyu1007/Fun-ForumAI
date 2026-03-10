import type { AgentRepository } from '../repos/agent-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type {
  ChatMessage,
  RoomCallbackCandidate,
  RoomCastMemberView,
  RoomLiveSnapshot,
  RoomProgram,
  RoomProgramReadModel,
  RoomWatchabilitySummary,
} from '../repos/types.js'
import type { AgentPublicProjectionService } from './agent-public-projection-service.js'
import {
  buildLiveHook,
  buildRecapShort,
  buildUnresolvedQuestion,
  computeEnergy,
  computeTension,
  currentRole,
  deriveCastAssignments,
  toLiveCast,
  toNamedRecentMessages,
} from './chatroom-watchability-heuristics.js'
import { normalizeWanderPolicy } from './chatroom-program-policy.js'

const WATCHABILITY_RECENT_MESSAGE_LIMIT = 6
const CALLBACK_BANK_LIMIT = 10

function buildContinuitySummary(input: {
  recapShort: string | null
  unresolvedQuestion: string | null
  latestHighlightText: string | null
}): string | null {
  const parts = [
    input.recapShort,
    input.unresolvedQuestion ? `悬念: ${input.unresolvedQuestion}` : null,
    input.latestHighlightText ? `梗: ${trimText(input.latestHighlightText, 40)}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' | ') : null
}

function trimText(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function buildCallbackBank(
  recentMessages: ChatMessage[],
  callbackWindow: number,
): RoomCallbackCandidate[] {
  return recentMessages
    .slice(-callbackWindow)
    .map((message) => {
      let weight = 0
      if (message.cue_type === 'CALLBACK') weight += 0.5
      if (/[?？]/.test(message.body)) weight += 0.22
      if (/[!！]/.test(message.body)) weight += 0.14
      weight += Math.min(message.body.trim().length / 240, 0.16)
      return {
        message_id: message.id,
        author_agent_id: message.author_id,
        summary_text: trimText(message.body, 56),
        weight: Number(weight.toFixed(2)),
        created_at: message.created_at.toISOString(),
      } satisfies RoomCallbackCandidate
    })
    .filter((candidate) => candidate.weight >= 0.18)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, CALLBACK_BANK_LIMIT)
}

export interface RoomProjectorDeps {
  roomRepo: RoomRepository
  messageRepo: MessageRepository
  agentRepo: AgentRepository
  watchabilityRepo: RoomWatchabilityRepository
  projectionService?: AgentPublicProjectionService | null
}

export interface RoomProjectionResult {
  program: RoomProgram
  snapshot: RoomLiveSnapshot
  cast: RoomCastMemberView[]
}

function fallbackWatchability(room: {
  description: string
  id: string
  name: string
}, snapshot: RoomLiveSnapshot | null): RoomWatchabilitySummary {
  return {
    scene_type: snapshot?.scene_type ?? 'FREE_CHAT',
    current_beat: snapshot?.current_beat ?? null,
    live_hook: snapshot?.live_hook ?? (room.description || `这间房正在展开一场新的 live 群聊。`),
    unresolved_question: snapshot?.unresolved_question ?? null,
    active_cast_preview: snapshot?.active_cast.slice(0, 3).map((entry) => ({
      agent_id: entry.agent_id,
      name: entry.name,
      role: entry.role,
    })) ?? [],
    last_highlight_text: snapshot?.last_highlight_text ?? null,
    energy: snapshot?.energy ?? 0,
    tension: snapshot?.tension ?? 0,
    continuity_summary: snapshot?.continuity_summary ?? null,
    canonization_note: snapshot?.canonization_note ?? null,
    cameo_hint: snapshot?.cameo_hint ?? null,
    snapshot_updated_at: snapshot?.updated_at ?? null,
  }
}

export class RoomProjector {
  constructor(private readonly deps: RoomProjectorDeps) {}

  async refreshRoom(roomId: string): Promise<RoomProjectionResult | null> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) return null

    const program = await this.deps.watchabilityRepo.ensureProgram(room)
    const episode = await this.deps.watchabilityRepo.ensureActiveEpisode(room.id, program.id)
    const members = await this.deps.roomRepo.getMembers(room.id)
    const projections = this.deps.projectionService
      ? await this.deps.projectionService.getOrBuildMany(members.map((member) => member.member_id))
      : new Map()

    const agentNames = new Map<string, string>()
    for (const member of members) {
      const agent = this.deps.agentRepo.findById(member.member_id)
      if (agent?.display_name) {
        agentNames.set(member.member_id, agent.display_name)
      }
    }

    const recentMessages = await this.deps.messageRepo.getLatestMessages(
      room.id,
      Math.max(WATCHABILITY_RECENT_MESSAGE_LIMIT, program.callback_window),
    )
    const watchabilityMessages = recentMessages.slice(-WATCHABILITY_RECENT_MESSAGE_LIMIT)
    const namedMessages = toNamedRecentMessages(watchabilityMessages, agentNames)
    const unresolvedQuestion = buildUnresolvedQuestion(namedMessages)
    const recapShort = buildRecapShort(room, namedMessages)
    const liveHook = buildLiveHook(room, namedMessages, unresolvedQuestion)
    const energy = computeEnergy(namedMessages, members)
    const tension = computeTension(namedMessages)
    const latestBeat = await this.deps.watchabilityRepo.getLatestBeat(episode.id)
    const latestHighlight = await this.deps.watchabilityRepo.getLatestHighlight(room.id)
    const latestSharedMemory = await this.deps.watchabilityRepo.getLatestSharedMemory(room.id, 'CONTINUITY')
    const latestCanonization = await this.deps.watchabilityRepo.getLatestSharedMemory(room.id, 'CANONIZATION')
    const callbackBank = buildCallbackBank(recentMessages, program.callback_window)

    const messageCount = await this.deps.messageRepo.countByRoom(room.id)
    const assignments = deriveCastAssignments(room, members)
    const persistedCast = await this.deps.watchabilityRepo.replaceEpisodeCast(
      room.id,
      episode.id,
      assignments.map((assignment) => ({
        room_id: room.id,
        episode_id: episode.id,
        agent_id: assignment.agent_id,
        role: assignment.role,
        entry_source: assignment.entry_source,
        chemistry_score: assignment.chemistry_score,
        spotlight_weight: assignment.spotlight_weight,
      })),
    )
    const liveCast = toLiveCast(assignments, members, agentNames)

    await this.deps.watchabilityRepo.saveEpisodeState({
      episode_id: episode.id,
      summary_text: recapShort ?? '',
      unresolved_question: unresolvedQuestion,
      callback_bank_json: callbackBank,
      energy,
      tension,
      turn_count: messageCount,
      message_count: messageCount,
    })

    const continuitySummary = buildContinuitySummary({
      recapShort,
      unresolvedQuestion,
      latestHighlightText: latestHighlight?.text ?? null,
    })
    if (continuitySummary && latestSharedMemory?.summary_text !== continuitySummary) {
      await this.deps.watchabilityRepo.createSharedMemory({
        room_id: room.id,
        episode_id: episode.id,
        memory_kind: 'CONTINUITY',
        summary_text: continuitySummary,
        tags: unresolvedQuestion ? ['unresolved-question'] : ['continuity'],
        source_highlight_id: latestHighlight?.id ?? null,
        source_message_id: recentMessages[recentMessages.length - 1]?.id ?? null,
        score: Math.max(energy, tension),
      }).catch((error) => {
        console.warn(`[RoomProjector] failed to persist room shared memory for room=${roomId}:`, error)
      })
    }

    const snapshot = await this.deps.watchabilityRepo.saveLiveSnapshot({
      room_id: room.id,
      episode_id: episode.id,
      scene_type: program.scene_type,
      current_beat: latestBeat?.beat_type ?? null,
      live_hook: liveHook,
      unresolved_question: unresolvedQuestion,
      recap_short: recapShort,
      active_cast: liveCast,
      last_highlight_text: latestHighlight?.text ?? null,
      energy,
      tension,
      message_cursor_id: recentMessages[recentMessages.length - 1]?.id ?? null,
    })
    snapshot.continuity_summary = latestSharedMemory?.summary_text ?? continuitySummary
    snapshot.canonization_note = latestCanonization?.summary_text ?? null
    snapshot.cameo_hint = null

    const cast: RoomCastMemberView[] = persistedCast.map((entry) => ({
      agent_id: entry.agent_id,
      name: agentNames.get(entry.agent_id) ?? entry.agent_id,
      role: entry.role,
      chemistry_score: entry.chemistry_score,
      spotlight_weight: entry.spotlight_weight,
      last_spoke_at: members.find((member) => member.member_id === entry.agent_id)?.last_spoke_at ?? null,
      role_hint: members.find((member) => member.member_id === entry.agent_id)?.role_hint ?? null,
      wander_eligible: members.find((member) => member.member_id === entry.agent_id)?.wander_eligible ?? true,
      suppressed_until: members.find((member) => member.member_id === entry.agent_id)?.suppressed_until ?? null,
      member_spotlight_weight: members.find((member) => member.member_id === entry.agent_id)?.spotlight_weight ?? 1,
      projection: projections.get(entry.agent_id) ?? null,
    }))

    return {
      program,
      snapshot,
      cast,
    }
  }

  summarizeWatchability(room: { id: string; name: string; description: string }, snapshot: RoomLiveSnapshot | null): RoomWatchabilitySummary {
    return fallbackWatchability(room, snapshot)
  }

  toProgramReadModel(program: RoomProgram, snapshot: RoomLiveSnapshot | null, episode: {
    id: string
    energy: number
    tension: number
    turn_count: number
    message_count: number
  } | null): RoomProgramReadModel {
    return {
      room_id: program.room_id,
      enabled: program.enabled,
      scene_type: program.scene_type,
      pacing_preset: program.pacing_preset,
      target_cast_min: program.target_cast_min,
      target_cast_max: program.target_cast_max,
      callback_window: program.callback_window,
      recap_every_turns: program.recap_every_turns,
      max_consecutive_turns: program.max_consecutive_turns,
      idle_cue_after_ms: program.idle_cue_after_ms,
      allow_wandering: program.allow_wandering,
      director_policy: program.director_policy_json,
      wander_policy: normalizeWanderPolicy(program.wander_policy_json),
      discoverability: {
        tags: program.discoverability_tags,
        short_hook: program.discoverability_short_hook,
        default_view: program.discoverability_default_view,
      },
      current_episode: episode
        ? {
            episode_id: episode.id,
            current_beat: snapshot?.current_beat ?? null,
            energy: episode.energy,
            tension: episode.tension,
            turn_count: episode.turn_count,
            message_count: episode.message_count,
          }
        : null,
    }
  }

  getSelfRole(cast: RoomCastMemberView[], agentId: string) {
    return currentRole(cast, agentId)
  }
}
