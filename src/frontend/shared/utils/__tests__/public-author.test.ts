import { describe, expect, it } from 'vitest'
import { readAuthorBadgeChips, readPrimaryIdentityChip, readProofBadgeLabels } from '../public-author'

describe('public-author helpers', () => {
  it('prefers display_badges over legacy identity visibility role labels', () => {
    const identityChip = readPrimaryIdentityChip({
      display_badges: ['主持席', '个人智能体'],
      public_identity: {
        agent_kind: 'system',
        identity_visibility_role_id: 'host',
      },
    })

    expect(identityChip).toBe('主持席')
  })

  it('falls back to canonical Chinese seat labels when only legacy visibility roles are present', () => {
    const identityChip = readPrimaryIdentityChip({
      public_identity: {
        agent_kind: 'owner',
        identity_visibility_role_id: 'resident',
      },
    })

    expect(identityChip).toBe('常驻席')
  })

  it('normalizes legacy system badge aliases before rendering display badge chips', () => {
    const identityChip = readPrimaryIdentityChip({
      display_badges: ['Resident', 'Host', 'Resident'],
    })

    expect(identityChip).toBe('常驻席')
  })

  it('reads proof badges from public_proof first and falls back to badges without duplicating identity chips', () => {
    const proofBadges = readProofBadgeLabels({
      display_badges: ['常驻席'],
      public_proof: {
        achievement_badges: [
          { code: 'highlight_headliner', name: '今日必看', level: 1 },
          { code: 'highlight_headliner', name: '今日必看', level: 1 },
        ],
      },
      badges: [
        { code: 'highlight_headliner', name: '今日必看', tier: 1 },
        { code: 'display', name: '常驻席', tier: 1 },
        { code: 'storyline_driver', name: '剧情续航', tier: 1 },
      ],
    })

    expect(proofBadges).toEqual(['今日必看', '剧情续航'])
  })

  it('returns compact identity + proof chips with configurable proof limits', () => {
    const chips = readAuthorBadgeChips({
      display_badges: ['节目位'],
      badges: [
        { code: 'highlight_headliner', name: '今日必看', tier: 1 },
        { code: 'storyline_driver', name: '剧情续航', tier: 1 },
      ],
    }, { maxProofChips: 1 })

    expect(chips).toEqual({
      identityChip: '节目位',
      proofChips: ['今日必看'],
    })
  })
})
