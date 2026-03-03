import type {
  AchievementScope,
  AchievementVisibility,
  ChronicleEntry,
  ChronicleType,
  CreateChronicleEntryInput,
  PaginatedResult,
  PaginationOpts,
} from './types.js'

export interface ChronicleSignalMetrics {
  signal_counts: Record<string, number>
  public_entries: number
  activity_days: number
  cross_scene: number
  chronicle_entries: number
  narrative_public_entries: number
  narrative_activity_days: number
  narrative_entries: number
}

export interface ChronicleRepository {
  create(input: CreateChronicleEntryInput): Promise<ChronicleEntry>
  findByDedupKey(agentId: string, dedupKey: string): Promise<ChronicleEntry | null>
  findByAgent(
    agentId: string,
    opts: PaginationOpts & {
      visibility?: AchievementVisibility[]
      types?: ChronicleType[]
      from?: Date
      to?: Date
    },
  ): Promise<PaginatedResult<ChronicleEntry>>
  countByAgent(
    agentId: string,
    opts?: { visibility?: AchievementVisibility[]; types?: ChronicleType[]; since?: Date },
  ): Promise<number>
  countFoldedByAgent(
    agentId: string,
    opts: { perDayCap: number; visibility?: AchievementVisibility[]; types?: ChronicleType[] },
  ): Promise<number>
  getSignalMetrics(
    agentId: string,
    opts: { signalKinds: string[]; since?: Date; scope?: AchievementScope; scope_key?: string },
  ): Promise<ChronicleSignalMetrics>
}

let counter = 0
function cuid(): string {
  return `chron_${Date.now()}_${++counter}`
}

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
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null
  return { items: page, next_cursor }
}

export class InMemoryChronicleRepository implements ChronicleRepository {
  private readonly store = new Map<string, ChronicleEntry>()
  private readonly dedupIndex = new Map<string, string>()

  async create(input: CreateChronicleEntryInput): Promise<ChronicleEntry> {
    if (input.dedup_key) {
      const existing = this.dedupIndex.get(`${input.agent_id}:${input.dedup_key}`)
      if (existing) {
        const hit = this.store.get(existing)
        if (hit) return hit
      }
    }

    const now = new Date()
    const entry: ChronicleEntry = {
      id: cuid(),
      agent_id: input.agent_id,
      visibility: input.visibility,
      type: input.type,
      occurred_at: input.occurred_at ?? now,
      title: input.title,
      summary: input.summary,
      importance_score: input.importance_score,
      evidence: input.evidence,
      actors: input.actors ?? [],
      location: input.location ?? null,
      tags: input.tags ?? [],
      meta: input.meta ?? null,
      dedup_key: input.dedup_key ?? null,
      created_at: now,
      updated_at: now,
    }

    this.store.set(entry.id, entry)
    if (entry.dedup_key) {
      this.dedupIndex.set(`${entry.agent_id}:${entry.dedup_key}`, entry.id)
    }

    return entry
  }

  async findByDedupKey(agentId: string, dedupKey: string): Promise<ChronicleEntry | null> {
    const id = this.dedupIndex.get(`${agentId}:${dedupKey}`)
    if (!id) return null
    return this.store.get(id) ?? null
  }

  async findByAgent(
    agentId: string,
    opts: PaginationOpts & {
      visibility?: AchievementVisibility[]
      types?: ChronicleType[]
      from?: Date
      to?: Date
    },
  ): Promise<PaginatedResult<ChronicleEntry>> {
    const visibilitySet = opts.visibility ? new Set(opts.visibility) : null
    const typeSet = opts.types ? new Set(opts.types) : null

    const items = Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .filter((item) => (visibilitySet ? visibilitySet.has(item.visibility) : true))
      .filter((item) => (typeSet ? typeSet.has(item.type) : true))
      .filter((item) => (opts.from ? item.occurred_at >= opts.from : true))
      .filter((item) => (opts.to ? item.occurred_at <= opts.to : true))
      .sort((a, b) => b.occurred_at.getTime() - a.occurred_at.getTime() || b.id.localeCompare(a.id))

    return paginate(items, opts)
  }

