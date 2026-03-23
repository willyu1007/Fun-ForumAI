import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryMediaGenerationJobRepository } from '../../repos/media-generation-job-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../../repos/media-semantic-snapshot-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { MediaLifecycleService } from '../media-lifecycle-service.js'
import { buildMediaSemanticSummary } from '../../test-utils/media-fixtures.js'

describe('MediaLifecycleService', () => {
  const originalLifecycle = { ...config.mediaLifecycle }

  afterEach(() => {
    Object.assign(config.mediaLifecycle, originalLifecycle)
  })

  it('archives orphan assets, deletes expired projections, and backfills outdated snapshots', async () => {
    Object.assign(config.mediaLifecycle, {
      orphanGraceHours: 1,
      expiredProjectionRetentionHours: 1,
      snapshotTargetSchemaVersion: 'visual_core.v2',
      snapshotTargetModelVersion: '2',
      snapshotBackfillBatchSize: 10,
    })

    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const mediaGenerationJobRepo = new InMemoryMediaGenerationJobRepository()
    const postMediaRepo = new InMemoryPostMediaRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const refreshSemanticSnapshot = vi.fn(async (assetId: string) => ({
      asset: await mediaAssetRepo.findById(assetId),
      snapshot: {
        id: `snapshot-${assetId}-new`,
      },
    }))
    const service = new MediaLifecycleService({
      mediaAssetRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      mediaGenerationJobRepo,
      postMediaRepo,
      mediaSemanticSnapshotRepo,
      mediaAssetService: {
        refreshSemanticSnapshot,
      } as never,
    })

    const orphanAsset = await mediaAssetRepo.create({
      id: 'asset-orphan',
      steward_agent_id: 'agent-1',
      source_kind: 'url_import',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'uploads/orphan.png',
      mime_type: 'image/png',
      file_size_bytes: 100,
      sha256: 'sha-orphan',
    })
    orphanAsset.created_at = new Date('2026-03-22T08:00:00.000Z')

    const boundAsset = await mediaAssetRepo.create({
      id: 'asset-bound',
      steward_agent_id: 'agent-1',
      source_kind: 'platform_canonical',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'canonical/bound.png',
      mime_type: 'image/png',
      file_size_bytes: 100,
      sha256: 'sha-bound',
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'forum_post',
      scene_id: 'post-1',
      asset_id: boundAsset.id,
      semantic_snapshot_id: 'snapshot-bound',
      binding_role: 'primary',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'system',
    })

    await mediaSemanticSnapshotRepo.create({
      id: 'snapshot-orphan-old',
      asset_id: orphanAsset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildMediaSemanticSummary({
        theme: 'old',
        scene: 'old',
        mood: 'old',
        discussion_points: [],
        salient_entities: [],
        public_safe_summary: 'old',
        internal_full_summary: 'old',
      }),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })

    const generatedAsset = await mediaAssetRepo.create({
      id: 'asset-generated',
      steward_agent_id: 'agent-1',
      source_kind: 'generated',
      source_scene_type: 'image_plan',
      source_scene_id: 'image-plan-1',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'generated/asset.png',
      mime_type: 'image/png',
      file_size_bytes: 100,
      sha256: 'sha-generated',
    })
    generatedAsset.created_at = new Date('2026-03-22T08:30:00.000Z')
    await mediaSemanticSnapshotRepo.create({
      id: 'snapshot-generated-old',
      asset_id: generatedAsset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildMediaSemanticSummary({
        theme: 'generated-old',
        scene: 'generated-old',
        mood: 'generated-old',
        discussion_points: [],
        salient_entities: [],
        public_safe_summary: 'generated-old',
        internal_full_summary: 'generated-old',
      }),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })
    await mediaGenerationJobRepo.create({
      id: 'job-generated-1',
      agent_id: 'agent-1',
      plan_id: 'image-plan-1',
      status: 'succeeded',
      provider: 'provider',
      model_name: 'model',
      request_fingerprint: 'fingerprint-generated-1',
      prompt_brief: 'generated prompt',
      based_on_projection_ids: ['projection-1'],
      output_asset_id: generatedAsset.id,
      attempt_count: 1,
      finished_at: new Date('2026-03-22T09:00:00.000Z'),
    })

    await mediaContextProjectionRepo.create({
      id: 'projection-expired',
      binding_id: 'binding-expired',
      projection_surface: 'planner',
      projection_kind: 'public_reuse_handoff',
      schema_version: 'public-reuse-handoff.v1',
      payload_json: {},
      expires_at: new Date('2026-03-22T07:00:00.000Z'),
    })

    const result = await service.runSweep(new Date('2026-03-22T12:00:00.000Z'))
    const refreshedOrphanAsset = await mediaAssetRepo.findById(orphanAsset.id)
    const remainingProjection = await mediaContextProjectionRepo.findById('projection-expired')

    expect(result.candidates.orphan_assets).toBe(1)
    expect(result.candidates.expired_projections).toBe(1)
    expect(result.candidates.snapshot_backfill_assets).toBe(2)
    expect(result.archived_assets).toBe(1)
    expect(result.deleted_projections).toBe(1)
    expect(result.snapshot_backfill_attempted).toBe(2)
    expect(result.snapshot_backfill_succeeded).toBe(2)
    expect(refreshedOrphanAsset?.lifecycle_status).toBe('archived')
    expect(remainingProjection).toBeNull()
    expect(refreshSemanticSnapshot).not.toHaveBeenCalledWith(orphanAsset.id)
    expect(refreshSemanticSnapshot).toHaveBeenCalledWith(boundAsset.id)
    expect(refreshSemanticSnapshot).toHaveBeenCalledWith(generatedAsset.id)
    expect(refreshSemanticSnapshot).toHaveBeenCalledTimes(2)
  })

  it('scans lifecycle candidates across every asset page instead of only the newest 500', async () => {
    Object.assign(config.mediaLifecycle, {
      orphanGraceHours: 1,
      snapshotTargetSchemaVersion: 'visual_core.v1',
      snapshotTargetModelVersion: '',
      snapshotBackfillBatchSize: 10,
    })

    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const mediaGenerationJobRepo = new InMemoryMediaGenerationJobRepository()
    const postMediaRepo = new InMemoryPostMediaRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const service = new MediaLifecycleService({
      mediaAssetRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      mediaGenerationJobRepo,
      postMediaRepo,
      mediaSemanticSnapshotRepo,
      mediaAssetService: {
        refreshSemanticSnapshot: vi.fn(),
      } as never,
    })

    const now = new Date('2026-03-22T12:00:00.000Z')
    for (let index = 0; index < 520; index += 1) {
      const asset = await mediaAssetRepo.create({
        id: `asset-${String(index).padStart(4, '0')}`,
        steward_agent_id: 'agent-1',
        source_kind: 'platform_canonical',
        visibility_policy: 'public_original_allowed',
        lifecycle_status: 'active',
        storage_key: `canonical/${index}.png`,
        mime_type: 'image/png',
        file_size_bytes: 100,
        sha256: `sha-${index}`,
      })
      asset.created_at = new Date(now.getTime() - (index === 519 ? 2 * 60 * 60 * 1000 : index * 1000))
      await mediaSemanticSnapshotRepo.create({
        id: `snapshot-${index}`,
        asset_id: asset.id,
        snapshot_kind: 'visual_core',
        schema_version: 'visual_core.v1',
        model_provider: 'test',
        model_name: 'test',
        model_version: '1',
        summary: buildMediaSemanticSummary({
          theme: 'ok',
          scene: 'ok',
          mood: 'ok',
          discussion_points: [],
          salient_entities: [],
          public_safe_summary: 'ok',
          internal_full_summary: 'ok',
        }),
        extraction_status: 'completed',
        quality_grade: 'rich',
        is_current: true,
      })
    }

    const preview = await service.previewCandidates(now)

    expect(preview.orphan_asset_ids).toContain('asset-0519')
  })
})
