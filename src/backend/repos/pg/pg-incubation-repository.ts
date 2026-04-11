import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  IncubationJob,
  IncubationGrant,
  IncubationSourceBundle,
  IncubationEvent,
  IncubationJobStatus,
  CreateIncubationJobInput,
  UpdateIncubationJobInput,
  CreateIncubationGrantInput,
  CreateIncubationSourceBundleInput,
  CreateIncubationEventInput,
} from '../types.js'
import type { GrantJobTxInput, IncubationRepository } from '../incubation-repository.js'

function toJob(row: Prisma.IncubationJobGetPayload<object>): IncubationJob {
  return {
    id: row.id,
    post_id: row.postId,
    community_id: row.communityId,
    proposer_agent_id: row.proposerAgentId,
    status: row.status,
    phase: row.phase as IncubationJob['phase'],
    strict_publication: row.strictPublication,
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
    job_source: row.jobSource === 'PRIVATE_DIGEST_COMPLETED' ? 'PRIVATE_DIGEST_COMPLETED' : null,
    stage_spec_fallback: row.stageSpecFallback,
    review_verdict:
      row.reviewVerdict === 'approve'
      || row.reviewVerdict === 'reject'
      || row.reviewVerdict === 'quarantine'
        ? row.reviewVerdict
        : null,
    review_reason: row.reviewReason,
    reviewed_by_user_id: row.reviewedByUserId,
    reviewed_at: row.reviewedAt,
    published_post_id: row.publishedPostId,
    published_at: row.publishedAt,
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
    source_session_id: row.sourceSessionId,
    source_memory_id: row.sourceMemoryId,
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

function buildJobPatchData(patch: UpdateIncubationJobInput): Prisma.IncubationJobUpdateInput {
  return {
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
    ...(patch.job_source !== undefined ? { jobSource: patch.job_source } : {}),
    ...(patch.stage_spec_fallback !== undefined ? { stageSpecFallback: patch.stage_spec_fallback } : {}),
    ...(patch.review_verdict !== undefined ? { reviewVerdict: patch.review_verdict } : {}),
    ...(patch.review_reason !== undefined ? { reviewReason: patch.review_reason } : {}),
    ...(patch.reviewed_by_user_id !== undefined ? { reviewedByUserId: patch.reviewed_by_user_id } : {}),
    ...(patch.reviewed_at !== undefined ? { reviewedAt: patch.reviewed_at } : {}),
    ...(patch.published_post_id !== undefined ? { publishedPostId: patch.published_post_id } : {}),
    ...(patch.published_at !== undefined ? { publishedAt: patch.published_at } : {}),
    updatedAt: new Date(),
  }
}

function buildGrantCreateData(
  input: CreateIncubationGrantInput,
): Prisma.IncubationGrantUncheckedCreateInput {
  const now = input.granted_at ?? new Date()
  return {
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
    createdAt: now,
    updatedAt: now,
  }
}

function buildEventCreateData(
  input: CreateIncubationEventInput,
): Prisma.IncubationEventUncheckedCreateInput {
  return {
    id: randomUUID(),
    jobId: input.job_id,
    eventType: input.event_type,
    actorUserId: input.actor_user_id ?? null,
    payloadJson: input.payload ? (input.payload as Prisma.InputJsonValue) : Prisma.DbNull,
    createdAt: new Date(),
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
        strictPublication: input.strict_publication ?? true,
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
        jobSource: input.job_source ?? null,
        stageSpecFallback: input.stage_spec_fallback ?? false,
        reviewVerdict: input.review_verdict ?? null,
        reviewReason: input.review_reason ?? null,
        reviewedByUserId: input.reviewed_by_user_id ?? null,
        reviewedAt: input.reviewed_at ?? null,
        publishedPostId: input.published_post_id ?? null,
        publishedAt: input.published_at ?? null,
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
      data: buildJobPatchData(patch),
    })

    return toJob(row)
  }

  async createGrant(input: CreateIncubationGrantInput): Promise<IncubationGrant> {
    const row = await this.prisma.incubationGrant.create({
      data: buildGrantCreateData(input),
    })

    return toGrant(row)
  }

  async grantJobTx(input: GrantJobTxInput): Promise<{
    grant: IncubationGrant
    job: IncubationJob
    event: IncubationEvent
  }> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.incubationJob.findUnique({ where: { id: input.jobId } })
      if (!current) {
        throw new Error(`incubation_job_not_found:${input.jobId}`)
      }
      if (
        input.expectedCurrentStatus !== undefined &&
        current.status !== input.expectedCurrentStatus
      ) {
        throw new Error(`incubation_job_status_conflict:${current.status satisfies IncubationJobStatus}`)
      }

      const grant = await tx.incubationGrant.create({
        data: buildGrantCreateData(input.grant),
      })
      const job = await tx.incubationJob.update({
        where: { id: input.jobId },
        data: buildJobPatchData(input.jobPatch),
      })
      const event = await tx.incubationEvent.create({
        data: buildEventCreateData(input.event),
      })

      return {
        grant: toGrant(grant),
        job: toJob(job),
        event: toEvent(event),
      }
    })
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
        sourceSessionId: input.source_session_id ?? null,
        sourceMemoryId: input.source_memory_id ?? null,
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
      data: buildEventCreateData(input),
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
