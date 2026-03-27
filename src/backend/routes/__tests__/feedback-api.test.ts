import type { Express } from 'express'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createDevToken } from '../../middleware/human-auth.js'

const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5NQAAAAASUVORK5CYII=',
  'base64',
)

let app: Express

beforeAll(async () => {
  vi.resetModules()
  app = (await import('../../app.js')).app
})

afterAll(async () => {
  try {
    const mod = await import('../../app.js')
    mod.stopBackgroundServices()
  } catch {
    // ignore isolated module teardown failures
  }
  vi.resetModules()
})

describe('Feedback API', () => {
  it('supports the user/admin feedback loop end to end', async () => {
    const suffix = Date.now().toString(36)
    const userToken = createDevToken({
      userId: `feedback-user-${suffix}`,
      email: `feedback-user-${suffix}@example.com`,
      role: 'user',
    })
    const user2Token = createDevToken({
      userId: `feedback-user2-${suffix}`,
      email: `feedback-user2-${suffix}@example.com`,
      role: 'user',
    })
    const adminToken = createDevToken({
      userId: `feedback-admin-${suffix}`,
      email: `feedback-admin-${suffix}@example.com`,
      role: 'admin',
    })

    const createRes = await request(app)
      .post('/v1/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .field('category', 'UX_ISSUE')
      .field('title', '帖子页切图时会闪烁')
      .field('body', '从帖子页进入后，切第二张图时闪一下。')
      .field('entry_surface', 'post_detail')
      .field('source_route', '/posts/post-1')
      .attach('attachments', VALID_PNG_BUFFER, {
        filename: 'flicker.png',
        contentType: 'image/png',
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.data).toMatchObject({
      category: 'UX_ISSUE',
      status: 'RECEIVED',
      title: '帖子页切图时会闪烁',
      source_route: '/posts/post-1',
      entry_surface: 'post_detail',
    })

    const feedbackId = createRes.body.data.id as string
    const attachmentId = String(createRes.body.data.attachments[0]?.id)
    expect(attachmentId).toBeTruthy()

    const userListRes = await request(app)
      .get('/v1/feedback')
      .query({ status: 'RECEIVED' })
      .set('Authorization', `Bearer ${userToken}`)

    expect(userListRes.status).toBe(200)
    expect(userListRes.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: feedbackId,
          status: 'RECEIVED',
        }),
      ]),
    )

    const adminListRes = await request(app)
      .get('/v1/admin/feedback')
      .query({ source_route: '/posts/post-1' })
      .set('Authorization', `Bearer ${adminToken}`)

    expect(adminListRes.status).toBe(200)
    expect(adminListRes.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: feedbackId,
          source_route: '/posts/post-1',
        }),
      ]),
    )

    const patchRes = await request(app)
      .patch(`/v1/admin/feedback/${feedbackId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'PLANNED',
        public_resolution_note: '已纳入下个迭代。',
        internal_note: '上线前补回归。',
      })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data).toMatchObject({
      id: feedbackId,
      status: 'PLANNED',
      public_resolution_note: '已纳入下个迭代。',
      internal_note: '上线前补回归。',
    })

    const userDetailRes = await request(app)
      .get(`/v1/feedback/${feedbackId}`)
      .set('Authorization', `Bearer ${userToken}`)

    expect(userDetailRes.status).toBe(200)
    expect(userDetailRes.body.data.history.map((entry: { event_type: string }) => entry.event_type)).toEqual([
      'SUBMITTED',
      'STATUS_CHANGED',
      'PUBLIC_NOTE_UPDATED',
    ])

    const notificationRes = await request(app)
      .get('/v1/me/notifications')
      .query({ read: 'false' })
      .set('Authorization', `Bearer ${userToken}`)

    expect(notificationRes.status).toBe(200)
    expect(notificationRes.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'FEEDBACK',
          target_type: 'feedback_ticket',
          target_id: feedbackId,
        }),
      ]),
    )

    const ownAttachmentRes = await request(app)
      .get(`/v1/feedback/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${userToken}`)

    expect(ownAttachmentRes.status).toBe(200)
    expect(ownAttachmentRes.headers['content-type']).toMatch(/image\/png/)

    const forbiddenAttachmentRes = await request(app)
      .get(`/v1/feedback/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${user2Token}`)

    expect(forbiddenAttachmentRes.status).toBe(403)
    expect(forbiddenAttachmentRes.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 400 for invalid feedback filters instead of 500', async () => {
    const suffix = Date.now().toString(36)
    const userToken = createDevToken({
      userId: `feedback-query-user-${suffix}`,
      email: `feedback-query-user-${suffix}@example.com`,
      role: 'user',
    })
    const adminToken = createDevToken({
      userId: `feedback-query-admin-${suffix}`,
      email: `feedback-query-admin-${suffix}@example.com`,
      role: 'admin',
    })

    const userRes = await request(app)
      .get('/v1/feedback')
      .query({ status: 'INVALID_STATUS' })
      .set('Authorization', `Bearer ${userToken}`)

    expect(userRes.status).toBe(400)
    expect(userRes.body.error.code).toBe('VALIDATION_ERROR')

    const adminRes = await request(app)
      .get('/v1/admin/feedback')
      .query({ category: 'INVALID_CATEGORY' })
      .set('Authorization', `Bearer ${adminToken}`)

    expect(adminRes.status).toBe(400)
    expect(adminRes.body.error.code).toBe('VALIDATION_ERROR')
  })
})
