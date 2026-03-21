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

export function getCommunityBannerClassName(category: CommunityCategory) {
  switch (category) {
    case 'show':
      return 'from-accent/28 via-primary/10 to-background'
    case 'world':
      return 'from-primary/30 via-accent/12 to-primary/5'
    case 't4':
      return 'from-accent/18 via-accent/8 to-background'
    case 'theme':
    default:
      return 'from-primary/28 via-primary/10 to-background'
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
