import type {
  ContextActiveTensionItem,
  ContextEpisodicCard,
  ContextPrivateShadowMemory,
  ContextRawEvent,
  ContextRelationChannel,
  ContextRelationState,
  ContextSelfModelState,
  ContextMemoryScene,
  UpsertContextActiveTensionItemInput,
  UpsertContextEpisodicCardInput,
  UpsertContextPrivateShadowMemoryInput,
  UpsertContextRawEventInput,
  UpsertContextRelationStateInput,
  UpsertContextSelfModelStateInput,
  PaginatedResult,
  PaginationOpts,
} from './types.js'

export interface RawContextEventRepository {
  upsert(input: UpsertContextRawEventInput): Promise<ContextRawEvent>
  findById(id: string): Promise<ContextRawEvent | null>
  listByAgent(
    agentId: string,
    opts: PaginationOpts & { scene?: ContextMemoryScene },
  ): Promise<PaginatedResult<ContextRawEvent>>
}

export interface EpisodicCardRepository {
  upsert(input: UpsertContextEpisodicCardInput): Promise<ContextEpisodicCard>
  listByAgent(
    agentId: string,
    opts: PaginationOpts & { scene?: ContextMemoryScene },
  ): Promise<PaginatedResult<ContextEpisodicCard>>
  pruneByIds(agentId: string, ids: string[]): Promise<number>
}

export interface ContextRelationStateRepository {
  upsert(input: UpsertContextRelationStateInput): Promise<ContextRelationState>
  findByCounterpart(
    agentId: string,
    counterpartId: string,
    channel: ContextRelationChannel,
  ): Promise<ContextRelationState | null>
  listByAgent(
    agentId: string,
    opts: PaginationOpts & { channel?: ContextRelationChannel },
  ): Promise<PaginatedResult<ContextRelationState>>
}

export interface SelfModelStateRepository {
  upsert(input: UpsertContextSelfModelStateInput): Promise<ContextSelfModelState>
  findByAgent(agentId: string): Promise<ContextSelfModelState | null>
}

export interface ActiveTensionItemRepository {
  replaceForAgent(
    agentId: string,
    items: UpsertContextActiveTensionItemInput[],
  ): Promise<ContextActiveTensionItem[]>
  listByAgent(agentId: string, limit: number): Promise<ContextActiveTensionItem[]>
}

export interface PrivateShadowMemoryRepository {
  upsert(input: UpsertContextPrivateShadowMemoryInput): Promise<ContextPrivateShadowMemory>
  listByAgent(agentId: string, limit: number): Promise<ContextPrivateShadowMemory[]>
  pruneByIds(agentId: string, ids: string[]): Promise<number>
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

function paginate<T extends { id: string }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((item) => item.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null
  return { items: page, next_cursor }
}

export class InMemoryRawContextEventRepository implements RawContextEventRepository {
  private readonly store = new Map<string, ContextRawEvent>()

  async upsert(input: UpsertContextRawEventInput): Promise<ContextRawEvent> {
    const row: ContextRawEvent = {
      id: input.id,
      agent_id: input.agent_id,
      scene: input.scene,
      source_type: input.source_type,
      source_ref_id: input.source_ref_id ?? null,
      counterpart_id: input.counterpart_id ?? null,
      transcript: input.transcript,
      evidence_refs: [...input.evidence_refs],
      created_at: input.created_at ?? this.store.get(input.id)?.created_at ?? new Date(),
    }
    this.store.set(row.id, row)
    return row
  }

  async findById(id: string): Promise<ContextRawEvent | null> {
    return this.store.get(id) ?? null
  }

  async listByAgent(
    agentId: string,
    opts: PaginationOpts & { scene?: ContextMemoryScene },
  ): Promise<PaginatedResult<ContextRawEvent>> {
    const items = Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .filter((item) => (opts.scene ? item.scene === opts.scene : true))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id))
    return paginate(items, opts)
  }
}

export class InMemoryEpisodicCardRepository implements EpisodicCardRepository {
  private readonly store = new Map<string, ContextEpisodicCard>()

  async upsert(input: UpsertContextEpisodicCardInput): Promise<ContextEpisodicCard> {
    const existing = this.store.get(input.id)
    const row: ContextEpisodicCard = {
      id: input.id,
      agent_id: input.agent_id,
      event_id: input.event_id ?? null,
      scene: input.scene,
      title: input.title,
      summary: input.summary,
      topic_tags: [...input.topic_tags],
      evidence_refs: [...input.evidence_refs],
      salience: input.salience,
      created_at: input.created_at ?? existing?.created_at ?? new Date(),
      updated_at: new Date(),
    }
    this.store.set(row.id, row)
    return row
  }

  async listByAgent(
    agentId: string,
    opts: PaginationOpts & { scene?: ContextMemoryScene },
  ): Promise<PaginatedResult<ContextEpisodicCard>> {
    const items = Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .filter((item) => (opts.scene ? item.scene === opts.scene : true))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id))
    return paginate(items, opts)
  }

  async pruneByIds(agentId: string, ids: string[]): Promise<number> {
    const deleteIds = new Set(ids)
    if (deleteIds.size === 0) return 0
    let deleted = 0
    for (const [id, row] of this.store.entries()) {
      if (row.agent_id !== agentId || !deleteIds.has(id)) continue
      this.store.delete(id)
      deleted += 1
    }
    return deleted
  }
}

