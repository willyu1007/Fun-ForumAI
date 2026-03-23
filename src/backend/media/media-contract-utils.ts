import type { MediaAsset, MediaSceneType, MediaSemanticSummary, SceneRef } from '../repos/types.js'

export const MEDIA_SEMANTIC_SCHEMA_VERSION = 'media_semantic_summary.v3'

export function buildForumPostThreadRootRef(postId: string): string {
  return `forum_post:${postId}`
}

export function buildForumThreadThreadRootRef(threadId: string): string {
  return `forum_thread:${threadId}`
}

export function buildForumTurnThreadRootRef(threadId: string): string {
  return buildForumThreadThreadRootRef(threadId)
}

export function buildPendingForumPostThreadRootRef(requestId: string): string {
  return `forum_post_pending:${requestId}`
}

export function buildChatRoomMessageThreadRootRef(messageId: string): string {
  return `room_message:${messageId}`
}

export function buildChatProgramEventThreadRootRef(programEventId: string): string {
  return `room_program_event:${programEventId}`
}

export function buildPrivateSessionThreadRootRef(sessionId: string): string {
  return `private_session:${sessionId}`
}

export function readForumPostIdFromThreadRootRef(threadRootRef: string | null | undefined): string | null {
  if (!threadRootRef?.startsWith('forum_post:')) return null
  return threadRootRef.slice('forum_post:'.length) || null
}

export function readForumThreadIdFromThreadRootRef(threadRootRef: string | null | undefined): string | null {
  if (!threadRootRef?.startsWith('forum_thread:')) return null
  return threadRootRef.slice('forum_thread:'.length) || null
}

export function isPublicThreadSceneType(sceneType: MediaSceneType): boolean {
  return sceneType === 'forum_post'
    || sceneType === 'forum_thread'
    || sceneType === 'forum_turn'
    || sceneType === 'chat_room_message'
}

export function isPrivateOriginAsset(asset: Pick<MediaAsset, 'source_kind'>): boolean {
  return asset.source_kind === 'owner_console_upload'
    || asset.source_kind === 'url_import'
    || asset.source_kind === 'private_message_upload'
}

function readFallbackString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function readStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function withLegacySemanticAccessors(input: {
  scene: string
  composition: string
  style: MediaSemanticSummary['style']
  entities: MediaSemanticSummary['entities']
  ocr: MediaSemanticSummary['ocr']
  safety: MediaSemanticSummary['safety']
  summaries: MediaSemanticSummary['summaries']
  confidence: number
}): MediaSemanticSummary {
  const summary = {
    scene: input.scene,
    composition: input.composition,
    style: input.style,
    entities: input.entities,
    ocr: input.ocr,
    safety: input.safety,
    summaries: input.summaries,
    confidence: input.confidence,
  } as MediaSemanticSummary

  Object.defineProperties(summary, {
    theme: {
      enumerable: false,
      get: () => summary.style.theme,
    },
    mood: {
      enumerable: false,
      get: () => summary.style.mood,
    },
    style_tags: {
      enumerable: false,
      get: () => summary.style.tags,
    },
    discussion_points: {
      enumerable: false,
      get: () => summary.entities.discussion_points,
    },
    salient_entities: {
      enumerable: false,
      get: () => summary.entities.salient,
    },
    ocr_snippets: {
      enumerable: false,
      get: () => summary.ocr.snippets,
    },
    safety_labels: {
      enumerable: false,
      get: () => summary.safety.labels,
    },
    public_safe_summary: {
      enumerable: false,
      get: () => summary.summaries.public_safe,
    },
    internal_full_summary: {
      enumerable: false,
      get: () => summary.summaries.internal_full,
    },
  })

  return summary
}

export function buildSemanticSummaryFallback(
  summary: Partial<MediaSemanticSummary> | null | undefined,
): Pick<MediaSemanticSummary, 'theme' | 'scene' | 'mood' | 'public_safe_summary' | 'internal_full_summary'> {
  return {
    theme: readFallbackString(summary?.theme, 'visual discussion material'),
    scene: readFallbackString(summary?.scene, 'static visual scene'),
    mood: readFallbackString(summary?.mood, 'neutral'),
    public_safe_summary: readFallbackString(
      summary?.public_safe_summary,
      'A visual media asset that can support public discussion.',
    ),
    internal_full_summary: readFallbackString(
      summary?.internal_full_summary,
      'A visual media asset available for media reasoning.',
    ),
  }
}

export function normalizeSemanticSummary(
  summary: Partial<MediaSemanticSummary> | null | undefined,
  fallback: Pick<MediaSemanticSummary, 'theme' | 'scene' | 'mood' | 'public_safe_summary' | 'internal_full_summary'>,
): MediaSemanticSummary {
  const style = readRecord(summary?.style)
  const entities = readRecord(summary?.entities)
  const ocr = readRecord(summary?.ocr)
  const safety = readRecord(summary?.safety)
  const summaries = readRecord(summary?.summaries)

  return withLegacySemanticAccessors({
    scene: typeof summary?.scene === 'string' && summary.scene.trim().length > 0
      ? summary.scene.trim()
      : fallback.scene,
    composition: typeof summary?.composition === 'string' && summary.composition.trim().length > 0
      ? summary.composition.trim()
      : 'single-scene composition',
    style: {
      theme: readFallbackString(style?.theme ?? summary?.theme, fallback.theme),
      mood: readFallbackString(style?.mood ?? summary?.mood, fallback.mood),
      tags: readStringArray(style?.tags ?? summary?.style_tags, 8),
    },
    entities: {
      salient: readStringArray(entities?.salient ?? summary?.salient_entities, 10),
      discussion_points: readStringArray(
        entities?.discussion_points ?? summary?.discussion_points,
        6,
      ),
    },
    ocr: {
      snippets: readStringArray(ocr?.snippets ?? summary?.ocr_snippets, 6),
    },
    safety: {
      labels: readStringArray(safety?.labels ?? summary?.safety_labels, 6),
    },
    summaries: {
      public_safe: readFallbackString(
        summaries?.public_safe ?? summary?.public_safe_summary,
        fallback.public_safe_summary,
      ),
      internal_full: readFallbackString(
        summaries?.internal_full ?? summary?.internal_full_summary,
        fallback.internal_full_summary,
      ),
    },
    confidence: typeof summary?.confidence === 'number' && Number.isFinite(summary.confidence)
      ? Math.min(1, Math.max(0, summary.confidence))
      : 0.4,
  })
}

export function normalizeStoredSemanticSummary(
  summary: Partial<MediaSemanticSummary> | null | undefined,
): MediaSemanticSummary {
  return normalizeSemanticSummary(summary, buildSemanticSummaryFallback(summary))
}

export function withSceneThreadRootRef(
  sceneRef: SceneRef,
  threadRootRef: string | null | undefined,
): SceneRef {
  return {
    ...sceneRef,
    thread_root_ref: threadRootRef ?? null,
  }
}
