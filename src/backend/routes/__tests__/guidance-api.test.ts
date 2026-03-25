import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { buildAgentTarget } from '../../../shared/agent-target.js'
import { app } from '../../app.js'
import { config } from '../../lib/config.js'
import { createDevToken } from '../../middleware/human-auth.js'

function extractVisitorCookie(setCookie: string | string[] | undefined): string | undefined {
  const values = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : [])
  return values.find((entry) => entry.startsWith('ff_vid='))
}

const featureFlags = config.features as unknown as Record<string, boolean>
const originalGuidanceFlag = featureFlags.guidanceV1
const originalGuidanceRecallFlag = featureFlags.guidanceRecallV1

beforeEach(() => {
  featureFlags.guidanceV1 = true
  featureFlags.guidanceRecallV1 = true
})

afterAll(() => {
  featureFlags.guidanceV1 = originalGuidanceFlag
  featureFlags.guidanceRecallV1 = originalGuidanceRecallFlag
})

describe('Guidance API', () => {
  it('shows only dual entry on first anonymous visit, then reveals checklist after spectator CTA', async () => {
    const first = await request(app).get('/v1/guidance/summary')
    expect(first.status).toBe(200)

    const firstModules = first.body.data.modules as Array<{ type: string }>
    expect(firstModules.some((module) => module.type === 'DUAL_ENTRY')).toBe(true)
    expect(firstModules.some((module) => module.type === 'CHECKLIST')).toBe(false)
    expect(firstModules.every((module) => ['DUAL_ENTRY', 'CHECKLIST', 'CARD', 'RECEIPT'].includes(module.type))).toBe(true)
    expect(firstModules.some((module) => module.type === 'PROOF')).toBe(false)

    expect(first.body.data.modules[0]).toMatchObject({
      type: 'DUAL_ENTRY',
      hero_body: expect.any(String),
      cards: [
        expect.objectContaining({
          track: 'SPECTATOR',
          entry_cta: expect.objectContaining({
            event_name: 'DUAL_ENTRY_CTA_CLICKED',
          }),
        }),
        expect.objectContaining({
          track: 'OWNER',
          entry_cta: expect.objectContaining({
            event_name: 'DUAL_ENTRY_CTA_CLICKED',
          }),
        }),
      ],
    })

    const visitorCookie = extractVisitorCookie(first.headers['set-cookie'])
    expect(visitorCookie).toBeTruthy()

    const eventRes = await request(app)
      .post('/v1/guidance/client-events')
      .set('Cookie', visitorCookie!)
      .send({
        event_type: 'DUAL_ENTRY_CTA_CLICKED',
        payload: { track: 'SPECTATOR' },
      })
    expect(eventRes.status).toBe(202)

    const second = await request(app)
      .get('/v1/guidance/summary')
      .set('Cookie', visitorCookie!)
    expect(second.status).toBe(200)
    expect(second.body.data.actor.current_track).toBe('SPECTATOR')

    const secondModules = second.body.data.modules as Array<{ type: string; items?: Array<{ reason_code: string }> }>
    const checklist = secondModules.find((module) => module.type === 'CHECKLIST')
    expect(checklist).toBeTruthy()
    expect(checklist?.items?.some((item) => item.reason_code === 'FOLLOW_FIRST_AGENT')).toBe(true)
  })

  it('scopes inbox actions to the current actor and supports receipt read state updates', async () => {
    const ownerToken = createDevToken({ userId: 'guidance-owner', email: 'owner@test.com', role: 'user' })
    const otherToken = createDevToken({ userId: 'guidance-other', email: 'other@test.com', role: 'user' })

    const createEvent = async (event_type: string, payload: Record<string, unknown>) => {
      const res = await request(app)
        .post('/v1/guidance/client-events')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ event_type, payload })
      expect(res.status).toBe(202)
    }

    await createEvent('AGENT_CREATED', { agent_id: 'agent-1' })
    await createEvent('PRIVATE_SESSION_ENDED', { agent_id: 'agent-1', session_id: 'session-1' })
    await createEvent('PRIVATE_DIGEST_READY', { agent_id: 'agent-1', session_id: 'session-1', memory_id: 'memory-1' })

    const inboxRes = await request(app)
      .get('/v1/guidance/inbox')
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(inboxRes.status).toBe(200)

    const receipt = (inboxRes.body.data.items as Array<{
      id: string
      reason_code: string
      unread: boolean
      cta: { target: string } | null
    }>).find((item) => item.reason_code === 'NURTURE_RECEIPT_READY')
    expect(receipt).toBeTruthy()
    expect(receipt?.cta?.target).toBe(buildAgentTarget({
      agentId: 'agent-1',
      mode: 'manage',
      tab: 'intro',
      introSection: 'privacy',
      sourceSessionId: 'session-1',
    }))

    const forbiddenAction = await request(app)
      .post(`/v1/guidance/items/${receipt!.id}/action`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ action: 'open' })
    expect(forbiddenAction.status).toBe(404)

    const openAction = await request(app)
      .post(`/v1/guidance/items/${receipt!.id}/action`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ action: 'open' })
    expect(openAction.status).toBe(200)
    expect(openAction.body.data.unread).toBe(false)

    const refreshedInbox = await request(app)
      .get('/v1/guidance/inbox')
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(refreshedInbox.status).toBe(200)
    expect(refreshedInbox.body.data.unread_count).toBe(0)
  })

  it('returns safe empty states and ignores client events while the feature flag is off', async () => {
    const ownerToken = createDevToken({ userId: 'guidance-flagged-owner', email: 'owner@test.com', role: 'user' })

    featureFlags.guidanceV1 = false

    const eventRes = await request(app)
      .post('/v1/guidance/client-events')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        event_type: 'DUAL_ENTRY_CTA_CLICKED',
        payload: { track: 'OWNER' },
      })
    expect(eventRes.status).toBe(202)

    const summaryOff = await request(app)
      .get('/v1/guidance/summary')
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(summaryOff.status).toBe(200)
    expect(summaryOff.body.data.modules).toEqual([])
    expect(summaryOff.body.data.actor.current_track).toBe('UNDECIDED')
    expect(summaryOff.body.data.actor.reveal).toEqual({
      style: true,
      instructions: true,
      advanced: true,
    })

    const inboxOff = await request(app)
      .get('/v1/guidance/inbox')
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(inboxOff.status).toBe(200)
    expect(inboxOff.body.data).toEqual({
      items: [],
      unread_count: 0,
    })

    featureFlags.guidanceV1 = true

    const summaryOn = await request(app)
      .get('/v1/guidance/summary')
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(summaryOn.status).toBe(200)
    expect(summaryOn.body.data.actor.current_track).toBe('UNDECIDED')
    expect(summaryOn.body.data.modules[0]).toMatchObject({
      type: 'DUAL_ENTRY',
      reason_code: 'HOME_DUAL_ENTRY',
    })
    expect(summaryOn.body.data.modules.some((module: { type: string }) => module.type === 'CHECKLIST')).toBe(false)
  })

  it('returns only bell-eligible canonical guidance items without duplicates', async () => {
    const ownerToken = createDevToken({ userId: 'guidance-bell-owner', email: 'owner@test.com', role: 'user' })

    const createEvent = async (event_type: string, payload: Record<string, unknown>) => {
      const res = await request(app)
        .post('/v1/guidance/client-events')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ event_type, payload })
      expect(res.status).toBe(202)
    }

    await createEvent('AGENT_CREATED', { agent_id: 'agent-bell-1' })
    await createEvent('PRIVATE_SESSION_ENDED', { agent_id: 'agent-bell-1', session_id: 'session-bell-1' })
    await createEvent('PRIVATE_DIGEST_READY', { agent_id: 'agent-bell-1', session_id: 'session-bell-1' })
    await createEvent('OWNER_AGENT_PUBLIC_EVENT', {
      agent_id: 'agent-bell-1',
      post_id: 'post-bell-1',
      target_url: '/posts/post-bell-1',
    })
    await createEvent('OWNER_AGENT_PUBLIC_EVENT', {
      agent_id: 'agent-bell-1',
      post_id: 'post-bell-1',
      target_url: '/posts/post-bell-1',
    })

    const bellRes = await request(app)
      .get('/v1/guidance/bell')
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(bellRes.status).toBe(200)
    expect(bellRes.body.data.unread_count).toBe(1)
    expect(bellRes.body.data.items).toHaveLength(1)
    expect(bellRes.body.data.items[0]).toMatchObject({
      reason_code: 'WATCH_PUBLIC_EFFECT',
      cta: {
        target: '/posts/post-bell-1',
      },
    })
  })

  it('leaves existing items unchanged when action requests arrive while the feature flag is off', async () => {
    const ownerToken = createDevToken({ userId: 'guidance-action-owner', email: 'owner@test.com', role: 'user' })

    const createEvent = async (event_type: string, payload: Record<string, unknown>) => {
      const res = await request(app)
        .post('/v1/guidance/client-events')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ event_type, payload })
      expect(res.status).toBe(202)
    }

    await createEvent('AGENT_CREATED', { agent_id: 'agent-2' })
    await createEvent('PRIVATE_SESSION_ENDED', { agent_id: 'agent-2', session_id: 'session-2' })
    await createEvent('PRIVATE_DIGEST_READY', { agent_id: 'agent-2', session_id: 'session-2', memory_id: 'memory-2' })

    const inboxRes = await request(app)
      .get('/v1/guidance/inbox')
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(inboxRes.status).toBe(200)

    const receipt = (inboxRes.body.data.items as Array<{ id: string; unread: boolean }>)[0]
    expect(receipt).toBeTruthy()
    expect(receipt.unread).toBe(true)

    featureFlags.guidanceV1 = false
    featureFlags.guidanceRecallV1 = false

    const actionRes = await request(app)
      .post(`/v1/guidance/items/${receipt.id}/action`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ action: 'open' })
    expect(actionRes.status).toBe(200)
    expect(actionRes.body.data.unread).toBe(true)

    featureFlags.guidanceV1 = true
    featureFlags.guidanceRecallV1 = true

    const refreshedInbox = await request(app)
      .get('/v1/guidance/inbox')
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(refreshedInbox.status).toBe(200)
    const refreshedReceipt = (refreshedInbox.body.data.items as Array<{ id: string; unread: boolean }>).find((item) => item.id === receipt.id)
    expect(refreshedReceipt?.unread).toBe(true)
  })
})
