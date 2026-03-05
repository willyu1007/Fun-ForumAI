import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  AftershowArtifact,
  AftershowCallout,
  CreateAftershowArtifactInput,
  UpdateAftershowArtifactInput,
  CreateAftershowCalloutInput,
  UpdateAftershowCalloutInput,
} from '../types.js'
import type { AftershowArtifactRepository } from '../aftershow-artifact-repository.js'

function toArtifact(row: {
  id: string
  runId: string | null
  postId: string
  communityId: string
  status: 'DUE' | 'SNAPSHOT_CREATED' | 'COMPOSED' | 'PUBLISHED' | 'ABORTED'
  windowStart: Date
  windowEnd: Date
  summaryText: string
  contentJson: Prisma.JsonValue | null
  audienceSummaryRef: string | null
  correlationId: string | null
  causeEventId: string | null
  idempotencyKey: string | null
  publishedAt: Date | null
  metaJson: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}): AftershowArtifact {
  return {
    id: row.id,
    run_id: row.runId,
    post_id: row.postId,
    community_id: row.communityId,
    status: row.status,
    window_start: row.windowStart,
    window_end: row.windowEnd,
    summary_text: row.summaryText,
    content: row.contentJson as Record<string, unknown> | null,
    audience_summary_ref: row.audienceSummaryRef,
    correlation_id: row.correlationId,
    cause_event_id: row.causeEventId,
    idempotency_key: row.idempotencyKey,
    published_at: row.publishedAt,
    meta: row.metaJson as Record<string, unknown> | null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toCallout(row: {
  id: string
  artifactId: string
  userId: string
  audienceMessageId: string
  reason: string
  evidenceRef: string | null
  notificationId: string | null
  invalidatedAt: Date | null
  metaJson: Prisma.JsonValue | null
  createdAt: Date
}): AftershowCallout {
  return {
    id: row.id,
    artifact_id: row.artifactId,
    user_id: row.userId,
    audience_message_id: row.audienceMessageId,
    reason: row.reason,
    evidence_ref: row.evidenceRef,
    notification_id: row.notificationId,
    invalidated_at: row.invalidatedAt,
    meta: row.metaJson as Record<string, unknown> | null,
    created_at: row.createdAt,
  }
}

export class PgAftershowArtifactRepository implements AftershowArtifactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createArtifact(input: CreateAftershowArtifactInput): Promise<AftershowArtifact> {
    const now = new Date()
    const row = await this.prisma.aftershowArtifact.create({
      data: {
        id: randomUUID(),
        runId: input.run_id ?? null,
        postId: input.post_id,
        communityId: input.community_id,
        status: input.status ?? 'DUE',
        windowStart: input.window_start,
        windowEnd: input.window_end,
        summaryText: input.summary_text,
        contentJson: input.content ? (input.content as Prisma.InputJsonValue) : Prisma.DbNull,
        audienceSummaryRef: input.audience_summary_ref ?? null,
        correlationId: input.correlation_id ?? null,
        causeEventId: input.cause_event_id ?? null,
        idempotencyKey: input.idempotency_key ?? null,
        publishedAt: input.published_at ?? null,
        metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull,
        createdAt: now,
        updatedAt: now,
      },
    })
    return toArtifact({ ...row, contentJson: row.contentJson, metaJson: row.metaJson })
  }

  async updateArtifact(id: string, input: UpdateAftershowArtifactInput): Promise<AftershowArtifact | null> {
    const row = await this.prisma.aftershowArtifact.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.summary_text !== undefined ? { summaryText: input.summary_text } : {}),
        ...(input.content !== undefined
          ? { contentJson: input.content ? (input.content as Prisma.InputJsonValue) : Prisma.DbNull }
          : {}),
        ...(input.audience_summary_ref !== undefined ? { audienceSummaryRef: input.audience_summary_ref } : {}),
        ...(input.published_at !== undefined ? { publishedAt: input.published_at } : {}),
        ...(input.meta !== undefined
          ? { metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull }
          : {}),
        updatedAt: new Date(),
      },
    }).catch((err) => (err?.code === 'P2025' ? null : Promise.reject(err)))
    if (!row) return null
    return toArtifact({ ...row, contentJson: row.contentJson, metaJson: row.metaJson })
  }

  async findArtifactById(id: string): Promise<AftershowArtifact | null> {
    const row = await this.prisma.aftershowArtifact.findUnique({ where: { id } })
    return row ? toArtifact({ ...row, contentJson: row.contentJson, metaJson: row.metaJson }) : null
  }

  async findLatestByPost(postId: string): Promise<AftershowArtifact | null> {
    const row = await this.prisma.aftershowArtifact.findFirst({
      where: { postId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? toArtifact({ ...row, contentJson: row.contentJson, metaJson: row.metaJson }) : null
  }

  async findLatestPublishedByPost(postId: string): Promise<AftershowArtifact | null> {
    const row = await this.prisma.aftershowArtifact.findFirst({
      where: { postId, status: 'PUBLISHED' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? toArtifact({ ...row, contentJson: row.contentJson, metaJson: row.metaJson }) : null
  }

  async countPublishedByPostSince(postId: string, since: Date): Promise<number> {
    return this.prisma.aftershowArtifact.count({
      where: {
        postId,
        status: 'PUBLISHED',
        createdAt: { gte: since },
      },
    })
  }

  async createCallout(input: CreateAftershowCalloutInput): Promise<AftershowCallout> {
    const row = await this.prisma.aftershowCallout.upsert({
      where: {
        artifactId_userId_audienceMessageId: {
          artifactId: input.artifact_id,
          userId: input.user_id,
          audienceMessageId: input.audience_message_id,
        },
      },
      create: {
        id: randomUUID(),
        artifactId: input.artifact_id,
        userId: input.user_id,
        audienceMessageId: input.audience_message_id,
        reason: input.reason,
        evidenceRef: input.evidence_ref ?? null,
        notificationId: input.notification_id ?? null,
        invalidatedAt: input.invalidated_at ?? null,
        metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull,
        createdAt: new Date(),
      },
      update: {
        reason: input.reason,
        evidenceRef: input.evidence_ref ?? null,
        ...(input.notification_id !== undefined ? { notificationId: input.notification_id } : {}),
        ...(input.invalidated_at !== undefined ? { invalidatedAt: input.invalidated_at } : {}),
        ...(input.meta !== undefined
          ? { metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull }
          : {}),
      },
    })
    return toCallout({ ...row, metaJson: row.metaJson })
  }

  async updateCallout(id: string, input: UpdateAftershowCalloutInput): Promise<AftershowCallout | null> {
    const row = await this.prisma.aftershowCallout.update({
      where: { id },
      data: {
        ...(input.notification_id !== undefined ? { notificationId: input.notification_id } : {}),
        ...(input.invalidated_at !== undefined ? { invalidatedAt: input.invalidated_at } : {}),
        ...(input.meta !== undefined
          ? { metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull }
          : {}),
      },
    }).catch((err) => (err?.code === 'P2025' ? null : Promise.reject(err)))
    return row ? toCallout({ ...row, metaJson: row.metaJson }) : null
  }

  async listCalloutsByArtifact(artifactId: string): Promise<AftershowCallout[]> {
    const rows = await this.prisma.aftershowCallout.findMany({
      where: { artifactId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => toCallout({ ...row, metaJson: row.metaJson }))
  }

  async countCalloutsByUserSince(userId: string, since: Date): Promise<number> {
    return this.prisma.aftershowCallout.count({
      where: { userId, createdAt: { gte: since } },
    })
  }

  async countCalloutsByUserAndPostSince(userId: string, postId: string, since: Date): Promise<number> {
    return this.prisma.aftershowCallout.count({
      where: {
        userId,
        createdAt: { gte: since },
        artifact: {
          postId,
        },
      },
    })
  }

  async countCalloutsByPostSince(postId: string, since: Date): Promise<number> {
    return this.prisma.aftershowCallout.count({
      where: {
        createdAt: { gte: since },
        artifact: {
          postId,
        },
      },
    })
  }
}
