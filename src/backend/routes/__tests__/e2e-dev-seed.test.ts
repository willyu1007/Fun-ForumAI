import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { agentService, chatService, communityRepo, roomRepo } from '../../container.js'
import { app, createTestCommunity } from './e2e-helpers.js'

describe('E2E: Dev seed route', () => {
  it('POST /v1/dev/seed reuses canonical seed agents and repairs archived duplicate-filled rooms', async () => {
    await createTestCommunity({
      name: '旧版自由讨论',
      slug: 'general',
      description: '缺少 stage spec 的历史社区',
      rules_json: {},
    })

    const firstRes = await request(app).post('/v1/dev/seed').send()
    expect(firstRes.status).toBe(200)
    const firstCommunityIds = firstRes.body.data.ids.communities as string[]
    const firstAgentIds = firstRes.body.data.ids.agents as string[]
    const firstRoomIds = firstRes.body.data.ids.rooms as string[]
    expect(Array.isArray(firstCommunityIds)).toBe(true)
    expect(firstCommunityIds.length).toBeGreaterThan(0)
    expect(firstRes.body.data.counts.agents).toBeGreaterThan(0)
    expect(firstRes.body.data.counts.posts).toBeGreaterThan(0)
    expect(firstRes.body.data.counts.comments).toBeGreaterThan(0)
    expect(firstRes.body.data.counts.rooms).toBeGreaterThan(0)
    expect(firstAgentIds).toHaveLength(5)
    expect(firstRoomIds).toHaveLength(3)

    const seededGeneral = communityRepo.findBySlug('general')
    expect(seededGeneral?.name).toBe('自由讨论')
    expect(seededGeneral?.rules_json).toMatchObject({
      stage_spec_v1: expect.objectContaining({ version: 'v1' }),
    })

    const duplicateHost = await agentService.createAgentPersisted({
      owner_id: 'dev-user-001',
      display_name: '苏格拉底-7B',
      model: 'qwen-plus',
    })
    const duplicateGuest = await agentService.createAgentPersisted({
      owner_id: 'dev-user-001',
      display_name: '洛芙蕾丝',
      model: 'qwen-plus',
    })

    await chatService.dispatchAgentToRoom(firstRoomIds[0], duplicateHost.id, 'dev-user-001')
    await chatService.dispatchAgentToRoom(firstRoomIds[0], duplicateGuest.id, 'dev-user-001')

    const archived = await roomRepo.updateStatus(firstRoomIds[0], 'archived')
    expect(archived?.status).toBe('archived')

    const secondRes = await request(app).post('/v1/dev/seed').send()
    expect(secondRes.status).toBe(200)
    expect(secondRes.body.data.ids.communities).toEqual(firstCommunityIds)
    expect(secondRes.body.data.ids.agents).toEqual(firstAgentIds)
    expect(secondRes.body.data.ids.rooms).toEqual(firstRoomIds)
    expect(secondRes.body.data.counts.rooms).toBeGreaterThan(0)

    const repairedRoom = await chatService.getRoom(firstRoomIds[0])
    expect(repairedRoom.status).toBe('active')
    expect(repairedRoom.members.map((member) => member.member_id).sort()).toEqual(
      [firstAgentIds[0], firstAgentIds[1], firstAgentIds[2]].sort(),
    )
  })
})
