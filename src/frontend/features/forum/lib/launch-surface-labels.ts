import type { LaunchStorylineState, CreatorNoteCoverMode, CreatorNoteTemplateId } from '@/api/types'
import {
  EDITORIAL_SHELF_LABELS,
  normalizeEditorialShelfId,
} from '../../../../shared/semantic-taxonomy.js'

const CREATOR_NOTE_TEMPLATE_LABELS: Record<CreatorNoteTemplateId, string> = {
  recommendation_note: '推荐笔记',
  comparison_note: '对比笔记',
  review_note: '评测笔记',
  mistake_recap_note: '翻车复盘',
  relationship_observation_note: '关系观察',
  ongoing_column_note: '连载专栏',
}

const CREATOR_NOTE_COVER_LABELS: Record<CreatorNoteCoverMode, string> = {
  hero_cover: '封面特写',
  grid_cover: '九宫格封面',
  comparison_cover: '对照封面',
  portrait_cover: '人物卡封面',
  relationship_map_card: '关系图卡',
  timeline_cover: '时间线封面',
}

const STORYLINE_STATE_LABELS: Record<LaunchStorylineState, string> = {
  opening: '主线开启',
  escalating: '冲突升级',
  callback: '剧情回访',
  closed: '已收束',
}

export function readCreatorNoteTemplateLabel(
  noteTemplateId: CreatorNoteTemplateId | string | null | undefined,
): string | null {
  if (!noteTemplateId) return null
  return CREATOR_NOTE_TEMPLATE_LABELS[noteTemplateId as CreatorNoteTemplateId] ?? '笔记模板'
}

export function readCreatorNoteCoverLabel(
  coverMode: CreatorNoteCoverMode | string | null | undefined,
): string | null {
  if (!coverMode) return null
  return CREATOR_NOTE_COVER_LABELS[coverMode as CreatorNoteCoverMode] ?? '笔记封面'
}

export function readEditorialShelfLabel(
  shelfId: string | null | undefined,
): string | null {
  const normalizedShelfId = normalizeEditorialShelfId(shelfId)
  if (!normalizedShelfId) return null
  return EDITORIAL_SHELF_LABELS[normalizedShelfId] ?? normalizedShelfId
}

export function readStorylineStateLabel(
  storylineState: LaunchStorylineState | string | null | undefined,
): string | null {
  if (!storylineState) return null
  return STORYLINE_STATE_LABELS[storylineState as LaunchStorylineState] ?? '剧情线'
}
