import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../app.js'
import { createDevToken } from '../../middleware/human-auth.js'

function extractVisitorCookie(setCookie: string | string[] | undefined): string | undefined {
  const values = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : [])
  return values.find((entry) => entry.startsWith('ff_vid='))
}

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
    expect(receipt?.cta?.target).toBe('/agents/agent-1?tab=privacy&source_session_id=session-1')

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
})
