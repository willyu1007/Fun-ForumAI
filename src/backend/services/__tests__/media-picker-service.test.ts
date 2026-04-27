import { describe, it, expect, beforeEach } from 'vitest'
import { MediaPickerService } from '../media-picker-service.js'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import type { MediaAsset } from '../../repos/types/media.js'

function makeAsset(overrides: Partial<MediaAsset> = {}): Parameters<InMemoryMediaAssetRepository['create']>[0] {
  return {
    source_kind: 'owner_console_upload',
    visibility_policy: 'public_original_allowed',
    lifecycle_status: 'active',
    storage_key: 'storage/key.png',
    mime_type: 'image/png',
    file_size_bytes: 1024,
    sha256: 'a'.repeat(64),
    ...overrides,
  } as Parameters<InMemoryMediaAssetRepository['create']>[0]
}

describe('MediaPickerService.isPickable', () => {
  it('accepts an active, public, storage-readable asset', () => {
    const asset: MediaAsset = {
      id: 'a1',
      steward_agent_id: null,
      owner_user_id: null,
      source_kind: 'owner_console_upload',
      source_scene_type: null,
      source_scene_id: null,
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'storage/k.png',
      origin_url: null,
      mime_type: 'image/png',
      file_size_bytes: 1024,
      width: null,
      height: null,
      sha256: 'a'.repeat(64),
      phash: null,
      duplicate_cluster_id: null,
      duplicate_distance: null,
      created_at: new Date(),
      updated_at: new Date(),
    }
    expect(MediaPickerService.isPickable(asset)).toBe(true)
  })

  it('rejects archived assets', () => {
    const asset = { ...minimalAsset(), lifecycle_status: 'archived' as const }
    expect(MediaPickerService.isPickable(asset)).toBe(false)
  })

  it('rejects blocked-lifecycle assets', () => {
    const asset = { ...minimalAsset(), lifecycle_status: 'blocked' as const }
    expect(MediaPickerService.isPickable(asset)).toBe(false)
  })

  it('rejects assets with null storage_key (not storage-readable)', () => {
    const asset = { ...minimalAsset(), storage_key: null }
    expect(MediaPickerService.isPickable(asset)).toBe(false)
  })

  it('rejects private_only visibility', () => {
    const asset = { ...minimalAsset(), visibility_policy: 'private_only' as const }
    expect(MediaPickerService.isPickable(asset)).toBe(false)
  })

  it('rejects blocked visibility', () => {
    const asset = { ...minimalAsset(), visibility_policy: 'blocked' as const }
    expect(MediaPickerService.isPickable(asset)).toBe(false)
  })

  it('accepts derivative-only visibility (allows public derivative use)', () => {
    const asset = { ...minimalAsset(), visibility_policy: 'public_derivative_only' as const }
    expect(MediaPickerService.isPickable(asset)).toBe(true)
  })
})

describe('MediaPickerService.list', () => {
  let repo: InMemoryMediaAssetRepository
  let service: MediaPickerService

  beforeEach(() => {
    repo = new InMemoryMediaAssetRepository()
    service = new MediaPickerService({ mediaAssetRepo: repo })
  })

  it('returns only pickable assets, hiding rejected ones', async () => {
    await repo.create(makeAsset())
    await repo.create(makeAsset({ visibility_policy: 'private_only' }))
    await repo.create(makeAsset({ lifecycle_status: 'archived' }))
    await repo.create(makeAsset({ storage_key: null }))

    const result = await service.list({ limit: 10 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].visibility_policy).toBe('public_original_allowed')
  })

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.create(makeAsset())
    }
    const result = await service.list({ limit: 2 })
    expect(result.items).toHaveLength(2)
  })

  it('caps limit at 100', async () => {
    const result = await service.list({ limit: 5000 })
    expect(result.items.length).toBeLessThanOrEqual(100)
  })

  it('uses default limit when not provided', async () => {
    for (let i = 0; i < 80; i++) {
      await repo.create(makeAsset())
    }
    const result = await service.list({})
    // Default is 50.
    expect(result.items).toHaveLength(50)
  })
})

function minimalAsset(): MediaAsset {
  return {
    id: 'm1',
    steward_agent_id: null,
    owner_user_id: null,
    source_kind: 'owner_console_upload',
    source_scene_type: null,
    source_scene_id: null,
    visibility_policy: 'public_original_allowed',
    lifecycle_status: 'active',
    storage_key: 'storage/k.png',
    origin_url: null,
    mime_type: 'image/png',
    file_size_bytes: 1024,
    width: null,
    height: null,
    sha256: 'a'.repeat(64),
    phash: null,
    duplicate_cluster_id: null,
    duplicate_distance: null,
    created_at: new Date(),
    updated_at: new Date(),
  }
}
