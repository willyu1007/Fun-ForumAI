import { randomUUID } from 'node:crypto'
import {
  Prisma,
  type PrismaClient,
  type Community as PrismaCommunity,
} from '@prisma/client'
import type { Community, PaginatedResult, PaginationOpts } from '../types.js'
import type { CommunityRepository } from '../community-repository.js'

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

const DEFAULT_CACHE_TTL_MS = 5_000

export class PgCommunityRepository implements CommunityRepository {
  private cache = new Map<string, Community>()
  private slugIndex = new Map<string, string>()
  private readonly cacheTtlMs: number
  private lastHydratedAt = 0
  private refreshInFlight: Promise<void> | null = null

  constructor(
    private readonly prisma: PrismaClient,
    opts?: { cacheTtlMs?: number },
  ) {
    this.cacheTtlMs = opts?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  }

  async hydrate(): Promise<void> {
    const rows = await this.prisma.community.findMany()
    this.cache.clear()
    this.slugIndex.clear()
    for (const row of rows) {
      const community = this.toDomain(row)
      this.cache.set(community.id, community)
      this.slugIndex.set(community.slug, community.id)
    }
    this.lastHydratedAt = Date.now()
  }

  private scheduleRefreshIfStale(): void {
    if (this.refreshInFlight) return
    if (Date.now() - this.lastHydratedAt < this.cacheTtlMs) return
    this.refreshInFlight = this.hydrate()
      .catch((err) => console.error('[PgCommunityRepo] background refresh error:', err))
      .finally(() => { this.refreshInFlight = null })
  }

  create(input: {
    name: string
    slug: string
    description?: string
    rules_json?: Record<string, unknown>
  }): Community {
    const id = randomUUID()
    const now = new Date()
    const community = this.newCommunity(input, id, now)
    this.cache.set(id, community)
    this.slugIndex.set(community.slug, id)
    this.prisma.community
      .create({
        data: {
          id,
          name: community.name,
          slug: community.slug,
          description: community.description,
          rulesJson:
            community.rules_json === null
              ? Prisma.DbNull
              : (community.rules_json as Prisma.InputJsonValue),
          visibilityDefault: community.visibility_default,
          createdAt: now,
          updatedAt: now,
        },
      })
      .catch((err) => console.error('[PgCommunityRepo] create error:', err))
    return community
  }

  async createPersisted(input: {
    name: string
    slug: string
    description?: string
    rules_json?: Record<string, unknown>
  }): Promise<Community> {
    const id = randomUUID()
    const now = new Date()
    const community = this.newCommunity(input, id, now)
    await this.prisma.community.create({
      data: {
        id,
        name: community.name,
        slug: community.slug,
        description: community.description,
        rulesJson:
          community.rules_json === null
            ? Prisma.DbNull
            : (community.rules_json as Prisma.InputJsonValue),
        visibilityDefault: community.visibility_default,
        createdAt: now,
        updatedAt: now,
      },
    })
    this.cache.set(id, community)
    this.slugIndex.set(community.slug, id)
    return community
  }

  findById(id: string): Community | null {
    this.scheduleRefreshIfStale()
    return this.cache.get(id) ?? null
  }

  findBySlug(slug: string): Community | null {
    this.scheduleRefreshIfStale()
    const id = this.slugIndex.get(slug)
    if (!id) return null
    return this.cache.get(id) ?? null
  }

  findAll(opts: PaginationOpts): PaginatedResult<Community> {
    this.scheduleRefreshIfStale()
    const items = Array.from(this.cache.values()).sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    )
    return paginate(items, opts)
  }

  update(
    id: string,
    patch: Partial<Pick<Community, 'name' | 'description' | 'rules_json' | 'visibility_default'>>,
  ): Community | null {
    const c = this.cache.get(id)
    if (!c) return null
    if (patch.name !== undefined) c.name = patch.name
    if (patch.description !== undefined) c.description = patch.description
    if (patch.rules_json !== undefined) c.rules_json = patch.rules_json
    if (patch.visibility_default !== undefined) c.visibility_default = patch.visibility_default
    c.updated_at = new Date()

    const data: Record<string, unknown> = { updatedAt: c.updated_at }
    if (patch.name !== undefined) data.name = patch.name
    if (patch.description !== undefined) data.description = patch.description
    if (patch.rules_json !== undefined) {
      data.rulesJson =
        patch.rules_json === null
          ? Prisma.DbNull
          : (patch.rules_json as Prisma.InputJsonValue)
    }
    if (patch.visibility_default !== undefined) data.visibilityDefault = patch.visibility_default
    this.prisma.community
      .update({ where: { id }, data })
      .catch((err) => console.error('[PgCommunityRepo] update error:', err))
    return c
  }

  private toDomain(row: PrismaCommunity): Community {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      rules_json: row.rulesJson as Record<string, unknown> | null,
      visibility_default: row.visibilityDefault,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private newCommunity(
    input: {
      name: string
      slug: string
      description?: string
      rules_json?: Record<string, unknown>
    },
    id: string,
    now: Date,
  ): Community {
    return {
      id,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      rules_json: input.rules_json ?? null,
      visibility_default: 'PUBLIC',
      created_at: now,
      updated_at: now,
    }
  }
}
