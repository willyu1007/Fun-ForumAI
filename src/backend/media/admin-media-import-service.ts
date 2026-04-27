import { ValidationError } from '../lib/errors.js'
import type {
  MediaAsset,
  MediaEmbeddingSnapshot,
  MediaReusePolicy,
  MediaSemanticSnapshot,
  PostMedia,
  SceneMediaBinding,
  VisualSourceKind,
} from '../repos/types.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { MediaReusePolicyRepository } from '../repos/media-reuse-policy-repository.js'
import type { MediaRetrievalDocumentRepository } from '../repos/media-retrieval-document-repository.js'
import type { MediaEmbeddingSnapshotRepository } from '../repos/media-embedding-snapshot-repository.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { StorageAdapter } from '../services/storage-adapter.js'
import type { MediaAssetService } from './media-asset-service.js'
import type { MediaReuseGovernanceService } from './media-reuse-governance-service.js'
import type { MediaRetrievalService } from './media-retrieval-service.js'
import {
  buildCommunityCommonsPoolSceneId,
  buildPlatformCanonicalPoolSceneId,
} from './media-reuse-governance-service.js'
import { resolveMediaAssetUrl } from './media-url.js'

export interface AdminMediaImportServiceDeps {
  mediaAssetService: MediaAssetService
  mediaReuseGovernanceService: Pick<
    MediaReuseGovernanceService,
    'registerPlatformCanonicalAsset' | 'registerCommunityCommonsAsset'
  >
  mediaRetrievalService: Pick<MediaRetrievalService, 'ensureAssetIndexed'>
  mediaAssetRepo: Pick<MediaAssetRepository, 'findById' | 'findByIds'>
  mediaSemanticSnapshotRepo: Pick<MediaSemanticSnapshotRepository, 'findCurrentByAssetId'>
  sceneMediaBindingRepo: Pick<
    SceneMediaBindingRepository,
    'findByScene' | 'findByAssetId' | 'findByAssetIds'
  >
  mediaReusePolicyRepo: Pick<MediaReusePolicyRepository, 'findBySubject'>
  mediaRetrievalDocumentRepo: Pick<MediaRetrievalDocumentRepository, 'listByAssetId'>
  mediaEmbeddingSnapshotRepo: Pick<MediaEmbeddingSnapshotRepository, 'listByRetrievalDocumentId'>
  postMediaRepo: Pick<PostMediaRepository, 'findByAssetId'>
  storage: Pick<StorageAdapter, 'publicUrl'>
}

export interface AdminMediaImportItemDto {
  asset: {
    asset_id: string
    source_kind: MediaAsset['source_kind']
    media_url: string
    mime_type: string
    file_size_bytes: number
    width: number | null
    height: number | null
    visibility_policy: MediaAsset['visibility_policy']
    lifecycle_status: MediaAsset['lifecycle_status']
    created_at: string
  }
  semantic_snapshot: {
    snapshot_id: string
    theme: string
    scene: string
    mood: string
    public_safe_summary: string
    tags: string[]
  } | null
  pool_binding: {
    binding_id: string
    scene_type: SceneMediaBinding['scene_type']
    scene_id: string
    display_policy: SceneMediaBinding['display_policy']
    created_at: string
  }
  reuse_policy: {
    policy_id: string
    allowed_reuse_modes: MediaReusePolicy['allowed_reuse_modes']
    cross_agent_quote_allowed: boolean
    copyright_state: MediaReusePolicy['copyright_state']
    status: MediaReusePolicy['status']
  }
  retrieval: {
    status: 'ready' | 'pending' | 'failed'
    document_ids: string[]
    doc_scopes: string[]
    searchable_embedding_count: number
    last_error_code: string | null
    last_error_message: string | null
  }
  usage_summary: {
    total_binding_count: number
    public_display_count: number
    latest_usage_at: string | null
    scene_type_counts: Record<string, number>
  }
}

export interface AdminMediaImportListPayload {
  pool: {
    scene_type: 'media_pool'
    scene_id: string
    community_id: string | null
  }
  items: AdminMediaImportItemDto[]
  next_cursor: string | null
}

interface ImportContext {
  pool_source_kind: 'platform_canonical' | 'community_commons'
  pool_scene_id: string
  community_id: string | null
}

export class AdminMediaImportService {
  constructor(private readonly deps: AdminMediaImportServiceDeps) {}

