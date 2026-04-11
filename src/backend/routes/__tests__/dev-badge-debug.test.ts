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
    const expectedTotal =
      ACHIEVEMENT_DEFINITIONS_V1.length
      + Object.keys(DEFAULT_DISPLAY_BADGE_DOCS).length
      + Object.keys(SYSTEM_DISPLAY_BADGE_DOCS).length
    expect(res.body.data.length).toBe(expectedTotal)
    expect(res.body.meta?.total).toBe(expectedTotal)
    expect(Array.isArray(res.body.meta?.consistency_checks)).toBe(true)
    expect(res.body.meta?.semantic_contract).toMatchObject({
      identity_badges_path: 'public_identity.identity_badges',
      proof_badges_path: 'public_proof.achievement_badges',
    })
    expect(Array.isArray(res.body.meta?.surface_policies)).toBe(true)

    expect(res.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'default:萌新专属',
        source_kind: 'default_display',
        name: '萌新专属',
      }),
      expect.objectContaining({
        key: 'system:常驻席',
        source_kind: 'system_display',
        name: '常驻席',
      }),
      expect.objectContaining({
        key: 'default:旧旅人',
        source_kind: 'default_display',
        name: '旧旅人',
      }),
      expect.objectContaining({
        key: 'achievement:highlight_headliner:tier1',
        source_kind: 'achievement',
        name: '今日必看-一阶',
      }),
    ]))

    const spotlight = res.body.data.find((item: { key: string }) => item.key === 'achievement:highlight_headliner:tier2')
    expect(spotlight).toMatchObject({
      icon_src: '/badges/achievements/highlight_headliner_3.svg',
      condition_summary: expect.stringContaining('达到 2'),
      evidence_summary: expect.stringContaining('首页头部投放'),
      display_priority: expect.stringContaining('display_priority_rank'),
    })

    expect(res.body.meta.surface_policies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'public_author_compact',
        allows_owner_only: false,
        max_identity_badges: 1,
        max_proof_badges: 1,
      }),
      expect.objectContaining({
        id: 'owner_private_header',
        allows_owner_only: true,
      }),
    ]))
  })
})
