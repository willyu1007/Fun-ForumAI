import type {
  MediaAsset,
  MediaCatalogCard,
  MediaCatalogCardPayload,
  MediaSemanticSnapshot,
  VisualSourceKind,
} from '../repos/types.js'
import type { MediaCatalogCardRepository } from '../repos/media-catalog-card-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import {
  computeMediaContentHash,
  dedupeStrings,
  resolveVisualSourceKindForAsset,
} from './media-retrieval-utils.js'

export interface MediaCatalogServiceDeps {
  mediaCatalogCardRepo: MediaCatalogCardRepository
  mediaSemanticSnapshotRepo: Pick<MediaSemanticSnapshotRepository, 'findCurrentByAssetId'>
}

export interface EnsureMediaCatalogCardInput {
  asset: MediaAsset
  snapshot?: MediaSemanticSnapshot | null
  source_kind?: VisualSourceKind | null
  target_scope?: {
    community_id?: string | null
  }
  annotations?: {
    tags?: string[]
    internal_note?: string | null
    owner_note?: string | null
  }
}

export class MediaCatalogService {
  constructor(private readonly deps: MediaCatalogServiceDeps) {}

  async ensureCurrentCard(input: EnsureMediaCatalogCardInput): Promise<MediaCatalogCard | null> {
    const snapshot = input.snapshot ?? await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(input.asset.id)
    if (!snapshot) return null

    const payload = buildCatalogPayload({
      asset: input.asset,
      snapshot,
      source_kind: resolveVisualSourceKindForAsset(input.asset, input.source_kind),
      community_id: input.target_scope?.community_id ?? null,
      annotations: input.annotations,
    })
    const contentHash = computeMediaContentHash(payload)
    const current = await this.deps.mediaCatalogCardRepo.findCurrentByAssetId(input.asset.id)
    if (current && current.content_hash === contentHash && current.build_status === 'ready') {
      return current
    }

    if (current) {
      await this.deps.mediaCatalogCardRepo.markNonCurrentByAssetId(input.asset.id, current.id)
    }

    return this.deps.mediaCatalogCardRepo.create({
      asset_id: input.asset.id,
      semantic_snapshot_id: snapshot.id,
      modality: 'image',
      source_kind: payload.source_kind,
      content_hash: contentHash,
      build_status: 'ready',
      payload_json: payload,
      is_current: true,
    })
  }
}

function buildCatalogPayload(input: {
  asset: MediaAsset
  snapshot: MediaSemanticSnapshot
  source_kind: VisualSourceKind
  community_id: string | null
  annotations?: EnsureMediaCatalogCardInput['annotations']
}): MediaCatalogCardPayload {
  return {
    modality: 'image',
    source_kind: input.source_kind,
    theme: input.snapshot.summary.theme,
    scene: input.snapshot.summary.scene,
    mood: input.snapshot.summary.mood,
    public_safe_summary: input.snapshot.summary.public_safe_summary,
    alt_text: input.snapshot.summary.public_safe_summary,
    tags: dedupeStrings([
      ...input.snapshot.summary.style_tags,
      ...(input.annotations?.tags ?? []),
    ]),
    discussion_points: input.snapshot.summary.discussion_points.slice(0, 8),
    salient_entities: input.snapshot.summary.salient_entities.slice(0, 8),
    scope_hints: {
      owner_user_id: input.asset.owner_user_id,
      steward_agent_id: input.asset.steward_agent_id,
      community_id: input.community_id,
    },
    annotations: {
      internal_note: input.annotations?.internal_note?.trim() || null,
      owner_note: input.annotations?.owner_note?.trim() || null,
    },
  }
}
