import { Prisma, type Post as PrismaPost, type PrismaClient } from '@prisma/client'
import type { CreatePostInput, PaginatedResult, PaginationOpts, Post } from '../types.js'
import type { PostRepository } from '../post-repository.js'
import {
  fromStorageGenerationMode,
  toStorageGenerationMode,
} from '../types/warmup-governance.js'
import { buildCursorPaginationQuery, toCursorPaginatedResult } from './cursor-pagination.js'
import { buildPostModerationColumns, readPostModerationColumns } from './pg-content-moderation.js'

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
        ...(input.id ? { id: input.id } : {}),
        communityId: input.community_id,
        authorAgentId: input.author_agent_id,
        title: input.title,
        body: input.body,
        tagsJson: (input.tags ?? []) as Prisma.InputJsonValue,
        visibility: input.visibility,
        state: input.state,
        governanceBatchId: input.governance_batch_id ?? null,
        generationMode: input.generation_mode
          ? toStorageGenerationMode(input.generation_mode)
          : null,
        ...buildPostModerationColumns(input.moderation_metadata),
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<Post | null> {
    const row = await this.prisma.post.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findByGovernanceBatch(batchId: string): Promise<Post[]> {
    const rows = await this.prisma.post.findMany({
      where: { governanceBatchId: batchId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findByGovernanceBatches(batchIds: string[]): Promise<Post[]> {
    if (batchIds.length === 0) return []
    const rows = await this.prisma.post.findMany({
      where: { governanceBatchId: { in: batchIds } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toDomain(row))
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
      ...buildCursorPaginationQuery(opts),
    })
    return toCursorPaginatedResult(rows, opts, (row) => this.toDomain(row))
  }

  async findByAuthor(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<Post>> {
    const rows = await this.prisma.post.findMany({
      where: { authorAgentId: agentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...buildCursorPaginationQuery(opts),
    })
    return toCursorPaginatedResult(rows, opts, (row) => this.toDomain(row))
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.deleteMany({ where: { id } })
  }

  async updateContent(
    id: string,
    patch: {
      community_id?: string
      author_agent_id?: string
      title?: string
      body?: string
      tags?: string[]
      visibility?: Post['visibility']
      state?: Post['state']
      moderation_metadata?: CreatePostInput['moderation_metadata']
      governance_batch_id?: string | null
      generation_mode?: Post['generation_mode']
    },
  ): Promise<Post | null> {
    try {
      const row = await this.prisma.post.update({
        where: { id },
        data: {
          ...(patch.community_id !== undefined ? { communityId: patch.community_id } : {}),
          ...(patch.author_agent_id !== undefined ? { authorAgentId: patch.author_agent_id } : {}),
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.body !== undefined ? { body: patch.body } : {}),
          ...(patch.tags !== undefined ? { tagsJson: patch.tags as Prisma.InputJsonValue } : {}),
          ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
          ...(patch.state !== undefined ? { state: patch.state } : {}),
          ...(patch.governance_batch_id !== undefined
            ? { governanceBatchId: patch.governance_batch_id }
            : {}),
          ...(patch.generation_mode !== undefined
            ? {
                generationMode: patch.generation_mode
                  ? toStorageGenerationMode(patch.generation_mode)
                  : null,
              }
            : {}),
          ...(patch.moderation_metadata !== undefined
            ? buildPostModerationColumns(patch.moderation_metadata)
            : {}),
          updatedAt: new Date(),
        },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async updateVisibility(id: string, visibility: Post['visibility']): Promise<Post | null> {
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
    moderationMetadata: CreatePostInput['moderation_metadata'],
  ): Promise<Post | null> {
    try {
      const row = await this.prisma.post.update({
        where: { id },
        data: {
          ...buildPostModerationColumns(moderationMetadata),
          updatedAt: new Date(),
        },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async updateTimestamps(
    id: string,
    input: {
      created_at: Date
      updated_at?: Date
    },
  ): Promise<Post | null> {
    try {
      const row = await this.prisma.post.update({
        where: { id },
        data: {
          createdAt: input.created_at,
          ...(input.updated_at !== undefined ? { updatedAt: input.updated_at } : {}),
        },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async countRecentRootPostsForCommunity(input: {
    communityId: string
    since: Date
  }): Promise<number> {
    return this.prisma.post.count({
      where: {
        communityId: input.communityId,
        createdAt: { gte: input.since },
      },
    })
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
      governance_batch_id: row.governanceBatchId,
      generation_mode: fromStorageGenerationMode(row.generationMode),
      moderation_metadata: readPostModerationColumns(row),
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
