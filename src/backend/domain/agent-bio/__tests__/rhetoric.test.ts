import { describe, expect, it } from 'vitest'
import type { AgentBioWorldviewModel } from '../types.js'
import { computePreferredRhetoricFamilies } from '../rhetoric.js'

function buildWorldview(
  overrides: Partial<AgentBioWorldviewModel> = {},
): AgentBioWorldviewModel {
  return {
    identity: {
      display_name: '阿澈',
      persona_seed_label: '中性型',
      home_voice_line_id: 'qwen-social-v1',
      voice_line_label: 'Qwen Social v1',
      visible_style: '克制',
      interests: ['旧地图'],
      mood: '偏中性',
    },
    projection: {
      public_projection_hint: '会把旧地图重新摆回台面',
      banter_style: 'gentle',
      top_scene: 'ROUND_TABLE',
      signature_moves: ['回身总结'],
    },
    public_history: {
      badges: [],
      tagline: '会把旧地图讲成新入口',
      top_chronicle_summaries: ['会把旧地图讲成新入口'],
    },
    owner_history: {
      chronicle_summaries: [],
      private_memory_summaries: [],
      dominant_private_sentiment: null,
    },
    relations: {
      following_effective: 0,
      followers_effective: 0,
      mutual_effective: 0,
      recent_state_tags: [],
    },
    persona_state: {
      maturity: 'steady',
      confidence: 0.42,
      drift_score: 0.18,
    },
    presence: {
      bucket: 'steady',
      score: 0.6,
      note_seed: '状态稳定',
      last_touch_at: null,
    },
    source_clauses: {
      public_safe: ['旧地图'],
      owner_only: [],
      private_header: [],
      private_guard: [],
    },
    ...overrides,
  }
}

describe('computePreferredRhetoricFamilies', () => {
  it('boosts stance-heavy system identities with strong stance axis', () => {
    const baseline = computePreferredRhetoricFamilies(buildWorldview())
    const systemWeighted = computePreferredRhetoricFamilies(buildWorldview({
      system_identity: {
        agent_kind: 'system',
        program_role: 'anchor',
        visibility_role: 'resident',
        home_community: '热点擂台',
        stance_axis: 'strong',
        humor_axis: 'medium',
        empathy_axis: 'low',
        narrative_axis: 'low',
        signature_topics: ['热点'],
        signature_relationships: [],
        role_promise: '负责点火',
        viewer_hook_style: '先给立场',
        forbidden_tones: ['官方通报腔'],
        private_lane_policy: 'public_only',
      },
    }))

    expect(systemWeighted.family_weights.stance).toBeGreaterThan(
      baseline.family_weights.stance ?? 0,
    )
    expect(systemWeighted.preferred_families[0]).toBe('stance')
  })

  it('boosts reflective families when empathy and narrative axes are high', () => {
    const baseline = computePreferredRhetoricFamilies(buildWorldview())
    const systemWeighted = computePreferredRhetoricFamilies(buildWorldview({
      system_identity: {
        agent_kind: 'system',
        program_role: 'anchor',
        visibility_role: 'resident',
        home_community: '深夜电台',
        stance_axis: 'low',
        humor_axis: 'low',
        empathy_axis: 'high',
        narrative_axis: 'high',
        signature_topics: ['夜聊'],
        signature_relationships: [],
        role_promise: '负责陪伴',
        viewer_hook_style: '先接住情绪',
        forbidden_tones: ['热搜播报腔'],
        private_lane_policy: 'public_only',
      },
    }))

    expect(systemWeighted.family_weights.phase_shadow).toBeGreaterThan(
      baseline.family_weights.phase_shadow ?? 0,
    )
    expect(systemWeighted.family_weights.contrast).toBeGreaterThan(
      baseline.family_weights.contrast ?? 0,
    )
  })
})
