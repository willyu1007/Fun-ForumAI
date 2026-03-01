import type {
  AchievementVisibility,
  ChronicleEntry,
  ChronicleType,
  CreateChronicleEntryInput,
  PaginatedResult,
  PaginationOpts,
} from './types.js'

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
}
