import { describe, expect, it, vi } from 'vitest'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../../repos/media-semantic-snapshot-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import type {
  PrivateMediaMemoryProjection,
  PrivateMediaRuntimeCard,
  PublicReuseHandoffCard,
} from '../../repos/types.js'
import type { StorageAdapter } from '../../services/storage-adapter.js'
import { MediaAssetService } from '../media-asset-service.js'
import { buildOwnerPrivatePoolSceneId, MediaBindingService } from '../media-binding-service.js'
import { MediaProjectionService } from '../media-projection-service.js'

function createStorageStub(
  objects: Record<string, { data: Buffer; contentType: string }> = {},
): StorageAdapter {
  return {
    backend: 'local',
    async putObject() {
      throw new Error('not implemented')
    },
    async getObject(key: string) {
      const object = objects[key]
      if (!object) return null
      return {
        data: object.data,
        contentType: object.contentType,
        size: object.data.byteLength,
      }
    },
    async deleteObject() {
      throw new Error('not implemented')
    },
    publicUrl(key: string) {
      return `https://cdn.test/${key}`
    },
  }
}

function buildSummary(publicSummary: string, internalSummary = publicSummary) {
  return {
    theme: `${publicSummary}-theme`,
    scene: `${publicSummary}-scene`,
    mood: 'neutral',
    discussion_points: [`${publicSummary}-discussion`],
    salient_entities: [`${publicSummary}-entity`],
    ocr_snippets: [`${publicSummary}-ocr`],
    safety_labels: [],
    public_safe_summary: publicSummary,
    internal_full_summary: internalSummary,
  }
}

