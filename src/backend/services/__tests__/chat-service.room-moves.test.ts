import { describe, expect, it, vi } from 'vitest'
import { InMemoryRoomRepository } from '../../repos/room-repository.js'
import { ChatService } from '../chat-service.js'

async function makeRooms(roomRepo: InMemoryRoomRepository) {
  const source = await roomRepo.create({
    name: 'Source',
    slug: 'source-room',
    description: 'source',
    created_by_agent_id: 'creator-1',
  })
  const target = await roomRepo.create({
    name: 'Target',
    slug: 'target-room',
    description: 'target',
    created_by_agent_id: 'creator-2',
  })
  return { source, target }
}

function makeService(roomRepo: InMemoryRoomRepository, overrides?: {
  sseHub?: { broadcastToRoom: ReturnType<typeof vi.fn> }
}) {
  return new ChatService({
    roomRepo,
    messageRepo: {} as never,
    agentRepo: {
      findById: vi.fn((agentId: string) => ({
        id: agentId,
        owner_id: 'owner-1',
        display_name: `Agent ${agentId}`,
      })),
    } as never,
    agentService: {
      getAgentPersisted: vi.fn((agentId: string) => ({
        id: agentId,
        owner_id: 'owner-1',
        display_name: `Agent ${agentId}`,
      })),
      getLatestConfigPersisted: vi.fn(() => null),
      getLatestConfig: vi.fn(() => null),
    } as never,
    eventRepo: {
      create: vi.fn(),
    } as never,
    sseHub: overrides?.sseHub as never,
  } as never)
}

describe('ChatService room moves', () => {
  it('keeps the source membership when ecology join fails before the source leave commits', async () => {
    const roomRepo = new InMemoryRoomRepository()
    const { source, target } = await makeRooms(roomRepo)
    await roomRepo.addMember(source.id, 'agent-1', 'creator', 20_000)

    const originalAddMember = roomRepo.addMember.bind(roomRepo)
    roomRepo.addMember = vi.fn(async (roomId, memberId, joinSource, tickInterval) => {
      if (roomId === target.id) {
        throw new Error('target join failed')
      }
      return originalAddMember(roomId, memberId, joinSource, tickInterval)
    })

    const sseHub = { broadcastToRoom: vi.fn() }
    const service = makeService(roomRepo, { sseHub })

    await expect(service.moveAgentByEcology(source.id, target.id, 'agent-1')).rejects.toThrow('target join failed')

    expect(await roomRepo.isMember(source.id, 'agent-1')).toBe(true)
    expect(await roomRepo.isMember(target.id, 'agent-1')).toBe(false)
    expect(sseHub.broadcastToRoom).not.toHaveBeenCalled()
  })

  it('rolls back the target membership when the source leave fails during a move', async () => {
    const roomRepo = new InMemoryRoomRepository()
    const { source, target } = await makeRooms(roomRepo)
    await roomRepo.addMember(source.id, 'agent-1', 'creator', 20_000)

    const originalRemoveMember = roomRepo.removeMember.bind(roomRepo)
    roomRepo.removeMember = vi.fn(async (roomId, memberId) => {
      if (roomId === source.id && memberId === 'agent-1') {
        return false
      }
      return originalRemoveMember(roomId, memberId)
    })

    const sseHub = { broadcastToRoom: vi.fn() }
    const service = makeService(roomRepo, { sseHub })

    await expect(service.moveAgentByEcology(source.id, target.id, 'agent-1')).rejects.toThrow(
      'Agent is not a member of this room',
    )

    expect(await roomRepo.isMember(source.id, 'agent-1')).toBe(true)
    expect(await roomRepo.isMember(target.id, 'agent-1')).toBe(false)
    expect(sseHub.broadcastToRoom).not.toHaveBeenCalled()
  })
})
