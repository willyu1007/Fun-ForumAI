import type { PrismaClient } from '@prisma/client'
import type {
  DevSeedProfile,
  DevSeedRegistryEntry,
  UpsertDevSeedRegistryEntryInput,
} from '../types.js'
import type { DevSeedRegistryRepository } from '../dev-seed-registry-repository.js'

export class PgDevSeedRegistryRepository implements DevSeedRegistryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async get(profile: DevSeedProfile, seedKey: string): Promise<DevSeedRegistryEntry | null> {
    const row = await this.prisma.devSeedRegistryEntry.findUnique({
      where: {
        profile_seedKey: {
          profile,
          seedKey,
        },
      },
    })
    return row ? this.toDomain(row) : null
  }

  async listByProfile(profile: DevSeedProfile): Promise<DevSeedRegistryEntry[]> {
    const rows = await this.prisma.devSeedRegistryEntry.findMany({
      where: { profile },
      orderBy: { seedKey: 'asc' },
    })
    return rows.map((row) => this.toDomain(row))
  }

  async upsert(input: UpsertDevSeedRegistryEntryInput): Promise<DevSeedRegistryEntry> {
    const row = await this.prisma.devSeedRegistryEntry.upsert({
      where: {
        profile_seedKey: {
          profile: input.profile,
          seedKey: input.seed_key,
        },
      },
      create: {
        profile: input.profile,
        seedKey: input.seed_key,
        entityType: input.entity_type,
        entityId: input.entity_id,
      },
      update: {
        entityType: input.entity_type,
        entityId: input.entity_id,
        updatedAt: new Date(),
      },
    })
    return this.toDomain(row)
  }

  async deleteByProfileAndSeedKeys(profile: DevSeedProfile, seedKeys: string[]): Promise<number> {
    if (seedKeys.length === 0) return 0
    const result = await this.prisma.devSeedRegistryEntry.deleteMany({
      where: {
        profile,
        seedKey: { in: seedKeys },
      },
    })
    return result.count
  }

  private toDomain(row: {
    id: string
    profile: string
    seedKey: string
    entityType: string
    entityId: string
    createdAt: Date
    updatedAt: Date
  }): DevSeedRegistryEntry {
    return {
      id: row.id,
      profile: row.profile as DevSeedProfile,
      seed_key: row.seedKey,
      entity_type: row.entityType as DevSeedRegistryEntry['entity_type'],
      entity_id: row.entityId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