  async importPlatformUpload(input: {
    actor_user_id: string
    file: { mime_type: string; bytes: Buffer }
    allow_quote_original?: boolean
  }): Promise<AdminMediaImportItemDto> {
    const ctx = this.platformContext()
    const { asset, snapshot } = await this.ingestUpload(ctx, input.actor_user_id, input.file)
    const { binding, policy } = await this.deps.mediaReuseGovernanceService.registerPlatformCanonicalAsset({
      asset_id: asset.id,
      actor_user_id: input.actor_user_id,
      allow_quote_original: input.allow_quote_original,
    })
    await this.attemptRetrievalIndex(ctx, asset, snapshot, input.actor_user_id)
    return this.assembleItem({ asset, snapshot, binding, policy })
  }

  async importPlatformUrl(input: {
    actor_user_id: string
    source_url: string
    allow_quote_original?: boolean
  }): Promise<AdminMediaImportItemDto> {
    const ctx = this.platformContext()
    const { asset, snapshot } = await this.ingestUrl(ctx, input.actor_user_id, input.source_url)
    const { binding, policy } = await this.deps.mediaReuseGovernanceService.registerPlatformCanonicalAsset({
      asset_id: asset.id,
      actor_user_id: input.actor_user_id,
      allow_quote_original: input.allow_quote_original,
    })
    await this.attemptRetrievalIndex(ctx, asset, snapshot, input.actor_user_id)
    return this.assembleItem({ asset, snapshot, binding, policy })
  }

  async importCommunityUpload(input: {
    community_id: string
    actor_user_id: string
    file: { mime_type: string; bytes: Buffer }
    allow_quote_original?: boolean
  }): Promise<AdminMediaImportItemDto> {
    const ctx = this.communityContext(input.community_id)
    const { asset, snapshot } = await this.ingestUpload(ctx, input.actor_user_id, input.file)
    const { binding, policy } = await this.deps.mediaReuseGovernanceService.registerCommunityCommonsAsset({
      community_id: input.community_id,
      asset_id: asset.id,
      actor_user_id: input.actor_user_id,
      allow_quote_original: input.allow_quote_original,
    })
    await this.attemptRetrievalIndex(ctx, asset, snapshot, input.actor_user_id)
    return this.assembleItem({ asset, snapshot, binding, policy, community_id: input.community_id })
  }

  async importCommunityUrl(input: {
    community_id: string
    actor_user_id: string
    source_url: string
    allow_quote_original?: boolean
  }): Promise<AdminMediaImportItemDto> {
    const ctx = this.communityContext(input.community_id)
    const { asset, snapshot } = await this.ingestUrl(ctx, input.actor_user_id, input.source_url)
    const { binding, policy } = await this.deps.mediaReuseGovernanceService.registerCommunityCommonsAsset({
      community_id: input.community_id,
      asset_id: asset.id,
      actor_user_id: input.actor_user_id,
      allow_quote_original: input.allow_quote_original,
    })
    await this.attemptRetrievalIndex(ctx, asset, snapshot, input.actor_user_id)
    return this.assembleItem({ asset, snapshot, binding, policy, community_id: input.community_id })
  }

  async listPlatformAssets(input: { limit?: number }): Promise<AdminMediaImportListPayload> {
    const ctx = this.platformContext()
    return this.listPoolAssets(ctx, input.limit ?? 50)
  }

  async listCommunityAssets(input: {
    community_id: string
    limit?: number
  }): Promise<AdminMediaImportListPayload> {
    const ctx = this.communityContext(input.community_id)
    return this.listPoolAssets(ctx, input.limit ?? 50)
  }

  // ── private ─────────────────────────────────────────────────

  private platformContext(): ImportContext {
    return {
      pool_source_kind: 'platform_canonical',
      pool_scene_id: buildPlatformCanonicalPoolSceneId(),
      community_id: null,
    }
  }

  private communityContext(communityId: string): ImportContext {
    if (!communityId || communityId.trim().length === 0) {
      throw new ValidationError('community_id is required')
    }
    return {
      pool_source_kind: 'community_commons',
      pool_scene_id: buildCommunityCommonsPoolSceneId(communityId),
      community_id: communityId,
    }
  }

