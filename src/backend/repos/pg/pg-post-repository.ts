import { randomUUID } from 'node:crypto'
import type { PrismaClient, Post as PrismaPost } from '@prisma/client'
import type {
  Post,
  CreatePostInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { PostRepository } from '../post-repository.js'

function paginate<T extends { id: string }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((i) => i.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
  return { items: page, next_cursor }
}

export class PgPostRepository implements PostRepository {
  private cache = new Map<string, Post>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.post.findMany()
    for (const row of rows) {
      this.cache.set(row.id, this.toDomain(row))
    }
  }

  create(input: CreatePostInput): Post {
    const id = randomUUID()
    const now = new Date()
    const post: Post = {
      id,
      community_id: input.community_id,
      author_agent_id: input.author_agent_id,
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      visibility: input.visibility,
      state: input.state,
      moderation_metadata: input.moderation_metadata ?? null,
      created_at: now,
      updated_at: now,
    }
    this.cache.set(id, post)
    this.prisma.post
      .create({
        data: {
          id,
          communityId: post.community_id,
          authorAgentId: post.author_agent_id,
          title: post.title,
          body: post.body,
          tagsJson: post.tags,
          visibility: post.visibility,
          state: post.state,
          moderationMetadataJson: post.moderation_metadata,
          createdAt: now,
          updatedAt: now,
        },
      })
      .catch((err) => console.error('[PgPostRepo] create error:', err))
    return post
  }

  findById(id: string): Post | null {
    return this.cache.get(id) ?? null
  }

  findPublic(
    opts: PaginationOpts & { communityId?: string },
  ): PaginatedResult<Post> {
    let items = Array.from(this.cache.values())
      .filter((p) => p.state === 'APPROVED')
      .filter((p) => p.visibility === 'PUBLIC' || p.visibility === 'GRAY')

    if (opts.communityId) {
      items = items.filter((p) => p.community_id === opts.communityId)
    }

    items.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  findByAuthor(agentId: string, opts: PaginationOpts): PaginatedResult<Post> {
    const items = Array.from(this.cache.values())
      .filter((p) => p.author_agent_id === agentId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  updateVisibility(id: string, visibility: Post['visibility']): Post | null {
    const post = this.cache.get(id)
    if (!post) return null
    post.visibility = visibility
    post.updated_at = new Date()
    this.prisma.post
      .update({
        where: { id },
        data: { visibility, updatedAt: post.updated_at },
      })
      .catch((err) =>
        console.error('[PgPostRepo] updateVisibility error:', err),
      )
    return post
  }

  updateState(id: string, state: Post['state']): Post | null {
    const post = this.cache.get(id)
    if (!post) return null
    post.state = state
    post.updated_at = new Date()
    this.prisma.post
      .update({ where: { id }, data: { state, updatedAt: post.updated_at } })
      .catch((err) => console.error('[PgPostRepo] updateState error:', err))
    return post
  }

  private toDomain(row: PrismaPost): Post {
    return {
      id: row.id,
      community_id: row.communityId,
      author_agent_id: row.authorAgentId,
      title: row.title,
      body: row.body,
      tags: (row.tagsJson as string[] | null) ?? [],
      visibility: row.visibility,
      state: row.state,
      moderation_metadata:
        (row.moderationMetadataJson as Record<string, unknown> | null) ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
