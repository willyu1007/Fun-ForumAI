import { describe, it, expect } from 'vitest'
import {
  parseStageSpecV1,
  parseStageSpecV1Safe,
  resolveStageSpecFromRules,
  AVAILABILITY_FALLBACK_STAGE_SPEC_V1,
} from '../stage-spec.js'

describe('StageSpecV1', () => {
  it('parses valid stage spec with PERIODIC mode', () => {
    const parsed = parseStageSpecV1({
      version: 'v1',
      min_tier_pool: 'T2',
      roles: {
        resident: { min_tier: 'T3', runtime_gate: true, t4_longform_only: false },
      },
      tier_gate: {
        resident_min_tier: 'T3',
        core_min_tier: 'T3',
        t4_longform_min_tier: 'T4',
      },
      strict_t4: {
        enabled: true,
        premod_required: true,
        min_sources: 3,
        grant_required: true,
        max_ttl_hours: 168,
        redaction: 'strong',
      },
      aftershow: {
        mode: 'PERIODIC',
        threshold: {
          min_comments: 30,
          min_human_vote_score: 10,
        },
        periodic: {
          enabled: false,
          interval_hours: 24,
        },
      },
    })

    expect(parsed.aftershow.mode).toBe('PERIODIC')
    expect(parsed.aftershow.enabled).toBe(true)
    expect(parsed.aftershow.threshold.audience_comments).toBe(30)
    expect(parsed.aftershow.threshold.human_vote_score).toBe(10)
    expect(parsed.aftershow.periodic.enabled).toBe(false)
    expect(parsed.allocator.community_max_agents).toBe(20)
    expect(parsed.human_participation.mode).toBe('A')
    expect(parsed.incubation.enabled).toBe(false)
  })

  it('parses enhanced v1 fields and keeps legacy threshold aliases compatible', () => {
    const parsed = parseStageSpecV1({
      version: 'v1',
      allocator: {
        community_max_agents: 12,
        thread_max_agents: 24,
        cooldown_seconds: 15,
        max_actions_per_hour: 66,
        max_tokens_per_day: 123_456,
        event_base_quota: {
          NewPostCreated: 7,
          NewCommentCreated: 4,
          NewMessageCreated: 2,
          VoteCast: 1,
          RoomTick: 3,
        },
        director_guard: {
          contrast_min_relevance_ratio: 0.5,
          wildcard_min_relevance_ratio: 0.4,
          min_abs_score: 1.2,
          thread_window: 8,
          thread_max_agent_occurrences: 3,
          thread_cooldown_seconds: 1200,
        },
      },
      human_participation: {
        mode: 'B',
        audience_zone_enabled: true,
        agent_reads_audience_zone: false,
        agent_reply_via_aftershow: true,
      },
      incubation: {
        enabled: true,
        seed_source: 'private_digest_only',
        grant_required: true,
        redaction_profile: 'strong',
        research: {
          allow_web_search: false,
          min_sources: 4,
        },
        format: {
          min_words: 800,
          max_words: 1800,
          citation_style: 'endnotes',
        },
      },
      aftershow: {
        enabled: false,
        mode: 'THRESHOLD',
        threshold: {
          min_comments: 99,
          min_human_vote_score: 12,
        },
      },
    })

    expect(parsed.allocator.community_max_agents).toBe(12)
    expect(parsed.human_participation.mode).toBe('B')
    expect(parsed.incubation.enabled).toBe(true)
    expect(parsed.incubation.research.min_sources).toBe(4)
    expect(parsed.aftershow.enabled).toBe(false)
    expect(parsed.aftershow.threshold.audience_comments).toBe(99)
    expect(parsed.aftershow.threshold.human_vote_score).toBe(12)
  })

  it('falls back to default when invalid', () => {
    const resolved = parseStageSpecV1Safe({
      version: 'v1',
      aftershow: {
        mode: 'UNKNOWN',
      },
    })

    expect(resolved.used_fallback).toBe(true)
    expect(resolved.stage_spec.version).toBe('v1')
    expect(resolved.errors.length).toBeGreaterThan(0)
  })

  it('resolves from rules_json and reports fallback on missing config', () => {
    const resolved = resolveStageSpecFromRules({}, { community_id: 'comm-1' })
    expect(resolved.used_fallback).toBe(true)
    expect(resolved.errors[0]).toContain('missing rules_json.stage_spec_v1')
    expect(resolved.stage_spec).toEqual(AVAILABILITY_FALLBACK_STAGE_SPEC_V1)
    expect(resolved.stage_spec.aftershow.mode).toBe('OFF')
    expect(resolved.stage_spec.strict_t4.enabled).toBe(false)
    expect(resolved.stage_spec.tier_gate.resident_min_tier).toBe('T1')
  })
})
