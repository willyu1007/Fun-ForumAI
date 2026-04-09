import type { Community } from '@/api/types'
import { readCommunityShellCategory } from '../../../shared/semantic-taxonomy.js'

export type CommunityCategory = 'theme' | 'show' | 'world' | 'creator'

export const COMMUNITY_CATEGORY_LABELS: Record<CommunityCategory, string> = {
  theme: '圆桌议题',
  show: '舞台剧',
  world: '剧情导向',
  creator: '创作者内容',
}

export const COMMUNITY_CATEGORY_ORDER: CommunityCategory[] = ['theme', 'show', 'world', 'creator']

export const COMMUNITY_FAMILY_LABELS: Record<string, string> = {
  conflict_arena: '冲突竞技场',
  relationship_jury: '关系法庭',
  persona_drama: '角色抓马',
  values_debate: '价值辩论',
  postmortem_lab: '赛后复盘',
  banter_observer: '吐槽观察',
  night_companion: '深夜陪伴',
  story_episode: '剧情连载',
  creator_recommendation: '创作者安利',
  creator_relationship: '创作者互动',
  weekly_program: '每周企划',
  limited_event: '限定活动',
}

export function resolveCommunityCategory(
  community: Pick<Community, 'slug' | 'name' | 'description' | 'community_semantics'>,
): CommunityCategory {
  const category = readCommunityShellCategory(community)
  if (category) {
    return category
  }

  return 'theme'
}

export function getCommunityCategoryGlyph(category: CommunityCategory) {
  switch (category) {
    case 'show':
      return '幕'
    case 'world':
      return '世'
    case 'creator':
      return '博'
    case 'theme':
    default:
      return '圆'
  }
}

export function getCommunityAvatarToneClassName(category: CommunityCategory) {
  switch (category) {
    case 'show':
      return 'bg-accent/12 text-accent'
    case 'world':
      return 'bg-primary/12 text-primary'
    case 'creator':
      return 'bg-accent/10 text-accent'
    case 'theme':
    default:
      return 'bg-primary/10 text-primary'
  }
}

export interface BannerTheme {
  type: 'custom_image'
  value: string
}

export const PRESET_BANNERS: BannerTheme[] = [
  {
    type: 'custom_image',
    value: '/community-banners/aurora-thread.svg',
  },
  {
    type: 'custom_image',
    value: '/community-banners/lantern-stage.svg',
  },
  {
    type: 'custom_image',
    value: '/community-banners/soft-grid.svg',
  },
  {
    type: 'custom_image',
    value: '/community-banners/midnight-arc.svg',
  },
  {
    type: 'custom_image',
    value: '/community-banners/sea-glow.svg',
  },
  {
    type: 'custom_image',
    value: '/community-banners/blue-depth.svg',
  },
  {
    type: 'custom_image',
    value: '/community-banners/plum-wave.svg',
  },
  {
    type: 'custom_image',
    value: '/community-banners/forest-ribbon.svg',
  },
  {
    type: 'custom_image',
    value: '/community-banners/ember-scene.svg',
  },
]

export interface AvatarTheme {
  type: 'preset' | 'custom_image'
  value: string // image URL
}

export const PRESET_AVATARS: AvatarTheme[] = [
  { type: 'preset', value: '/community-avatars/comm-avatar-01-pixel-sword.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-02-vr-headset.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-03-mecha-core.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-04-d20-dice.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-05-vaporwave-cassette.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-06-lofi-headphones.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-07-magical-wand.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-08-goth-bat.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-09-skateboard.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-10-retro-boombox.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-11-pop-lightstick.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-12-kettlebell.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-13-latte-art.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-14-bonsai-tree.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-15-glowing-book.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-16-spray-can.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-17-crypto-coin.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-18-neon-ufo.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-19-pixel-frog.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-20-zen-symbol.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-21-hologram-planet.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-22-magic-hourglass.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-23-laurel-wreath.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-24-glitch-portal.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-25-greek-column.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-26-pitchfork-halo.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-27-scales-justice.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-28-retro-mic.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-29-on-air-sign.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-30-cyber-chip.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-31-food-cloche.png' },
  { type: 'preset', value: '/community-avatars/comm-avatar-32-vintage-compass.png' },
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function getCommunityBannerTheme(community: Pick<Community, 'slug'>): BannerTheme {
  const index = hashString(community.slug) % PRESET_BANNERS.length
  return PRESET_BANNERS[index]
}

export function getCommunityAvatarTheme(community: Pick<Community, 'slug'>): AvatarTheme {
  // Use a different seed/offset so the avatar doesn't always strictly pair with the same banner
  const index = hashString(community.slug + '-avatar') % PRESET_AVATARS.length
  return PRESET_AVATARS[index]
}
