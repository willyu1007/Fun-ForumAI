import type {
  AgentRelation as PrismaRelation,
  AgentRelationEvent as PrismaRelationEvent,
  PrismaClient,
} from '@prisma/client'
import { Prisma } from '@prisma/client'
import type {
  AgentRelation,
  AgentRelationEvent,
  CreateAgentRelationEventInput,
  PaginatedResult,
  PaginationOpts,
  RelationState,
  UpsertAgentRelationInput,
} from '../types.js'
import type { RelationRepository } from '../relation-repository.js'

export class PgRelationRepository implements RelationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createEvent(input: CreateAgentRelationEventInput): Promise<{ event: AgentRelationEvent; deduped: boolean }> {
    try {
      const row = await this.prisma.agentRelationEvent.create({
        data: {
          fromAgentId: input.from_agent_id,
          toAgentId: input.to_agent_id,
          eventType: input.event_type,
          severity: input.severity ?? 'info',
          sourceType: input.source_type,
          sourceRefId: input.source_ref_id ?? null,
          idempotencyKey: input.idempotency_key,
          payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      })
      return { event: this.eventToDomain(row), deduped: false }
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err

      const row = await this.prisma.agentRelationEvent.findUnique({
        where: { idempotencyKey: input.idempotency_key },
      })
      if (!row) throw err
      return { event: this.eventToDomain(row), deduped: true }
    }
  }

  async getRelation(fromAgentId: string, toAgentId: string): Promise<AgentRelation | null> {
    const row = await this.prisma.agentRelation.findUnique({
      where: {
        fromAgentId_toAgentId: {
          fromAgentId,
          toAgentId,
        },
      },
    })
    return row ? this.relationToDomain(row) : null
  }

  async upsertRelation(input: UpsertAgentRelationInput): Promise<AgentRelation> {
    if (input.expected_version !== undefined) {
      const update = buildRelationUpdate(input, true)
      const result = await this.prisma.agentRelation.updateMany({
        where: {
          fromAgentId: input.from_agent_id,
          toAgentId: input.to_agent_id,
          version: input.expected_version,
        },
        data: update,
      })
      if (result.count === 0) {
        const latest = await this.getRelation(input.from_agent_id, input.to_agent_id)
        if (!latest) {
          throw new Error('relation_version_conflict_or_missing')
        }
        return latest
      }
      const latest = await this.getRelation(input.from_agent_id, input.to_agent_id)
      if (!latest) {
        throw new Error('relation_not_found_after_update')
      }
      return latest
    }

    const row = await this.prisma.agentRelation.upsert({
      where: {
        fromAgentId_toAgentId: {
          fromAgentId: input.from_agent_id,
          toAgentId: input.to_agent_id,
        },
      },
      create: {
        fromAgentId: input.from_agent_id,
        toAgentId: input.to_agent_id,
        state: input.state,
        relationScore: input.relation_score,
        interactionScore: input.interaction_score,
        personaScore: input.persona_score,
        safetyScore: input.safety_score,
        shadowStartedAt: input.shadow_started_at ?? null,
        effectiveAt: input.effective_at ?? null,
        inactiveAt: input.inactive_at ?? null,
        blockedAt: input.blocked_at ?? null,
        belowThresholdSince: input.below_threshold_since ?? null,
        lastSignalAt: input.last_signal_at ?? null,
        lastInteractionAt: input.last_interaction_at ?? null,
        lastEvaluatedAt: input.last_evaluated_at ?? null,
        lastStateChangedAt: input.last_state_changed_at ?? null,
        version: 1,
      },
      update: buildRelationUpdate(input, true),
    })

    return this.relationToDomain(row)
  }

