import { Prisma, type PrismaClient, type CommunityCultureDigest as PrismaCommunityCultureDigest } from '@prisma/client'
import type {
  CommunityCultureDigest,
  CreateCommunityCultureDigestInput,
} from '../types.js'
import type { CommunityCultureDigestRepository } from '../community-culture-digest-repository.js'

export class PgCommunityCultureDigestRepository implements CommunityCultureDigestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async create(input: CreateCommunityCultureDigestInput): Promise<CommunityCultureDigest> {
    if ((input.status ?? 'ACTIVE') === 'ACTIVE') {
      await this.deactivateActive(input.community_id)
    }

    const row = await this.prisma.communityCultureDigest.create({
      data: {
        communityId: input.community_id,
        version: input.version,
        digestJson: input.digest_json as Prisma.InputJsonValue,
        sourceWindowDays: input.source_window_days,
        expiresAt: input.expires_at,
        generatedAt: input.generated_at ?? new Date(),
        status: input.status ?? 'ACTIVE',
      },
    })

    return this.toDomain(row)
  }

  async findActiveByCommunity(communityId: string, now = new Date()): Promise<CommunityCultureDigest | null> {
    const row = await this.prisma.communityCultureDigest.findFirst({
      where: {
        communityId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
      orderBy: [{ version: 'desc' }, { generatedAt: 'desc' }],
    })

    return row ? this.toDomain(row) : null
  }

  async findLatestByCommunity(communityId: string): Promise<CommunityCultureDigest | null> {
    const row = await this.prisma.communityCultureDigest.findFirst({
      where: { communityId },
      orderBy: [{ version: 'desc' }, { generatedAt: 'desc' }],
    })

    return row ? this.toDomain(row) : null
  }

  async listActive(now = new Date()): Promise<CommunityCultureDigest[]> {
    const rows = await this.prisma.communityCultureDigest.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
      orderBy: [{ communityId: 'asc' }, { version: 'desc' }],
    })

    return rows.map((row) => this.toDomain(row))
  }

  async deactivateActive(communityId: string): Promise<number> {
    const result = await this.prisma.communityCultureDigest.updateMany({
      where: {
        communityId,
        status: 'ACTIVE',
      },
      data: {
        status: 'EXPIRED',
        updatedAt: new Date(),
      },
    })
    return result.count
  }

  async expireStale(now = new Date()): Promise<number> {
    const result = await this.prisma.communityCultureDigest.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
      data: {
        status: 'EXPIRED',
        updatedAt: now,
      },
    })

    return result.count
  }

  private toDomain(row: PrismaCommunityCultureDigest): CommunityCultureDigest {
    return {
      id: row.id,
      community_id: row.communityId,
      version: row.version,
      digest_json: (row.digestJson ?? {}) as Record<string, unknown>,
      source_window_days: row.sourceWindowDays,
      expires_at: row.expiresAt,
      generated_at: row.generatedAt,
      status: row.status,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
