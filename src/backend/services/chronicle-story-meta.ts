import type { ChronicleEntry } from '../repos/types.js'
import type {
  ChronicleStoryMetaV1,
  SourceDimension,
  SourceDimensionLabel,
} from '../../shared/owner-life-overview.js'

const STORY_META_KEY = 'story_meta_v1'

function normalizeTags(tags: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
  ).slice(0, 12)
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function normalizeOwnerFacingSceneLabel(
  sourceDimension: SourceDimension,
  sceneLabel: string | null,
): string | null {
  if (!sceneLabel) return null
  if (sourceDimension === 'OWNER' && sceneLabel === 'owner 线') {
    return '私域余温'
  }
  return sceneLabel
}

function toMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function inferSourceDimension(input: {
  visibility: ChronicleEntry['visibility']
  type: ChronicleEntry['type']
  tags?: string[]
}): SourceDimension {
  const tags = input.tags ?? []

  if (input.type === 'RELATION_CHANGE') return 'SOCIAL'
  if (input.type === 'MODERATION' || tags.some((tag) => tag.startsWith('system:'))) return 'SYSTEM'
  if (input.visibility === 'OWNER_ONLY' || input.type === 'PRIVATE_DIGEST') return 'OWNER'
  if (tags.some((tag) => tag.startsWith('relation:') || tag.startsWith('peer:'))) return 'SOCIAL'
  return 'WORLD'
}

function toSourceLabel(sourceDimension: SourceDimension): SourceDimensionLabel {
  switch (sourceDimension) {
    case 'OWNER':
      return '来自你'
    case 'SOCIAL':
      return '和别人'
    case 'SYSTEM':
      return '系统层'
    case 'WORLD':
    default:
      return '论坛里'
  }
}

function inferStoryKind(input: {
  sourceDimension: SourceDimension
  type: ChronicleEntry['type']
  tags?: string[]
}): string {
  const tags = input.tags ?? []
  if (input.type === 'PRIVATE_DIGEST') return 'private_afterglow'
  if (input.type === 'RELATION_CHANGE') return 'relation_shift'
  if (input.type === 'ACHIEVEMENT') return 'milestone'
  if (input.type === 'MODERATION') return 'system_adjustment'
  if (tags.some((tag) => tag.startsWith('community:'))) return 'community_scene'
  if (input.sourceDimension === 'WORLD') return 'public_scene'
  if (input.sourceDimension === 'SOCIAL') return 'social_scene'
  if (input.sourceDimension === 'OWNER') return 'owner_scene'
  return 'system_scene'
}

function inferSceneLabel(input: {
  sourceDimension: SourceDimension
  type: ChronicleEntry['type']
  tags?: string[]
  location?: string | null
  meta?: Record<string, unknown> | null
}): string | null {
  const explicit = normalizeOptionalString(input.meta?.scene_label)
  if (explicit) return normalizeOwnerFacingSceneLabel(input.sourceDimension, explicit)
  if (input.location?.trim()) return input.location.trim()

  const sceneTag = (input.tags ?? []).find((tag) => tag.startsWith('scene:'))
  if (sceneTag) return sceneTag.slice('scene:'.length)

  if (input.type === 'PRIVATE_DIGEST') return '私域余温'
  if (input.type === 'RELATION_CHANGE') return '关系推进'
  if (input.type === 'MODERATION') return '系统边界'
  if (input.sourceDimension === 'WORLD') return '公共场景'
  if (input.sourceDimension === 'SOCIAL') return '同场关系'
  if (input.sourceDimension === 'OWNER') return '私域余温'
  return null
}

function buildChapterTitle(sourceDimension: SourceDimension, date: Date): string {
  const monthLabel = date.toISOString().slice(0, 7).replace('-', ' / ')
  switch (sourceDimension) {
    case 'OWNER':
      return `你与她的私域篇 ${monthLabel}`
    case 'SOCIAL':
      return `她和别人的关系篇 ${monthLabel}`
    case 'SYSTEM':
      return `系统与边界记录 ${monthLabel}`
    case 'WORLD':
    default:
      return `她在世界里的经历篇 ${monthLabel}`
  }
}

function linkedAchievementCodes(tags?: string[]): string[] {
  return normalizeTags(tags)
    .filter((tag) => tag.startsWith('achievement:'))
    .map((tag) => tag.slice('achievement:'.length))
}

function beatTypeToStoryKind(beatType: string, sourceDimension: SourceDimension): string {
  switch (beatType) {
    case 'AFTERGLOW':
      return 'private_afterglow'
    case 'RELATION':
      return 'relation_shift'
    case 'MILESTONE':
      return 'milestone'
    case 'SYSTEM':
      return 'system_adjustment'
    case 'SCENE':
    default:
      return inferStoryKind({ sourceDimension, type: 'HIGHLIGHT' })
  }
}

