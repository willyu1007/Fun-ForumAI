import { describe, expect, it, vi } from 'vitest'
import { MediaAssetService } from '../media-asset-service.js'

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
      binding_role: 'supporting',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: null,
      source_binding_id: null,
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
})
