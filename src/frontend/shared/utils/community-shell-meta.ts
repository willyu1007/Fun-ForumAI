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
  type: 'preset' | 'custom_image'
  /** CSS linear-gradient() for preset, or image URL for custom_image */
  value: string
  texture?: string
}

const NOISE_TEXTURE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E")`

export const PRESET_BANNERS: BannerTheme[] = [
  {
    type: 'preset',
    value: 'linear-gradient(to right, #2dd4bf, #6366f1, #9333ea)',
    texture: `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0H0v20h20V0z' fill='none'/%3E%3Cpath d='M20 19.5H0v-1h20v1zM19.5 20V0h-1v20h1z' fill='rgba(255,255,255,0.15)'/%3E%3C/svg%3E")`,
  },
  {
    type: 'preset',
    value: 'linear-gradient(to right, #fb7185, #d946ef, #6366f1)',
    texture: `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='2' fill='rgba(255,255,255,0.15)'/%3E%3C/svg%3E")`,
  },
  {
    type: 'preset',
    value: 'linear-gradient(to right, #67e8f9, #f9a8d4, #fde047)',
    texture: `url("data:image/svg+xml,%3Csvg width='10' height='10' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M-1 11L11 -1M-1 1L1 -1M9 11L11 9' stroke='rgba(255,255,255,0.15)' stroke-width='2'/%3E%3C/svg%3E")`,
  },
  {
    type: 'preset',
    value: 'linear-gradient(to right, #0f172a, #1e1b4b, #0f172a)',
    texture: `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 0v20M0 10h20' stroke='rgba(255,255,255,0.15)' stroke-width='1'/%3E%3C/svg%3E")`,
  },
  {
    type: 'preset',
    value: 'linear-gradient(to right, #10b981, #0d9488, #0e7490)',
    texture: `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10l5-5 5 5 5-5 5 5' fill='none' stroke='rgba(255,255,255,0.15)' stroke-width='2'/%3E%3C/svg%3E")`,
  },
  {
    type: 'preset',
    value: 'linear-gradient(to right, #2563eb, #4338ca, #3730a3)',
    texture: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 200'%3E%3Ccircle cx='400' cy='250' r='200' fill='rgba(255,255,255,0.05)'/%3E%3Ccircle cx='400' cy='250' r='150' fill='rgba(255,255,255,0.05)'/%3E%3Ccircle cx='400' cy='250' r='100' fill='rgba(255,255,255,0.05)'/%3E%3C/svg%3E")`,
  },
  {
    type: 'preset',
    value: 'linear-gradient(to right, #6b21a8, #701a75, #881337)',
    texture: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 200'%3E%3Cpolygon points='200,-50 50,300 350,300' fill='rgba(255,255,255,0.07)'/%3E%3Cpolygon points='600,-50 450,300 750,300' fill='rgba(255,255,255,0.07)'/%3E%3C/svg%3E")`,
  },
  {
    type: 'preset',
    value: 'linear-gradient(to right, #065f46, #134e4a, #042f2e)',
    texture: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 200'%3E%3Cpolygon points='-100,250 150,80 400,250' fill='rgba(255,255,255,0.05)'/%3E%3Cpolygon points='250,250 500,40 850,250' fill='rgba(255,255,255,0.08)'/%3E%3C/svg%3E")`,
  },
  {
    type: 'preset',
    value: 'linear-gradient(to right, #f97316, #d97706, #b45309)',
    texture: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 200'%3E%3Crect x='100' y='50' width='120' height='120' rx='24' fill='rgba(255,255,255,0.08)' transform='rotate(15 160 110)'/%3E%3Crect x='600' y='20' width='80' height='80' rx='16' fill='rgba(255,255,255,0.1)' transform='rotate(-10 640 60)'/%3E%3Ccircle cx='450' cy='150' r='50' fill='rgba(255,255,255,0.06)'/%3E%3C/svg%3E")`,
  },
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
