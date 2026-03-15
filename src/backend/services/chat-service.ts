import type {
  ChatMessage,
  CreateChatMessageInput,
  CreateRoomInput,
  PaginatedResult,
  PaginationOpts,
  Room,
  RoomHighlight,
  RoomLiveSnapshot,
  RoomMember,
  RoomProgramReadModel,
  RoomWatchabilitySummary,
} from '../repos/types.js'
import type { NurtureOrchestrator } from './nurture-orchestrator.js'
import type { PublicObservationDigestService } from './public-observation-digest-service.js'
import type { RelationService } from './relation-service.js'
import type { RoomProgramProjector } from './room-program-projector.js'
import type { RoomProjector } from './room-projector.js'
import {
  createRoom,
  dispatchAgentToRoom,
  leaveAndJoin,
  moveAgentByEcology,
  recallAgentFromRoom,
} from './chat-service/membership.js'
import {
  getAgentChatConfig,
  getAgentChatConfigPersisted,
  getAvailableRooms,
  getLeastActiveRoom,
  getMessages,
  getRoom,
  getRoomCast,
  getRoomHighlights,
  getRoomLiveSnapshot,
  getRoomProgram,
  getRooms,
  getRoomsByAgent,
  getRoomsWithWatchability,
  updateAgentChatConfig,
} from './chat-service/read-model.js'
import { sendMessage } from './chat-service/message-pipeline.js'
import type { ChatServiceDeps, JoinLeaveHook } from './chat-service/types.js'

export type { ChatServiceDeps } from './chat-service/types.js'

export class ChatService {
  private joinHook?: JoinLeaveHook
  private leaveHook?: (roomId: string, agentId: string) => void
  private roomProjector: RoomProjector | null = null
  private roomProgramProjector: RoomProgramProjector | null = null

  constructor(private readonly deps: ChatServiceDeps) {}

  setJoinHook(hook: JoinLeaveHook): void {
    this.joinHook = hook
  }

  setLeaveHook(hook: (roomId: string, agentId: string) => void): void {
    this.leaveHook = hook
  }

  setRoomProjector(projector: RoomProjector | null): void {
    this.roomProjector = projector
  }

  setRoomProgramProjector(projector: RoomProgramProjector | null): void {
    this.roomProgramProjector = projector
  }

  setXpService(engine: ChatServiceDeps['xpService']): void {
    ;(this.deps as { xpService: ChatServiceDeps['xpService'] }).xpService = engine
  }

  setNurtureOrchestrator(orchestrator: NurtureOrchestrator | null): void {
    ;(this.deps as { nurtureOrchestrator: NurtureOrchestrator | null }).nurtureOrchestrator =
      orchestrator
  }

  setPublicObservationService(service: PublicObservationDigestService | null): void {
    ;(this.deps as {
      publicObservationService: PublicObservationDigestService | null
    }).publicObservationService = service
  }

  setRelationService(service: RelationService | null): void {
    ;(this.deps as { relationService: RelationService | null }).relationService = service
  }

  private getContext() {
    return {
      deps: this.deps,
      joinHook: this.joinHook,
      leaveHook: this.leaveHook,
      roomProjector: this.roomProjector,
      roomProgramProjector: this.roomProgramProjector,
    }
  }

  async createRoom(input: CreateRoomInput): Promise<{ room: Room; greeting?: ChatMessage }> {
    return createRoom(this.getContext(), input)
  }

  async dispatchAgentToRoom(
    roomId: string,
    agentId: string,
    ownerId: string,
  ): Promise<RoomMember> {
    return dispatchAgentToRoom(this.getContext(), roomId, agentId, ownerId)
  }

  async moveAgentByEcology(
    leaveRoomId: string,
    joinRoomId: string,
    agentId: string,
  ): Promise<RoomMember> {
    return moveAgentByEcology(this.getContext(), leaveRoomId, joinRoomId, agentId)
  }

  async recallAgentFromRoom(roomId: string, agentId: string, ownerId: string): Promise<void> {
    return recallAgentFromRoom(this.getContext(), roomId, agentId, ownerId)
  }

  async leaveAndJoin(
    leaveRoomId: string,
    joinRoomId: string,
    agentId: string,
    ownerId: string,
  ): Promise<RoomMember> {
    return leaveAndJoin(this.getContext(), leaveRoomId, joinRoomId, agentId, ownerId)
  }

  async sendMessage(input: CreateChatMessageInput): Promise<ChatMessage> {
    return sendMessage(this.getContext(), input)
  }

  async getRooms(opts: PaginationOpts & { status?: Room['status'] }): Promise<PaginatedResult<Room>> {
    return getRooms(this.getContext(), opts)
  }

  async getRoomsWithWatchability(
    opts: PaginationOpts & { status?: Room['status'] },
  ): Promise<PaginatedResult<Room & { watchability: RoomWatchabilitySummary | null }>> {
    return getRoomsWithWatchability(this.getContext(), opts)
  }

  async getRoom(roomId: string): Promise<Room & { members: RoomMember[] }> {
    return getRoom(this.getContext(), roomId)
  }

  async getRoomLiveSnapshot(roomId: string): Promise<RoomLiveSnapshot> {
    return getRoomLiveSnapshot(this.getContext(), roomId)
  }

  async getRoomCast(
    roomId: string,
  ): Promise<{ room_id: string; episode_id: string | null; cast: import('../repos/types.js').RoomCastMemberView[] }> {
    return getRoomCast(this.getContext(), roomId)
  }

  async getRoomProgram(roomId: string): Promise<RoomProgramReadModel> {
    return getRoomProgram(this.getContext(), roomId)
  }

  async getRoomHighlights(
    roomId: string,
    opts: PaginationOpts & { episode_id?: string | null },
  ): Promise<PaginatedResult<RoomHighlight>> {
    return getRoomHighlights(this.getContext(), roomId, opts)
  }

  async getMessages(roomId: string, opts: PaginationOpts): Promise<PaginatedResult<ChatMessage>> {
    return getMessages(this.getContext(), roomId, opts)
  }

  async getAvailableRooms(): Promise<Room[]> {
    return getAvailableRooms(this.getContext())
  }

  async getRoomsByAgent(agentId: string): Promise<Room[]> {
    return getRoomsByAgent(this.getContext(), agentId)
  }

  async getLeastActiveRoom(agentId: string): Promise<Room | null> {
    return getLeastActiveRoom(this.getContext(), agentId)
  }

  getAgentChatConfig(agentId: string): {
    talkativeness: number
    allow_wandering: boolean
  } {
    return getAgentChatConfig(this.getContext(), agentId)
  }

  async getAgentChatConfigPersisted(
    agentId: string,
  ): Promise<{ talkativeness: number; allow_wandering: boolean }> {
    return getAgentChatConfigPersisted(this.getContext(), agentId)
  }

  async updateAgentChatConfig(
    agentId: string,
    ownerId: string,
    update: { talkativeness?: number; allow_wandering?: boolean },
  ): Promise<{ talkativeness: number; allow_wandering: boolean }> {
    return updateAgentChatConfig(this.getContext(), agentId, ownerId, update)
  }
}
