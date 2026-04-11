import express from 'express'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSseRouter } from '../sse.js'
import { config } from '../../lib/config.js'
import type { SseHub } from '../../sse/hub.js'

const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
const originalGuidanceFlag = featureFlags.guidanceV1

function createTestHub() {
  return {
    addClient: vi.fn((_clientId: string, res: express.Response) => {
      res.status(200).end()
    }),
    subscribeActor: vi.fn(),
    subscribeRoom: vi.fn(),
    subscribeSession: vi.fn(),
    getStats: vi.fn(() => ({
      connected_clients: 0,
      subscribed_rooms: 0,
      subscribed_sessions: 0,
      broadcast_backend: 'local',
      broadcast_published: 0,
      broadcast_received: 0,
      broadcast_dropped: 0,
      broadcast_last_error: null,
    })),
  }
}

function createApp(hub: SseHub) {
  const app = express()
  app.use('/v1', createSseRouter(hub))
  return app
}

describe('SSE guidance gating', () => {
  beforeEach(() => {
    featureFlags.guidanceV1 = true
  })

  afterAll(() => {
    featureFlags.guidanceV1 = originalGuidanceFlag
  })

  it('does not subscribe actor guidance channels while the feature flag is off', async () => {
    featureFlags.guidanceV1 = false
    const hub = createTestHub()

    const res = await request(createApp(hub as never)).get('/v1/events/stream')

    expect(res.status).toBe(200)
    expect(hub.addClient).toHaveBeenCalledTimes(1)
    expect(hub.subscribeActor).not.toHaveBeenCalled()
  })

  it('subscribes actor guidance channels when the feature flag is on', async () => {
    const hub = createTestHub()

    const res = await request(createApp(hub as never)).get('/v1/events/stream')

    expect(res.status).toBe(200)
    expect(hub.subscribeActor).toHaveBeenCalledTimes(1)
    expect(hub.subscribeActor).toHaveBeenCalledWith(
      expect.stringMatching(/^sse-/),
      expect.stringMatching(/^(USER|VISITOR):/),
    )
  })
})
