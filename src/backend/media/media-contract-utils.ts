import type { MediaAsset, MediaSceneType, MediaSemanticSummary, SceneRef } from '../repos/types.js'

export const MEDIA_SEMANTIC_SCHEMA_VERSION = 'media_semantic_summary.v2'

export function buildForumPostThreadRootRef(postId: string): string {
  return `forum_post:${postId}`
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

export function isPublicThreadSceneType(sceneType: MediaSceneType): boolean {
  return sceneType === 'forum_post'
    || sceneType === 'forum_comment'
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
  return {
    theme: typeof summary?.theme === 'string' && summary.theme.trim().length > 0
      ? summary.theme.trim()
      : fallback.theme,
    scene: typeof summary?.scene === 'string' && summary.scene.trim().length > 0
      ? summary.scene.trim()
      : fallback.scene,
    mood: typeof summary?.mood === 'string' && summary.mood.trim().length > 0
      ? summary.mood.trim()
      : fallback.mood,
    confidence: typeof summary?.confidence === 'number' && Number.isFinite(summary.confidence)
      ? Math.min(1, Math.max(0, summary.confidence))
      : 0.4,
    composition: typeof summary?.composition === 'string' && summary.composition.trim().length > 0
      ? summary.composition.trim()
      : 'single-scene composition',
    style_tags: Array.isArray(summary?.style_tags)
      ? summary.style_tags
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8)
      : [],
    discussion_points: Array.isArray(summary?.discussion_points)
      ? summary.discussion_points
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6)
      : [],
    salient_entities: Array.isArray(summary?.salient_entities)
      ? summary.salient_entities
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 10)
      : [],
    ocr_snippets: Array.isArray(summary?.ocr_snippets)
      ? summary.ocr_snippets
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6)
      : [],
    safety_labels: Array.isArray(summary?.safety_labels)
      ? summary.safety_labels
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6)
      : [],
    public_safe_summary:
      typeof summary?.public_safe_summary === 'string' && summary.public_safe_summary.trim().length > 0
        ? summary.public_safe_summary.trim()
        : fallback.public_safe_summary,
    internal_full_summary:
      typeof summary?.internal_full_summary === 'string' && summary.internal_full_summary.trim().length > 0
        ? summary.internal_full_summary.trim()
        : fallback.internal_full_summary,
  }
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