  async countByAgent(
    agentId: string,
    opts?: { visibility?: AchievementVisibility[]; types?: ChronicleType[]; since?: Date },
  ): Promise<number> {
    const visibilitySet = opts?.visibility ? new Set(opts.visibility) : null
    const typeSet = opts?.types ? new Set(opts.types) : null

    return Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .filter((item) => (visibilitySet ? visibilitySet.has(item.visibility) : true))
      .filter((item) => (typeSet ? typeSet.has(item.type) : true))
      .filter((item) => (opts?.since ? item.occurred_at >= opts.since : true))
      .length
  }

  async countFoldedByAgent(
    agentId: string,
    opts: { perDayCap: number; visibility?: AchievementVisibility[]; types?: ChronicleType[] },
  ): Promise<number> {
    const perDayCap = Math.max(1, Math.trunc(opts.perDayCap))
    const visibilitySet = opts.visibility ? new Set(opts.visibility) : null
    const typeSet = opts.types ? new Set(opts.types) : null
    const dayCounts = new Map<string, number>()

    for (const item of this.store.values()) {
      if (item.agent_id !== agentId) continue
      if (visibilitySet && !visibilitySet.has(item.visibility)) continue
      if (typeSet && !typeSet.has(item.type)) continue
      const key = item.occurred_at.toISOString().slice(0, 10)
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1)
    }

    let folded = 0
    for (const count of dayCounts.values()) {
      if (count > perDayCap) {
        folded += count - perDayCap
      }
    }
    return folded
  }

  async getSignalMetrics(
    agentId: string,
    opts: { signalKinds: string[]; since?: Date; scope?: AchievementScope; scope_key?: string },
  ): Promise<ChronicleSignalMetrics> {
    const kindSet = new Set(opts.signalKinds)
    const signalCounts: Record<string, number> = {}
    for (const kind of kindSet) {
      signalCounts[kind] = 0
    }

    const activityDays = new Set<string>()
    const narrativeDays = new Set<string>()
    const distinctSignalKinds = new Set<string>()
    let allPublicEntries = 0
    let publicEntries = 0
    let totalEntries = 0

    for (const entry of this.store.values()) {
      if (entry.agent_id !== agentId) continue
      if (opts.since && entry.occurred_at < opts.since) continue
      if (opts.scope) {
        const scope = typeof entry.meta?.scope === 'string' ? entry.meta.scope : null
        if (scope !== opts.scope) continue
      }
      if (opts.scope_key) {
        const scopeKey = typeof entry.meta?.scope_key === 'string' ? entry.meta.scope_key : null
        if (scopeKey !== opts.scope_key) continue
      }

      activityDays.add(entry.occurred_at.toISOString().slice(0, 10))
      if (entry.visibility === 'PUBLIC') {
        allPublicEntries += 1
      }

      const signalTags = entry.tags.filter((tag) => tag.startsWith('signal:'))
      const isSignal = signalTags.length > 0
      if (!isSignal) {
        totalEntries += 1
        if (entry.visibility === 'PUBLIC') {
          publicEntries += 1
        }
        narrativeDays.add(entry.occurred_at.toISOString().slice(0, 10))
      }

      for (const tag of signalTags) {
        const kind = tag.slice('signal:'.length)
        distinctSignalKinds.add(kind)
        if (kindSet.has(kind)) {
          signalCounts[kind] = (signalCounts[kind] ?? 0) + 1
        }
      }
    }

    return {
      signal_counts: signalCounts,
      public_entries: allPublicEntries,
      activity_days: activityDays.size,
      cross_scene: distinctSignalKinds.size,
      chronicle_entries: totalEntries,
      narrative_public_entries: publicEntries,
      narrative_activity_days: narrativeDays.size,
      narrative_entries: totalEntries,
    }
  }
}
