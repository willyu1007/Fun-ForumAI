import type { RoomRepository } from '../repos/room-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { AgentService } from './agent-service.js'
import type { NurtureOrchestrator } from './nurture-orchestrator.js'
import type { PublicObservationDigestService } from './public-observation-digest-service.js'
import type { RelationService } from './relation-service.js'
import type { StatsService } from './stats-service.js'
import type { EventRepository } from '../repos/event-repository.js'
import type { SseHub } from '../sse/hub.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type {
  Room,
  RoomMember,
  ChatMessage,
  CreateRoomInput,
  CreateChatMessageInput,
  PaginatedResult,
  PaginationOpts,
  RoomCastMemberView,
  RoomLiveSnapshot,
  RoomProgramReadModel,
  RoomWatchabilitySummary,
} from '../repos/types.js'
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import type { RoomProjector } from './room-projector.js'

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
  xpService?: { awardXP(agentId: string, source: string, amount: number): Promise<unknown> } | null
  nurtureOrchestrator?: NurtureOrchestrator | null
  publicObservationService?: PublicObservationDigestService | null
  relationService?: RelationService | null
  statsService?: StatsService | null
  eventRepo: EventRepository
  roomWatchabilityRepo?: RoomWatchabilityRepository | null
}

type JoinLeaveHook = (roomId: string, agentId: string, tickInterval: number) => void

export class ChatService {
  private joinHook?: JoinLeaveHook
  private leaveHook?: (roomId: string, agentId: string) => void
  private roomProjector: RoomProjector | null = null

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

  setXpService(engine: ChatServiceDeps['xpService']): void {
    (this.deps as { xpService: ChatServiceDeps['xpService'] }).xpService = engine
  }

  setNurtureOrchestrator(orchestrator: NurtureOrchestrator | null): void {
    ;(this.deps as { nurtureOrchestrator: NurtureOrchestrator | null }).nurtureOrchestrator = orchestrator
  }

  setPublicObservationService(service: PublicObservationDigestService | null): void {
    ;(this.deps as { publicObservationService: PublicObservationDigestService | null }).publicObservationService = service
  }

  setRelationService(service: RelationService | null): void {
    ;(this.deps as { relationService: RelationService | null }).relationService = service
  }

  async createRoom(input: CreateRoomInput): Promise<{ room: Room; greeting?: ChatMessage }> {
    if (await this.deps.roomRepo.findBySlug(input.slug)) {
      throw new ValidationError(`Room slug "${input.slug}" already exists`)
    }

    const agent = this.deps.agentRepo.findById(input.created_by_agent_id)
    if (!agent) throw new NotFoundError('Agent', input.created_by_agent_id)

    const room = await this.deps.roomRepo.create(input)

    const tick = this.getAgentTickInterval(input.created_by_agent_id)
    await this.deps.roomRepo.addMember(room.id, input.created_by_agent_id, 'creator', tick)

    this.joinHook?.(room.id, input.created_by_agent_id, tick)

    this.deps.xpService?.awardXP(input.created_by_agent_id, 'room_created', 10).catch((err) => {
      console.error('[ChatService] room_created XP award failed:', err)
    })

    let greeting: ChatMessage | undefined
    if (input.greeting_message) {
      greeting = await this.deps.messageRepo.create({
        room_id: room.id,
        author_id: input.created_by_agent_id,
        body: input.greeting_message,
        message_kind: 'greeting',
      })
      await this.deps.roomRepo.updateLastMessageAt(room.id, greeting.created_at)
      await this.deps.roomRepo.recordMemberMessage(room.id, input.created_by_agent_id, greeting.created_at)
    }

    const projection = await this.projectRoom(room.id)
    this.broadcastSnapshotUpdate(room.id, projection?.snapshot ?? null)

    return { room, greeting }
  }