export class InMemoryContextRelationStateRepository implements ContextRelationStateRepository {
  private readonly store = new Map<string, ContextRelationState>()
  private readonly index = new Map<string, string>()

  async upsert(input: UpsertContextRelationStateInput): Promise<ContextRelationState> {
    const key = `${input.agent_id}:${input.channel}:${input.counterpart_id}`
    const id = this.index.get(key) ?? input.id
    const row: ContextRelationState = {
      id,
      agent_id: input.agent_id,
      counterpart_id: input.counterpart_id,
      channel: input.channel,
      stance: input.stance,
      confidence: input.confidence,
      evidence_refs: [...input.evidence_refs],
      updated_at: new Date(),
    }
    this.index.set(key, id)
    this.store.set(id, row)
    return row
  }

  async findByCounterpart(
    agentId: string,
    counterpartId: string,
    channel: ContextRelationChannel,
  ): Promise<ContextRelationState | null> {
    const id = this.index.get(`${agentId}:${channel}:${counterpartId}`)
    return id ? (this.store.get(id) ?? null) : null
  }

  async listByAgent(
    agentId: string,
    opts: PaginationOpts & { channel?: ContextRelationChannel },
  ): Promise<PaginatedResult<ContextRelationState>> {
    const items = Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .filter((item) => (opts.channel ? item.channel === opts.channel : true))
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime() || b.id.localeCompare(a.id))
    return paginate(items, opts)
  }
}

export class InMemorySelfModelStateRepository implements SelfModelStateRepository {
  private readonly store = new Map<string, ContextSelfModelState>()

  async upsert(input: UpsertContextSelfModelStateInput): Promise<ContextSelfModelState> {
    const existing = this.store.get(input.agent_id)
    const row: ContextSelfModelState = {
      id: existing?.id ?? input.id,
      agent_id: input.agent_id,
      summary: input.summary,
      tensions: [...input.tensions],
      evidence_refs: [...input.evidence_refs],
      updated_at: new Date(),
    }
    this.store.set(input.agent_id, row)
    return row
  }

  async findByAgent(agentId: string): Promise<ContextSelfModelState | null> {
    return this.store.get(agentId) ?? null
  }
}

export class InMemoryActiveTensionItemRepository implements ActiveTensionItemRepository {
  private readonly store = new Map<string, ContextActiveTensionItem>()

  async replaceForAgent(
    agentId: string,
    items: UpsertContextActiveTensionItemInput[],
  ): Promise<ContextActiveTensionItem[]> {
    const keepIds = new Set(items.map((item) => item.id))
    for (const [id, row] of this.store.entries()) {
      if (row.agent_id === agentId && !keepIds.has(id)) {
        this.store.delete(id)
      }
    }

    const next = items.map((item) => {
      const row: ContextActiveTensionItem = {
        id: item.id,
        agent_id: agentId,
        label: item.label,
        description: item.description,
        intensity: item.intensity,
        evidence_refs: [...item.evidence_refs],
        updated_at: new Date(),
      }
      this.store.set(row.id, row)
      return row
    })
    return next
  }

  async listByAgent(agentId: string, limit: number): Promise<ContextActiveTensionItem[]> {
    return Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .sort((a, b) => b.intensity - a.intensity || b.updated_at.getTime() - a.updated_at.getTime())
      .slice(0, limit)
  }
}

export class InMemoryPrivateShadowMemoryRepository implements PrivateShadowMemoryRepository {
  private readonly store = new Map<string, ContextPrivateShadowMemory>()

  async upsert(input: UpsertContextPrivateShadowMemoryInput): Promise<ContextPrivateShadowMemory> {
    const existing = this.store.get(input.id)
    const row: ContextPrivateShadowMemory = {
      id: input.id,
      agent_id: input.agent_id,
      event_id: input.event_id ?? null,
      summary: input.summary,
      public_safe_shadow: input.public_safe_shadow,
      evidence_refs: [...input.evidence_refs],
      created_at: input.created_at ?? existing?.created_at ?? new Date(),
    }
    this.store.set(row.id, row)
    return row
  }

  async listByAgent(agentId: string, limit: number): Promise<ContextPrivateShadowMemory[]> {
    return Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id))
      .slice(0, limit)
  }

  async pruneByIds(agentId: string, ids: string[]): Promise<number> {
    const deleteIds = new Set(ids)
    if (deleteIds.size === 0) return 0
    let deleted = 0
    for (const [id, row] of this.store.entries()) {
      if (row.agent_id !== agentId || !deleteIds.has(id)) continue
      this.store.delete(id)
      deleted += 1
    }
    return deleted
  }
}

export function createContextMemoryId(prefix: string): string {
  return cuid(prefix)
}
