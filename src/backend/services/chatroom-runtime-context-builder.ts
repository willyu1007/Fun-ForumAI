import type { AgentRepository } from '../repos/agent-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type {
  ChatMessage,
  Room,
  RoomCastMemberView,
  RoomProgramReadModel,
} from '../repos/types.js'
import type { ExecutionContext } from '../runtime/types.js'
import { sanitizeChatOutput } from '../runtime/chat-output-sanitizer.js'
import { RoomProjector } from './room-projector.js'
import { toNamedRecentMessages } from './chatroom-watchability-heuristics.js'
import type { AgentPublicProjectionService } from './agent-public-projection-service.js'

export interface ChatroomRuntimeContextBuilderDeps {
  roomRepo: RoomRepository
  agentRepo: AgentRepository
  watchabilityRepo: RoomWatchabilityRepository
  roomProjector: RoomProjector
  projectionService?: AgentPublicProjectionService | null
}

export interface ChatroomRuntimeContextResult {
  chatContext: NonNullable<ExecutionContext['chatContext']>
  promptVariables: Record<string, string>
}

const CHATROOM_SIGNATURE_MOVE_REWRITES: Array<[pattern: RegExp, replacement: string]> = [
  [/使用正式书面语/gu, '保留书面质感，但像现场接话一样短句'],
  [/详细展开论述/gu, '有内容，但只补最关键的一层'],
]

function stringifyCast(cast: RoomCastMemberView[]): string {
  if (cast.length === 0) return ''
  return cast
    .map((entry) => `- ${entry.name} (${entry.role})`)
    .join('\n')
}

function buildDirectorGoal(program: RoomProgramReadModel, room: Room, liveHook: string | null): string {
  return liveHook
    ?? program.discoverability.short_hook
    ?? room.description
    ?? `继续把「${room.name}」这场 live 群聊往前推进。`
}

function sanitizePromptText(text: string | null | undefined): string | null {
  if (!text) return null
  const sanitized = sanitizeChatOutput(text)
  if (!sanitized.text || sanitized.looks_meta) return null
  return sanitized.text
}

function adaptProjectionSignatureMoves(signatureMoves: string[] | null | undefined): string[] {
  const rawMoves = signatureMoves ?? []
  const rewritten = rawMoves.map((move) => {
    let next = move
    for (const [pattern, replacement] of CHATROOM_SIGNATURE_MOVE_REWRITES) {
      next = next.replace(pattern, replacement)
    }
    return next.trim()
  }).filter(Boolean)

  if (!rewritten.some((move) => move.includes('先给判断'))) {
    rewritten.push('先给判断，再补一层')
  }

  return Array.from(new Set(rewritten))
}

export class ChatroomRuntimeContextBuilder {
  constructor(private readonly deps: ChatroomRuntimeContextBuilderDeps) {}

  setProjectionService(service: AgentPublicProjectionService | null): void {
    ;(this.deps as { projectionService?: AgentPublicProjectionService | null }).projectionService = service
  }

