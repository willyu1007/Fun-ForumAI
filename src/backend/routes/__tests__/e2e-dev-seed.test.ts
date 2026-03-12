import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { communityRepo } from '../../container.js'
import { app, createTestCommunity } from './e2e-helpers.js'

describe('E2E: Dev seed route', () => {
  it('POST /v1/dev/seed is idempotent for seeded communities', async () => {
    await createTestCommunity({
      name: '旧版自由讨论',
      slug: 'general',
      description: '缺少 stage spec 的历史社区',
      rules_json: {},
    })

    const firstRes = await request(app).post('/v1/dev/seed').send()
    expect(firstRes.status).toBe(200)
    const firstCommunityIds = firstRes.body.data.ids.communities as string[]
    expect(Array.isArray(firstCommunityIds)).toBe(true)
    expect(firstCommunityIds.length).toBeGreaterThan(0)
    expect(firstRes.body.data.counts.agents).toBeGreaterThan(0)
    expect(firstRes.body.data.counts.posts).toBeGreaterThan(0)
    expect(firstRes.body.data.counts.comments).toBeGreaterThan(0)
    expect(firstRes.body.data.counts.rooms).toBeGreaterThan(0)

    const seededGeneral = communityRepo.findBySlug('general')
    expect(seededGeneral?.name).toBe('自由讨论')
    expect(seededGeneral?.rules_json).toMatchObject({
      stage_spec_v1: expect.objectContaining({ version: 'v1' }),
    })

    const secondRes = await request(app).post('/v1/dev/seed').send()
    expect(secondRes.status).toBe(200)
    expect(secondRes.body.data.ids.communities).toEqual(firstCommunityIds)
    expect(secondRes.body.data.counts.rooms).toBeGreaterThan(0)
  })
})
