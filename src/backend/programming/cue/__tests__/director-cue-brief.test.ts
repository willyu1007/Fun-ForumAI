/**
 * T-212 M3 — DirectorCueBrief compile (live + dryRun) shape & semantics.
 */

import { describe, it, expect } from 'vitest'
import {
  buildDirectorCueBrief,
  DirectorCueBriefServiceImpl,
} from '../director-cue-brief.js'
import type { PublicDiscussionCueDomain } from '../types.js'
import type { PublicDiscussionCueMediaDomain } from '../../../repos/cue-repository.js'

function makeCue(overrides: Partial<PublicDiscussionCueDomain> = {}): PublicDiscussionCueDomain {
  return {
    id: 'cue_123',
    schedule_id: 'sched_42',
    source_type: 'manual',
    status: 'scheduled',
    community_id: 'c_general',
    scope: { mode: 'single', community_id: 'c_general' },
    trigger_at: '2026-04-26T20:30:00.000Z',
    timezone: 'Asia/Shanghai',
    priority: 50,
    lane: 'standard',
    dispatch_policy: {
      trigger_at: '2026-04-26T20:30:00.000Z',
      timezone: 'Asia/Shanghai',
      dispatch_mode: 'graceful',
      grace_seconds: 60,
      priority: 50,
      lane: 'standard',
      misfire_policy: 'delay',
      max_attempts: 3,
      retry_backoff_seconds: 30,
    },
    theme_intent: {
      topic_seed: 'AI 陪伴边界',
      discussion_question: '何时是越界？',
      angle_hint: '基于真实案例展开',
      tone_band: 'tense_but_playful',
    },
    scene_constraints: {
      community_scope: { mode: 'single', community_id: 'c_general' },
      public_stage_scope: ['forum'],
      privacy_policy: 'public_only',
      private_reference_policy: 'forbidden',
      safety_profile: 'standard',
    },
    role_requirements: {
      requirements: [
        { role: 'anchor', weight: 0.7 },
        { role: 'challenger', weight: 0.8 },
      ],
      relationship_shape: 'contrast',
    },
    locked_fields: [],
    risk_level: 'standard',
    revision: 1,
    idempotency_key: 'cue:sched_42:pending-aaaaaaaaaaaa:0',
    created_at: '2026-04-26T19:00:00.000Z',
    updated_at: '2026-04-26T19:00:00.000Z',
    ...overrides,
  }
}

function makeMedia(
  overrides: Partial<PublicDiscussionCueMediaDomain> = {},
): PublicDiscussionCueMediaDomain {
  return {
    id: 'cmed_1',
    cue_id: 'cue_123',
    asset_id: 'asset_1',
    semantic_snapshot_id: null,
    role: 'mood_reference',
    usage_strength: 'preferred',
    use_policy: 'prefer_runtime_context',
    display_policy: 'runtime_decides',
    selection_note: null,
    sort_order: 0,
    reuse_limit: null,
    validation_status: 'valid',
    validation_reason: null,
    created_by_type: 'admin',
    created_by_id: 'user-1',
    created_at: new Date('2026-04-26T19:00:00.000Z'),
    ...overrides,
  }
}

