import { describe, expect, it } from 'vitest'
import {
  buildInitialIdentityConfig,
  resolveAgentIdentity,
  sanitizeIdentityConfig,
} from '../agent-identity.js'

const baseAgent = {
  id: 'agent-1',
  owner_id: 'user-1',
  display_name: 'Identity Bot',
  avatar_url: null,
  persona_version: 1,
  reputation_score: 0,
  status: 'ACTIVE' as const,
  created_at: new Date('2026-03-01T10:00:00.000Z'),
  updated_at: new Date('2026-03-01T10:00:00.000Z'),
}

describe('agent-identity', () => {
  it('resolves canonical configs as contract_v1 identity', () => {
    const resolved = resolveAgentIdentity(baseAgent, {
      id: 'cfg-1',
      agent_id: baseAgent.id,
      config_json: {
        personaSeed: {
          seedCode: 'sharp-tongue',
        },
        voice: {
          homeVoiceLineId: 'qwen-social-v1',
          selectedAt: '2026-03-02T10:00:00.000Z',
        },
        ownerStylePins: {
          mood: 'critical',
          habits: ['asks_questions'],
          interests: ['科技'],
        },
      },
      risk_level: 'LOW',
      review_status: 'NOT_REQUIRED',
      review_case_id: null,
      lint_warnings: [],
      updated_at: new Date('2026-03-02T10:00:00.000Z'),
      effective_at: new Date('2026-03-02T10:00:00.000Z'),
      updated_by: 'admin',
    })

    expect(resolved.source).toBe('contract_v1')
    expect(resolved.summary.persona_seed_code).toBe('sharp-tongue')
    expect(resolved.visiblePersona.interests).toEqual(['科技'])
  })

  it('falls back to default contract_v1 when config is missing', () => {
    const resolved = resolveAgentIdentity(baseAgent, null)

    expect(resolved.source).toBe('contract_v1')
    expect(resolved.summary.persona_seed_code).toBe('scholar')
    expect(resolved.summary.home_voice_line_id).toBe('qwen-social-v1')
  })

  it('sanitizes visible home voice lines and keeps contract structure stable', () => {
    const configJson = buildInitialIdentityConfig({
      personaSeedCode: 'mediator',
      ownerStylePins: { interests: ['社会'] },
      selectedAt: new Date('2026-03-03T10:00:00.000Z'),
    })
    const sanitized = sanitizeIdentityConfig(configJson)

    expect(sanitized).toMatchObject({
      personaSeed: { seedCode: 'mediator' },
      voice: { homeVoiceLineId: 'qwen-social-v1', locked: true },
      ownerStylePins: { interests: ['社会'] },
    })
    expect(sanitized).not.toHaveProperty('style')
  })

  it('fills missing canonical fields on sanitize without reading legacy keys', () => {
    const sanitized = sanitizeIdentityConfig({
      personaSeed: { seedCode: 'sharp-tongue' },
    })

    expect(sanitized).toMatchObject({
      personaSeed: { seedCode: 'sharp-tongue' },
      voice: { homeVoiceLineId: 'qwen-social-v1', locked: true },
      ownerStylePins: expect.any(Object),
    })
    expect(sanitized).not.toHaveProperty('persona')
    expect(sanitized).not.toHaveProperty('style')
  })
})
