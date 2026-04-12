import type { CreatePostMediaInput, PostMedia } from './types.js'

export interface PostMediaRepository {
  create(input: CreatePostMediaInput): PostMedia
  findByPostId(postId: string): PostMedia[]
  findByPostIds(postIds: string[]): Record<string, PostMedia[]>
  findByAssetId(assetId: string): PostMedia[]
  findByWarmStartBatch(batchId: string): PostMedia[]
  deleteByPostIds(postIds: string[]): number
}

let counter = 0
function cuid(): string {
  return `post_media_${Date.now()}_${++counter}`
}

export class InMemoryPostMediaRepository implements PostMediaRepository {
  private store = new Map<string, PostMedia>()

  create(input: CreatePostMediaInput): PostMedia {
    const media: PostMedia = {
      id: cuid(),
      post_id: input.post_id,
      asset_id: input.asset_id,
      media_url: input.media_url,
      mime_type: input.mime_type,
      warm_start_batch_id: input.warm_start_batch_id ?? null,
      generation_mode: input.generation_mode ?? null,
      created_at: new Date(),
    }
    this.store.set(media.id, media)
    return media
  }

  findByPostId(postId: string): PostMedia[] {
    return Array.from(this.store.values())
      .filter((item) => item.post_id === postId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  findByPostIds(postIds: string[]): Record<string, PostMedia[]> {
    const index = new Set(postIds)
    const out: Record<string, PostMedia[]> = {}
    for (const item of this.store.values()) {
      if (!index.has(item.post_id)) continue
      if (!out[item.post_id]) out[item.post_id] = []
      out[item.post_id].push(item)
    }
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    }
    return out
  }

  findByAssetId(assetId: string): PostMedia[] {
    return Array.from(this.store.values())
      .filter((item) => item.asset_id === assetId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  findByWarmStartBatch(batchId: string): PostMedia[] {
    return Array.from(this.store.values())
      .filter((item) => item.warm_start_batch_id === batchId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  deleteByPostIds(postIds: string[]): number {
    const lookup = new Set(postIds)
    if (lookup.size === 0) return 0
    let deleted = 0
    for (const [id, item] of this.store.entries()) {
      if (!lookup.has(item.post_id)) continue
      this.store.delete(id)
      deleted += 1
    }
    return deleted
  }
}
