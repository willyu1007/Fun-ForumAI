import type { Community, CommunitySemanticContract } from '@/api/types'
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

type CommunityCategoryCarrier = Pick<Community, 'slug' | 'name' | 'description'> & {
  community_semantics?: Partial<Pick<CommunitySemanticContract, 'community_shell_category'>> | null
}

export function resolveCommunityCategory(community: CommunityCategoryCarrier): CommunityCategory {
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
  overlayClassName?: string
  glowClassName?: string
}

export const PRESET_BANNERS: BannerTheme[] = [
  {
    type: 'custom_image',
    value: '/community-banners/aurora-thread.webp',
  },
  {
    type: 'custom_image',
    value: '/community-banners/lantern-stage.webp',
  },
  {
    type: 'custom_image',
    value: '/community-banners/soft-grid.webp',
  },
  {
    type: 'custom_image',
    value: '/community-banners/midnight-arc.webp',
  },
  {
    type: 'custom_image',
    value: '/community-banners/sea-glow.webp',
  },
  {
    type: 'custom_image',
    value: '/community-banners/blue-depth.webp',
  },
  {
    type: 'custom_image',
    value: '/community-banners/plum-wave.webp',
  },
  {
    type: 'custom_image',
    value: '/community-banners/forest-ribbon.webp',
  },
  {
    type: 'custom_image',
    value: '/community-banners/ember-scene.webp',
  },
]

export interface AvatarTheme {
  type: 'preset' | 'custom_image'
  value: string // image URL
}

type LaunchCommunitySlug =
  | 'hot-arena'
  | 'emotion-jury'
  | 'persona-chaos'
  | 'values-stage'
  | 'fail-postmortem'
  | 'banter-watch'
  | 'late-night-radio'
  | 'plot-twist-club'
  | 'creator-recommendation'
  | 'creator-relationship'
  | 'weekly-headline'
  | 'limited-program'

interface LaunchCommunityVisualTheme {
  banner: BannerTheme
  avatar: AvatarTheme
}

export const PRESET_AVATARS: AvatarTheme[] = [
  { type: 'preset', value: '/community-avatars/comm-avatar-01-pixel-sword.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-02-vr-headset.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-03-mecha-core.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-04-d20-dice.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-05-vaporwave-cassette.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-06-lofi-headphones.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-07-magical-wand.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-08-goth-bat.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-09-skateboard.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-10-retro-boombox.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-11-pop-lightstick.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-12-kettlebell.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-13-latte-art.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-14-bonsai-tree.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-15-glowing-book.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-16-spray-can.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-17-crypto-coin.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-18-neon-ufo.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-19-pixel-frog.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-20-zen-symbol.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-21-hologram-planet.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-22-magic-hourglass.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-23-laurel-wreath.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-24-glitch-portal.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-25-greek-column.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-26-pitchfork-halo.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-27-scales-justice.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-28-retro-mic.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-29-on-air-sign.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-30-cyber-chip.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-31-food-cloche.webp' },
  { type: 'preset', value: '/community-avatars/comm-avatar-32-vintage-compass.webp' },
]

const LAUNCH_COMMUNITY_VISUAL_THEMES: Record<LaunchCommunitySlug, LaunchCommunityVisualTheme> = {
  'hot-arena': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/ember-scene.webp',
      overlayClassName: 'bg-gradient-to-r from-rose-950/60 via-orange-950/18 to-transparent',
      glowClassName: 'bg-orange-500/24',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-01-pixel-sword.webp' },
  },
  'emotion-jury': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/blue-depth.webp',
      overlayClassName: 'bg-gradient-to-r from-slate-950/62 via-blue-950/18 to-transparent',
      glowClassName: 'bg-sky-400/18',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-27-scales-justice.webp' },
  },
  'persona-chaos': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/aurora-thread.webp',
      overlayClassName: 'bg-gradient-to-r from-fuchsia-950/55 via-violet-950/18 to-transparent',
      glowClassName: 'bg-fuchsia-500/22',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-24-glitch-portal.webp' },
  },
  'values-stage': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/lantern-stage.webp',
      overlayClassName: 'bg-gradient-to-r from-amber-950/55 via-stone-950/14 to-transparent',
      glowClassName: 'bg-amber-400/18',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-25-greek-column.webp' },
  },
  'fail-postmortem': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/soft-grid.webp',
      overlayClassName: 'bg-gradient-to-r from-slate-950/64 via-zinc-950/18 to-transparent',
      glowClassName: 'bg-slate-300/16',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-22-magic-hourglass.webp' },
  },
  'banter-watch': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/sea-glow.webp',
      overlayClassName: 'bg-gradient-to-r from-emerald-950/52 via-cyan-950/16 to-transparent',
      glowClassName: 'bg-cyan-400/18',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-10-retro-boombox.webp' },
  },
  'late-night-radio': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/midnight-arc.webp',
      overlayClassName: 'bg-gradient-to-r from-indigo-950/64 via-slate-950/20 to-transparent',
      glowClassName: 'bg-indigo-400/18',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-28-retro-mic.webp' },
  },
  'plot-twist-club': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/forest-ribbon.webp',
      overlayClassName: 'bg-gradient-to-r from-green-950/54 via-emerald-950/14 to-transparent',
      glowClassName: 'bg-emerald-400/18',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-08-goth-bat.webp' },
  },
  'creator-recommendation': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/plum-wave.webp',
      overlayClassName: 'bg-gradient-to-r from-rose-950/50 via-fuchsia-950/14 to-transparent',
      glowClassName: 'bg-pink-400/18',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-31-food-cloche.webp' },
  },
  'creator-relationship': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/forest-ribbon.webp',
      overlayClassName: 'bg-gradient-to-r from-stone-950/54 via-rose-950/16 to-transparent',
      glowClassName: 'bg-rose-300/18',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-14-bonsai-tree.webp' },
  },
  'weekly-headline': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/blue-depth.webp',
      overlayClassName: 'bg-gradient-to-r from-slate-950/66 via-sky-950/16 to-transparent',
      glowClassName: 'bg-sky-300/16',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-32-vintage-compass.webp' },
  },
  'limited-program': {
    banner: {
      type: 'custom_image',
      value: '/community-banners/lantern-stage.webp',
      overlayClassName: 'bg-gradient-to-r from-orange-950/52 via-amber-950/16 to-transparent',
      glowClassName: 'bg-yellow-400/18',
    },
    avatar: { type: 'preset', value: '/community-avatars/comm-avatar-04-d20-dice.webp' },
  },
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

function resolveLaunchCommunityVisualTheme(
  community: Pick<Community, 'slug'>,
): LaunchCommunityVisualTheme | null {
  const theme = LAUNCH_COMMUNITY_VISUAL_THEMES[community.slug as LaunchCommunitySlug]
  return theme ?? null
}

export function getCommunityBannerTheme(community: Pick<Community, 'slug'>): BannerTheme {
  const explicitTheme = resolveLaunchCommunityVisualTheme(community)
  if (explicitTheme) {
    return explicitTheme.banner
  }
  const index = hashString(community.slug) % PRESET_BANNERS.length
  return PRESET_BANNERS[index]
}

export function getCommunityAvatarTheme(community: Pick<Community, 'slug'>): AvatarTheme {
  const explicitTheme = resolveLaunchCommunityVisualTheme(community)
  if (explicitTheme) {
    return explicitTheme.avatar
  }
  // Use a different seed/offset so the avatar doesn't always strictly pair with the same banner
  const index = hashString(community.slug + '-avatar') % PRESET_AVATARS.length
  return PRESET_AVATARS[index]
}
