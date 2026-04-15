import { createHash } from 'node:crypto'
import type {
  MediaAsset,
  MediaRetrievalDocScope,
  MediaSemanticSnapshot,
  VisualSourceKind,
} from '../repos/types.js'

export function resolveVisualSourceKindForAsset(
  asset: Pick<MediaAsset, 'source_kind'>,
  preferred?: VisualSourceKind | null,
): VisualSourceKind {
  if (preferred) return preferred
  switch (asset.source_kind) {
    case 'platform_canonical':
      return 'platform_canonical'
    case 'community_commons':
      return 'community_commons'
    case 'generated':
      return 'generated_public'
    case 'owner_console_upload':
    case 'url_import':
    case 'private_message_upload':
    default:
      return 'owner_private_pool'
  }
}

export function buildMediaRetrievalDocKey(assetId: string, docScope: MediaRetrievalDocScope): string {
  return `${assetId}:${docScope}`
}

export function computeMediaContentHash(value: unknown): string {
  return createHash('sha256')
    .update(typeof value === 'string' ? value : stableStringify(value))
    .digest('hex')
}

export function dedupeStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(
    values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  ))
}

export function summarizeSnapshotTerms(snapshot: Pick<MediaSemanticSnapshot, 'summary'>): string[] {
  return dedupeStrings([
    snapshot.summary.theme,
    snapshot.summary.scene,
    snapshot.summary.mood,
    ...snapshot.summary.style_tags,
    ...snapshot.summary.salient_entities,
    ...snapshot.summary.discussion_points,
    ...snapshot.summary.ocr_snippets,
  ])
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `"${key}":${stableStringify(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
