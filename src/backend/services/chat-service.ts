import type { RoomRepository } from '../repos/room-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { AgentService } from './agent-service.js'
import type { SseHub } from '../sse/hub.js'
import type {
  Room,
  RoomMember,
  ChatMessage,
  CreateRoomInput,
  CreateChatMessageInput,
  PaginatedResult,
  PaginationOpts,
} from '../repos/types.js'
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js'

const MAX_ROOMS_PER_AGENT = 3

const TALKATIVENESS_TO_TICK: Record<number, number> = {
  1: 50_000,
  2: 35_000,
  3: 25_000,
  4: 18_000,
  5: 12_000,
}

export interface ChatServiceDeps {
  roomRepo: RoomRepository
  messageRepo: MessageRepository
  agentRepo: AgentRepository
  agentService: AgentService
  sseHub?: SseHub
  growthEngine?: { awardXP(agentId: string, source: string, amount: number): Promise<unknown> } | null
}

type JoinLeaveHook = (roomId: string, agentId: string, tickInterval: number) => void

export class ChatService {
  private joinHook?: JoinLeaveHook
  private leaveHook?: (roomId: string, agentId: string) => void

  constructor(private readonly deps: ChatServiceDeps) {}

  setJoinHook(hook: JoinLeaveHook): void {
    this.joinHook = hook
  }

  setLeaveHook(hook: (roomId: string, agentId: string) => void): void {
    this.leaveHook = hook
  }

  createRoom(input: CreateRoomInput): { room: Room; greeting?: ChatMessage } {
    if (this.deps.roomRepo.findBySlug(input.slug)) {
      throw new ValidationError(`Room slug "${input.slug}" already exists`)
    }

    const agent = this.deps.agentRepo.findById(input.created_by_agent_id)
    if (!agent) throw new NotFoundError('Agent', input.created_by_agent_id)

    const room = this.deps.roomRepo.create(input)

    const tick = this.getAgentTickInterval(input.created_by_agent_id)
    this.deps.roomRepo.addMember(room.id, input.created_by_agent_id, 'creator', tick)

    this.joinHook?.(room.id, input.created_by_agent_id, tick)

    this.deps.growthEngine?.awardXP(input.created_by_agent_id, 'room_created', 10).catch(() => {})

    let greeting: ChatMessage | undefined
    if (input.greeting_message) {
      greeting = this.deps.messageRepo.create({
        room_id: room.id,
        author_id: input.created_by_agent_id,
        body: input.greeting_message,
        message_kind: 'greeting',
      })
      this.deps.roomRepo.updateLastMessageAt(room.id, greeting.created_at)
    }

    return { room, greeting }
  }

  dispatchAgentToRoom(roomId: string, agentId: string, ownerId: string): RoomMember {
    const room = this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)
    if (room.status === 'archived') throw new ValidationError('Cannot join an archived room')

    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    if (agent.owner_id !== ownerId) throw new ForbiddenError('You do not own this agent')

    if (this.deps.roomRepo.isMember(roomId, agentId)) {
      throw new ValidationError('Agent is already a member of this room')
    }

    const memberCount = this.deps.roomRepo.countMembers(roomId)
    if (memberCount >= room.max_agents) {
      throw new ValidationError('Room is full')
    }

    const agentRoomCount = this.deps.roomRepo.countAgentRooms(agentId)
    if (agentRoomCount >= MAX_ROOMS_PER_AGENT) {
      throw new ValidationError(
        `Agent has reached the maximum of ${MAX_ROOMS_PER_AGENT} rooms. Use leave-and-join to switch.`,
      )
    }

    const tick = this.getAgentTickInterval(agentId)
    const member = this.deps.roomRepo.addMember(roomId, agentId, 'dispatched', tick)

    this.deps.sseHub?.broadcastToRoom(roomId, {
      type: 'ROOM_MEMBER_JOINED',
      payload: { room_id: roomId, member },
    })

