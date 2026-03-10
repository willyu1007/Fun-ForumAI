import type { RoomRepository } from '../repos/room-repository.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type { SseHub } from '../sse/hub.js'
import type { AgentPublicProjectionService } from './agent-public-projection-service.js'
import { normalizeWanderPolicy } from './chatroom-program-policy.js'
import type { ChatService } from './chat-service.js'
import type { RoomDiscoveryService } from './room-discovery-service.js'

export interface RoomEcologyServiceDeps {
  roomRepo: RoomRepository
  watchabilityRepo: RoomWatchabilityRepository
  projectionService: AgentPublicProjectionService
  discoveryService: RoomDiscoveryService
  chatService: ChatService
  sseHub?: SseHub | null
}

export class RoomEcologyService {
  private readonly lastMoveAt = new Map<string, number>()

  constructor(private readonly deps: RoomEcologyServiceDeps) {}

  async maybeWander(roomId: string, agentId: string): Promise<boolean> {
    const [room, member, program] = await Promise.all([
      this.deps.roomRepo.findById(roomId),
      this.deps.roomRepo.getMember(roomId, agentId),
      this.deps.watchabilityRepo.getProgram(roomId),
    ])
    if (!room || !member || !program) return false

    const agentChatConfig = this.deps.chatService.getAgentChatConfig(agentId)
    const policy = normalizeWanderPolicy(program.wander_policy_json)
    if (!agentChatConfig.allow_wandering || !program.allow_wandering || !policy.enabled) {
      return false
    }
    if (member.wander_eligible === false) return false
    if (member.suppressed_until && member.suppressed_until.getTime() > Date.now()) return false

    const moveKey = `${agentId}:${roomId}`
    const lastMoveAt = this.lastMoveAt.get(moveKey) ?? 0
    if (Date.now() - lastMoveAt < policy.entry_cooldown_ms) return false

    const currentRooms = await this.deps.roomRepo.countAgentRooms(agentId)
    if (currentRooms > policy.max_parallel_rooms) return false

    const projection = await this.deps.projectionService.getOrBuild(agentId)
    const ranked = await this.deps.discoveryService.rankRoomsForAgent({
      agentId,
      currentRoomId: roomId,
      projection,
    })
    const target = ranked[0]
    if (!target || target.score < policy.min_discoverability_score) return false

    try {
      await this.deps.chatService.moveAgentByEcology(roomId, target.room.id, agentId)
    } catch (error) {
      console.error('[RoomEcologyService] wandering move failed:', error)
      return false
    }
    this.lastMoveAt.set(`${agentId}:${target.room.id}`, Date.now())
    this.lastMoveAt.set(moveKey, Date.now())

    this.deps.sseHub?.broadcastToRoom(roomId, {
      type: 'ROOM_CONTROL_STATE_UPDATED',
      payload: {
        room_id: roomId,
        reason: 'wandering_leave',
        emitted_at: new Date().toISOString(),
      },
    })
    this.deps.sseHub?.broadcastToRoom(target.room.id, {
      type: 'ROOM_CONTROL_STATE_UPDATED',
      payload: {
        room_id: target.room.id,
        reason: 'wandering_join',
        emitted_at: new Date().toISOString(),
      },
    })

    return true
  }
}
