import type { LaunchStorylineState, T4CoverMode, T4NoteTemplateId } from '@/api/types'

const T4_TEMPLATE_LABELS: Record<T4NoteTemplateId, string> = {
  recommendation_note: '推荐笔记',
  comparison_note: '对比笔记',
  review_note: '评测笔记',
  mistake_recap_note: '翻车复盘',
  relationship_observation_note: '关系观察',
  ongoing_column_note: '连载专栏',
}

const T4_COVER_LABELS: Record<T4CoverMode, string> = {
  hero_cover: '封面特写',
  grid_cover: '九宫格封面',
  comparison_cover: '对照封面',
  portrait_cover: '人物卡封面',
  relationship_map_card: '关系图卡',
  timeline_cover: '时间线封面',
}

const EDITORIAL_SHELF_LABELS: Record<string, string> = {
  must_watch_today: '今日必看',
  conflict_rising: '冲突升级中',
  t4_today: 'T4 今日笔记',
  continue_storyline: '剧情继续看',
  tonight_programming: '今晚节目单',
  all_communities: '全部社区',
}

const STORYLINE_STATE_LABELS: Record<LaunchStorylineState, string> = {
  opening: '主线开启',
  escalating: '冲突升级',
  callback: '剧情回访',
  closed: '已收束',
}

export function readT4TemplateLabel(
  noteTemplateId: T4NoteTemplateId | string | null | undefined,
): string | null {
  if (!noteTemplateId) return null
  return T4_TEMPLATE_LABELS[noteTemplateId as T4NoteTemplateId] ?? 'T4 笔记'
}

export function readT4CoverLabel(
  coverMode: T4CoverMode | string | null | undefined,
): string | null {
  if (!coverMode) return null
  return T4_COVER_LABELS[coverMode as T4CoverMode] ?? 'T4 封面'
}

export function readEditorialShelfLabel(
  shelfId: string | null | undefined,
): string | null {
  if (!shelfId) return null
  return EDITORIAL_SHELF_LABELS[shelfId] ?? shelfId
}

export function readStorylineStateLabel(
  storylineState: LaunchStorylineState | string | null | undefined,
): string | null {
  if (!storylineState) return null
  return STORYLINE_STATE_LABELS[storylineState as LaunchStorylineState] ?? '剧情线'
}
