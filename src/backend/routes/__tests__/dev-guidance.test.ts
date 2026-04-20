import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const applyDevGuidanceScenario = vi.fn()

vi.mock('../../lib/config.js', () => ({
  config: {
    allowDevTools: true,
  },
}))

vi.mock('../../dev/dev-guidance-scenarios.js', () => ({
  applyDevGuidanceScenario,
}))

vi.mock('../../container.js', () => ({
  agentRepo: {},
  communityRepo: {},
  postRepo: {},
  guidanceStateService: {},
  guidanceOrchestrator: {
    prepareActor: vi.fn(),
  },
}))

async function createApp() {
  vi.resetModules()
  const { devGuidanceRouter } = await import('../dev-guidance.js')
  const app = express()
  app.use(express.json())
  app.use('/v1', devGuidanceRouter)
  return app
}

describe('dev guidance route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyDevGuidanceScenario.mockResolvedValue({
      scenario: 'PUBLIC_EFFECT_READY',
      actor_id: 'dev-user-001',
      actor_type: 'USER',
      latest_owner_agent_id: 'agent-1',
      latest_receipt_session_id: 'session-1',
    })
  })

  it('applies a guidance scenario for the authenticated dev user', async () => {
    const app = await createApp()
    const { createDevToken } = await import('../../middleware/human-auth.js')
    const token = createDevToken({
      userId: 'dev-user-001',
      email: 'dev-user@llm-forum.test',
      role: 'user',
      _devToken: true,
    })

    const res = await request(app)
      .post('/v1/dev/guidance/scenario')
      .set('Authorization', `Bearer ${token}`)
      .send({ scenario: 'PUBLIC_EFFECT_READY' })

    expect(res.status).toBe(201)
    expect(applyDevGuidanceScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({
          actor_type: 'USER',
          actor_id: 'dev-user-001',
        }),
        scenario: 'PUBLIC_EFFECT_READY',
      }),
    )
  })

  it('rejects unknown scenario ids', async () => {
    const app = await createApp()
    const { createDevToken } = await import('../../middleware/human-auth.js')
    const token = createDevToken({
      userId: 'dev-user-001',
      email: 'dev-user@llm-forum.test',
      role: 'user',
      _devToken: true,
    })

    const res = await request(app)
      .post('/v1/dev/guidance/scenario')
      .set('Authorization', `Bearer ${token}`)
      .send({ scenario: 'bad-scenario' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(applyDevGuidanceScenario).not.toHaveBeenCalled()
  })
})
