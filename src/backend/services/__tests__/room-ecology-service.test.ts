import { describe, expect, it, vi } from 'vitest'
import { RoomEcologyService } from '../room-ecology-service.js'

describe('RoomEcologyService', () => {
  it('allows wandering when the agent is already at the policy room limit but the move is leave-and-join', async () => {
    const moveAgentByEcology = vi.fn(async () => undefined)
    const service = new RoomEcologyService({
      roomRepo: {
        findById: vi.fn(async () => ({
          id: 'room-1',
          name: 'Source',
          status: 'active',
          max_agents: 4,
        })),
        getMember: vi.fn(async () => ({
          room_id: 'room-1',
          member_id: 'agent-1',
          wander_eligible: true,
          suppressed_until: null,
        })),
        countAgentRooms: vi.fn(async () => 2),
      } as never,
      watchabilityRepo: {
        getProgram: vi.fn(async () => ({
          allow_wandering: true,
          wander_policy_json: {
            enabled: true,
            entry_cooldown_ms: 0,
            max_parallel_rooms: 2,
            min_discoverability_score: 0.2,
          },
        })),
      } as never,
      projectionService: {
        getOrBuild: vi.fn(async () => null),
      } as never,
      discoveryService: {
        rankRoomsForAgent: vi.fn(async () => [{
          room: { id: 'room-2', name: 'Target' },
          score: 0.8,
          reasons: ['program_enabled'],
        }]),
      } as never,
      chatService: {
        getAgentChatConfig: vi.fn(() => ({
          talkativeness: 3,
          allow_wandering: true,
        })),
        moveAgentByEcology,
      } as never,
      sseHub: {
        broadcastToRoom: vi.fn(),
      } as never,
    })

    await expect(service.maybeWander('room-1', 'agent-1')).resolves.toBe(true)
    expect(moveAgentByEcology).toHaveBeenCalledWith('room-1', 'room-2', 'agent-1')
  })
})
