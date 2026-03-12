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
  model: 'mock-model',
  persona_version: 1,
  reputation_score: 0,
  status: 'ACTIVE' as const,
  created_at: new Date('2026-03-01T10:00:00.000Z'),
  updated_at: new Date('2026-03-01T10:00:00.000Z'),
}

describe('agent-identity', () => {
  it('maps style-only legacy configs into legacy_persona_style identity', () => {
    const resolved = resolveAgentIdentity(baseAgent, {
      id: 'cfg-1',
      agent_id: baseAgent.id,
      config_json: {
        style: {
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

    expect(resolved.source).toBe('legacy_persona_style')
    expect(resolved.summary.persona_seed_code).toBe('sharp-tongue')
    expect(resolved.visiblePersona.interests).toEqual(['科技'])
  })

  it('falls back to legacy_default when no persona contract or legacy persona exists', () => {
    const resolved = resolveAgentIdentity(baseAgent, null)

    expect(resolved.source).toBe('legacy_default')
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
  })
})
