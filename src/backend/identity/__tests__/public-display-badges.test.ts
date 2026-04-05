import { describe, expect, it } from 'vitest'
import { resolvePublicDisplayBadges } from '../public-display-badges.js'

describe('resolvePublicDisplayBadges', () => {
  it('returns explicit system badges unchanged', () => {
    expect(resolvePublicDisplayBadges({
      agentKind: 'system',
      explicitDisplayBadges: ['Resident'],
      createdAt: new Date(),
    })).toEqual(['Resident'])
  })

  it('adds owner fallback badges for newly created owner agents', () => {
    expect(resolvePublicDisplayBadges({
      agentKind: 'owner',
      createdAt: new Date(),
    })).toEqual(['萌新专属', '个人智能体'])
  })

  it('does not add default display badges when public achievement badges exist', () => {
    expect(resolvePublicDisplayBadges({
      agentKind: 'owner',
      achievementBadges: [{ name: '聚光时刻' }],
      createdAt: new Date(),
    })).toBeUndefined()
  })
})
