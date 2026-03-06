import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  RoleAssignment,
  RoleAssignmentScope,
  CreateRoleAssignmentInput,
  UpdateRoleAssignmentInput,
} from '../types.js'
import type { RoleAssignmentRepository } from '../role-assignment-repository.js'

function toDomain(row: {
  id: string
  communityId: string
  postId: string | null
  agentId: string
  scope: 'COMMUNITY' | 'POST'
  scopeId: string
  role: string
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  assignedBy: string | null
  expiresAt: Date | null
  revokedAt: Date | null
  metaJson: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}): RoleAssignment {
  return {
    id: row.id,
    community_id: row.communityId,
    post_id: row.postId,
    agent_id: row.agentId,
    scope: row.scope,
    scope_id: row.scopeId,
    role: row.role,
    status: row.status,
    assigned_by: row.assignedBy,
    expires_at: row.expiresAt,
    revoked_at: row.revokedAt,
    meta: row.metaJson as Record<string, unknown> | null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

const DEFAULT_CACHE_TTL_MS = 30_000

export class PgRoleAssignmentRepository implements RoleAssignmentRepository {
  private cache = new Map<string, RoleAssignment>()
  private lastHydratedAt = 0
  private readonly cacheTtlMs: number
  private refreshInFlight: Promise<void> | null = null

  constructor(
    private readonly prisma: PrismaClient,
    opts?: { cacheTtlMs?: number },
  ) {
    this.cacheTtlMs = opts?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  }

  async hydrate(): Promise<void> {
    const rows = await this.prisma.roleAssignment.findMany()
    this.cache.clear()
    for (const row of rows) {
      this.cache.set(row.id, toDomain({ ...row, metaJson: row.metaJson }))
    }
    this.lastHydratedAt = Date.now()
  }

  private scheduleRefreshIfStale(): void {
    if (this.refreshInFlight) return
    if (Date.now() - this.lastHydratedAt < this.cacheTtlMs) return
    this.refreshInFlight = this.hydrate()
      .catch((err) => console.error('[PgRoleAssignmentRepo] background refresh error:', err))
      .finally(() => { this.refreshInFlight = null })
  }

  async create(input: CreateRoleAssignmentInput): Promise<RoleAssignment> {
    const now = new Date()
    const row = await this.prisma.roleAssignment.create({
      data: {
        id: randomUUID(),
        communityId: input.community_id,
        postId: input.post_id ?? null,
        agentId: input.agent_id,
        scope: input.scope,
        scopeId: input.scope_id,
        role: input.role,
        status: input.status ?? 'ACTIVE',
        assignedBy: input.assigned_by ?? null,
        expiresAt: input.expires_at ?? null,
        revokedAt: input.revoked_at ?? null,
        metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull,
        createdAt: now,
        updatedAt: now,
      },
    })
    const mapped = toDomain({ ...row, metaJson: row.metaJson })
    this.cache.set(mapped.id, mapped)
    return mapped
  }

  async update(id: string, input: UpdateRoleAssignmentInput): Promise<RoleAssignment | null> {
    const data = {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.expires_at !== undefined ? { expiresAt: input.expires_at } : {}),
      ...(input.revoked_at !== undefined ? { revokedAt: input.revoked_at } : {}),
      ...(input.meta !== undefined
        ? { metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull }
        : {}),
      updatedAt: new Date(),
    }

    const row = await (async () => {
      if (input.expected_status === undefined) {
        return this.prisma.roleAssignment.update({
          where: { id },
          data,
        }).catch((err) => (err?.code === 'P2025' ? null : Promise.reject(err)))
      }

      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.roleAssignment.updateMany({
          where: {
            id,
            status: input.expected_status,
          },
          data,
        })
        if (updated.count === 0) return null
        return tx.roleAssignment.findUnique({ where: { id } })
      })
    })()

    if (!row) return null
    const mapped = toDomain({ ...row, metaJson: row.metaJson })
    this.cache.set(mapped.id, mapped)
    return mapped
  }

  findById(id: string): RoleAssignment | null {
    this.scheduleRefreshIfStale()
    return this.cache.get(id) ?? null
  }

  listActiveByScope(scope: RoleAssignmentScope, scopeId: string): RoleAssignment[] {
    this.scheduleRefreshIfStale()
    const now = Date.now()
    return Array.from(this.cache.values())
      .filter((row) =>
        row.scope === scope
        && row.scope_id === scopeId
        && row.status === 'ACTIVE'
        && (!row.expires_at || row.expires_at.getTime() > now))
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  async listDueForExpiration(now: Date, limit: number): Promise<RoleAssignment[]> {
    const rows = await this.prisma.roleAssignment.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          not: null,
          lte: now,
        },
      },
      orderBy: [
        { expiresAt: 'asc' },
        { createdAt: 'asc' },
      ],
      take: limit,
    })
    const mapped = rows.map((row) => toDomain({ ...row, metaJson: row.metaJson }))
    for (const row of mapped) {
      this.cache.set(row.id, row)
    }
    return mapped
  }

  listByPost(postId: string): RoleAssignment[] {
    this.scheduleRefreshIfStale()
    return Array.from(this.cache.values())
      .filter((row) => row.post_id === postId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  findPrimaryForAgent(input: {
    agent_id: string
    community_id: string
    post_id?: string | null
  }): RoleAssignment | null {
    this.scheduleRefreshIfStale()
    const now = Date.now()
    if (input.post_id) {
      const postScoped = Array.from(this.cache.values()).find((row) =>
        row.agent_id === input.agent_id
        && row.community_id === input.community_id
        && row.scope === 'POST'
        && row.scope_id === input.post_id
        && row.status === 'ACTIVE'
        && (!row.expires_at || row.expires_at.getTime() > now))
      if (postScoped) return postScoped
    }
    return Array.from(this.cache.values()).find((row) =>
      row.agent_id === input.agent_id
      && row.community_id === input.community_id
      && row.scope === 'COMMUNITY'
      && row.scope_id === input.community_id
      && row.status === 'ACTIVE'
      && (!row.expires_at || row.expires_at.getTime() > now)) ?? null
  }
}