  async listOutgoing(
    agentId: string,
    opts: PaginationOpts & { state?: RelationState },
  ): Promise<PaginatedResult<AgentRelation>> {
    const rows = await this.prisma.agentRelation.findMany({
      where: {
        fromAgentId: agentId,
        ...(opts.state ? { state: opts.state } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    })

    return paginate(rows.map((row) => this.relationToDomain(row)), opts.limit)
  }

  async listIncoming(
    agentId: string,
    opts: PaginationOpts & { state?: RelationState },
  ): Promise<PaginatedResult<AgentRelation>> {
    const rows = await this.prisma.agentRelation.findMany({
      where: {
        toAgentId: agentId,
        ...(opts.state ? { state: opts.state } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    })

    return paginate(rows.map((row) => this.relationToDomain(row)), opts.limit)
  }

  async listMutualEffective(
    agentId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<AgentRelation>> {
    const take = opts.limit + 1

    const cursorFilter = opts.cursor
      ? Prisma.sql`AND r1."id" < ${opts.cursor}`
      : Prisma.empty

    const rows = await this.prisma.$queryRaw<PrismaRelation[]>`
      SELECT r1.*
      FROM agent_relations r1
      JOIN agent_relations r2
        ON r1."to_agent_id" = r2."from_agent_id"
        AND r1."from_agent_id" = r2."to_agent_id"
      WHERE r1."from_agent_id" = ${agentId}
        AND r1.state = 'effective'
        AND r2.state = 'effective'
        ${cursorFilter}
      ORDER BY r1."updated_at" DESC, r1."id" DESC
      LIMIT ${take}
    `

    const mapped = rows.map((row) => this.rawRelationToDomain(row))
    const hasMore = mapped.length > opts.limit
    const page = hasMore ? mapped.slice(0, opts.limit) : mapped
    return {
      items: page,
      next_cursor: hasMore ? page[page.length - 1].id : null,
    }
  }

  async countOutgoingByStates(agentId: string, states: RelationState[]): Promise<number> {
    return this.prisma.agentRelation.count({
      where: { fromAgentId: agentId, state: { in: states } },
    })
  }

  async countIncomingByStates(agentId: string, states: RelationState[]): Promise<number> {
    return this.prisma.agentRelation.count({
      where: { toAgentId: agentId, state: { in: states } },
    })
  }

  async countMutualEffective(agentId: string): Promise<number> {
    const outgoing = await this.prisma.agentRelation.findMany({
      where: { fromAgentId: agentId, state: 'effective' },
      select: { toAgentId: true },
    })
    const toIds = outgoing.map((row) => row.toAgentId)
    if (toIds.length === 0) return 0

    return this.prisma.agentRelation.count({
      where: {
        fromAgentId: { in: toIds },
        toAgentId: agentId,
        state: 'effective',
      },
    })
  }

  async listPairEvents(
    fromAgentId: string,
    toAgentId: string,
    opts: {
      since?: Date
      severity?: 'info' | 'warning' | 'severe'
      event_type?: string
      limit: number
    },
  ): Promise<AgentRelationEvent[]> {
    const rows = await this.prisma.agentRelationEvent.findMany({
      where: {
        fromAgentId,
        toAgentId,
        ...(opts.since ? { createdAt: { gte: opts.since } } : {}),
        ...(opts.severity ? { severity: opts.severity } : {}),
        ...(opts.event_type ? { eventType: opts.event_type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
    })

    return rows.map((row) => this.eventToDomain(row))
  }

  async adminUnblockTx(
    eventInput: CreateAgentRelationEventInput,
    relationInput: UpsertAgentRelationInput,
  ): Promise<{ event: AgentRelationEvent; relation: AgentRelation }> {
    const [eventRow, relationRow] = await this.prisma.$transaction([
      this.prisma.agentRelationEvent.create({
        data: {
          fromAgentId: eventInput.from_agent_id,
          toAgentId: eventInput.to_agent_id,
          eventType: eventInput.event_type,
          severity: eventInput.severity ?? 'info',
          sourceType: eventInput.source_type,
          sourceRefId: eventInput.source_ref_id ?? null,
          idempotencyKey: eventInput.idempotency_key,
          payload: (eventInput.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      }),
      this.prisma.agentRelation.update({
        where: {
          fromAgentId_toAgentId: {
            fromAgentId: relationInput.from_agent_id,
            toAgentId: relationInput.to_agent_id,
          },
        },
        data: buildRelationUpdate(relationInput, true),
      }),
    ])

    return {
      event: this.eventToDomain(eventRow),
      relation: this.relationToDomain(relationRow),
    }
  }

  async listRelationsByStates(states: RelationState[], limit: number): Promise<AgentRelation[]> {
    const rows = await this.prisma.agentRelation.findMany({
      where: {
        state: { in: states },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })

    return rows.map((row) => this.relationToDomain(row))
  }

  private rawRelationToDomain(row: Record<string, unknown>): AgentRelation {
    return {
      id: row.id as string,
      from_agent_id: row.from_agent_id as string,
      to_agent_id: row.to_agent_id as string,
      state: row.state as RelationState,
      relation_score: row.relation_score as number,
      interaction_score: row.interaction_score as number,
      persona_score: row.persona_score as number,
      safety_score: row.safety_score as number,
      shadow_started_at: row.shadow_started_at as Date | null,
      effective_at: row.effective_at as Date | null,
      inactive_at: row.inactive_at as Date | null,
      blocked_at: row.blocked_at as Date | null,
      below_threshold_since: row.below_threshold_since as Date | null,
      last_signal_at: row.last_signal_at as Date | null,
      last_interaction_at: row.last_interaction_at as Date | null,
      last_evaluated_at: row.last_evaluated_at as Date | null,
      last_state_changed_at: row.last_state_changed_at as Date | null,
      version: row.version as number,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    }
  }

  private relationToDomain(row: PrismaRelation): AgentRelation {
    return {
      id: row.id,
      from_agent_id: row.fromAgentId,
      to_agent_id: row.toAgentId,
      state: row.state as RelationState,
      relation_score: row.relationScore,
      interaction_score: row.interactionScore,
      persona_score: row.personaScore,
      safety_score: row.safetyScore,
      shadow_started_at: row.shadowStartedAt,
      effective_at: row.effectiveAt,
      inactive_at: row.inactiveAt,
      blocked_at: row.blockedAt,
      below_threshold_since: row.belowThresholdSince,
      last_signal_at: row.lastSignalAt,
      last_interaction_at: row.lastInteractionAt,
      last_evaluated_at: row.lastEvaluatedAt,
      last_state_changed_at: row.lastStateChangedAt,
      version: row.version,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private eventToDomain(row: PrismaRelationEvent): AgentRelationEvent {
    return {
      id: row.id,
      from_agent_id: row.fromAgentId,
      to_agent_id: row.toAgentId,
      event_type: row.eventType as AgentRelationEvent['event_type'],
      severity: row.severity as AgentRelationEvent['severity'],
      source_type: row.sourceType,
      source_ref_id: row.sourceRefId,
      idempotency_key: row.idempotencyKey,
      payload: toJsonObjectOrNull(row.payload),
      created_at: row.createdAt,
    }
  }
}

function buildRelationUpdate(
  input: UpsertAgentRelationInput,
  incrementVersion: boolean,
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    state: input.state,
    relationScore: input.relation_score,
    interactionScore: input.interaction_score,
    personaScore: input.persona_score,
    safetyScore: input.safety_score,
    ...(incrementVersion ? { version: { increment: 1 } } : {}),
  }

  const optional = {
    shadowStartedAt: input.shadow_started_at,
    effectiveAt: input.effective_at,
    inactiveAt: input.inactive_at,
    blockedAt: input.blocked_at,
    belowThresholdSince: input.below_threshold_since,
    lastSignalAt: input.last_signal_at,
    lastInteractionAt: input.last_interaction_at,
    lastEvaluatedAt: input.last_evaluated_at,
    lastStateChangedAt: input.last_state_changed_at,
  }

  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) {
      update[key] = value
    }
  }

  return update
}

function paginate(items: AgentRelation[], limit: number): PaginatedResult<AgentRelation> {
  const hasMore = items.length > limit
  const page = hasMore ? items.slice(0, limit) : items
  return {
    items: page,
    next_cursor: hasMore ? page[page.length - 1].id : null,
  }
}

function toJsonObjectOrNull(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function isUniqueConstraintError(err: unknown): boolean {
  return Boolean(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002',
  )
}
