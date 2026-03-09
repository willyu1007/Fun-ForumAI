import { describe, expect, it } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryMessageRepository } from '../../repos/message-repository.js'
import { InMemoryRoomRepository } from '../../repos/room-repository.js'
import { InMemoryRoomWatchabilityRepository } from '../../repos/room-watchability-repository.js'
import { RoomProjector } from '../room-projector.js'

describe('RoomProjector', () => {
  it('assigns host foil skeptic roles and increments snapshot versions', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const roomRepo = new InMemoryRoomRepository()
    const messageRepo = new InMemoryMessageRepository()
    const watchabilityRepo = new InMemoryRoomWatchabilityRepository()

    const host = agentRepo.create({ owner_id: 'u1', display_name: 'Host' })
    const foil = agentRepo.create({ owner_id: 'u2', display_name: 'Foil' })
    const skeptic = agentRepo.create({ owner_id: 'u3', display_name: 'Skeptic' })

    const room = await roomRepo.create({
      name: 'Live Room',
      slug: 'live-room',
      description: '深夜嘴炮',
      created_by_agent_id: host.id,
    })

    await roomRepo.addMember(room.id, host.id, 'creator', 20_000)
    await roomRepo.addMember(room.id, foil.id, 'dispatched', 20_000)
    await roomRepo.addMember(room.id, skeptic.id, 'dispatched', 20_000)

    const msg1 = await messageRepo.create({
      room_id: room.id,
      author_id: host.id,
      body: '今晚来聊聊为什么大家总在深夜点外卖？',
    })
    await roomRepo.recordMemberMessage(room.id, host.id, msg1.created_at)

    const msg2 = await messageRepo.create({
      room_id: room.id,
      author_id: foil.id,
      body: '因为白天太累了，夜里想给自己一点补偿！',
    })
    await roomRepo.recordMemberMessage(room.id, foil.id, msg2.created_at)

    const projector = new RoomProjector({
      roomRepo,
      messageRepo,
      agentRepo,
      watchabilityRepo,
    })

    const first = await projector.refreshRoom(room.id)
    const second = await projector.refreshRoom(room.id)

    expect(first?.cast.map((entry) => [entry.name, entry.role])).toEqual([
      ['Host', 'HOST'],
      ['Foil', 'FOIL'],
      ['Skeptic', 'SKEPTIC'],
    ])
    expect(first?.snapshot.live_hook).toContain('Foil')
    expect(second?.snapshot.version).toBeGreaterThan(first?.snapshot.version ?? 0)
  })

  it('does not assign a replacement host when the creator is absent', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const roomRepo = new InMemoryRoomRepository()
    const messageRepo = new InMemoryMessageRepository()
    const watchabilityRepo = new InMemoryRoomWatchabilityRepository()

    const creator = agentRepo.create({ owner_id: 'u1', display_name: 'Creator' })
    const foil = agentRepo.create({ owner_id: 'u2', display_name: 'Foil' })
    const skeptic = agentRepo.create({ owner_id: 'u3', display_name: 'Skeptic' })
    const regular = agentRepo.create({ owner_id: 'u4', display_name: 'Regular' })

    const room = await roomRepo.create({
      name: 'No Host Room',
      slug: 'no-host-room',
      description: 'creator 已离场',
      created_by_agent_id: creator.id,
    })

    await roomRepo.addMember(room.id, foil.id, 'dispatched', 20_000)
    await roomRepo.addMember(room.id, skeptic.id, 'dispatched', 20_000)
    await roomRepo.addMember(room.id, regular.id, 'dispatched', 20_000)

    const foilMessage = await messageRepo.create({
      room_id: room.id,
      author_id: foil.id,
      body: '我先把话题挑起来。',
    })
    await roomRepo.recordMemberMessage(room.id, foil.id, foilMessage.created_at)

    const skepticMessage = await messageRepo.create({
      room_id: room.id,
      author_id: skeptic.id,
      body: '等等，这里面是不是还有别的前提？',
    })
    await roomRepo.recordMemberMessage(room.id, skeptic.id, skepticMessage.created_at)

    const projector = new RoomProjector({
      roomRepo,
      messageRepo,
      agentRepo,
      watchabilityRepo,
    })

    const projection = await projector.refreshRoom(room.id)

    expect(projection?.cast.map((entry) => [entry.name, entry.role])).toEqual([
      ['Foil', 'FOIL'],
      ['Skeptic', 'SKEPTIC'],
      ['Regular', 'REGULAR'],
    ])
    expect(projection?.cast.some((entry) => entry.role === 'HOST')).toBe(false)
  })
})
