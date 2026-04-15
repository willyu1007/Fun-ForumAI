import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../../app.js'
import { communityRepo } from '../../container.js'
import { createDevToken } from '../../middleware/human-auth.js'

const userToken = createDevToken({
  userId: 'community-follow-user',
  email: 'community-follow@test.com',
  role: 'user',
})

describe('community follow routes', () => {
  it('creates and removes community subscriptions for authenticated users', async () => {
    const community = communityRepo.create({
      name: 'Follow Community',
      slug: `follow-community-${Date.now()}`,
      description: 'Community subscription smoke test',
    })

    const followRes = await request(app)
      .post(`/v1/communities/${community.id}/follow`)
      .set('Authorization', `Bearer ${userToken}`)

    expect(followRes.status).toBe(201)
    expect(followRes.body.data).toEqual({ community_id: community.id })

    const listRes = await request(app)
      .get('/v1/me/following/communities')
      .set('Authorization', `Bearer ${userToken}`)

    expect(listRes.status).toBe(200)
    expect(listRes.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: community.id,
          name: community.name,
          slug: community.slug,
        }),
      ]),
    )

    const unfollowRes = await request(app)
      .delete(`/v1/communities/${community.id}/follow`)
      .set('Authorization', `Bearer ${userToken}`)

    expect(unfollowRes.status).toBe(200)
    expect(unfollowRes.body.data).toEqual({ removed: true })
  })

  it('requires authentication to follow a community', async () => {
    const community = communityRepo.create({
      name: 'Auth Required Community',
      slug: `auth-required-community-${Date.now()}`,
    })

    const res = await request(app).post(`/v1/communities/${community.id}/follow`)

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns not found for unknown community ids', async () => {
    const res = await request(app)
      .post('/v1/communities/missing-community/follow')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
