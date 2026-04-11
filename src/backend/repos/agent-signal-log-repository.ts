import type {
  AgentSignalLog,
  AchievementScope,
  CreateAgentSignalLogInput,
} from './types.js'

const GLOBAL_SCOPE: AchievementScope = 'global'
const GLOBAL_SCOPE_KEY = '__global__'

export interface AgentSignalMetrics {
  signal_counts: Record<string, number>
  public_entries: number
  activity_days: number
  cross_scene: number
  signal_entries: number
}

export interface AgentSignalLogRepository {
  create(input: CreateAgentSignalLogInput): Promise<AgentSignalLog>
  findByDedupKey(agentId: string, dedupKey: string): Promise<AgentSignalLog | null>
  getMetrics(
    agentId: string,
    opts: { signalKinds: string[]; since?: Date; scope?: AchievementScope; scope_key?: string },
  ): Promise<AgentSignalMetrics>
}

let counter = 0
function cuid(): string {
  return `sig_${Date.now()}_${++counter}`
}

export class InMemoryAgentSignalLogRepository implements AgentSignalLogRepository {
  private readonly store = new Map<string, AgentSignalLog>()
  private readonly dedupIndex = new Map<string, string>()

  async create(input: CreateAgentSignalLogInput): Promise<AgentSignalLog> {
    if (input.dedup_key) {
      const existing = this.dedupIndex.get(`${input.agent_id}:${input.dedup_key}`)
      if (existing) {
        const row = this.store.get(existing)
        if (row) return row
      }
    }

    const now = new Date()
    const row: AgentSignalLog = {
      id: cuid(),
      agent_id: input.agent_id,
      signal_kind: input.signal_kind,
      importance_score: input.importance_score,
      visibility: input.visibility,
      scope: input.scope ?? GLOBAL_SCOPE,
      scope_key: input.scope_key ?? GLOBAL_SCOPE_KEY,
      occurred_at: input.occurred_at ?? now,
      evidence: input.evidence,
      signal_context: input.signal_context ?? null,
      dedup_key: input.dedup_key ?? null,
      created_at: now,
    }

    this.store.set(row.id, row)
    if (row.dedup_key) {
      this.dedupIndex.set(`${row.agent_id}:${row.dedup_key}`, row.id)
    }
    return row
  }

  async findByDedupKey(agentId: string, dedupKey: string): Promise<AgentSignalLog | null> {
    const id = this.dedupIndex.get(`${agentId}:${dedupKey}`)
    if (!id) return null
    return this.store.get(id) ?? null
  }

  async getMetrics(
    agentId: string,
    opts: { signalKinds: string[]; since?: Date; scope?: AchievementScope; scope_key?: string },
  ): Promise<AgentSignalMetrics> {
    const counts: Record<string, number> = {}
    for (const kind of opts.signalKinds) {
      counts[kind] = 0
    }

    const daySet = new Set<string>()
    const kindSet = new Set<string>()
    let publicEntries = 0
    let total = 0

    for (const entry of this.store.values()) {
      if (entry.agent_id !== agentId) continue
      if (opts.since && entry.occurred_at < opts.since) continue
      if (opts.scope && entry.scope !== opts.scope) continue
      if (opts.scope_key && entry.scope_key !== opts.scope_key) continue

      total += 1
      if (entry.visibility === 'PUBLIC') {
        publicEntries += 1
      }
      daySet.add(entry.occurred_at.toISOString().slice(0, 10))
      kindSet.add(entry.signal_kind)
      if (Object.prototype.hasOwnProperty.call(counts, entry.signal_kind)) {
        counts[entry.signal_kind] += 1
      }
    }

    return {
      signal_counts: counts,
      public_entries: publicEntries,
      activity_days: daySet.size,
      cross_scene: kindSet.size,
      signal_entries: total,
    }
  }
}
