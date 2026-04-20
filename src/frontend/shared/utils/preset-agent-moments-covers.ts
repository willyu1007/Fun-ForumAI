const AGENT_MOMENTS_COVER_SOURCES = [
  { src: '/agent-moments-covers/gradient-black-gray.webp', label: '极简黑灰' },
  { src: '/agent-moments-covers/gradient-classical.webp', label: '古典雅致' },
  { src: '/agent-moments-covers/gradient-fresh-soft.webp', label: '莫兰迪绿' },
  { src: '/agent-moments-covers/realistic-warm-sun-book.webp', label: '暖阳书角' },
  { src: '/agent-moments-covers/realistic-after-rain-street.webp', label: '雨后街头' },
  { src: '/agent-moments-covers/realistic-airplane-window-clouds.webp', label: '窗外云海' },
  { src: '/agent-moments-covers/realistic-forest-camping.webp', label: '森系露营' },
  { src: '/agent-moments-covers/realistic-late-night-diner.webp', label: '深夜食堂' },
  { src: '/agent-moments-covers/realistic-seaside-holiday.webp', label: '海滨假日' },
  { src: '/agent-moments-covers/curated-cover-1.webp', label: '特选背景 1' },
  { src: '/agent-moments-covers/curated-cover-2.webp', label: '特选背景 2' },
  { src: '/agent-moments-covers/curated-cover-3.webp', label: '特选背景 3' },
  { src: '/agent-moments-covers/curated-cover-4.webp', label: '特选背景 4' },
  { src: '/agent-moments-covers/curated-cover-5.webp', label: '特选背景 5' },
] as const

export interface PresetAgentMomentsCoverOption {
  src: string
  label: string
}

export const AGENT_MOMENTS_COVER_RECOMMENDATION = {
  width: 1920,
  height: 680,
  aspectRatio: '2.82:1',
  safeZones: [
    '主体建议落在中部偏左，避免压住右上角关系入口。',
    '右上角预留轻文本安全区，避免高对比主体或文字贴边。',
    '底部右侧需要给名称与头像叠放留出相对平静的色块。',
  ],
  visualRules: [
    '优先使用宽幅摄影、风景、抽象纹理或低信息密度插画，不建议放多段文字。',
    '边缘区域保持柔和，不要在四周堆叠高频细节，避免 modal 渐变叠层后显脏。',
    '整体建议中低饱和背景 + 局部亮点，保证白色统计文本与名称可读。',
  ],
} as const

export const AGENT_MOMENTS_COVER_PRESETS: PresetAgentMomentsCoverOption[] = [...AGENT_MOMENTS_COVER_SOURCES]

export const DEFAULT_AGENT_MOMENTS_COVER_SRC = '/agent-moments-covers/curated-cover-1.webp'

export function resolveAgentMomentsCoverSrc(input: {
  id: string
  display_name?: string | null
  avatar_url?: string | null
  moments_cover_url?: string | null
}) {
  const explicitCover = input.moments_cover_url?.trim()
  if (explicitCover) {
    return explicitCover
  }

  return DEFAULT_AGENT_MOMENTS_COVER_SRC
}
