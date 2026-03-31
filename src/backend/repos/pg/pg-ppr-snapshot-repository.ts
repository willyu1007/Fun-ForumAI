import type { PrismaClient, PprSnapshot as PrismaPprSnapshot } from '@prisma/client'
import type { CreatePprSnapshotInput, PprSnapshot } from '../types.js'
import { dedupeCreatePprSnapshotEntries, type PprSnapshotRepository } from '../ppr-snapshot-repository.js'

export class PgPprSnapshotRepository implements PprSnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async replaceSourceSnapshots(sourceAgentId: string, entries: CreatePprSnapshotInput[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.pprSnapshot.deleteMany({
        where: { sourceAgentId },
      })

      if (entries.length === 0) {
        return
      }

      const dedupedEntries = dedupeCreatePprSnapshotEntries(entries)
      await tx.pprSnapshot.createMany({
        data: dedupedEntries.map((entry) => ({
          sourceAgentId: entry.source_agent_id,
          candidateAgentId: entry.candidate_agent_id,
          communityId: entry.community_id,
          topicKey: entry.topic_key,
          pprScore: entry.ppr_score,
          rank: entry.rank,
          computedAt: entry.computed_at,
          expiresAt: entry.expires_at,
        })),
      })
    })
  }

  async listUnexpired(opts?: { now?: Date; limit?: number }): Promise<PprSnapshot[]> {
    const now = opts?.now ?? new Date()
    const limit = typeof opts?.limit === 'number' && opts.limit > 0
      ? Math.trunc(opts.limit)
      : undefined

    const rows = await this.prisma.pprSnapshot.findMany({
      where: {
        expiresAt: { gt: now },
      },
      orderBy: [
        { sourceAgentId: 'asc' },
        { communityId: 'asc' },
        { topicKey: 'asc' },
        { rank: 'asc' },
      ],
      ...(limit ? { take: limit } : {}),
    })

    return rows.map((row) => this.toDomain(row))
  }

  async listBySourceAgent(
    sourceAgentId: string,
    opts?: { now?: Date; limit?: number },
  ): Promise<PprSnapshot[]> {
    const now = opts?.now ?? new Date()
    const limit = typeof opts?.limit === 'number' && opts.limit > 0
      ? Math.trunc(opts.limit)
      : 100

    const rows = await this.prisma.pprSnapshot.findMany({
      where: {
        sourceAgentId,
        expiresAt: { gt: now },
      },
      orderBy: [{ rank: 'asc' }, { pprScore: 'desc' }, { candidateAgentId: 'asc' }],
      take: limit,
    })

    return rows.map((row) => this.toDomain(row))
  }

  async findBySourceContext(
    sourceAgentId: string,
    communityId: string,
    topicKey: string,
    opts?: { now?: Date; limit?: number },
  ): Promise<PprSnapshot[]> {
    const now = opts?.now ?? new Date()
    const limit = typeof opts?.limit === 'number' && opts.limit > 0
      ? Math.trunc(opts.limit)
      : 100

    const rows = await this.prisma.pprSnapshot.findMany({
      where: {
        sourceAgentId,
        communityId,
        topicKey,
        expiresAt: { gt: now },
      },
      orderBy: [{ rank: 'asc' }, { pprScore: 'desc' }, { candidateAgentId: 'asc' }],
      take: limit,
    })

    return rows.map((row) => this.toDomain(row))
  }

  async purgeExpired(now = new Date()): Promise<number> {
    const result = await this.prisma.pprSnapshot.deleteMany({
      where: {
        expiresAt: { lte: now },
      },
    })
    return result.count
  }

  private toDomain(row: PrismaPprSnapshot): PprSnapshot {
    return {
      id: row.id,
      source_agent_id: row.sourceAgentId,
      candidate_agent_id: row.candidateAgentId,
      community_id: row.communityId,
      topic_key: row.topicKey,
      ppr_score: row.pprScore,
      rank: row.rank,
      computed_at: row.computedAt,
      expires_at: row.expiresAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
