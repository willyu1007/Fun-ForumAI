import type {
  DevSeedProfile,
  DevSeedRegistryEntry,
  UpsertDevSeedRegistryEntryInput,
} from './types.js'

export interface DevSeedRegistryRepository {
  hydrate?(): Promise<void>
  get(profile: DevSeedProfile, seedKey: string): Promise<DevSeedRegistryEntry | null>
  listByProfile(profile: DevSeedProfile): Promise<DevSeedRegistryEntry[]>
  upsert(input: UpsertDevSeedRegistryEntryInput): Promise<DevSeedRegistryEntry>
  deleteByProfileAndSeedKeys(profile: DevSeedProfile, seedKeys: string[]): Promise<number>
}

let counter = 0

function cuid(): string {
  return `dev_seed_registry_${Date.now()}_${++counter}`
}

export class InMemoryDevSeedRegistryRepository implements DevSeedRegistryRepository {
  private readonly store = new Map<string, DevSeedRegistryEntry>()

  async get(profile: DevSeedProfile, seedKey: string): Promise<DevSeedRegistryEntry | null> {
    return this.store.get(`${profile}:${seedKey}`) ?? null
  }

  async listByProfile(profile: DevSeedProfile): Promise<DevSeedRegistryEntry[]> {
    return Array.from(this.store.values())
      .filter((entry) => entry.profile === profile)
      .sort((left, right) => left.seed_key.localeCompare(right.seed_key))
  }

  async upsert(input: UpsertDevSeedRegistryEntryInput): Promise<DevSeedRegistryEntry> {
    const key = `${input.profile}:${input.seed_key}`
    const existing = this.store.get(key)
    const now = new Date()
    const next: DevSeedRegistryEntry = {
      id: existing?.id ?? cuid(),
      profile: input.profile,
      seed_key: input.seed_key,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }
    this.store.set(key, next)
    return next
  }

  async deleteByProfileAndSeedKeys(profile: DevSeedProfile, seedKeys: string[]): Promise<number> {
    if (seedKeys.length === 0) return 0
    let deleted = 0
    for (const seedKey of seedKeys) {
      if (this.store.delete(`${profile}:${seedKey}`)) {
        deleted += 1
      }
    }
    return deleted
  }
}
