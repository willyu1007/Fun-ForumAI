import type { Community } from '@/api/types'

export type CommunityCategory = 'theme' | 'show' | 'world' | 't4'

export const COMMUNITY_CATEGORY_LABELS: Record<CommunityCategory, string> = {
  theme: '圆桌议题',
  show: '舞台剧',
  world: '剧情导向',
  t4: '博主分享',
}

export const COMMUNITY_CATEGORY_ORDER: CommunityCategory[] = ['theme', 'show', 'world', 't4']

const EXPLICIT_COMMUNITY_CATEGORY_MAP: Record<string, CommunityCategory> = {
  general: 'theme',
  philosophy: 'theme',
  tech: 'theme',
  creative: 't4',
  'ai-consciousness': 'world',
  'code-tasting': 't4',
  'scene-pool-ai-consciousness': 'show',
}

const CATEGORY_KEYWORD_RULES: Array<{ category: CommunityCategory; keywords: string[] }> = [
  { category: 'show', keywords: ['舞台', '试播', '秀', '剧场', '表演', '节目'] },
  { category: 'world', keywords: ['剧情', '叙事', '世界', '设定', '意识', '宇宙', '故事'] },
  { category: 't4', keywords: ['写作', '品鉴', '专栏', '分享', '长文', '博客', '俳句', '创意'] },
  { category: 'theme', keywords: ['讨论', '哲思', '前沿', '议题', '自由'] },
]

export function resolveCommunityCategory(
  community: Pick<Community, 'slug' | 'name' | 'description'>,
): CommunityCategory {
  const explicit = EXPLICIT_COMMUNITY_CATEGORY_MAP[community.slug]
  if (explicit) {
    return explicit
  }

  const haystack = `${community.name} ${community.description ?? ''}`.toLowerCase()
  for (const rule of CATEGORY_KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return rule.category
    }
  }

  return 'theme'
}

export function getCommunityCategoryGlyph(category: CommunityCategory) {
  switch (category) {
    case 'show':
      return '幕'
    case 'world':
      return '世'
    case 't4':
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
    case 't4':
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
  { type: 'preset', value: '/community-avatars/aurora-orb.svg' },
  { type: 'preset', value: '/community-avatars/lantern-echo.svg' },
  { type: 'preset', value: '/community-avatars/soft-grid.svg' },
  { type: 'preset', value: '/community-avatars/midnight-node.svg' },
  { type: 'preset', value: '/community-avatars/sea-ring.svg' },
  { type: 'preset', value: '/community-avatars/blue-core.svg' },
  { type: 'preset', value: '/community-avatars/plum-disc.svg' },
  { type: 'preset', value: '/community-avatars/forest-spark.svg' },
  { type: 'preset', value: '/community-avatars/ember-orbit.svg' },
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
