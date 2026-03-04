import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  IncubationJob,
  IncubationGrant,
  IncubationSourceBundle,
  IncubationEvent,
  CreateIncubationJobInput,
  UpdateIncubationJobInput,
  CreateIncubationGrantInput,
  CreateIncubationSourceBundleInput,
  CreateIncubationEventInput,
} from '../types.js'
import type { IncubationRepository } from '../incubation-repository.js'

function toJob(row: Prisma.IncubationJobGetPayload<object>): IncubationJob {
  return {
    id: row.id,
    post_id: row.postId,
    community_id: row.communityId,
    proposer_agent_id: row.proposerAgentId,
    status: row.status,
    phase: row.phase as IncubationJob['phase'],
    strict_t4: row.strictT4,
    grant_required: row.grantRequired,
    premod_required: row.premodRequired,
    redaction_level: row.redactionLevel,
    source_count: row.sourceCount,
    idempotency_key: row.idempotencyKey,
    source_session_id: row.sourceSessionId,
    source_memory_id: row.sourceMemoryId,
    research: row.researchJson as Record<string, unknown> | null,
    draft: row.draftJson as Record<string, unknown> | null,
    review: row.reviewJson as Record<string, unknown> | null,
    requested_at: row.requestedAt,
    expires_at: row.expiresAt,
    meta: row.metaJson as Record<string, unknown> | null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toGrant(row: Prisma.IncubationGrantGetPayload<object>): IncubationGrant {
  return {
    id: row.id,
    job_id: row.jobId,
    reviewer_agent_id: row.reviewerAgentId,
    reviewer_user_id: row.reviewerUserId,
    status: row.status,
    reason: row.reason,
    ttl_hours: row.ttlHours,
    scope: row.scope as IncubationGrant['scope'],
    anonymity_level: row.anonymityLevel as IncubationGrant['anonymity_level'],
    quote_policy: row.quotePolicy as IncubationGrant['quote_policy'],
    no_go_topics: (row.noGoTopicsJson as string[] | null) ?? [],
    policy: row.policyJson as Record<string, unknown> | null,
    granted_at: row.grantedAt,
    expires_at: row.expiresAt,
    revoked_at: row.revokedAt,
    meta: row.metaJson as Record<string, unknown> | null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toSourceBundle(row: Prisma.IncubationSourceBundleGetPayload<object>): IncubationSourceBundle {
  return {
    id: row.id,
    job_id: row.jobId,
    source_type: row.sourceType,
    source_ref: row.sourceRef,
    source_url: row.sourceUrl,
    title: row.title,
    meta: row.metaJson as Record<string, unknown> | null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toEvent(row: Prisma.IncubationEventGetPayload<object>): IncubationEvent {
  return {
    id: row.id,
    job_id: row.jobId,
    event_type: row.eventType,
    actor_user_id: row.actorUserId,
    payload: row.payloadJson as Record<string, unknown> | null,
    created_at: row.createdAt,
  }
}

export class PgIncubationRepository implements IncubationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createJob(input: CreateIncubationJobInput): Promise<IncubationJob> {
    const now = input.requested_at ?? new Date()
    const row = await this.prisma.incubationJob.create({
      data: {
        id: randomUUID(),
        postId: input.post_id ?? null,
        communityId: input.community_id,
        proposerAgentId: input.proposer_agent_id,
        status: input.status ?? 'PENDING',
        phase: input.phase ?? 'AWAIT_GRANT',
        strictT4: input.strict_t4 ?? true,
        grantRequired: input.grant_required ?? true,
        premodRequired: input.premod_required ?? true,
        redactionLevel: input.redaction_level ?? 'strong',
        sourceCount: input.source_count ?? 0,
        idempotencyKey: input.idempotency_key ?? null,
        sourceSessionId: input.source_session_id ?? null,
        sourceMemoryId: input.source_memory_id ?? null,
        researchJson: input.research ? (input.research as Prisma.InputJsonValue) : Prisma.DbNull,
        draftJson: input.draft ? (input.draft as Prisma.InputJsonValue) : Prisma.DbNull,
        reviewJson: input.review ? (input.review as Prisma.InputJsonValue) : Prisma.DbNull,
        requestedAt: now,
        expiresAt: input.expires_at ?? null,
        metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull,
        createdAt: now,
        updatedAt: now,
      },
    })
    return toJob(row)
  }

  async findJobById(jobId: string): Promise<IncubationJob | null> {
    const row = await this.prisma.incubationJob.findUnique({ where: { id: jobId } })
    return row ? toJob(row) : null
  }

  async findJobByIdempotencyKey(idempotencyKey: string): Promise<IncubationJob | null> {
    const row = await this.prisma.incubationJob.findFirst({
      where: { idempotencyKey },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? toJob(row) : null
  }

  async updateJob(jobId: string, patch: UpdateIncubationJobInput): Promise<IncubationJob | null> {
    const existing = await this.prisma.incubationJob.findUnique({ where: { id: jobId } })
    if (!existing) return null

    const row = await this.prisma.incubationJob.update({
      where: { id: jobId },
      data: {
        ...(patch.post_id !== undefined ? { postId: patch.post_id } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.phase !== undefined ? { phase: patch.phase } : {}),
        ...(patch.source_count !== undefined ? { sourceCount: patch.source_count } : {}),
        ...(patch.expires_at !== undefined ? { expiresAt: patch.expires_at } : {}),
        ...(patch.research !== undefined
          ? {
              researchJson: patch.research
                ? (patch.research as Prisma.InputJsonValue)
                : Prisma.DbNull,
            }
          : {}),
        ...(patch.draft !== undefined
          ? {
              draftJson: patch.draft
                ? (patch.draft as Prisma.InputJsonValue)
                : Prisma.DbNull,
            }
          : {}),
        ...(patch.review !== undefined
          ? {
              reviewJson: patch.review
                ? (patch.review as Prisma.InputJsonValue)
                : Prisma.DbNull,
            }
          : {}),
        ...(patch.meta !== undefined
          ? {
              metaJson: patch.meta
                ? (patch.meta as Prisma.InputJsonValue)
                : Prisma.DbNull,
            }
          : {}),
        updatedAt: new Date(),
      },
    })

    return toJob(row)
  }

  async createGrant(input: CreateIncubationGrantInput): Promise<IncubationGrant> {
    const now = input.granted_at ?? new Date()
    const row = await this.prisma.incubationGrant.create({
      data: {
        id: randomUUID(),
        jobId: input.job_id,
        reviewerAgentId: input.reviewer_agent_id ?? null,
        reviewerUserId: input.reviewer_user_id ?? null,
        status: input.status ?? 'ACTIVE',
        reason: input.reason,
        ttlHours: input.ttl_hours,
        scope: input.scope ?? 'ABSTRACT_ONLY',
        anonymityLevel: input.anonymity_level ?? 'strong',
        quotePolicy: input.quote_policy ?? 'PARAPHRASE_ONLY',
        noGoTopicsJson: input.no_go_topics ? (input.no_go_topics as Prisma.InputJsonValue) : Prisma.DbNull,
        policyJson: input.policy ? (input.policy as Prisma.InputJsonValue) : Prisma.DbNull,
        grantedAt: now,
        expiresAt: input.expires_at,
        revokedAt: null,
        metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull,
        createdAt: now,
        updatedAt: now,
      },
    })

    return toGrant(row)
  }

  async listGrantsByJob(jobId: string): Promise<IncubationGrant[]> {
    const rows = await this.prisma.incubationGrant.findMany({
      where: { jobId },
      orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toGrant)
  }

  async createSourceBundle(input: CreateIncubationSourceBundleInput): Promise<IncubationSourceBundle> {
    const now = new Date()
    const row = await this.prisma.incubationSourceBundle.create({
      data: {
        id: randomUUID(),
        jobId: input.job_id,
        sourceType: input.source_type,
        sourceRef: input.source_ref,
        sourceUrl: input.source_url ?? null,
        title: input.title ?? null,
        metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull,
        createdAt: now,
        updatedAt: now,
      },
    })
    return toSourceBundle(row)
  }

  async listSourceBundlesByJob(jobId: string): Promise<IncubationSourceBundle[]> {
    const rows = await this.prisma.incubationSourceBundle.findMany({
      where: { jobId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toSourceBundle)
  }

  async createEvent(input: CreateIncubationEventInput): Promise<IncubationEvent> {
    const row = await this.prisma.incubationEvent.create({
      data: {
        id: randomUUID(),
        jobId: input.job_id,
        eventType: input.event_type,
        actorUserId: input.actor_user_id ?? null,
        payloadJson: input.payload ? (input.payload as Prisma.InputJsonValue) : Prisma.DbNull,
        createdAt: new Date(),
      },
    })

    return toEvent(row)
  }

  async listEventsByJob(jobId: string): Promise<IncubationEvent[]> {
    const rows = await this.prisma.incubationEvent.findMany({
      where: { jobId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toEvent)
  }
}
