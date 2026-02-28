import { randomUUID } from 'node:crypto'
import type { PostMedia as PrismaPostMedia, PrismaClient } from '@prisma/client'
import type { CreatePostMediaInput, PostMedia } from '../types.js'
import type { PostMediaRepository } from '../post-media-repository.js'

export class PgPostMediaRepository implements PostMediaRepository {
  private cache = new Map<string, PostMedia>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.postMedia.findMany()
    for (const row of rows) {
      const media = this.toDomain(row)
      this.cache.set(media.id, media)
    }
  }

  create(input: CreatePostMediaInput): PostMedia {
    const id = randomUUID()
    const now = new Date()
    const media: PostMedia = {
      id,
      post_id: input.post_id,
      asset_id: input.asset_id,
      media_url: input.media_url,
      mime_type: input.mime_type,
      created_at: now,
    }
    this.cache.set(id, media)

    this.prisma.postMedia.create({
      data: {
        id,
        postId: media.post_id,
        assetId: media.asset_id,
        mediaUrl: media.media_url,
        mimeType: media.mime_type,
        createdAt: now,
      },
    }).catch((err: unknown) => console.error('[PgPostMediaRepo] create error:', err))

    return media
  }

  findByPostId(postId: string): PostMedia[] {
    return Array.from(this.cache.values())
      .filter((item) => item.post_id === postId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  findByPostIds(postIds: string[]): Record<string, PostMedia[]> {
    const index = new Set(postIds)
    const out: Record<string, PostMedia[]> = {}
    for (const item of this.cache.values()) {
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
    return Array.from(this.cache.values())
      .filter((item) => item.asset_id === assetId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  private toDomain(row: PrismaPostMedia): PostMedia {
    return {
      id: row.id,
      post_id: row.postId,
      asset_id: row.assetId,
      media_url: row.mediaUrl,
      mime_type: row.mimeType,
      created_at: row.createdAt,
    }
  }
}
