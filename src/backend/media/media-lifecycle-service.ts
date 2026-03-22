import { config } from '../lib/config.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { MediaGenerationJobRepository } from '../repos/media-generation-job-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { MediaAssetService } from './media-asset-service.js'

const HOUR_MS = 60 * 60 * 1000
const ASSET_SCAN_PAGE_SIZE = 250

export interface MediaLifecycleCandidates {
  orphan_asset_ids: string[]
  expired_projection_ids: string[]
  snapshot_backfill_asset_ids: string[]
}

export interface MediaLifecycleRunResult {
  run_at: string
  candidates: {
    orphan_assets: number
    expired_projections: number
    snapshot_backfill_assets: number
  }
  archived_assets: number
  deleted_projections: number
  snapshot_backfill_attempted: number
  snapshot_backfill_succeeded: number
  snapshot_backfill_failed: number
}

function shouldBackfillSnapshot(input: {
  schema_version: string
  model_version: string
}): boolean {
  if (input.schema_version !== config.mediaLifecycle.snapshotTargetSchemaVersion) {
    return true
  }
  if (
    config.mediaLifecycle.snapshotTargetModelVersion
    && input.model_version !== config.mediaLifecycle.snapshotTargetModelVersion
  ) {
    return true
  }
  return false
}

export class MediaLifecycleService {
  constructor(private readonly deps: {
    mediaAssetRepo: MediaAssetRepository
    sceneMediaBindingRepo: SceneMediaBindingRepository
    mediaContextProjectionRepo: MediaContextProjectionRepository
    mediaGenerationJobRepo: Pick<MediaGenerationJobRepository, 'findByOutputAssetId'>
    postMediaRepo: PostMediaRepository
    mediaSemanticSnapshotRepo: MediaSemanticSnapshotRepository
    mediaAssetService: Pick<MediaAssetService, 'refreshSemanticSnapshot'>
  }) {}

  async previewCandidates(now = new Date()): Promise<MediaLifecycleCandidates> {
    const orphanCutoff = now.getTime() - (config.mediaLifecycle.orphanGraceHours * HOUR_MS)
    const orphan_asset_ids: string[] = []
    const snapshot_backfill_asset_ids: string[] = []
    let before: {
      created_at: Date
      id: string
    } | undefined

    while (true) {
      const assets = await this.deps.mediaAssetRepo.listRecent({
        lifecycle_statuses: ['active'],
        limit: ASSET_SCAN_PAGE_SIZE,
        before,
      })
      if (assets.length === 0) break

      for (const asset of assets) {
        const [bindings, snapshots, generationJobs] = await Promise.all([
          this.deps.sceneMediaBindingRepo.findByAssetId(asset.id),
          this.deps.mediaSemanticSnapshotRepo.listByAssetId(asset.id),
          this.deps.mediaGenerationJobRepo.findByOutputAssetId(asset.id),
        ])
        const hasPostMedia = this.deps.postMediaRepo.findByAssetId(asset.id).length > 0
        const hasGenerationAssociation = generationJobs.length > 0 || asset.source_scene_type === 'image_plan'
        if (
          bindings.length === 0
          && !hasPostMedia
          && !hasGenerationAssociation
          && asset.created_at.getTime() <= orphanCutoff
        ) {
          orphan_asset_ids.push(asset.id)
        }

        const currentSnapshot = snapshots.find((item) => item.is_current) ?? null
        if (
          !orphan_asset_ids.includes(asset.id)
          && (!currentSnapshot || shouldBackfillSnapshot(currentSnapshot))
        ) {
          snapshot_backfill_asset_ids.push(asset.id)
        }
      }

      if (assets.length < ASSET_SCAN_PAGE_SIZE) break
      const last = assets[assets.length - 1]
      before = {
        created_at: last.created_at,
        id: last.id,
      }
    }

    const projectionCutoff = new Date(
      now.getTime() - (config.mediaLifecycle.expiredProjectionRetentionHours * HOUR_MS),
    )
    const projections = await this.deps.mediaContextProjectionRepo.listAll()
    const expired_projection_ids = projections
      .filter((projection) =>
        projection.projection_surface !== 'public_display'
        && projection.expires_at
        && projection.expires_at.getTime() <= projectionCutoff.getTime())
      .map((projection) => projection.id)

    return {
      orphan_asset_ids,
      expired_projection_ids,
      snapshot_backfill_asset_ids,
    }
  }

  async runSweep(now = new Date()): Promise<MediaLifecycleRunResult> {
    const candidates = await this.previewCandidates(now)
    let archivedAssets = 0
    let snapshotBackfillSucceeded = 0
    let snapshotBackfillFailed = 0

    for (const assetId of candidates.orphan_asset_ids) {
      const archived = await this.deps.mediaAssetRepo.update(assetId, {
        lifecycle_status: 'archived',
      })
      if (archived) archivedAssets += 1
    }

    const deletedProjections = await this.deps.mediaContextProjectionRepo.deleteByIds(
      candidates.expired_projection_ids,
    )

    const batch = candidates.snapshot_backfill_asset_ids.slice(
      0,
      Math.max(1, config.mediaLifecycle.snapshotBackfillBatchSize),
    )
    for (const assetId of batch) {
      const refreshed = await this.deps.mediaAssetService.refreshSemanticSnapshot(assetId)
      if (refreshed?.snapshot) {
        snapshotBackfillSucceeded += 1
      } else {
        snapshotBackfillFailed += 1
      }
    }

    return {
      run_at: now.toISOString(),
      candidates: {
        orphan_assets: candidates.orphan_asset_ids.length,
        expired_projections: candidates.expired_projection_ids.length,
        snapshot_backfill_assets: candidates.snapshot_backfill_asset_ids.length,
      },
      archived_assets: archivedAssets,
      deleted_projections: deletedProjections,
      snapshot_backfill_attempted: batch.length,
      snapshot_backfill_succeeded: snapshotBackfillSucceeded,
      snapshot_backfill_failed: snapshotBackfillFailed,
    }
  }
}