export function buildChronicleStoryMetaV1(input: {
  occurred_at: Date
  visibility: ChronicleEntry['visibility']
  type: ChronicleEntry['type']
  title?: string
  summary?: string
  location?: string | null
  tags?: string[]
  meta?: Record<string, unknown> | null
}): ChronicleStoryMetaV1 {
  const sourceDimension = inferSourceDimension(input)
  const sourceTags = normalizeTags(input.tags)
  const chapterKey = `${sourceDimension}:${toMonthKey(input.occurred_at)}`

  return {
    version: 1,
    source_dimension: sourceDimension,
    source_label: toSourceLabel(sourceDimension),
    story_kind: inferStoryKind({
      sourceDimension,
      type: input.type,
      tags: input.tags,
    }),
    chapter_key: chapterKey,
    chapter_title: buildChapterTitle(sourceDimension, input.occurred_at),
    scene_label: inferSceneLabel({
      sourceDimension,
      type: input.type,
      tags: input.tags,
      location: input.location,
      meta: input.meta,
    }),
    emotion_before: normalizeOptionalString(input.meta?.emotion_before),
    emotion_after: normalizeOptionalString(input.meta?.emotion_after),
    reaction_sentence: normalizeOptionalString(input.meta?.reaction_sentence),
    outcome_sentence: normalizeOptionalString(input.meta?.outcome_sentence),
    next_hook: normalizeOptionalString(input.meta?.next_hook),
    linked_achievement_codes: linkedAchievementCodes(input.tags),
    source_tags: sourceTags,
    scope: normalizeOptionalString(input.meta?.scope),
    scope_key: normalizeOptionalString(input.meta?.scope_key),
  }
}

export function withChronicleStoryMeta(
  meta: Record<string, unknown> | null | undefined,
  storyMeta: ChronicleStoryMetaV1,
): Record<string, unknown> {
  return {
    ...(meta ?? {}),
    [STORY_META_KEY]: storyMeta,
  }
}

export function readChronicleStoryMeta(
  entry: Pick<ChronicleEntry, 'occurred_at' | 'visibility' | 'type' | 'tags' | 'meta' | 'location'>,
): ChronicleStoryMetaV1 {
  const raw = entry.meta?.[STORY_META_KEY]
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>
    const sourceDimension = record.source_dimension
    const chapterKey = record.chapter_key
    const chapterTitle = record.chapter_title

    if (
      (sourceDimension === 'WORLD' ||
        sourceDimension === 'SOCIAL' ||
        sourceDimension === 'OWNER' ||
        sourceDimension === 'SYSTEM') &&
      typeof chapterKey === 'string' &&
      typeof chapterTitle === 'string'
    ) {
      const sourceTags = normalizeTags(normalizeStringArray(record.source_tags))
      const storyKind = normalizeOptionalString(record.story_kind)

      if (storyKind) {
        return {
          version: 1,
          source_dimension: sourceDimension,
          source_label: (record.source_label === '论坛里' ||
          record.source_label === '和别人' ||
          record.source_label === '来自你' ||
          record.source_label === '系统层'
            ? record.source_label
            : toSourceLabel(sourceDimension)) as SourceDimensionLabel,
          story_kind: storyKind,
          chapter_key: chapterKey,
          chapter_title: chapterTitle,
          scene_label: normalizeOwnerFacingSceneLabel(
            sourceDimension,
            normalizeOptionalString(record.scene_label),
          ),
          emotion_before: normalizeOptionalString(record.emotion_before),
          emotion_after: normalizeOptionalString(record.emotion_after),
          reaction_sentence: normalizeOptionalString(record.reaction_sentence),
          outcome_sentence: normalizeOptionalString(record.outcome_sentence),
          next_hook: normalizeOptionalString(record.next_hook),
          linked_achievement_codes: normalizeStringArray(record.linked_achievement_codes),
          source_tags: sourceTags,
          scope: normalizeOptionalString(record.scope),
          scope_key: normalizeOptionalString(record.scope_key),
        }
      }

      const beatType = normalizeOptionalString(record.beat_type) ?? 'SCENE'
      return {
        version: 1,
        source_dimension: sourceDimension,
        source_label: toSourceLabel(sourceDimension),
        story_kind: beatTypeToStoryKind(beatType, sourceDimension),
        chapter_key: chapterKey,
        chapter_title: chapterTitle,
        scene_label: inferSceneLabel({
          sourceDimension,
          type: entry.type,
          tags: entry.tags,
          location: entry.location,
          meta: entry.meta,
        }),
        emotion_before: null,
        emotion_after: null,
        reaction_sentence: null,
        outcome_sentence: null,
        next_hook: null,
        linked_achievement_codes: linkedAchievementCodes(entry.tags),
        source_tags: sourceTags,
        scope: normalizeOptionalString(record.scope),
        scope_key: normalizeOptionalString(record.scope_key),
      }
    }
  }

  return buildChronicleStoryMetaV1({
    occurred_at: entry.occurred_at,
    visibility: entry.visibility,
    type: entry.type,
    location: entry.location,
    tags: entry.tags,
    meta: entry.meta,
  })
}
