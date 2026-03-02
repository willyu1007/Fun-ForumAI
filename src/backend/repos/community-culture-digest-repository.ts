import type {
  CommunityCultureDigest,
  CommunityCultureDigestStatus,
  CreateCommunityCultureDigestInput,
} from './types.js'

export interface CommunityCultureDigestRepository {
  create(input: CreateCommunityCultureDigestInput): Promise<CommunityCultureDigest>
  findActiveByCommunity(communityId: string, now?: Date): Promise<CommunityCultureDigest | null>
  findLatestByCommunity(communityId: string): Promise<CommunityCultureDigest | null>
  listActive(now?: Date): Promise<CommunityCultureDigest[]>
  deactivateActive(communityId: string): Promise<number>
  expireStale(now?: Date): Promise<number>
}

let counter = 0
function cuid(): string {
  return `cdigest_${Date.now()}_${++counter}`
}

export class InMemoryCommunityCultureDigestRepository implements CommunityCultureDigestRepository {
  private readonly store = new Map<string, CommunityCultureDigest>()

  async create(input: CreateCommunityCultureDigestInput): Promise<CommunityCultureDigest> {
    const now = new Date()
    const row: CommunityCultureDigest = {
      id: cuid(),
      community_id: input.community_id,
      version: input.version,
      digest_json: input.digest_json,
      source_window_days: input.source_window_days,
      expires_at: input.expires_at,
      generated_at: input.generated_at ?? now,
      status: input.status ?? 'ACTIVE',
      created_at: now,
      updated_at: now,
    }

    if (row.status === 'ACTIVE') {
      await this.deactivateActive(row.community_id)
    }

    this.store.set(row.id, row)
    return row
  }

  async findActiveByCommunity(communityId: string, now = new Date()): Promise<CommunityCultureDigest | null> {
    const matches = Array.from(this.store.values())
      .filter((item) => item.community_id === communityId)
      .filter((item) => item.status === 'ACTIVE')
      .filter((item) => item.expires_at > now)
      .sort((a, b) => b.version - a.version || b.generated_at.getTime() - a.generated_at.getTime())
    return matches[0] ?? null
  }

  async findLatestByCommunity(communityId: string): Promise<CommunityCultureDigest | null> {
    const matches = Array.from(this.store.values())
      .filter((item) => item.community_id === communityId)
      .sort((a, b) => b.version - a.version || b.generated_at.getTime() - a.generated_at.getTime())
    return matches[0] ?? null
  }

  async listActive(now = new Date()): Promise<CommunityCultureDigest[]> {
    return Array.from(this.store.values())
      .filter((item) => item.status === 'ACTIVE' && item.expires_at > now)
      .sort((a, b) => a.community_id.localeCompare(b.community_id) || b.version - a.version)
  }

  async deactivateActive(communityId: string): Promise<number> {
    let changed = 0
    for (const item of this.store.values()) {
      if (item.community_id !== communityId) continue
      if (item.status !== 'ACTIVE') continue
      item.status = 'EXPIRED'
      item.updated_at = new Date()
      changed += 1
    }
    return changed
  }

  async expireStale(now = new Date()): Promise<number> {
    let changed = 0
    for (const item of this.store.values()) {
      if (item.status !== 'ACTIVE') continue
      if (item.expires_at > now) continue
      item.status = 'EXPIRED'
      item.updated_at = now
      changed += 1
    }
    return changed
  }
}

export function isActiveDigestStatus(status: CommunityCultureDigestStatus): boolean {
  return status === 'ACTIVE'
}
