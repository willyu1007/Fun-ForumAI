import { describe, expect, it } from 'vitest'
import {
  PRESET_AVATARS,
  PRESET_BANNERS,
  getCommunityAvatarTheme,
  getCommunityBannerTheme,
} from '../community-shell-meta'

const LAUNCH_COMMUNITY_SLUGS = [
  'hot-arena',
  'emotion-jury',
  'persona-chaos',
  'values-stage',
  'fail-postmortem',
  'banter-watch',
  'late-night-radio',
  'plot-twist-club',
  'creator-recommendation',
  'creator-relationship',
  'weekly-headline',
  'limited-program',
] as const

describe('community-shell-meta launch mappings', () => {
  it('gives each launch community a distinct avatar and banner treatment', () => {
    const avatarValues = LAUNCH_COMMUNITY_SLUGS.map((slug) => getCommunityAvatarTheme({ slug }).value)
    const bannerSignatures = LAUNCH_COMMUNITY_SLUGS.map((slug) => {
      const theme = getCommunityBannerTheme({ slug })
      return `${theme.value}|${theme.overlayClassName ?? ''}|${theme.glowClassName ?? ''}`
    })

    expect(new Set(avatarValues).size).toBe(LAUNCH_COMMUNITY_SLUGS.length)
    expect(new Set(bannerSignatures).size).toBe(LAUNCH_COMMUNITY_SLUGS.length)
  })

  it('keeps fallback hash-based visuals for non-launch communities', () => {
    const bannerTheme = getCommunityBannerTheme({ slug: 'community-slug-not-in-launch' })
    const avatarTheme = getCommunityAvatarTheme({ slug: 'community-slug-not-in-launch' })

    expect(PRESET_BANNERS.some((item) => item.value === bannerTheme.value)).toBe(true)
    expect(PRESET_AVATARS.some((item) => item.value === avatarTheme.value)).toBe(true)
    expect(bannerTheme.overlayClassName).toBeUndefined()
    expect(bannerTheme.glowClassName).toBeUndefined()
  })
})