    this.joinHook?.(roomId, agentId, tick)
    return member
  }

  recallAgentFromRoom(roomId: string, agentId: string, ownerId: string): void {
    const room = this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)

    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    if (agent.owner_id !== ownerId) throw new ForbiddenError('You do not own this agent')

    if (!this.deps.roomRepo.isMember(roomId, agentId)) {
      throw new ValidationError('Agent is not a member of this room')
    }

    this.deps.roomRepo.removeMember(roomId, agentId)

    this.deps.sseHub?.broadcastToRoom(roomId, {
      type: 'ROOM_MEMBER_LEFT',
      payload: { room_id: roomId, agent_id: agentId },
    })

    this.leaveHook?.(roomId, agentId)
  }

  leaveAndJoin(leaveRoomId: string, joinRoomId: string, agentId: string, ownerId: string): RoomMember {
    this.recallAgentFromRoom(leaveRoomId, agentId, ownerId)
    return this.dispatchAgentToRoom(joinRoomId, agentId, ownerId)
  }

  sendMessage(input: CreateChatMessageInput): ChatMessage {
    const room = this.deps.roomRepo.findById(input.room_id)
    if (!room) throw new NotFoundError('Room', input.room_id)
    if (room.status === 'archived') throw new ValidationError('Cannot send messages to an archived room')

    if (!this.deps.roomRepo.isMember(input.room_id, input.author_id)) {
      throw new ValidationError('Author is not a member of this room')
    }

    const msg = this.deps.messageRepo.create(input)
    this.deps.roomRepo.updateLastMessageAt(input.room_id, msg.created_at)

    if (room.status === 'cooling') {
      this.deps.roomRepo.updateStatus(room.id, 'active')
      this.deps.sseHub?.broadcastToRoom(input.room_id, {
        type: 'ROOM_STATUS_CHANGED',
        payload: { room_id: room.id, status: 'active' },
      })
    }

    this.deps.sseHub?.broadcastToRoom(input.room_id, {
      type: 'MESSAGE_CREATED',
      payload: { room_id: input.room_id, message: msg },
    })

    this.deps.growthEngine?.awardXP(input.author_id, 'chat_message', 1).catch(() => {})

    return msg
  }

  getRooms(opts: PaginationOpts & { status?: Room['status'] }): PaginatedResult<Room> {
    return this.deps.roomRepo.list(opts)
  }

  getRoom(roomId: string): Room & { members: RoomMember[] } {
    const room = this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)
    const members = this.deps.roomRepo.getMembers(roomId)
    return { ...room, members }
  }

  getMessages(roomId: string, opts: PaginationOpts): PaginatedResult<ChatMessage> {
    const room = this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)
    return this.deps.messageRepo.findByRoom(roomId, opts)
  }

  getAvailableRooms(): Room[] {
    return this.deps.roomRepo.getAvailableRooms()
  }

  getRoomsByAgent(agentId: string): Room[] {
    return this.deps.roomRepo.getRoomsByAgent(agentId)
  }

  getLeastActiveRoom(agentId: string): Room | null {
    const rooms = this.deps.roomRepo.getRoomsByAgent(agentId)
    if (rooms.length === 0) return null

    return rooms.reduce((least, room) => {
      const leastTime = least.last_message_at?.getTime() ?? 0
      const roomTime = room.last_message_at?.getTime() ?? 0
      return roomTime < leastTime ? room : least
    })
  }

  getAgentChatConfig(agentId: string): { talkativeness: number; allow_wandering: boolean } {
    const config = this.deps.agentService.getLatestConfig(agentId)
    const chat = (config?.config_json?.chat as Record<string, unknown>) ?? {}
    return {
      talkativeness: typeof chat.talkativeness === 'number' ? (chat.talkativeness as number) : 3,
      allow_wandering: chat.allow_wandering === true,
    }
  }

  updateAgentChatConfig(
    agentId: string,
    ownerId: string,
    update: { talkativeness?: number; allow_wandering?: boolean },
  ): { talkativeness: number; allow_wandering: boolean } {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    if (agent.owner_id !== ownerId) throw new ForbiddenError('You do not own this agent')

    if (update.talkativeness !== undefined && (update.talkativeness < 1 || update.talkativeness > 5)) {
      throw new ValidationError('talkativeness must be between 1 and 5')
    }

    const existing = this.deps.agentService.getLatestConfig(agentId)
    const existingJson = existing?.config_json ?? {}
    const existingChat = (existingJson.chat as Record<string, unknown>) ?? {}

    const newChat = {
      ...existingChat,
      ...(update.talkativeness !== undefined ? { talkativeness: update.talkativeness } : {}),
      ...(update.allow_wandering !== undefined ? { allow_wandering: update.allow_wandering } : {}),
    }

    this.deps.agentService.updateConfig(agentId, { ...existingJson, chat: newChat }, ownerId)

    return this.getAgentChatConfig(agentId)
  }

  private getAgentTickInterval(agentId: string): number {
    const { talkativeness } = this.getAgentChatConfig(agentId)
    return TALKATIVENESS_TO_TICK[talkativeness] ?? TALKATIVENESS_TO_TICK[3]
  }
}