describe('buildDirectorCueBrief — live mode', () => {
  it('returns source=live with the provided attempt id', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue(),
      attemptId: 'att_1',
    })
    expect(brief.source).toBe('live')
    expect(brief.programming.audit_refs.attempt_id).toBe('att_1')
    expect(brief.overlay.status).toBe('active')
  })

  it('throws when attemptId is missing in live mode', () => {
    // @ts-expect-error — intentionally missing required attemptId
    expect(() => buildDirectorCueBrief({ cue: makeCue() })).toThrow(
      /attemptId is required/,
    )
  })

  it('carries cue audit refs (schedule, cue, source_type) verbatim', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue({ source_type: 'baseline' }),
      attemptId: 'att_1',
    })
    expect(brief.programming.audit_refs).toEqual({
      schedule_id: 'sched_42',
      cue_id: 'cue_123',
      attempt_id: 'att_1',
      source_type: 'baseline',
    })
  })

  it('attaches change ids when provided', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue(),
      attemptId: 'att_1',
      changeIds: ['ch_a', 'ch_b'],
    })
    expect(brief.programming.audit_refs.change_ids).toEqual(['ch_a', 'ch_b'])
  })

  it('omits change_ids when none provided (back-compat with no audit linkage)', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue(),
      attemptId: 'att_1',
    })
    expect(brief.programming.audit_refs.change_ids).toBeUndefined()
  })

  it('translates source_type to overlay.source.type per the editorial / automated / autonomous bucket map', () => {
    expect(
      buildDirectorCueBrief({
        cue: makeCue({ source_type: 'manual' }),
        attemptId: 'a',
      }).overlay.source.type,
    ).toBe('editorial')
    expect(
      buildDirectorCueBrief({
        cue: makeCue({ source_type: 'baseline' }),
        attemptId: 'a',
      }).overlay.source.type,
    ).toBe('editorial')
    expect(
      buildDirectorCueBrief({
        cue: makeCue({ source_type: 'automated' }),
        attemptId: 'a',
      }).overlay.source.type,
    ).toBe('automated')
    expect(
      buildDirectorCueBrief({
        cue: makeCue({ source_type: 'system' }),
        attemptId: 'a',
      }).overlay.source.type,
    ).toBe('autonomous')
  })

  it('maps cue risk_level to overlay safety.risk_level (low / medium / high)', () => {
    expect(
      buildDirectorCueBrief({
        cue: makeCue({ risk_level: 'low' }),
        attemptId: 'a',
      }).overlay.safety.risk_level,
    ).toBe('low')
    expect(
      buildDirectorCueBrief({
        cue: makeCue({ risk_level: 'standard' }),
        attemptId: 'a',
      }).overlay.safety.risk_level,
    ).toBe('medium')
    expect(
      buildDirectorCueBrief({
        cue: makeCue({ risk_level: 'high' }),
        attemptId: 'a',
      }).overlay.safety.risk_level,
    ).toBe('high')
    expect(
      buildDirectorCueBrief({
        cue: makeCue({ risk_level: 'strict_review' }),
        attemptId: 'a',
      }).overlay.safety.risk_level,
    ).toBe('high')
  })

  it('builds topic_bundle from topic_seed + discussion_question + angle_hint', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue(),
      attemptId: 'a',
    })
    expect(brief.overlay.topical_context.topic_bundle).toEqual([
      'AI 陪伴边界',
      '何时是越界？',
      '基于真实案例展开',
    ])
  })

  it('sets safety + privacy boundaries unconditionally', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue(),
      attemptId: 'a',
    })
    expect(brief.programming.safety_boundary).toEqual({
      no_persona_writeback: true,
      no_private_leak: true,
    })
    expect(brief.programming.privacy_boundary.privacy_mode).toBe('public_only')
    expect(brief.programming.privacy_boundary.prohibited_reference_types).toEqual([
      'owner_private_speech',
      'private_memory',
      'hidden_director_goal',
    ])
  })

  it('includes valid + degraded media in pool, sorted by sort_order, excluding invalid/blocked', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue(),
      attemptId: 'a',
      media: [
        makeMedia({ id: 'm2', asset_id: 'a2', sort_order: 5 }),
        makeMedia({ id: 'm1', asset_id: 'a1', sort_order: 0, validation_status: 'valid' }),
        makeMedia({ id: 'm3', asset_id: 'a3', sort_order: 2, validation_status: 'invalid' }),
        makeMedia({ id: 'm4', asset_id: 'a4', sort_order: 1, validation_status: 'blocked' }),
        makeMedia({ id: 'm5', asset_id: 'a5', sort_order: 3, validation_status: 'degraded' }),
      ],
    })
    expect(brief.programming.media_resource_pool.map((m) => m.asset_id)).toEqual([
      'a1',
      'a5',
      'a2',
    ])
  })

  it('uses cue.expire_at for overlay TTL when provided', () => {
    const expire = '2026-04-27T00:00:00.000Z'
    const brief = buildDirectorCueBrief({
      cue: makeCue({ expire_at: expire }),
      attemptId: 'a',
    })
    expect(brief.overlay.ttl.expire_at).toBe(expire)
  })

  it('falls back to trigger_at + 24h for overlay TTL when no expire_at', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue(),
      attemptId: 'a',
    })
    expect(brief.overlay.ttl.expire_at).toBe('2026-04-27T20:30:00.000Z')
  })
})

describe('buildDirectorCueBrief — dryRun mode', () => {
  it('returns source=preview_dry_run with overlay.status=draft', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue(),
      dryRun: true,
    })
    expect(brief.source).toBe('preview_dry_run')
    expect(brief.overlay.status).toBe('draft')
  })

  it('uses attemptId="preview" when caller does not supply one', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue(),
      dryRun: true,
    })
    expect(brief.programming.audit_refs.attempt_id).toBe('preview')
  })

  it('respects supplied attemptId in dryRun mode', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue(),
      dryRun: true,
      attemptId: 'preview-XYZ',
    })
    expect(brief.programming.audit_refs.attempt_id).toBe('preview-XYZ')
  })

  it('produces a deterministic preview overlay_id (no attempt_id in id)', () => {
    const brief = buildDirectorCueBrief({
      cue: makeCue({ id: 'cue_xyz' }),
      dryRun: true,
    })
    expect(brief.overlay.overlay_id).toBe('cue_overlay_preview_cue_xyz')
  })
})

describe('DirectorCueBriefServiceImpl', () => {
  it('compile() awaits buildDirectorCueBrief and yields the same shape', async () => {
    const service = new DirectorCueBriefServiceImpl()
    const brief = await service.compile({
      cue: makeCue(),
      attemptId: 'att_1',
    })
    expect(brief.source).toBe('live')
    expect(brief.programming.audit_refs.cue_id).toBe('cue_123')
  })
})
