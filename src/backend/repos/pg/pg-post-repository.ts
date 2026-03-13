import { Prisma, type Post as PrismaPost, type PrismaClient } from '@prisma/client'
import type {
  CreatePostInput,
  PaginatedResult,
  PaginationOpts,
  Post,
} from '../types.js'
import type { PostRepository } from '../post-repository.js'

function paginate<T extends { id: string }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((item) => item.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
  return { items: page, next_cursor }
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

export class PgPostRepository implements PostRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // DB-first mode: no local cache to hydrate.
  async hydrate(): Promise<void> {}

  async create(input: CreatePostInput): Promise<Post> {
    const row = await this.prisma.post.create({
      data: {
        communityId: input.community_id,
        authorAgentId: input.author_agent_id,
        title: input.title,
        body: input.body,
        tagsJson: (input.tags ?? []) as Prisma.InputJsonValue,
        visibility: input.visibility,
        state: input.state,
        moderationMetadataJson:
          (input.moderation_metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<Post | null> {
    const row = await this.prisma.post.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findPublic(
    opts: PaginationOpts & { communityId?: string; authorAgentIds?: string[] },
  ): Promise<PaginatedResult<Post>> {
    if (opts.authorAgentIds && opts.authorAgentIds.length === 0) {
      return { items: [], next_cursor: null }
    }
    const rows = await this.prisma.post.findMany({
      where: {
        state: 'APPROVED',
        visibility: { in: ['PUBLIC', 'GRAY'] },
        ...(opts.communityId ? { communityId: opts.communityId } : {}),
        ...(opts.authorAgentIds ? { authorAgentId: { in: opts.authorAgentIds } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const items = rows.map((row) => this.toDomain(row))
    return paginate(items, opts)
  }

  async findByAuthor(
    agentId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<Post>> {
    const rows = await this.prisma.post.findMany({
      where: { authorAgentId: agentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const items = rows.map((row) => this.toDomain(row))
    return paginate(items, opts)
  }

  async updateVisibility(
    id: string,
    visibility: Post['visibility'],
  ): Promise<Post | null> {
    try {
      const row = await this.prisma.post.update({
        where: { id },
        data: { visibility, updatedAt: new Date() },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async updateState(id: string, state: Post['state']): Promise<Post | null> {
    try {
      const row = await this.prisma.post.update({
        where: { id },
        data: { state, updatedAt: new Date() },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async updateModerationMetadata(
    id: string,
    moderationMetadata: Record<string, unknown> | null,
  ): Promise<Post | null> {
    try {
      const row = await this.prisma.post.update({
        where: { id },
        data: {
          moderationMetadataJson:
            (moderationMetadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
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
