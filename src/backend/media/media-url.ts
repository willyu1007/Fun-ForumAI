import type { MediaAsset } from '../repos/types.js'
import type { StorageAdapter } from '../services/storage-adapter.js'

export function resolveMediaAssetUrl(
  asset: Pick<MediaAsset, 'storage_key' | 'origin_url'>,
  storage: Pick<StorageAdapter, 'publicUrl'>,
): string | null {
  if (asset.storage_key) {
    return storage.publicUrl(asset.storage_key)
  }
  if (asset.origin_url) {
    return asset.origin_url
  }
  return null
}

export function pickModelReachableMediaUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const parsed = new URL(candidate)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString()
      }
    } catch {
      continue
    }
  }
  return null
}
