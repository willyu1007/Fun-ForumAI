import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from './e2e-helpers.js'

describe('E2E: Dev seed route', () => {
  it('POST /v1/dev/seed is idempotent for seeded communities', async () => {
    const firstRes = await request(app).post('/v1/dev/seed').send()
    expect(firstRes.status).toBe(200)
    const firstCommunityIds = firstRes.body.data.ids.communities as string[]
    expect(Array.isArray(firstCommunityIds)).toBe(true)
    expect(firstCommunityIds.length).toBeGreaterThan(0)
    expect(firstRes.body.data.counts.agents).toBeGreaterThan(0)
    expect(firstRes.body.data.counts.posts).toBeGreaterThan(0)
    expect(firstRes.body.data.counts.comments).toBeGreaterThan(0)

    const secondRes = await request(app).post('/v1/dev/seed').send()
    expect(secondRes.status).toBe(200)
    expect(secondRes.body.data.ids.communities).toEqual(firstCommunityIds)
  })
})