  private async ingestUpload(
    ctx: ImportContext,
    actorUserId: string,
    file: { mime_type: string; bytes: Buffer },
  ): Promise<{ asset: MediaAsset; snapshot: MediaSemanticSnapshot | null }> {
    if (!file.bytes || file.bytes.byteLength <= 0) {
      throw new ValidationError('file is required')
    }
    const record = await this.deps.mediaAssetService.ingestManagedAsset({
      owner_user_id: actorUserId,
      source_kind: ctx.pool_source_kind,
      mime_type: file.mime_type,
      bytes: file.bytes,
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
    })
    return { asset: record.asset, snapshot: record.snapshot ?? null }
  }

  private async ingestUrl(
    ctx: ImportContext,
    actorUserId: string,
    sourceUrl: string,
  ): Promise<{ asset: MediaAsset; snapshot: MediaSemanticSnapshot | null }> {
    const record = await this.deps.mediaAssetService.ingestManagedRemoteAsset({
      owner_user_id: actorUserId,
      source_kind: ctx.pool_source_kind,
      source_url: sourceUrl,
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
    })
    return { asset: record.asset, snapshot: record.snapshot ?? null }
  }

  private async attemptRetrievalIndex(
    ctx: ImportContext,
    asset: MediaAsset,
    snapshot: MediaSemanticSnapshot | null,
    actorUserId: string,
  ): Promise<void> {
    try {
      await this.deps.mediaRetrievalService.ensureAssetIndexed({
        asset,
        snapshot,
        source_kind: ctx.pool_source_kind as VisualSourceKind,
        target_scope: {
          owner_user_id: actorUserId,
          steward_agent_id: null,
          community_id: ctx.community_id,
        },
        generated_from: 'catalog_card',
        reason: 'admin_media_import',
      })
    } catch {
      // swallow indexing failures; retrieval status will surface as `pending`/`failed`
      // in the assembled DTO without rolling back the asset write.
    }
  }

  private async listPoolAssets(
    ctx: ImportContext,
    limit: number,
  ): Promise<AdminMediaImportListPayload> {
    const cap = Math.min(Math.max(limit, 1), 100)
    const bindings = await this.deps.sceneMediaBindingRepo.findByScene('media_pool', ctx.pool_scene_id)
    const sorted = [...bindings].sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    const trimmed = sorted.slice(0, cap)
    const assetIds = trimmed.map((binding) => binding.asset_id)
    const assets = assetIds.length > 0 ? await this.deps.mediaAssetRepo.findByIds(assetIds) : []
    const assetById = new Map(assets.map((asset) => [asset.id, asset]))
    const items: AdminMediaImportItemDto[] = []
    for (const binding of trimmed) {
      const asset = assetById.get(binding.asset_id)
      if (!asset) continue
      const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
      const policy = await this.deps.mediaReusePolicyRepo.findBySubject(
        'asset',
        asset.id,
        ctx.pool_source_kind,
      )
      if (!policy) continue
      items.push(await this.assembleItem({ asset, snapshot: snapshot ?? null, binding, policy, community_id: ctx.community_id }))
    }
    return {
      pool: {
        scene_type: 'media_pool',
        scene_id: ctx.pool_scene_id,
        community_id: ctx.community_id,
      },
      items,
      next_cursor: null,
    }
  }

