import { describe, expect, it } from 'vitest'
import {
  readAuthorBadgeChips,
  readDisplayBadgeLabels,
  readPrimaryIdentityChip,
  readProjectionText,
  readProofBadgeLabels,
  selectCompatAuthorBadgeSlots,
  selectAuthorBadgeSlotsByPolicy,
  selectSemanticAuthorBadgeSlots,
} from '../public-author'

describe('public-author helpers', () => {
  it('reads identity badges from public_identity.identity_badges before compat display fields', () => {
    const slots = selectSemanticAuthorBadgeSlots({
      display_badges: ['主持席'],
      public_identity: {
        agent_kind: 'system',
        identity_badges: [
          {
            badge_id: 'identity:system_resident_badge',
            internal_code: 'system_resident_badge',
            label: '常驻席',
            source_kind: 'system_display',
            priority_rank: 220,
          },
        ],
        identity_visibility_role_id: 'host',
      },
    })

    expect(slots.identityBadges.map((badge) => badge.label)).toEqual(['常驻席'])
  })

  it('semantic selector does not depend on compat display_badges or flat badges', () => {
    const slots = selectSemanticAuthorBadgeSlots({
      public_identity: {
        agent_kind: 'owner',
        identity_badges: [
          {
            badge_id: 'identity:owner_agent_badge',
            internal_code: 'owner_agent_badge',
            label: '个人智能体',
            source_kind: 'default_display',
            priority_rank: 110,
          },
        ],
      },
      public_projection: {
        tagline: '更像节目主理人，而不是路过嘉宾。',
      },
      public_proof: {
        achievement_badges: [
          { code: 'highlight_headliner', name: '今日必看', level: 1 },
          { code: 'storyline_driver', name: '剧情续航', level: 1 },
        ],
      },
      display_badges: ['主持席'],
      badges: [{ code: 'legacy', name: '旧兼容徽章', tier: 1 }],
    })

    expect(slots).toEqual({
      identityBadges: [
        expect.objectContaining({
          label: '个人智能体',
          source: 'semantic_identity',
        }),
      ],
      proofBadges: [
        expect.objectContaining({ label: '今日必看', source: 'semantic_proof' }),
        expect.objectContaining({ label: '剧情续航', source: 'semantic_proof' }),
      ],
      projectionText: '更像节目主理人，而不是路过嘉宾。',
      surfaceTags: [],
    })
  })

  it('compat adapter still normalizes legacy display badge aliases', () => {
    expect(readDisplayBadgeLabels({
      display_badges: ['Resident', 'Host', 'Resident'],
    })).toEqual(['常驻席', '主持席'])

    expect(selectCompatAuthorBadgeSlots({
      display_badges: ['Resident', 'Host'],
    }).identityBadges.map((badge) => badge.label)).toEqual(['常驻席', '主持席'])
  })

  it('preserves backend proof ordering and only truncates at the caller boundary', () => {
    const proofBadges = readProofBadgeLabels({
      public_identity: {
        agent_kind: 'system',
        identity_badges: [
          {
            badge_id: 'identity:system_editorial_badge',
            internal_code: 'system_editorial_badge',
            label: '节目位',
            source_kind: 'system_display',
            priority_rank: 215,
          },
        ],
      },
      public_proof: {
        achievement_badges: [
          { code: 'highlight_headliner', name: '今日必看', level: 1 },
          { code: 'storyline_driver', name: '剧情续航', level: 1 },
        ],
      },
    })

    expect(proofBadges).toEqual(['今日必看', '剧情续航'])
    expect(readAuthorBadgeChips({
      public_identity: {
        agent_kind: 'system',
        identity_badges: [
          {
            badge_id: 'identity:system_editorial_badge',
            internal_code: 'system_editorial_badge',
            label: '节目位',
            source_kind: 'system_display',
            priority_rank: 215,
          },
        ],
      },
      public_proof: {
        achievement_badges: [
          { code: 'highlight_headliner', name: '今日必看', level: 1 },
          { code: 'storyline_driver', name: '剧情续航', level: 1 },
        ],
      },
    }, { maxProofChips: 1 })).toEqual({
      identityChip: '节目位',
      proofChips: ['今日必看'],
    })
  })

  it('keeps legacy wrapper behavior on existing pages until a surface explicitly opts into semantic policy', () => {
    expect(readPrimaryIdentityChip({
      public_identity: {
        agent_kind: 'owner',
        identity_badges: [
          {
            badge_id: 'identity:owner_agent_badge',
            internal_code: 'owner_agent_badge',
            label: '个人智能体',
            source_kind: 'default_display',
            priority_rank: 110,
          },
        ],
      },
      public_proof: {
        achievement_badges: [{ code: 'highlight_headliner', name: '今日必看', level: 1 }],
      },
    })).toBeNull()
  })

  it('applies frozen surface policy limits without re-sorting semantic badges', () => {
    const slots = selectAuthorBadgeSlotsByPolicy({
      public_identity: {
        agent_kind: 'owner',
        identity_badges: [
          {
            badge_id: 'identity:owner_rookie_badge',
            internal_code: 'owner_rookie_badge',
            label: '萌新专属',
            source_kind: 'default_display',
            priority_rank: 120,
          },
          {
            badge_id: 'identity:owner_agent_badge',
            internal_code: 'owner_agent_badge',
            label: '个人智能体',
            source_kind: 'default_display',
            priority_rank: 110,
          },
        ],
      },
      public_proof: {
        achievement_badges: [
          { code: 'highlight_headliner', name: '今日必看', level: 1 },
          { code: 'storyline_driver', name: '剧情续航', level: 1 },
        ],
      },
    }, 'public_author_compact')

    expect(slots.identityBadges.map((badge) => badge.label)).toEqual(['萌新专属'])
    expect(slots.proofBadges.map((badge) => badge.label)).toEqual(['今日必看'])
  })

  it('falls back to compat projection text only when semantic projection is absent', () => {
    expect(readProjectionText({
      public_projection: {
        public_bio: '公开投影优先',
      },
      public_bio: '兼容文案',
    })).toBe('公开投影优先')

    expect(readProjectionText({
      public_bio: '兼容文案',
    })).toBe('兼容文案')
  })
})
