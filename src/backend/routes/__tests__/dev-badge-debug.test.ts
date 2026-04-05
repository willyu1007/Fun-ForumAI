import type { Express } from 'express'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { ACHIEVEMENT_DEFINITIONS_V1 } from '../../services/achievements/definitions.js'
import { DEFAULT_DISPLAY_BADGE_DOCS, SYSTEM_DISPLAY_BADGE_DOCS } from '../../../shared/badges/catalog.js'

async function loadAppWithNodeEnv(nodeEnv: 'test' | 'production'): Promise<Express> {
  const previousNodeEnv = process.env.NODE_ENV
  const previousJwtSecret = process.env.JWT_SECRET
  const previousServiceSecret = process.env.SERVICE_AUTH_SECRET
  process.env.NODE_ENV = nodeEnv
  process.env.JWT_SECRET = 'test-jwt-secret'
  process.env.SERVICE_AUTH_SECRET = 'test-service-secret'
  vi.resetModules()
  const mod = await import('../../app.js')
  process.env.NODE_ENV = previousNodeEnv
  process.env.JWT_SECRET = previousJwtSecret
  process.env.SERVICE_AUTH_SECRET = previousServiceSecret
  return mod.app
}

describe('GET /v1/dev/badges/debug', () => {
  let devApp: Express

  beforeAll(async () => {
    devApp = await loadAppWithNodeEnv('test')
  })

  it('returns the maintained badge catalog with default, system, and achievement rows', async () => {
    const res = await request(devApp)
      .get('/v1/dev/badges/debug')
      .send()

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(
      ACHIEVEMENT_DEFINITIONS_V1.length
      + Object.keys(DEFAULT_DISPLAY_BADGE_DOCS).length
      + Object.keys(SYSTEM_DISPLAY_BADGE_DOCS).length,
    )

    expect(res.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'default:萌新专属',
        source_kind: 'default_display',
        name: '萌新专属',
      }),
      expect.objectContaining({
        key: 'system:Resident',
        source_kind: 'system_display',
        name: 'Resident',
      }),
      expect.objectContaining({
        key: 'achievement:chronicle_spotlight:tier1',
        source_kind: 'achievement',
        name: 'Chronicle Spotlight T1',
      }),
    ]))

    const spotlight = res.body.data.find((item: { key: string }) => item.key === 'achievement:chronicle_spotlight:tier2')
    expect(spotlight).toMatchObject({
      icon_src: '/badges/agent/achievement-seal.svg',
      condition_summary: expect.stringContaining('达到 5'),
      evidence_summary: expect.stringContaining('信号来源'),
      display_priority: expect.stringContaining('公开成就层'),
    })
  })
})
