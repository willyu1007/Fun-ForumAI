import type {
  PrismaClient,
  AgentMemory as PrismaMemory,
  AgentPrivacySettings as PrismaPrivacy,
} from '@prisma/client'
import type {
  AgentMemory,
  AgentPrivacySettingsEntity,
  CreateAgentMemoryInput,
  UpsertPrivacySettingsInput,
  PaginatedResult,
  PaginationOpts,
  MemorySource,
} from '../types.js'
import type { MemoryRepository } from '../memory-repository.js'

export class PgMemoryRepository implements MemoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMemory(input: CreateAgentMemoryInput): Promise<AgentMemory> {
    const row = await this.prisma.agentMemory.create({
      data: {
        agentId: input.agent_id,
        sourceType: input.source_type,
        sourceSessionId: input.source_session_id ?? null,
        sourceRefType: input.source_ref_type ?? null,
        sourceRefId: input.source_ref_id ?? null,
        sourceEventId: input.source_event_id ?? null,
        summaryText: input.summary_text,
        topicTags: input.topic_tags,
        keyFacts: input.key_facts,
        sentiment: input.sentiment ?? null,
        importanceScore: input.importance_score,
        privacyFloor: input.privacy_floor ?? 1,
      },
    })
    return this.memoryToDomain(row)
  }

  async findMemoryById(id: string): Promise<AgentMemory | null> {
    const row = await this.prisma.agentMemory.findUnique({ where: { id } })
    return row ? this.memoryToDomain(row) : null
  }

  async listMemories(
    agentId: string,
    opts: PaginationOpts & {
      source_type?: MemorySource
      forgotten?: boolean
      source_ref_type?: string
      source_ref_id?: string
      source_event_id?: string
    },
  ): Promise<PaginatedResult<AgentMemory>> {
    const where: Record<string, unknown> = { agentId }
    if (opts.source_type) where.sourceType = opts.source_type
    if (opts.forgotten !== undefined) where.forgotten = opts.forgotten
    if (opts.source_ref_type) where.sourceRefType = opts.source_ref_type
    if (opts.source_ref_id) where.sourceRefId = opts.source_ref_id
    if (opts.source_event_id) where.sourceEventId = opts.source_event_id

    const rows = await this.prisma.agentMemory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    })

    const hasMore = rows.length > opts.limit
    const items = hasMore ? rows.slice(0, opts.limit) : rows

    return {
      items: items.map((r) => this.memoryToDomain(r)),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    }
  }

  async findActiveMemories(
    agentId: string,
    opts: { maxImportance?: number },
  ): Promise<AgentMemory[]> {
    const where: Record<string, unknown> = { agentId, forgotten: false }
    if (opts.maxImportance !== undefined) {
      where.importanceScore = { lte: opts.maxImportance }
    }

    const rows = await this.prisma.agentMemory.findMany({
      where,
      orderBy: { importanceScore: 'desc' },
    })
    return rows.map((r) => this.memoryToDomain(r))
  }

  async updateImportanceScore(id: string, score: number): Promise<void> {
    await this.prisma.agentMemory.update({
      where: { id },
      data: { importanceScore: score },
    })
  }

  async markForgotten(id: string): Promise<void> {
    await this.prisma.agentMemory.update({
      where: { id },
      data: { forgotten: true },
    })
  }

  async incrementAccessCount(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const now = new Date()
    await this.prisma.agentMemory.updateMany({
      where: { id: { in: ids } },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: now,
      },
    })
  }

  async batchDecay(agentId: string, factor: number): Promise<number> {
    const result = await this.prisma.$executeRaw`
      UPDATE agent_memories
      SET importance_score = importance_score * ${factor}
      WHERE agent_id = ${agentId}
        AND forgotten = false
    `
    return result
  }

  async getPrivacySettings(agentId: string): Promise<AgentPrivacySettingsEntity | null> {
    const row = await this.prisma.agentPrivacySettings.findUnique({
      where: { agentId },
    })
    return row ? this.privacyToDomain(row) : null
  }

  async upsertPrivacySettings(
    input: UpsertPrivacySettingsInput,
  ): Promise<AgentPrivacySettingsEntity> {
    const row = await this.prisma.agentPrivacySettings.upsert({
      where: { agentId: input.agent_id },
      create: {
        agentId: input.agent_id,
        disclosureLevel: input.disclosure_level ?? 1,
        publicMemoryBudget: input.public_memory_budget ?? 1000,
        publicMemoryTopK: input.public_memory_top_k ?? 4,
        updatedBy: input.updated_by,
      },
      update: {
        ...(input.disclosure_level !== undefined
          ? { disclosureLevel: input.disclosure_level }
          : {}),
        ...(input.public_memory_budget !== undefined
          ? { publicMemoryBudget: input.public_memory_budget }
          : {}),
        ...(input.public_memory_top_k !== undefined
          ? { publicMemoryTopK: input.public_memory_top_k }
          : {}),
        updatedBy: input.updated_by,
      },
    })
    return this.privacyToDomain(row)
  }

  private memoryToDomain(row: PrismaMemory): AgentMemory {
    return {
      id: row.id,
      agent_id: row.agentId,
      source_type: row.sourceType,
      source_session_id: row.sourceSessionId,
      source_ref_type: row.sourceRefType,
      source_ref_id: row.sourceRefId,
      source_event_id: row.sourceEventId,
      summary_text: row.summaryText,
      topic_tags: Array.isArray(row.topicTags) ? (row.topicTags as string[]) : [],
      key_facts: Array.isArray(row.keyFacts) ? (row.keyFacts as string[]) : [],
      sentiment: row.sentiment,
      importance_score: row.importanceScore,
      privacy_floor: row.privacyFloor,
      access_count: row.accessCount,
      forgotten: row.forgotten,
      created_at: row.createdAt,
      last_accessed_at: row.lastAccessedAt,
    }
  }

  private privacyToDomain(row: PrismaPrivacy): AgentPrivacySettingsEntity {
    return {
      agent_id: row.agentId,
      disclosure_level: row.disclosureLevel,
      public_memory_budget: row.publicMemoryBudget,
      public_memory_top_k: row.publicMemoryTopK,
      updated_at: row.updatedAt,
      updated_by: row.updatedBy,
    }
  }
}
