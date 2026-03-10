import type { AgentRepository } from '../repos/agent-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type {
  ChatMessage,
  Room,
  RoomCastMemberView,
  RoomEpisode,
  RoomEpisodeBeat,
  RoomHighlight,
  RoomLiveSnapshot,
  RoomMember,
  RoomProgram,
  RoomProgramEvent,
} from '../repos/types.js'

const DEFAULT_RECENT_MESSAGE_LIMIT = 12

export interface LoadedRoomProgramState {
  room: Room
  program: RoomProgram
  episode: RoomEpisode | null
  snapshot: RoomLiveSnapshot | null
  cast: RoomCastMemberView[]
  members: RoomMember[]
  recentMessages: ChatMessage[]
  latestBeat: RoomEpisodeBeat | null
  latestEvent: RoomProgramEvent | null
  latestHighlight: RoomHighlight | null
  lastMessage: ChatMessage | null
}

export interface RoomProgramStateLoaderDeps {
  roomRepo: RoomRepository
  messageRepo: MessageRepository
  agentRepo: AgentRepository
  watchabilityRepo: RoomWatchabilityRepository
}

export class RoomProgramStateLoader {
  constructor(private readonly deps: RoomProgramStateLoaderDeps) {}

  async load(roomId: string, recentMessageLimit = DEFAULT_RECENT_MESSAGE_LIMIT): Promise<LoadedRoomProgramState | null> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) return null

    const program =
      await this.deps.watchabilityRepo.getProgram(roomId)
      ?? await this.deps.watchabilityRepo.ensureProgram(room)
    const episode = await this.deps.watchabilityRepo.getActiveEpisode(roomId)
    const snapshot = await this.deps.watchabilityRepo.getLiveSnapshot(roomId)
    const members = await this.deps.roomRepo.getMembers(roomId)
    const persistedCast = await this.deps.watchabilityRepo.getCurrentCast(roomId)
    const recentMessages = await this.deps.messageRepo.getLatestMessages(roomId, recentMessageLimit)
    const latestBeat = episode
      ? await this.deps.watchabilityRepo.getLatestBeat(episode.id)
      : null
    const latestEvent = await this.deps.watchabilityRepo.getLatestProgramEvent(roomId)
    const latestHighlight = await this.deps.watchabilityRepo.getLatestHighlight(roomId)

    const cast: RoomCastMemberView[] = persistedCast.map((entry) => ({
      agent_id: entry.agent_id,
      name: this.deps.agentRepo.findById(entry.agent_id)?.display_name ?? entry.agent_id,
      role: entry.role,
      chemistry_score: entry.chemistry_score,
      spotlight_weight: entry.spotlight_weight,
      last_spoke_at: members.find((member) => member.member_id === entry.agent_id)?.last_spoke_at ?? null,
    }))

    return {
      room,
      program,
      episode,
      snapshot,
      cast,
      members,
      recentMessages,
      latestBeat,
      latestEvent,
      latestHighlight,
      lastMessage: recentMessages[recentMessages.length - 1] ?? null,
    }
  }
}
