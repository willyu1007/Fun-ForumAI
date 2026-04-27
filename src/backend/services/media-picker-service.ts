/**
 * T-210 M2 — Media picker service for the cue editor.
 *
 * Surfaces a filtered list of MediaAsset rows safe for cue authoring.
 * Filter SSOT (mirrored on the frontend for UI consistency, but the server
 * is authoritative — UI is allowed to hide additional rows but never to
 * surface rows the server would reject):
 *
 *   - lifecycle_status === 'active'
 *   - storage_key !== null              (storage readable)
 *   - visibility_policy ∉ {'private_only','blocked'}  (allows public use)
 *
 * Out of scope for MVP (TODO when T-216 / media governance lands):
 *   - reuse-governance block lookup (MediaReusePolicy.status === 'blocked')
 *   - duplicate-cluster suppression beyond canonical
 *   - per-community visibility scoping (cross-community projection check)
 *   - private-pool gating ("not in private pool unless projected")
 *
 * The community filter narrows the result by the asset's relationship to
 * the requested community; in MVP we keep it permissive (return public
 * assets regardless of source community), with a TODO for T-216.
 */

import type {
  MediaAsset,
  MediaLifecycleStatus,
  MediaVisibilityPolicy,
} from '../repos/types/media.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'

export interface MediaPickerQuery {
  communityId?: string
  /** Limit the number of returned items (server caps at 100). */
  limit?: number
  /** Cursor for pagination (asset_id of last item). */
  cursor?: string
}

export interface MediaPickerItem {
  asset_id: string
  source_kind: MediaAsset['source_kind']
  visibility_policy: MediaVisibilityPolicy
  storage_key: string | null
  mime_type: string
  width: number | null
  height: number | null
  created_at: string
}

export interface MediaPickerResult {
  items: MediaPickerItem[]
  next_cursor: string | null
}

const PUBLIC_VISIBILITIES: ReadonlySet<MediaVisibilityPolicy> = new Set([
  'public_original_allowed',
  'public_derivative_only',
])

const ACTIVE: ReadonlyArray<MediaLifecycleStatus> = ['active']

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 50

export interface MediaPickerServiceDeps {
  mediaAssetRepo: MediaAssetRepository
}

export class MediaPickerService {
  private readonly mediaAssetRepo: MediaAssetRepository

  constructor(deps: MediaPickerServiceDeps) {
    this.mediaAssetRepo = deps.mediaAssetRepo
  }

  /**
   * Picker filter — pure predicate matching the SSOT in the file header.
   * Exposed so the preview chain (M3) can re-validate already-selected
   * assets against the same rules.
   */
  static isPickable(asset: MediaAsset): boolean {
    if (asset.lifecycle_status !== 'active') return false
    if (!asset.storage_key) return false
    if (!PUBLIC_VISIBILITIES.has(asset.visibility_policy)) return false
    return true
  }

  async list(query: MediaPickerQuery): Promise<MediaPickerResult> {
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)

    // Fetch a slightly larger window than `limit` so post-filter we can still
    // return up to `limit` items. For MVP we use a 2x buffer; if the lifecycle
    // mix is unusual the caller can paginate forward via `cursor`.
    const fetched = await this.mediaAssetRepo.listRecent({
      limit: limit * 2,
      lifecycle_statuses: ACTIVE as MediaLifecycleStatus[],
    })

    // Apply server-side filter (UI mirrors but is not authoritative).
    const filtered = fetched.filter((asset) => MediaPickerService.isPickable(asset))

    // Cursor pagination: skip up to the cursor (exclusive).
    let startIdx = 0
    if (query.cursor) {
      const idx = filtered.findIndex((a) => a.id === query.cursor)
      if (idx >= 0) startIdx = idx + 1
    }

    const sliced = filtered.slice(startIdx, startIdx + limit)
    const next_cursor = startIdx + limit < filtered.length ? sliced[sliced.length - 1]?.id ?? null : null

    return {
      items: sliced.map(toPickerItem),
      next_cursor,
    }
  }
}

function toPickerItem(asset: MediaAsset): MediaPickerItem {
  return {
    asset_id: asset.id,
    source_kind: asset.source_kind,
    visibility_policy: asset.visibility_policy,
    storage_key: asset.storage_key,
    mime_type: asset.mime_type,
    width: asset.width,
    height: asset.height,
    created_at: asset.created_at.toISOString(),
  }
}
