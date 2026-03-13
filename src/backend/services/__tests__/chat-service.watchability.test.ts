import { describe, expect, it, vi } from 'vitest'
import { ChatService } from '../chat-service.js'

function baseDeps() {
  return {
    roomRepo: {
      findById: vi.fn(async () => ({
        id: 'room-1',
        name: 'Room 1',
        description: 'live room',
        status: 'active',
      })),
      isMember: vi.fn(async () => true),
      updateLastMessageAt: vi.fn(async () => undefined),
      updateStatus: vi.fn(async () => undefined),
      recordMemberMessage: vi.fn(async () => undefined),
      getMembers: vi.fn(async () => []),
    },
    messageRepo: {
      create: vi.fn(async () => ({
        id: 'msg-1',
        room_id: 'room-1',
        author_id: 'agent-1',
        body: 'hello',
        message_kind: 'normal',
        created_at: new Date(),
      })),
    },
    agentRepo: {
      findById: vi.fn(() => ({ id: 'agent-1', owner_id: 'owner-1' })),
    },
    agentService: {
      getLatestConfig: vi.fn(() => null),
    },
    eventRepo: {
      create: vi.fn(),
    },
  } as const
}

describe('ChatService watchability hooks', () => {
  it('emits snapshot updates after message projection', async () => {
    const deps = baseDeps()
    const sseHub = { broadcastToRoom: vi.fn() }
    const projector = {
      refreshRoom: vi.fn(async () => ({
        snapshot: {
          room_id: 'room-1',
          episode_id: 'ep-1',
          current_beat: null,
          live_hook: '现在有戏',
          unresolved_question: '为什么会这样？',
          energy: 0.8,
          tension: 0.4,
          last_highlight_text: null,
          version: 3,
        },
        cast: [],
      })),
    }

    const service = new ChatService({
      ...deps,
      sseHub: sseHub as never,
    } as never)
    service.setRoomProjector(projector as never)

    await service.sendMessage({
      room_id: 'room-1',
      author_id: 'agent-1',
      body: 'hello',
    })

    await vi.waitFor(() => {
      expect(projector.refreshRoom).toHaveBeenCalledWith('room-1')
      expect(sseHub.broadcastToRoom).toHaveBeenCalledWith('room-1', expect.objectContaining({
        type: 'ROOM_LIVE_SNAPSHOT_UPDATED',
      }))
    })
  })

  it('does not fail message writes when projector throws', async () => {
    const deps = baseDeps()
    const service = new ChatService({
      ...deps,
      sseHub: { broadcastToRoom: vi.fn() } as never,
    } as never)
    service.setRoomProjector({
      refreshRoom: vi.fn(async () => {
        throw new Error('boom')
      }),
    } as never)

    await expect(service.sendMessage({
      room_id: 'room-1',
      author_id: 'agent-1',
      body: 'hello',
    })).resolves.toMatchObject({
      id: 'msg-1',
    })
  })

  it('hides meta chatter and strips forum quote wrappers from room history APIs', async () => {
    const deps = baseDeps()
    const messageRepo = deps.messageRepo as typeof deps.messageRepo & {
      findByRoom: (roomId: string, opts: { limit?: number; cursor?: string | null }) => Promise<{
        items: Array<{
          id: string
          room_id: string
          author_id: string
          body: string
          message_kind: string
          created_at: Date
        }>
        next_cursor: string | null
      }>
    }
    messageRepo.findByRoom = vi.fn(async () => ({
      items: [
        {
          id: 'meta-1',
          room_id: 'room-1',
          author_id: 'agent-1',
          body: '现在是热身阶段，各方暂未投入主要精力。建议主持人可适时抛出更具吸引力的话题。',
          message_kind: 'normal',
          created_at: new Date(),
        },
        {
          id: 'reply-1',
          room_id: 'room-1',
          author_id: 'agent-1',
          body: '[展开] 辩论大师 回复于 2024/08/19 12:22 楼晶:那么，安全性测试的具体实施方法有哪些呢？\n\n> （追问）那么，安全性测试的具体实施方法有哪些呢？\n\n除了已知漏洞的靶网站，还有什么具体的模拟手段吗？比如虚拟网络环境或者沙箱技术。',
          message_kind: 'normal',
          created_at: new Date(),
        },
      ],
      next_cursor: null,
    }))

    const service = new ChatService({
      ...deps,
      messageRepo,
    } as never)
    const result = await service.getMessages('room-1', { limit: 20 })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'reply-1',
      body: '除了已知漏洞的靶网站，还有什么具体的模拟手段吗？比如虚拟网络环境或者沙箱技术。',
    })
  })

  it('hydrates persisted chat config before calculating the initial room tick interval', async () => {
    const roomRepo = {
      findBySlug: vi.fn(async () => null),
      create: vi.fn(async () => ({
        id: 'room-1',
        name: 'Room 1',
        description: 'live room',
        status: 'active',
        max_agents: 6,
      })),
      addMember: vi.fn(async () => ({
        room_id: 'room-1',
        member_id: 'agent-1',
        joined_at: new Date(),
        role_hint: null,
        join_source: 'creator',
        personal_tick_interval: 12_000,
      })),
      updateLastMessageAt: vi.fn(async () => undefined),
      recordMemberMessage: vi.fn(async () => undefined),
    }
    const service = new ChatService({
      roomRepo: roomRepo as never,
      messageRepo: {
        create: vi.fn(),
      } as never,
      agentRepo: {
        findById: vi.fn(() => ({ id: 'agent-1', owner_id: 'owner-1', display_name: 'Agent One' })),
      } as never,
      agentService: {
        getAgentPersisted: vi.fn(async () => ({ id: 'agent-1', owner_id: 'owner-1' })),
        getLatestConfig: vi.fn(() => null),
        getLatestConfigPersisted: vi.fn(async () => ({
          id: 'cfg-1',
          agent_id: 'agent-1',
          config_json: { chat: { talkativeness: 5, allow_wandering: true } },
        })),
      } as never,
      eventRepo: {
        create: vi.fn(),
      } as never,
    } as never)

    await service.createRoom({
      slug: 'room-1',
      name: 'Room 1',
      description: 'live room',
      created_by_agent_id: 'agent-1',
    })

    expect(roomRepo.addMember).toHaveBeenCalledWith('room-1', 'agent-1', 'creator', 12_000)
  })

  it('filters no-recommend rooms from watchability listings', async () => {
    const deps = baseDeps()
    const service = new ChatService({
      ...deps,
      roomRepo: {
        ...deps.roomRepo,
        list: vi.fn(async () => ({
          items: [
            {
              id: 'room-1',
              name: 'Room 1',
              description: 'hidden room',
              status: 'active',
              max_agents: 4,
              last_message_at: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
            {
              id: 'room-2',
              name: 'Room 2',
              description: 'visible room',
              status: 'active',
              max_agents: 4,
              last_message_at: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          next_cursor: null,
        })),
      } as never,
      roomWatchabilityRepo: {
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
            scene_type: 'FREE_CHAT',
            discoverability_tags: [],
          },
        ]),
        listLiveSnapshots: vi.fn(async () => []),
      } as never,
    } as never)

    const result = await service.getRoomsWithWatchability({ limit: 20 })

    expect(result.items.map((item) => item.id)).toEqual(['room-2'])
  })

  it('keeps pagination moving when hidden rooms are filtered out', async () => {
    const deps = baseDeps()
    const listMock = vi.fn(async (opts: { cursor?: string; limit: number }) => {
      if (!opts.cursor) {
        return {
          items: [
            {
              id: 'room-1',
              name: 'Room 1',
              description: 'hidden room',
              status: 'active',
              max_agents: 4,
              last_message_at: null,
              created_at: new Date('2026-03-12T00:00:00Z'),
              updated_at: new Date('2026-03-12T00:00:00Z'),
            },
          ],
          next_cursor: 'room-1',
        }
      }
      if (opts.cursor === 'room-1') {
        return {
          items: [
            {
              id: 'room-2',
              name: 'Room 2',
              description: 'visible room',
              status: 'active',
              max_agents: 4,
              last_message_at: null,
              created_at: new Date('2026-03-11T00:00:00Z'),
              updated_at: new Date('2026-03-11T00:00:00Z'),
            },
          ],
          next_cursor: 'room-2',
        }
      }
      return {
        items: [
          {
            id: 'room-3',
            name: 'Room 3',
            description: 'visible room 2',
            status: 'active',
            max_agents: 4,
            last_message_at: null,
            created_at: new Date('2026-03-10T00:00:00Z'),
            updated_at: new Date('2026-03-10T00:00:00Z'),
          },
        ],
        next_cursor: null,
      }
    })

    const service = new ChatService({
      ...deps,
      roomRepo: {
        ...deps.roomRepo,
        list: listMock,
      } as never,
      roomWatchabilityRepo: {
        listPrograms: vi.fn(async (roomIds: string[]) => roomIds.map((roomId) => ({
          room_id: roomId,
          enabled: true,
          scene_type: 'FREE_CHAT',
          discoverability_tags: roomId === 'room-1' ? ['no_recommend'] : [],
        }))),
        listLiveSnapshots: vi.fn(async () => []),
      } as never,
    } as never)

    const firstPage = await service.getRoomsWithWatchability({ limit: 1 })

    expect(firstPage.items.map((item) => item.id)).toEqual(['room-2'])
    expect(firstPage.next_cursor).toBe('room-2')

    const secondPage = await service.getRoomsWithWatchability({
      limit: 1,
      cursor: firstPage.next_cursor ?? undefined,
    })

    expect(secondPage.items.map((item) => item.id)).toEqual(['room-3'])
    expect(secondPage.next_cursor).toBeNull()
  })

  it('filters no-recommend rooms from available-room discovery', async () => {
    const deps = baseDeps()
    const service = new ChatService({
      ...deps,
      roomRepo: {
        ...deps.roomRepo,
        getAvailableRooms: vi.fn(async () => [
          {
            id: 'room-1',
            name: 'Room 1',
            description: 'hidden room',
            status: 'active',
            max_agents: 4,
            last_message_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'room-2',
            name: 'Room 2',
            description: 'visible room',
            status: 'active',
            max_agents: 4,
            last_message_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]),
      } as never,
      roomWatchabilityRepo: {
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
            scene_type: 'FREE_CHAT',
            discoverability_tags: [],
          },
        ]),
      } as never,
    } as never)

    const rooms = await service.getAvailableRooms()

    expect(rooms.map((item) => item.id)).toEqual(['room-2'])
  })
})
