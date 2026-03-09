import type { AgentRepository } from '../repos/agent-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type {
  RoomCastMemberView,
  RoomLiveSnapshot,
  RoomProgram,
  RoomProgramReadModel,
  RoomWatchabilitySummary,
} from '../repos/types.js'
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

const RECENT_MESSAGE_LIMIT = 6

export interface RoomProjectorDeps {
  roomRepo: RoomRepository
  messageRepo: MessageRepository
  agentRepo: AgentRepository
  watchabilityRepo: RoomWatchabilityRepository
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

    const agentNames = new Map<string, string>()
    for (const member of members) {
      const agent = this.deps.agentRepo.findById(member.member_id)
      if (agent?.display_name) {
        agentNames.set(member.member_id, agent.display_name)
      }
    }

    const recentMessages = await this.deps.messageRepo.getLatestMessages(room.id, RECENT_MESSAGE_LIMIT)
    const namedMessages = toNamedRecentMessages(recentMessages, agentNames)
    const unresolvedQuestion = buildUnresolvedQuestion(namedMessages)
    const recapShort = buildRecapShort(room, namedMessages)
    const liveHook = buildLiveHook(room, namedMessages, unresolvedQuestion)
    const energy = computeEnergy(namedMessages, members)
    const tension = computeTension(namedMessages)

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
      energy,
      tension,
      turn_count: recentMessages.length,
      message_count: await this.deps.messageRepo.countByRoom(room.id),
    })

    const snapshot = await this.deps.watchabilityRepo.saveLiveSnapshot({
      room_id: room.id,
      episode_id: episode.id,
      scene_type: program.scene_type,
      current_beat: null,
      live_hook: liveHook,
      unresolved_question: unresolvedQuestion,
      recap_short: recapShort,
      active_cast: liveCast,
      last_highlight_text: null,
      energy,
      tension,
      message_cursor_id: recentMessages[recentMessages.length - 1]?.id ?? null,
    })

    const cast: RoomCastMemberView[] = persistedCast.map((entry) => ({
      agent_id: entry.agent_id,
      name: agentNames.get(entry.agent_id) ?? entry.agent_id,
      role: entry.role,
      chemistry_score: entry.chemistry_score,
      spotlight_weight: entry.spotlight_weight,
      last_spoke_at: members.find((member) => member.member_id === entry.agent_id)?.last_spoke_at ?? null,
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
      allow_wandering: program.allow_wandering,
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
