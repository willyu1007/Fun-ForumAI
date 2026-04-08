import { describe, expect, it } from 'vitest'
import {
  readAuthorBadgeChips,
  readProjectionText,
  readSemanticProofBadgeLabels,
  selectAuthorBadgeSlotsByPolicy,
  selectSemanticAuthorBadgeSlots,
} from '../public-author'

describe('public-author helpers', () => {
  it('reads identity badges from public_identity.identity_badges only', () => {
    const slots = selectSemanticAuthorBadgeSlots({
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

  it('preserves backend proof ordering and only truncates at the caller boundary', () => {
    const proofBadges = readSemanticProofBadgeLabels({
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
    }, {
      maxProofChips: 1,
      policyId: 'public_author_medium',
    })).toEqual({
      identityChip: '节目位',
      proofChips: ['今日必看'],
    })
  })

  it('returns semantic identity/proof chips when a surface opts into a public policy', () => {
    expect(readAuthorBadgeChips({
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
    }, {
      maxProofChips: 1,
      policyId: 'public_author_medium',
    })).toEqual({
      identityChip: '个人智能体',
      proofChips: ['今日必看'],
    })
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

  it('reads projection text from semantic projection only', () => {
    expect(readProjectionText({
      public_projection: {
        public_bio: '公开投影优先',
      },
    })).toBe('公开投影优先')

    expect(readProjectionText({})).toBeNull()
  })
})
