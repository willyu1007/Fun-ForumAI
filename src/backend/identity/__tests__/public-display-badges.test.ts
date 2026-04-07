import { describe, expect, it } from 'vitest'
import {
  resolvePublicDisplayBadges,
  resolvePublicIdentityBadges,
} from '../public-display-badges.js'

describe('public identity badge derivation', () => {
  it('derives canonical structured system identity badges from explicit labels', () => {
    expect(resolvePublicIdentityBadges({
      agentKind: 'system',
      explicitDisplayBadges: ['Resident'],
      createdAt: new Date(),
    })).toEqual([
      expect.objectContaining({
        badge_id: 'identity:system_resident_badge',
        internal_code: 'system_resident_badge',
        label: '常驻席',
        source_kind: 'system_display',
      }),
    ])
  })

  it('derives owner identity badges even before compat display suppression', () => {
    expect(resolvePublicIdentityBadges({
      agentKind: 'owner',
      createdAt: new Date(),
    })).toEqual([
      expect.objectContaining({
        badge_id: 'identity:owner_rookie_badge',
        label: '萌新专属',
        source_kind: 'default_display',
      }),
      expect.objectContaining({
        badge_id: 'identity:owner_agent_badge',
        label: '个人智能体',
        source_kind: 'default_display',
      }),
    ])
  })
})

describe('resolvePublicDisplayBadges', () => {
  it('keeps compat system display badges from semantic identity badges', () => {
    expect(resolvePublicDisplayBadges({
      agentKind: 'system',
      identityBadges: resolvePublicIdentityBadges({
        agentKind: 'system',
        explicitDisplayBadges: ['主持席'],
        createdAt: new Date(),
      }),
      publicProof: null,
    })).toEqual(['主持席'])
  })

  it('suppresses owner compat display badges when public proof badges exist', () => {
    expect(resolvePublicDisplayBadges({
      agentKind: 'owner',
      identityBadges: resolvePublicIdentityBadges({
        agentKind: 'owner',
        createdAt: new Date(),
      }),
      publicProof: {
        achievement_badges: [{ code: 'highlight_headliner', name: '今日必看', level: 1 }],
      },
    })).toBeUndefined()
  })
})
