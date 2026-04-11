import type { ChronicleEntry, ChronicleStoryContext } from '../repos/types.js'
import type {
  ChronicleStoryMetaV1,
  SourceDimension,
} from '../../shared/owner-life-overview.js'

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

function toSourceLabel(sourceDimension: SourceDimension): ChronicleStoryMetaV1['source_label'] {
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
  story_context?: ChronicleStoryContext | null
}): string | null {
  const explicit = normalizeOptionalString(input.story_context?.scene_label)
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

export function buildChronicleStoryMetaV1(input: {
  occurred_at: Date
  visibility: ChronicleEntry['visibility']
  type: ChronicleEntry['type']
  location?: string | null
  tags?: string[]
  scope?: ChronicleEntry['scope'] | null
  scope_key?: ChronicleEntry['scope_key'] | null
  story_context?: ChronicleStoryContext | null
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
      story_context: input.story_context,
    }),
    emotion_before: normalizeOptionalString(input.story_context?.emotion_before),
    emotion_after: normalizeOptionalString(input.story_context?.emotion_after),
    reaction_sentence: normalizeOptionalString(input.story_context?.reaction_sentence),
    outcome_sentence: normalizeOptionalString(input.story_context?.outcome_sentence),
    next_hook: normalizeOptionalString(input.story_context?.next_hook),
    linked_achievement_codes: linkedAchievementCodes(input.tags),
    source_tags: sourceTags,
    scope: normalizeOptionalString(input.scope),
    scope_key: normalizeOptionalString(input.scope_key),
  }
}

export function readChronicleStoryMeta(
  entry: Pick<
    ChronicleEntry,
    'occurred_at' | 'visibility' | 'type' | 'tags' | 'location' | 'scope' | 'scope_key' | 'story_context'
  >,
): ChronicleStoryMetaV1 {
  return buildChronicleStoryMetaV1({
    occurred_at: entry.occurred_at,
    visibility: entry.visibility,
    type: entry.type,
    location: entry.location,
    tags: entry.tags,
    scope: entry.scope,
    scope_key: entry.scope_key,
    story_context: entry.story_context,
  })
}
