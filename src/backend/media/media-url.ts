import type { MediaAsset } from '../repos/types.js'
import type { StorageAdapter } from '../services/storage-adapter.js'

export function resolveBrowserMediaUrl(mediaUrl: string): string {
  try {
    const parsed = new URL(mediaUrl)
    if (parsed.protocol === 's3:') {
      const storageKey = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
      if (storageKey) {
        return `/v1/media/local/${encodeURIComponent(storageKey)}`
      }
    }
  } catch {
    return mediaUrl
  }

  return mediaUrl
}

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

export async function resolveAvailableMediaAssetUrl(
  asset: Pick<MediaAsset, 'storage_key' | 'origin_url'>,
  storage: Pick<StorageAdapter, 'publicUrl' | 'getObject'>,
): Promise<string | null> {
  if (asset.storage_key) {
    const object = await storage.getObject(asset.storage_key)
    if (object) {
      return storage.publicUrl(asset.storage_key)
    }
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