  async build(input: {
    room: Room
    agentId: string
    recentMessages: ChatMessage[]
  }): Promise<ChatroomRuntimeContextResult> {
    const { room, agentId, recentMessages } = input
    const program = await this.deps.watchabilityRepo.getProgram(room.id) ?? await this.deps.watchabilityRepo.ensureProgram(room)
    const snapshot = await this.deps.watchabilityRepo.getLiveSnapshot(room.id)
    const activeEpisode = await this.deps.watchabilityRepo.getActiveEpisode(room.id)
    const latestBeat = activeEpisode
      ? await this.deps.watchabilityRepo.getLatestBeat(activeEpisode.id)
      : null
    const latestEvent = await this.deps.watchabilityRepo.getLatestProgramEvent(room.id)
    const latestHighlight = await this.deps.watchabilityRepo.getLatestHighlight(room.id)
    const latestSharedMemory = await this.deps.watchabilityRepo.getLatestSharedMemory(room.id, 'CONTINUITY')
    const persistedCast = await this.deps.watchabilityRepo.getCurrentCast(room.id)
    const members = await this.deps.roomRepo.getMembers(room.id)
    const projections = this.deps.projectionService
      ? await this.deps.projectionService.getOrBuildMany(persistedCast.map((entry) => entry.agent_id))
      : new Map()
    const cast = persistedCast.map((entry) => ({
      agent_id: entry.agent_id,
      name: this.deps.agentRepo.findById(entry.agent_id)?.display_name ?? entry.agent_id,
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

    const recentAgentNames = new Map<string, string>()
    for (const message of recentMessages) {
      const agent = this.deps.agentRepo.findById(message.author_id)
      if (agent?.display_name) {
        recentAgentNames.set(message.author_id, agent.display_name)
      }
    }

    const recent = toNamedRecentMessages(recentMessages, recentAgentNames).flatMap((message) => {
      const body = sanitizePromptText(message.body)
      return body
        ? [{
            author_name: message.author_name,
            body,
            is_self: message.author_id === agentId,
            message_kind: message.message_kind,
          }]
        : []
    })

    const programReadModel = this.deps.roomProjector.toProgramReadModel(
      program,
      snapshot,
      activeEpisode,
    )
    const selfRole = this.deps.roomProjector.getSelfRole(cast, agentId)
    const selfMember = members.find((member) => member.member_id === agentId) ?? null
    const selfProjection = projections.get(agentId) ?? null
    const directorGoal =
      latestEvent?.director_goal
      ?? latestBeat?.director_goal
      ?? buildDirectorGoal(programReadModel, room, snapshot?.live_hook ?? null)

    const liveHook = sanitizePromptText(snapshot?.live_hook)
    const unresolvedQuestion = sanitizePromptText(snapshot?.unresolved_question)
    const sharedMemorySummary = sanitizePromptText(latestSharedMemory?.summary_text)
    const lastHighlight = sanitizePromptText(latestHighlight?.text ?? snapshot?.last_highlight_text)
    const signatureMoves = adaptProjectionSignatureMoves(selfProjection?.signature_moves_json)

    const chatContext: NonNullable<ExecutionContext['chatContext']> = {
      room_name: room.name,
      room_description: room.description,
      recent_messages: recent,
      program: programReadModel.enabled
        ? {
            scene_type: programReadModel.scene_type,
            episode_id: snapshot?.episode_id ?? '',
            current_beat: latestBeat?.beat_type ?? snapshot?.current_beat ?? null,
            cue_type: latestEvent?.cue_type ?? latestBeat?.cue_type ?? null,
            director_goal: directorGoal,
            self_role: selfRole,
            cast: cast.map((entry) => ({
              agent_id: entry.agent_id,
              agent_name: entry.name,
              role: entry.role,
              last_spoke_at: entry.last_spoke_at?.toISOString() ?? null,
            })),
            live_hook: liveHook,
            unresolved_question: unresolvedQuestion,
            public_projection_hint: selfProjection?.public_projection_hint ?? null,
            signature_moves: signatureMoves,
            shared_memory_summary: sharedMemorySummary,
            role_hint: selfMember?.role_hint ?? null,
            projection_updated_at: selfProjection?.updated_at.toISOString() ?? null,
          }
        : undefined,
    }

    return {
      chatContext,
      promptVariables: chatContext.program
        ? {
            program_scene: chatContext.program.scene_type,
            episode_id: chatContext.program.episode_id,
            current_beat: chatContext.program.current_beat ?? '',
            cue_type: chatContext.program.cue_type ?? '',
            director_goal: chatContext.program.director_goal,
            self_role: chatContext.program.self_role ?? '',
            cast_snapshot: stringifyCast(cast),
            live_hook: chatContext.program.live_hook ?? '',
            unresolved_question: chatContext.program.unresolved_question ?? '',
            last_highlight: lastHighlight ?? '',
            public_projection_hint: chatContext.program.public_projection_hint ?? '',
            signature_moves: chatContext.program.signature_moves.join('、'),
            shared_memory_summary: chatContext.program.shared_memory_summary ?? '',
            role_hint: chatContext.program.role_hint ?? '',
            projection_updated_at: chatContext.program.projection_updated_at ?? '',
          }
        : {
            program_scene: '',
            episode_id: '',
            current_beat: '',
            cue_type: '',
            director_goal: '',
            self_role: '',
            cast_snapshot: '',
            live_hook: '',
            unresolved_question: '',
            last_highlight: '',
            public_projection_hint: '',
            signature_moves: '',
            shared_memory_summary: '',
            role_hint: '',
            projection_updated_at: '',
          },
    }
  }
}