describe('MediaAssetService', () => {
  it('does not fall back to arbitrary canonical assets for proactive private attachments', async () => {
    const listByStewardAgentId = vi.fn(async () => [])
    const findByIds = vi.fn(async () => [{
      id: 'canonical-1',
      steward_agent_id: null,
      owner_user_id: null,
      source_kind: 'platform_canonical',
      source_scene_type: 'media_pool',
      source_scene_id: 'platform_canonical:global',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'canonical/global-1.png',
      origin_url: null,
      mime_type: 'image/png',
      file_size_bytes: 1024,
      width: 1024,
      height: 1024,
      sha256: 'sha-canonical-1',
      phash: null,
      created_at: new Date(),
      updated_at: new Date(),
    }])
    const findByScene = vi.fn(async () => [{
      id: 'binding-1',
      scene_type: 'media_pool',
      scene_id: 'platform_canonical:global',
      asset_id: 'canonical-1',
      semantic_snapshot_id: 'snapshot-1',
      binding_role: 'reference',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'system',
      source_scene_type: null,
      source_scene_id: null,
      binding_note_text: null,
      created_at: new Date(),
    }])

    const service = new MediaAssetService({
      mediaAssetRepo: {
        listByStewardAgentId,
        findByIds,
      } as never,
      mediaSemanticSnapshotRepo: {} as never,
      sceneMediaBindingRepo: {
        findByScene,
      } as never,
      mediaContextProjectionRepo: {} as never,
      storage: {} as never,
      mediaSemanticService: {} as never,
      mediaBindingService: {} as never,
      mediaProjectionService: {} as never,
      mediaWriteBridge: {} as never,
    })

    const candidate = await service.findLatestAgentAuthoredPrivateAttachmentCandidate('agent-1')

    expect(candidate).toBeNull()
    expect(listByStewardAgentId).toHaveBeenCalledWith('agent-1', {
      lifecycle_statuses: ['active'],
    })
    expect(findByScene).not.toHaveBeenCalled()
    expect(findByIds).not.toHaveBeenCalled()
  })

  it('refreshes binding snapshot references and future-use projections without rewriting public display payloads', async () => {
    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const storage = createStorageStub({
      'private/asset.png': {
        data: Buffer.from('image-bytes'),
        contentType: 'image/png',
      },
    })
    const mediaBindingService = new MediaBindingService({ sceneMediaBindingRepo })
    const mediaProjectionService = new MediaProjectionService({ mediaContextProjectionRepo })
    const mediaSemanticService = {
      extract: vi.fn(async () => ({
        schema_version: 'visual_core.v2',
        model_provider: 'test',
        model_name: 'vision',
        model_version: '2',
        extraction_status: 'completed' as const,
        quality_grade: 'rich' as const,
        summary: buildSummary('new-public', 'new internal summary'),
      })),
    }
    const service = new MediaAssetService({
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      storage,
      mediaSemanticService: mediaSemanticService as never,
      mediaBindingService,
      mediaProjectionService,
      mediaWriteBridge: {} as never,
    })

    const asset = await mediaAssetRepo.create({
      id: 'asset-private-1',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'private_message_upload',
      source_scene_type: 'private_session',
      source_scene_id: 'session-1',
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      storage_key: 'private/asset.png',
      mime_type: 'image/png',
      file_size_bytes: 512,
      sha256: 'sha-private-1',
    })
    const oldSnapshot = await mediaSemanticSnapshotRepo.create({
      id: 'snapshot-old',
      asset_id: asset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'vision',
      model_version: '1',
      summary: buildSummary('old-public', 'old internal summary'),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })

    const ownerBinding = await sceneMediaBindingRepo.create({
      id: 'binding-owner',
      scene_type: 'memory_card',
      scene_id: buildOwnerPrivatePoolSceneId('agent-1'),
      asset_id: asset.id,
      semantic_snapshot_id: oldSnapshot.id,
      binding_role: 'memory',
      relation_to_scene: 'uploaded_by_owner',
      binding_note_text: 'owner-note',
      display_policy: 'runtime_only_no_display',
      created_by_type: 'owner',
      created_by_id: 'owner-1',
    })
    await mediaProjectionService.createRetrievalCaptionProjection({
      binding: ownerBinding,
      asset,
      snapshot: oldSnapshot,
      mediaUrl: storage.publicUrl(asset.storage_key!),
      ownerNote: 'owner-note',
    })

    const privateBinding = await sceneMediaBindingRepo.create({
      id: 'binding-private',
      scene_type: 'private_message',
      scene_id: 'message-1',
      asset_id: asset.id,
      semantic_snapshot_id: oldSnapshot.id,
      binding_role: 'inline',
      relation_to_scene: 'attached_to_private_message',
      display_policy: 'original_allowed',
      created_by_type: 'owner',
      created_by_id: 'owner-1',
    })
    const runtimeProjection = await mediaProjectionService.createPrivateRuntimeProjection({
      binding: privateBinding,
      asset,
      snapshot: oldSnapshot,
      source_kind: asset.source_kind,
      why_relevant_hint: 'old why hint',
    })
    const memoryProjection = await mediaProjectionService.createPrivateMemoryProjection({
      binding: privateBinding,
      asset,
      snapshot: oldSnapshot,
      agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      session_id: 'session-1',
      why_relevant_hint: 'old why hint',
    })
    const handoffProjection = await mediaProjectionService.createPublicReuseHandoffProjection({
      binding: privateBinding,
      asset,
      snapshot: oldSnapshot,
      source_kind: asset.source_kind,
      why_relevant_hint: 'old why hint',
      allowed_reuse_modes: ['derive_new', 'reference_only'],
      disclose_origin_policy: 'never',
    })

    const postBinding = await sceneMediaBindingRepo.create({
      id: 'binding-post',
      scene_type: 'forum_post',
      scene_id: 'post-1',
      asset_id: asset.id,
      semantic_snapshot_id: oldSnapshot.id,
      binding_role: 'primary',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'scheduled-post-bridge',
    })
    const displayProjection = await mediaProjectionService.createDisplayAttachmentProjection({
      binding: postBinding,
      asset,
      snapshot: oldSnapshot,
      mediaUrl: storage.publicUrl(asset.storage_key!),
      altText: 'published old alt',
      publicCaption: 'published old caption',
    })

    const refreshed = await service.refreshSemanticSnapshot(asset.id)
    const currentSnapshot = await mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
    const allSnapshots = await mediaSemanticSnapshotRepo.listByAssetId(asset.id)
    const retrievalProjection = (await mediaContextProjectionRepo.findByBindingId(ownerBinding.id))
      .find((projection) => projection.projection_kind === 'retrieval_caption')
    const updatedRuntimeProjection = await mediaContextProjectionRepo.findById(runtimeProjection.projection.id)
    const updatedMemoryProjection = await mediaContextProjectionRepo.findById(memoryProjection.projection.id)
    const updatedHandoffProjection = await mediaContextProjectionRepo.findById(handoffProjection.projection.id)
    const updatedDisplayProjection = await mediaContextProjectionRepo.findById(displayProjection.id)
    const ownerBindings = await sceneMediaBindingRepo.findByScene('memory_card', ownerBinding.scene_id)
    const privateBindings = await sceneMediaBindingRepo.findByScene('private_message', 'message-1')
    const postBindings = await sceneMediaBindingRepo.findByScene('forum_post', 'post-1')

    expect(refreshed?.snapshot).not.toBeNull()
    expect(currentSnapshot?.id).toBe(refreshed?.snapshot?.id)
    expect(currentSnapshot?.id).not.toBe(oldSnapshot.id)
    expect(allSnapshots.find((snapshot) => snapshot.id === oldSnapshot.id)?.is_current).toBe(false)
    expect(ownerBindings[0]?.semantic_snapshot_id).toBe(currentSnapshot?.id)
    expect(privateBindings[0]?.semantic_snapshot_id).toBe(currentSnapshot?.id)
    expect(postBindings[0]?.semantic_snapshot_id).toBe(currentSnapshot?.id)

    expect((retrievalProjection?.payload_json.summary as { theme: string }).theme).toBe('new-public-theme')
    expect((updatedRuntimeProjection?.payload_json as unknown as PrivateMediaRuntimeCard).asset_ref.semantic_snapshot_id)
      .toBe(currentSnapshot?.id)
    expect((updatedRuntimeProjection?.payload_json as unknown as PrivateMediaRuntimeCard).private_summary.private_safe_caption)
      .toContain('new internal summary')
    expect((updatedMemoryProjection?.payload_json as unknown as PrivateMediaMemoryProjection).semantic_snapshot_id)
      .toBe(currentSnapshot?.id)
    expect((updatedHandoffProjection?.payload_json as unknown as PublicReuseHandoffCard).asset_ref.semantic_snapshot_id)
      .toBe(currentSnapshot?.id)
    expect((updatedDisplayProjection?.payload_json as { alt_text: string; public_caption: string }).alt_text)
      .toBe('published old alt')
    expect((updatedDisplayProjection?.payload_json as { alt_text: string; public_caption: string }).public_caption)
      .toBe('published old caption')
  })
})