  private async assembleItem(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot | null
    binding: SceneMediaBinding
    policy: MediaReusePolicy
    community_id?: string | null
  }): Promise<AdminMediaImportItemDto> {
    const mediaUrl = resolveMediaAssetUrl(input.asset, this.deps.storage)
    if (!mediaUrl) {
      throw new ValidationError(`media asset ${input.asset.id} has no resolvable media URL`)
    }
    const retrieval = await this.resolveRetrievalStatus(input.asset.id)
    const usage = await this.resolveUsageSummary(input.asset.id)
    return {
      asset: {
        asset_id: input.asset.id,
        source_kind: input.asset.source_kind,
        media_url: mediaUrl,
        mime_type: input.asset.mime_type,
        file_size_bytes: input.asset.file_size_bytes,
        width: input.asset.width,
        height: input.asset.height,
        visibility_policy: input.asset.visibility_policy,
        lifecycle_status: input.asset.lifecycle_status,
        created_at: input.asset.created_at.toISOString(),
      },
      semantic_snapshot: input.snapshot
        ? {
            snapshot_id: input.snapshot.id,
            theme: input.snapshot.summary.theme,
            scene: input.snapshot.summary.scene,
            mood: input.snapshot.summary.mood,
            public_safe_summary: input.snapshot.summary.public_safe_summary,
            tags: input.snapshot.summary.style.tags,
          }
        : null,
      pool_binding: {
        binding_id: input.binding.id,
        scene_type: input.binding.scene_type,
        scene_id: input.binding.scene_id,
        display_policy: input.binding.display_policy,
        created_at: input.binding.created_at.toISOString(),
      },
      reuse_policy: {
        policy_id: input.policy.id,
        allowed_reuse_modes: input.policy.allowed_reuse_modes,
        cross_agent_quote_allowed: input.policy.cross_agent_quote_allowed,
        copyright_state: input.policy.copyright_state,
        status: input.policy.status,
      },
      retrieval,
      usage_summary: usage,
    }
  }

  private async resolveRetrievalStatus(assetId: string): Promise<AdminMediaImportItemDto['retrieval']> {
    const documents = await this.deps.mediaRetrievalDocumentRepo.listByAssetId(assetId)
    if (documents.length === 0) {
      return {
        status: 'pending',
        document_ids: [],
        doc_scopes: [],
        searchable_embedding_count: 0,
        last_error_code: null,
        last_error_message: null,
      }
    }
    let searchable = 0
    let latestFailed: MediaEmbeddingSnapshot | null = null
    let latestNonSearchable: MediaEmbeddingSnapshot | null = null
    for (const doc of documents) {
      const snapshots = await this.deps.mediaEmbeddingSnapshotRepo.listByRetrievalDocumentId(doc.id)
      for (const snapshot of snapshots) {
        if (snapshot.is_active && snapshot.search_status === 'searchable') {
          searchable += 1
        }
        if (snapshot.search_status === 'failed') {
          if (!latestFailed || snapshot.created_at.getTime() > latestFailed.created_at.getTime()) {
            latestFailed = snapshot
          }
        }
        if (snapshot.search_status !== 'searchable') {
          if (!latestNonSearchable || snapshot.created_at.getTime() > latestNonSearchable.created_at.getTime()) {
            latestNonSearchable = snapshot
          }
        }
      }
    }
    const documentIds = documents.map((doc) => doc.id)
    const docScopes = uniqueStrings(documents.map((doc) => doc.doc_scope))
    if (searchable > 0) {
      return {
        status: 'ready',
        document_ids: documentIds,
        doc_scopes: docScopes,
        searchable_embedding_count: searchable,
        last_error_code: null,
        last_error_message: null,
      }
    }
    if (latestFailed) {
      return {
        status: 'failed',
        document_ids: documentIds,
        doc_scopes: docScopes,
        searchable_embedding_count: 0,
        last_error_code: latestFailed.error_code,
        last_error_message: latestFailed.error_message,
      }
    }
    return {
      status: 'pending',
      document_ids: documentIds,
      doc_scopes: docScopes,
      searchable_embedding_count: 0,
      last_error_code: latestNonSearchable?.error_code ?? null,
      last_error_message: latestNonSearchable?.error_message ?? null,
    }
  }

  private async resolveUsageSummary(assetId: string): Promise<AdminMediaImportItemDto['usage_summary']> {
    const bindings: SceneMediaBinding[] = await this.deps.sceneMediaBindingRepo.findByAssetId(assetId)
    const postMedia: PostMedia[] = await this.deps.postMediaRepo.findByAssetId(assetId)
    const sceneTypeCounts: Record<string, number> = {}
    let publicDisplay = 0
    let latestTimestamp: number | null = null
    for (const binding of bindings) {
      sceneTypeCounts[binding.scene_type] = (sceneTypeCounts[binding.scene_type] ?? 0) + 1
      if (binding.display_policy === 'original_allowed') publicDisplay += 1
      const ts = binding.created_at.getTime()
      if (latestTimestamp === null || ts > latestTimestamp) latestTimestamp = ts
    }
    for (const item of postMedia) {
      const ts = item.created_at.getTime()
      if (latestTimestamp === null || ts > latestTimestamp) latestTimestamp = ts
    }
    return {
      total_binding_count: bindings.length,
      public_display_count: publicDisplay,
      latest_usage_at: latestTimestamp !== null ? new Date(latestTimestamp).toISOString() : null,
      scene_type_counts: sceneTypeCounts,
    }
  }
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}
