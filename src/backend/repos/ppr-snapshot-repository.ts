import type { CreatePprSnapshotInput, PprSnapshot } from './types.js'

export interface PprSnapshotRepository {
  replaceSourceSnapshots(sourceAgentId: string, entries: CreatePprSnapshotInput[]): Promise<void>
  listUnexpired(opts?: { now?: Date; limit?: number }): Promise<PprSnapshot[]>
  findBySourceContext(
    sourceAgentId: string,
    communityId: string,
    topicKey: string,
    opts?: { now?: Date; limit?: number },
  ): Promise<PprSnapshot[]>
  purgeExpired(now?: Date): Promise<number>
}

let counter = 0
function cuid(): string {
  return `ppr_${Date.now()}_${++counter}`
}

function sortByRankAsc(a: PprSnapshot, b: PprSnapshot): number {
  if (a.rank !== b.rank) return a.rank - b.rank
  if (a.ppr_score !== b.ppr_score) return b.ppr_score - a.ppr_score
  return a.candidate_agent_id.localeCompare(b.candidate_agent_id)
}

function uniqueKey(entry: Pick<PprSnapshot, 'source_agent_id' | 'candidate_agent_id' | 'community_id' | 'topic_key'>): string {
  return [entry.source_agent_id, entry.candidate_agent_id, entry.community_id, entry.topic_key].join(':')
}

export function dedupeCreatePprSnapshotEntries(entries: CreatePprSnapshotInput[]): CreatePprSnapshotInput[] {
  const deduped = new Map<string, CreatePprSnapshotInput>()
  for (const entry of entries) {
    deduped.set(uniqueKey(entry), entry)
  }
  return Array.from(deduped.values())
}

export class InMemoryPprSnapshotRepository implements PprSnapshotRepository {
  private readonly store = new Map<string, PprSnapshot>()

  async replaceSourceSnapshots(sourceAgentId: string, entries: CreatePprSnapshotInput[]): Promise<void> {
    for (const [key, row] of this.store) {
      if (row.source_agent_id === sourceAgentId) {
        this.store.delete(key)
      }
    }

    const now = new Date()
    for (const entry of dedupeCreatePprSnapshotEntries(entries)) {
      const row: PprSnapshot = {
        id: cuid(),
        source_agent_id: entry.source_agent_id,
        candidate_agent_id: entry.candidate_agent_id,
        community_id: entry.community_id,
        topic_key: entry.topic_key,
        ppr_score: entry.ppr_score,
        rank: entry.rank,
        computed_at: entry.computed_at,
        expires_at: entry.expires_at,
        created_at: now,
        updated_at: now,
      }
      this.store.set(uniqueKey(row), row)
    }
  }

  async listUnexpired(opts?: { now?: Date; limit?: number }): Promise<PprSnapshot[]> {
    const now = opts?.now ?? new Date()
    const limit = typeof opts?.limit === 'number' && opts.limit > 0
      ? Math.trunc(opts.limit)
      : Number.POSITIVE_INFINITY

    const rows = Array.from(this.store.values())
      .filter((row) => row.expires_at > now)
      .sort((a, b) => {
        const source = a.source_agent_id.localeCompare(b.source_agent_id)
        if (source !== 0) return source
        const community = a.community_id.localeCompare(b.community_id)
        if (community !== 0) return community
        const topic = a.topic_key.localeCompare(b.topic_key)
        if (topic !== 0) return topic
        return sortByRankAsc(a, b)
      })

    return rows.slice(0, limit)
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
      : Number.POSITIVE_INFINITY

    return Array.from(this.store.values())
      .filter((row) => row.source_agent_id === sourceAgentId)
      .filter((row) => row.community_id === communityId)
      .filter((row) => row.topic_key === topicKey)
      .filter((row) => row.expires_at > now)
      .sort(sortByRankAsc)
      .slice(0, limit)
  }

  async purgeExpired(now = new Date()): Promise<number> {
    let removed = 0
    for (const [key, row] of this.store) {
      if (row.expires_at <= now) {
        this.store.delete(key)
        removed += 1
      }
    }
    return removed
  }
}