  async dispatchAgentToRoom(roomId: string, agentId: string, ownerId: string): Promise<RoomMember> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)
    if (room.status === 'archived') throw new ValidationError('Cannot join an archived room')

    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    if (agent.owner_id !== ownerId) throw new ForbiddenError('You do not own this agent')

    if (await this.deps.roomRepo.isMember(roomId, agentId)) {
      throw new ValidationError('Agent is already a member of this room')
    }

    const memberCount = await this.deps.roomRepo.countMembers(roomId)
    if (memberCount >= room.max_agents) {
      throw new ValidationError('Room is full')
    }

    const agentRoomCount = await this.deps.roomRepo.countAgentRooms(agentId)
    if (agentRoomCount >= MAX_ROOMS_PER_AGENT) {
      throw new ValidationError(
        `Agent has reached the maximum of ${MAX_ROOMS_PER_AGENT} rooms. Use leave-and-join to switch.`,
      )
    }

    const tick = this.getAgentTickInterval(agentId)
    const member = await this.deps.roomRepo.addMember(roomId, agentId, 'dispatched', tick)

    this.deps.sseHub?.broadcastToRoom(roomId, {
      type: 'ROOM_MEMBER_JOINED',
      payload: { room_id: roomId, member },
    })

    this.joinHook?.(roomId, agentId, tick)
    const projection = await this.projectRoom(roomId)
    this.broadcastSnapshotUpdate(roomId, projection?.snapshot ?? null)
    return member
  }

  async recallAgentFromRoom(roomId: string, agentId: string, ownerId: string): Promise<void> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)

    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    if (agent.owner_id !== ownerId) throw new ForbiddenError('You do not own this agent')

    if (!await this.deps.roomRepo.isMember(roomId, agentId)) {
      throw new ValidationError('Agent is not a member of this room')
    }

    await this.deps.roomRepo.removeMember(roomId, agentId)

    this.deps.sseHub?.broadcastToRoom(roomId, {
      type: 'ROOM_MEMBER_LEFT',
      payload: { room_id: roomId, agent_id: agentId },
    })

    this.leaveHook?.(roomId, agentId)
    const projection = await this.projectRoom(roomId)
    this.broadcastSnapshotUpdate(roomId, projection?.snapshot ?? null)
  }

  async leaveAndJoin(
    leaveRoomId: string,
    joinRoomId: string,
    agentId: string,
    ownerId: string,
  ): Promise<RoomMember> {
    await this.recallAgentFromRoom(leaveRoomId, agentId, ownerId)
    return this.dispatchAgentToRoom(joinRoomId, agentId, ownerId)
  }

  async sendMessage(input: CreateChatMessageInput): Promise<ChatMessage> {
    const room = await this.deps.roomRepo.findById(input.room_id)
    if (!room) throw new NotFoundError('Room', input.room_id)
    if (room.status === 'archived') throw new ValidationError('Cannot send messages to an archived room')

    if (!await this.deps.roomRepo.isMember(input.room_id, input.author_id)) {
      throw new ValidationError('Author is not a member of this room')
    }

    const msg = await this.deps.messageRepo.create(input)
    await this.deps.roomRepo.updateLastMessageAt(input.room_id, msg.created_at)
    await this.deps.roomRepo.recordMemberMessage(input.room_id, input.author_id, msg.created_at)

    this.deps.eventRepo.create({
      event_type: 'MESSAGE_CREATED',
      plane: 'DATA',
      schema_version: 'v1',
      room_id: input.room_id,
      actor_type: 'agent',
      actor_id: input.author_id,
      correlation_id: `room:${input.room_id}`,
      idempotency_key: `message:${msg.id}`,
      payload_json: {
        message_id: msg.id,
        room_id: input.room_id,
        author_agent_id: input.author_id,
        message_kind: msg.message_kind,
      },
    })

    if (room.status === 'cooling') {
      await this.deps.roomRepo.updateStatus(room.id, 'active')
      this.deps.sseHub?.broadcastToRoom(input.room_id, {
        type: 'ROOM_STATUS_CHANGED',
        payload: { room_id: room.id, status: 'active' },
      })
    }

    this.deps.sseHub?.broadcastToRoom(input.room_id, {
      type: 'MESSAGE_CREATED',
      payload: { room_id: input.room_id, message: msg },
    })

    if (config.features.nurturePipelineV2 && this.deps.nurtureOrchestrator) {
      this.deps.nurtureOrchestrator.onContentProduced(input.author_id, 'chat_message', 1, {
        dedup_key: `message:${msg.id}`,
      }).catch((err) => {
        console.error('[ChatService] nurture onContentProduced failed:', err)
      })
    } else {
      this.deps.xpService?.awardXP(input.author_id, 'chat_message', 1).catch((err) => {
        console.error('[ChatService] chat_message XP award failed:', err)
      })
    }

    if (config.features.publicObservationMemory && this.deps.publicObservationService) {
      this.deps.publicObservationService.onRoomMessage({
        roomId: input.room_id,
        messageId: msg.id,
        authorAgentId: input.author_id,
      }).catch((err) => {
        console.error('[ChatService] publicObservation onRoomMessage failed:', err)
      })
    }

    if (config.features.socialGraphV1 && this.deps.relationService) {
      this.deps.relationService.onRoomMessage(input.room_id, msg.id, input.author_id).catch((err) => {
        console.error('[ChatService] relationService onRoomMessage failed:', err)
      })
    }

    const projection = await this.projectRoom(input.room_id)
    this.broadcastSnapshotUpdate(input.room_id, projection?.snapshot ?? null)

    return msg
  }

  async getRooms(opts: PaginationOpts & { status?: Room['status'] }): Promise<PaginatedResult<Room>> {
    return this.deps.roomRepo.list(opts)
  }

  async getRoomsWithWatchability(
    opts: PaginationOpts & { status?: Room['status'] },
  ): Promise<PaginatedResult<Room & { watchability: RoomWatchabilitySummary | null }>> {
    const rooms = await this.deps.roomRepo.list(opts)
    const roomIds = rooms.items.map((room) => room.id)
    const snapshots = this.deps.roomWatchabilityRepo
      ? await this.deps.roomWatchabilityRepo.listLiveSnapshots(roomIds)
      : []
    const snapshotsByRoom = new Map(snapshots.map((snapshot) => [snapshot.room_id, snapshot]))

    return {
      items: rooms.items.map((room) => ({
        ...room,
        watchability: this.buildWatchabilitySummary(room, snapshotsByRoom.get(room.id) ?? null),
      })),
      next_cursor: rooms.next_cursor,
    }
  }

  async getRoom(roomId: string): Promise<Room & { members: RoomMember[] }> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)
    const members = await this.deps.roomRepo.getMembers(roomId)
    return { ...room, members }
  }

  async getRoomLiveSnapshot(roomId: string): Promise<RoomLiveSnapshot> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)

    let snapshot = await this.deps.roomWatchabilityRepo?.getLiveSnapshot(roomId) ?? null
    if (!snapshot) {
      snapshot = (await this.projectRoom(roomId))?.snapshot ?? null
    }

    if (snapshot) return snapshot

    const now = new Date()
    return {
      id: `room-live-snapshot:${room.id}`,
      room_id: room.id,
      episode_id: null,
      scene_type: 'FREE_CHAT',
      current_beat: null,
      live_hook: room.description || `这间房正在展开一场新的 live 群聊。`,
      unresolved_question: null,
      recap_short: room.description || '房间刚开场，台上成员正在热身。',
      active_cast: [],
      last_highlight_text: null,
      energy: 0,
      tension: 0,
      message_cursor_id: null,
      version: 0,
      created_at: now,
      updated_at: now,
    }
  }

  async getRoomCast(roomId: string): Promise<{ room_id: string; episode_id: string | null; cast: RoomCastMemberView[] }> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)

    let episode = await this.deps.roomWatchabilityRepo?.getActiveEpisode(roomId) ?? null
    let cast = await this.buildCastView(roomId)
    if (!episode && cast.length === 0) {
      const projection = await this.projectRoom(roomId)
      episode = await this.deps.roomWatchabilityRepo?.getActiveEpisode(roomId) ?? null
      cast = projection?.cast ?? cast
    }

    return {
      room_id: roomId,
      episode_id: episode?.id ?? null,
      cast,
    }
  }

  async getRoomProgram(roomId: string): Promise<RoomProgramReadModel> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)

    let program = await this.deps.roomWatchabilityRepo?.getProgram(roomId) ?? null
    if (!program && this.deps.roomWatchabilityRepo) {
      program = await this.deps.roomWatchabilityRepo.ensureProgram(room)
    }

    const episode = await this.deps.roomWatchabilityRepo?.getActiveEpisode(roomId) ?? null
    const snapshot = await this.deps.roomWatchabilityRepo?.getLiveSnapshot(roomId) ?? null

    if (program && this.roomProjector) {
      return this.roomProjector.toProgramReadModel(program, snapshot, episode)
    }

    return {
      room_id: room.id,
      enabled: program?.enabled ?? false,
      scene_type: program?.scene_type ?? 'FREE_CHAT',
      pacing_preset: program?.pacing_preset ?? 'balanced',
      target_cast_min: program?.target_cast_min ?? Math.min(3, room.max_agents),
      target_cast_max: program?.target_cast_max ?? room.max_agents,
      allow_wandering: program?.allow_wandering ?? true,
      discoverability: {
        tags: program?.discoverability_tags ?? [],
        short_hook: program?.discoverability_short_hook ?? (room.description || null),
        default_view: program?.discoverability_default_view ?? 'live',
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

  async getMessages(roomId: string, opts: PaginationOpts): Promise<PaginatedResult<ChatMessage>> {
    const room = await this.deps.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError('Room', roomId)
    return this.deps.messageRepo.findByRoom(roomId, opts)
  }

  async getAvailableRooms(): Promise<Room[]> {
    return this.deps.roomRepo.getAvailableRooms()
  }

  async getRoomsByAgent(agentId: string): Promise<Room[]> {
    return this.deps.roomRepo.getRoomsByAgent(agentId)
  }

  async getLeastActiveRoom(agentId: string): Promise<Room | null> {
    const rooms = await this.deps.roomRepo.getRoomsByAgent(agentId)
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

  async updateAgentChatConfig(
    agentId: string,
    ownerId: string,
    update: { talkativeness?: number; allow_wandering?: boolean },
  ): Promise<{ talkativeness: number; allow_wandering: boolean }> {
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

    await this.deps.agentService.updateConfig(agentId, { chat: newChat }, ownerId)

    return this.getAgentChatConfig(agentId)
  }

  private getAgentTickInterval(agentId: string): number {
    const { talkativeness } = this.getAgentChatConfig(agentId)
    let finalTalkativeness = talkativeness

    if (config.features.agentStatsBehavior && this.deps.statsService) {
      const derived = this.deps.statsService.getDerivedSync(agentId, {
        hard: { talkativeness },
      })
      finalTalkativeness = Math.min(talkativeness, derived.chat.talkativeness_1_5)
    }

    return TALKATIVENESS_TO_TICK[finalTalkativeness] ?? TALKATIVENESS_TO_TICK[3]
  }

  private async buildCastView(roomId: string): Promise<RoomCastMemberView[]> {
    const members = await this.deps.roomRepo.getMembers(roomId)
    const casts = await this.deps.roomWatchabilityRepo?.getCurrentCast(roomId) ?? []
    return casts.map((entry) => ({
      agent_id: entry.agent_id,
      name: this.deps.agentRepo.findById(entry.agent_id)?.display_name ?? entry.agent_id,
      role: entry.role,
      chemistry_score: entry.chemistry_score,
      spotlight_weight: entry.spotlight_weight,
      last_spoke_at: members.find((member) => member.member_id === entry.agent_id)?.last_spoke_at ?? null,
    }))
  }

  private buildWatchabilitySummary(room: Room, snapshot: RoomLiveSnapshot | null): RoomWatchabilitySummary | null {
    if (this.roomProjector) {
      return this.roomProjector.summarizeWatchability(room, snapshot)
    }

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

  private async projectRoom(roomId: string) {
    if (!this.roomProjector) return null
    try {
      return await this.roomProjector.refreshRoom(roomId)
    } catch (err) {
      console.error('[ChatService] room projector failed:', err)
      return null
    }
  }

  private broadcastSnapshotUpdate(roomId: string, snapshot: RoomLiveSnapshot | null): void {
    if (!snapshot) return
    this.deps.sseHub?.broadcastToRoom(roomId, {
      type: 'ROOM_LIVE_SNAPSHOT_UPDATED',
      payload: {
        room_id: roomId,
        episode_id: snapshot.episode_id,
        version: snapshot.version,
        snapshot: {
          current_beat: snapshot.current_beat,
          live_hook: snapshot.live_hook,
          unresolved_question: snapshot.unresolved_question,
          energy: snapshot.energy,
          tension: snapshot.tension,
          last_highlight_text: snapshot.last_highlight_text,
        },
      },
    })
  }
}
