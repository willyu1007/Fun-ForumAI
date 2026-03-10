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
import { RoomProjector } from './room-projector.js'
import { toNamedRecentMessages } from './chatroom-watchability-heuristics.js'

export interface ChatroomRuntimeContextBuilderDeps {
  roomRepo: RoomRepository
  agentRepo: AgentRepository
  watchabilityRepo: RoomWatchabilityRepository
  roomProjector: RoomProjector
}

export interface ChatroomRuntimeContextResult {
  chatContext: NonNullable<ExecutionContext['chatContext']>
  promptVariables: Record<string, string>
}

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

export class ChatroomRuntimeContextBuilder {
  constructor(private readonly deps: ChatroomRuntimeContextBuilderDeps) {}

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
    const persistedCast = await this.deps.watchabilityRepo.getCurrentCast(room.id)
    const members = await this.deps.roomRepo.getMembers(room.id)
    const cast = persistedCast.map((entry) => ({
      agent_id: entry.agent_id,
      name: this.deps.agentRepo.findById(entry.agent_id)?.display_name ?? entry.agent_id,
      role: entry.role,
      chemistry_score: entry.chemistry_score,
      spotlight_weight: entry.spotlight_weight,
      last_spoke_at: members.find((member) => member.member_id === entry.agent_id)?.last_spoke_at ?? null,
    }))

    const recentAgentNames = new Map<string, string>()
    for (const message of recentMessages) {
      const agent = this.deps.agentRepo.findById(message.author_id)
      if (agent?.display_name) {
        recentAgentNames.set(message.author_id, agent.display_name)
      }
    }

    const recent = toNamedRecentMessages(recentMessages, recentAgentNames).map((message) => ({
      author_name: message.author_name,
      body: message.body,
      is_self: message.author_id === agentId,
      message_kind: message.message_kind,
    }))

    const programReadModel = this.deps.roomProjector.toProgramReadModel(
      program,
      snapshot,
      activeEpisode,
    )
    const selfRole = this.deps.roomProjector.getSelfRole(cast, agentId)
    const directorGoal =
      latestEvent?.director_goal
      ?? latestBeat?.director_goal
      ?? buildDirectorGoal(programReadModel, room, snapshot?.live_hook ?? null)

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
            live_hook: snapshot?.live_hook ?? null,
            unresolved_question: snapshot?.unresolved_question ?? null,
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
            last_highlight: latestHighlight?.text ?? snapshot?.last_highlight_text ?? '',
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
          },
    }
  }
}
