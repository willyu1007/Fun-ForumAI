import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  ContextActiveTensionItem,
  ContextEpisodicCard,
  ContextMemorySourceType,
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
} from '../types.js'
import type {
  ActiveTensionItemRepository,
  ContextRelationStateRepository,
  EpisodicCardRepository,
  PrivateShadowMemoryRepository,
  RawContextEventRepository,
  SelfModelStateRepository,
} from '../context-memory-repository.js'

function paginate<T extends { id: string }>(items: T[], limit: number): PaginatedResult<T> {
  const hasMore = items.length > limit
  const page = hasMore ? items.slice(0, limit) : items
  return {
    items: page,
    next_cursor: hasMore ? page[page.length - 1].id : null,
  }
}

export class PgRawContextEventRepository implements RawContextEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(input: UpsertContextRawEventInput): Promise<ContextRawEvent> {
    const row = await this.prisma.rawContextEvent.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        agentId: input.agent_id,
        scene: toScene(input.scene),
        sourceType: toSourceType(input.source_type),
        sourceRefId: input.source_ref_id ?? null,
        counterpartId: input.counterpart_id ?? null,
        transcript: input.transcript,
        evidenceRefs: input.evidence_refs as Prisma.InputJsonValue,
        createdAt: input.created_at ?? new Date(),
      },
      update: {
        scene: toScene(input.scene),
        sourceType: toSourceType(input.source_type),
        sourceRefId: input.source_ref_id ?? null,
        counterpartId: input.counterpart_id ?? null,
        transcript: input.transcript,
        evidenceRefs: input.evidence_refs as Prisma.InputJsonValue,
      },
    })
    return rawEventToDomain(row)
  }

  async findById(id: string): Promise<ContextRawEvent | null> {
    const row = await this.prisma.rawContextEvent.findUnique({ where: { id } })
    return row ? rawEventToDomain(row) : null
  }

  async listByAgent(
    agentId: string,
    opts: PaginationOpts & {
      scene?: ContextMemoryScene
      source_type?: ContextMemorySourceType
      source_ref_id?: string
    },
  ): Promise<PaginatedResult<ContextRawEvent>> {
    const rows = await this.prisma.rawContextEvent.findMany({
      where: {
        agentId,
        ...(opts.scene ? { scene: toScene(opts.scene) } : {}),
        ...(opts.source_type ? { sourceType: toSourceType(opts.source_type) } : {}),
        ...(opts.source_ref_id ? { sourceRefId: opts.source_ref_id } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    })
    return paginate(rows.map((row) => rawEventToDomain(row)), opts.limit)
  }
}

export class PgEpisodicCardRepository implements EpisodicCardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(input: UpsertContextEpisodicCardInput): Promise<ContextEpisodicCard> {
    const row = await this.prisma.episodicCard.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        agentId: input.agent_id,
        eventId: input.event_id ?? null,
        scene: toScene(input.scene),
        title: input.title,
        summary: input.summary,
        topicTags: input.topic_tags as Prisma.InputJsonValue,
        evidenceRefs: input.evidence_refs as Prisma.InputJsonValue,
        salience: input.salience,
        createdAt: input.created_at ?? new Date(),
      },
      update: {
        eventId: input.event_id ?? null,
        scene: toScene(input.scene),
        title: input.title,
        summary: input.summary,
        topicTags: input.topic_tags as Prisma.InputJsonValue,
        evidenceRefs: input.evidence_refs as Prisma.InputJsonValue,
        salience: input.salience,
      },
    })
    return episodicCardToDomain(row)
  }

  async listByAgent(
    agentId: string,
    opts: PaginationOpts & { scene?: ContextMemoryScene },
  ): Promise<PaginatedResult<ContextEpisodicCard>> {
    const rows = await this.prisma.episodicCard.findMany({
      where: {
        agentId,
        ...(opts.scene ? { scene: toScene(opts.scene) } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    })
    return paginate(rows.map((row) => episodicCardToDomain(row)), opts.limit)
  }

  async pruneByIds(agentId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.prisma.episodicCard.deleteMany({
      where: {
        agentId,
        id: { in: ids },
      },
    })
    return result.count
  }
}

export class PgContextRelationStateRepository implements ContextRelationStateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(input: UpsertContextRelationStateInput): Promise<ContextRelationState> {
    const row = await this.prisma.contextRelationState.upsert({
      where: {
        agentId_counterpartId_channel: {
          agentId: input.agent_id,
          counterpartId: input.counterpart_id,
          channel: toChannel(input.channel),
        },
      },
      create: {
        id: input.id,
        agentId: input.agent_id,
        counterpartId: input.counterpart_id,
        channel: toChannel(input.channel),
        stance: input.stance,
        confidence: input.confidence,
        evidenceRefs: input.evidence_refs as Prisma.InputJsonValue,
      },
      update: {
        stance: input.stance,
        confidence: input.confidence,
        evidenceRefs: input.evidence_refs as Prisma.InputJsonValue,
      },
    })
    return relationStateToDomain(row)
  }

  async findByCounterpart(
    agentId: string,
    counterpartId: string,
    channel: ContextRelationChannel,
  ): Promise<ContextRelationState | null> {
    const row = await this.prisma.contextRelationState.findUnique({
      where: {
        agentId_counterpartId_channel: {
          agentId,
          counterpartId,
          channel: toChannel(channel),
        },
      },
    })
    return row ? relationStateToDomain(row) : null
  }

  async listByAgent(
    agentId: string,
    opts: PaginationOpts & { channel?: ContextRelationChannel },
  ): Promise<PaginatedResult<ContextRelationState>> {
    const rows = await this.prisma.contextRelationState.findMany({
      where: {
        agentId,
        ...(opts.channel ? { channel: toChannel(opts.channel) } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    })
    return paginate(rows.map((row) => relationStateToDomain(row)), opts.limit)
  }
}

export class PgSelfModelStateRepository implements SelfModelStateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(input: UpsertContextSelfModelStateInput): Promise<ContextSelfModelState> {
    const row = await this.prisma.selfModelState.upsert({
      where: { agentId: input.agent_id },
      create: {
        id: input.id,
        agentId: input.agent_id,
        summary: input.summary,
        tensions: input.tensions as Prisma.InputJsonValue,
        evidenceRefs: input.evidence_refs as Prisma.InputJsonValue,
      },
      update: {
        summary: input.summary,
        tensions: input.tensions as Prisma.InputJsonValue,
        evidenceRefs: input.evidence_refs as Prisma.InputJsonValue,
      },
    })
    return selfModelToDomain(row)
  }

  async findByAgent(agentId: string): Promise<ContextSelfModelState | null> {
    const row = await this.prisma.selfModelState.findUnique({ where: { agentId } })
    return row ? selfModelToDomain(row) : null
  }
}

export class PgActiveTensionItemRepository implements ActiveTensionItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async replaceForAgent(
    agentId: string,
    items: UpsertContextActiveTensionItemInput[],
  ): Promise<ContextActiveTensionItem[]> {
    const ids = items.map((item) => item.id)
    await this.prisma.activeTensionItem.deleteMany({
      where: {
        agentId,
        ...(ids.length > 0 ? { id: { notIn: ids } } : {}),
      },
    })

    const rows = await Promise.all(items.map((item) => this.prisma.activeTensionItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        agentId,
        label: item.label,
        description: item.description,
        intensity: item.intensity,
        evidenceRefs: item.evidence_refs as Prisma.InputJsonValue,
      },
      update: {
        label: item.label,
        description: item.description,
        intensity: item.intensity,
        evidenceRefs: item.evidence_refs as Prisma.InputJsonValue,
      },
    })))

    return rows
      .map((row) => activeTensionToDomain(row))
      .sort((a, b) => b.intensity - a.intensity || b.updated_at.getTime() - a.updated_at.getTime())
  }

  async listByAgent(agentId: string, limit: number): Promise<ContextActiveTensionItem[]> {
    const rows = await this.prisma.activeTensionItem.findMany({
      where: { agentId },
      orderBy: [{ intensity: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    })
    return rows.map((row) => activeTensionToDomain(row))
  }
}

export class PgPrivateShadowMemoryRepository implements PrivateShadowMemoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(input: UpsertContextPrivateShadowMemoryInput): Promise<ContextPrivateShadowMemory> {
    const row = await this.prisma.privateShadowMemory.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        agentId: input.agent_id,
        eventId: input.event_id ?? null,
        summary: input.summary,
        publicSafeShadow: input.public_safe_shadow,
        evidenceRefs: input.evidence_refs as Prisma.InputJsonValue,
        createdAt: input.created_at ?? new Date(),
      },
      update: {
        eventId: input.event_id ?? null,
        summary: input.summary,
        publicSafeShadow: input.public_safe_shadow,
        evidenceRefs: input.evidence_refs as Prisma.InputJsonValue,
      },
    })
    return privateShadowToDomain(row)
  }

  async listByAgent(agentId: string, limit: number): Promise<ContextPrivateShadowMemory[]> {
    const rows = await this.prisma.privateShadowMemory.findMany({
      where: { agentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
    return rows.map((row) => privateShadowToDomain(row))
  }

  async pruneByIds(agentId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.prisma.privateShadowMemory.deleteMany({
      where: {
        agentId,
        id: { in: ids },
      },
    })
    return result.count
  }
}

function rawEventToDomain(row: {
  id: string
  agentId: string
  scene: string
  sourceType: string
  sourceRefId: string | null
  counterpartId: string | null
  transcript: string
  evidenceRefs: Prisma.JsonValue
  createdAt: Date
}): ContextRawEvent {
  return {
    id: row.id,
    agent_id: row.agentId,
    scene: row.scene as ContextMemoryScene,
    source_type: row.sourceType as ContextRawEvent['source_type'],
    source_ref_id: row.sourceRefId,
    counterpart_id: row.counterpartId,
    transcript: row.transcript,
    evidence_refs: jsonStringArray(row.evidenceRefs),
    created_at: row.createdAt,
  }
}

function episodicCardToDomain(row: {
  id: string
  agentId: string
  eventId: string | null
  scene: string
  title: string
  summary: string
  topicTags: Prisma.JsonValue
  evidenceRefs: Prisma.JsonValue
  salience: number
  createdAt: Date
  updatedAt: Date
}): ContextEpisodicCard {
  return {
    id: row.id,
    agent_id: row.agentId,
    event_id: row.eventId,
    scene: row.scene as ContextMemoryScene,
    title: row.title,
    summary: row.summary,
    topic_tags: jsonStringArray(row.topicTags),
    evidence_refs: jsonStringArray(row.evidenceRefs),
    salience: row.salience,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function relationStateToDomain(row: {
  id: string
  agentId: string
  counterpartId: string
  channel: string
  stance: string
  confidence: number
  evidenceRefs: Prisma.JsonValue
  updatedAt: Date
}): ContextRelationState {
  return {
    id: row.id,
    agent_id: row.agentId,
    counterpart_id: row.counterpartId,
    channel: row.channel as ContextRelationChannel,
    stance: row.stance,
    confidence: row.confidence,
    evidence_refs: jsonStringArray(row.evidenceRefs),
    updated_at: row.updatedAt,
  }
}

function selfModelToDomain(row: {
  id: string
  agentId: string
  summary: string
  tensions: Prisma.JsonValue
  evidenceRefs: Prisma.JsonValue
  updatedAt: Date
}): ContextSelfModelState {
  return {
    id: row.id,
    agent_id: row.agentId,
    summary: row.summary,
    tensions: jsonStringArray(row.tensions),
    evidence_refs: jsonStringArray(row.evidenceRefs),
    updated_at: row.updatedAt,
  }
}

function activeTensionToDomain(row: {
  id: string
  agentId: string
  label: string
  description: string
  intensity: number
  evidenceRefs: Prisma.JsonValue
  updatedAt: Date
}): ContextActiveTensionItem {
  return {
    id: row.id,
    agent_id: row.agentId,
    label: row.label,
    description: row.description,
    intensity: row.intensity,
    evidence_refs: jsonStringArray(row.evidenceRefs),
    updated_at: row.updatedAt,
  }
}

function privateShadowToDomain(row: {
  id: string
  agentId: string
  eventId: string | null
  summary: string
  publicSafeShadow: string
  evidenceRefs: Prisma.JsonValue
  createdAt: Date
}): ContextPrivateShadowMemory {
  return {
    id: row.id,
    agent_id: row.agentId,
    event_id: row.eventId,
    summary: row.summary,
    public_safe_shadow: row.publicSafeShadow,
    evidence_refs: jsonStringArray(row.evidenceRefs),
    created_at: row.createdAt,
  }
}

function jsonStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function toScene(scene: ContextMemoryScene) {
  return scene.toUpperCase() as 'FORUM' | 'CHAT_ROOM' | 'PRIVATE_CHAT'
}

function toSourceType(sourceType: ContextRawEvent['source_type']) {
  return sourceType.toUpperCase() as 'PRIVATE_SESSION' | 'FORUM_THREAD' | 'CHAT_ROOM_WINDOW' | 'NIGHTLY_COMPACTION'
}

function toChannel(channel: ContextRelationChannel) {
  return channel.toUpperCase() as 'OWNER' | 'COMMUNITY' | 'ROOM' | 'AGENT'
}
