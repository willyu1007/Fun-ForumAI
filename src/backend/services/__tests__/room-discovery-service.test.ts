import { describe, expect, it, vi } from 'vitest'
import { RoomDiscoveryService } from '../room-discovery-service.js'

describe('RoomDiscoveryService', () => {
  it('ranks rooms using batched program and snapshot data without per-room membership probes', async () => {
    const service = new RoomDiscoveryService({
      roomRepo: {
        getAvailableRooms: vi.fn(async () => [
          {
            id: 'room-1',
            name: 'Current',
            status: 'active',
            max_agents: 4,
            last_message_at: new Date('2026-03-10T10:00:00.000Z'),
          },
          {
            id: 'room-2',
            name: 'Debate',
            status: 'active',
            max_agents: 4,
            last_message_at: new Date('2026-03-10T10:05:00.000Z'),
          },
          {
            id: 'room-3',
            name: 'Quiet',
            status: 'active',
            max_agents: 4,
            last_message_at: null,
          },
        ]),
        getRoomsByAgent: vi.fn(async () => [{
          id: 'room-1',
        }]),
      } as never,
      watchabilityRepo: {
        listPrograms: vi.fn(async () => [
          { room_id: 'room-2', enabled: true, scene_type: 'DEBATE' },
          { room_id: 'room-3', enabled: false, scene_type: 'FREE_CHAT' },
        ]),
        listLiveSnapshots: vi.fn(async () => [{
          room_id: 'room-2',
          last_highlight_text: '刚刚有人把悬念点燃了。',
        }]),
      } as never,
    })

    const ranked = await service.rankRoomsForAgent({
      agentId: 'agent-1',
      currentRoomId: 'room-1',
      projection: {
        scene_affinity_json: {
          FREE_CHAT: 0.2,
          DEBATE: 0.9,
        },
      } as never,
    })

    expect(ranked.map((item) => item.room.id)).toEqual(['room-2', 'room-3'])
    expect(ranked[0]?.reasons).toContain('scene_affinity')
    expect(ranked[0]?.reasons).toContain('has_highlight')
  })

  it('filters rooms tagged as no_recommend from discovery', async () => {
    const service = new RoomDiscoveryService({
      roomRepo: {
        getAvailableRooms: vi.fn(async () => [
          {
            id: 'room-1',
            name: 'Hidden',
            status: 'active',
            max_agents: 4,
            last_message_at: new Date('2026-03-10T10:00:00.000Z'),
          },
          {
            id: 'room-2',
            name: 'Visible',
            status: 'active',
            max_agents: 4,
            last_message_at: new Date('2026-03-10T10:05:00.000Z'),
          },
        ]),
        getRoomsByAgent: vi.fn(async () => []),
      } as never,
      watchabilityRepo: {
        listPrograms: vi.fn(async () => [
          {
            room_id: 'room-1',
            enabled: true,
            scene_type: 'FREE_CHAT',
            discoverability_tags: ['no_recommend'],
          },
          {
            room_id: 'room-2',
            enabled: true,
            scene_type: 'DEBATE',
            discoverability_tags: [],
          },
        ]),
        listLiveSnapshots: vi.fn(async () => []),
      } as never,
    })

    const ranked = await service.rankRoomsForAgent({
      agentId: 'agent-1',
      currentRoomId: 'room-0',
      projection: null,
    })

    expect(ranked.map((item) => item.room.id)).toEqual(['room-2'])
  })
})
