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
  reason: string | null
  thresholdPass: boolean | null
  publishShape: string | null
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
    reason: row.reason,
    threshold_pass: row.thresholdPass,
    publish_shape: row.publishShape === 'aftershow_block' ? 'aftershow_block' : null,
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
    created_at: row.createdAt,
  }
}

export class PgAftershowArtifactRepository implements AftershowArtifactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createArtifact(input: CreateAftershowArtifactInput): Promise<AftershowArtifact> {
    if (input.idempotency_key) {
      const existing = await this.prisma.aftershowArtifact.findUnique({
        where: { idempotencyKey: input.idempotency_key },
      })
      if (existing) {
        return toArtifact({ ...existing, contentJson: existing.contentJson })
      }
    }

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
        reason: input.reason ?? null,
        thresholdPass: input.threshold_pass ?? null,
        publishShape: input.publish_shape ?? null,
        createdAt: now,
        updatedAt: now,
      },
    }).catch(async (err) => {
      if (err?.code === 'P2002' && input.idempotency_key) {
        const existing = await this.prisma.aftershowArtifact.findUnique({
          where: { idempotencyKey: input.idempotency_key },
        })
        if (existing) return existing
      }
      throw err
    })
    return toArtifact({ ...row, contentJson: row.contentJson })
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
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
        ...(input.threshold_pass !== undefined ? { thresholdPass: input.threshold_pass } : {}),
        ...(input.publish_shape !== undefined ? { publishShape: input.publish_shape } : {}),
        updatedAt: new Date(),
      },
    }).catch((err) => (err?.code === 'P2025' ? null : Promise.reject(err)))
    if (!row) return null
    return toArtifact({ ...row, contentJson: row.contentJson })
  }

  async findArtifactById(id: string): Promise<AftershowArtifact | null> {
    const row = await this.prisma.aftershowArtifact.findUnique({ where: { id } })
    return row ? toArtifact({ ...row, contentJson: row.contentJson }) : null
  }

  async findLatestByPost(postId: string): Promise<AftershowArtifact | null> {
    const row = await this.prisma.aftershowArtifact.findFirst({
      where: { postId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? toArtifact({ ...row, contentJson: row.contentJson }) : null
  }

  async findLatestPublishedByPost(postId: string): Promise<AftershowArtifact | null> {
    const row = await this.prisma.aftershowArtifact.findFirst({
      where: { postId, status: 'PUBLISHED' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? toArtifact({ ...row, contentJson: row.contentJson }) : null
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
        createdAt: new Date(),
      },
      update: {
        reason: input.reason,
        evidenceRef: input.evidence_ref ?? null,
        ...(input.notification_id !== undefined ? { notificationId: input.notification_id } : {}),
        ...(input.invalidated_at !== undefined ? { invalidatedAt: input.invalidated_at } : {}),
      },
    })
    return toCallout(row)
  }

  async updateCallout(id: string, input: UpdateAftershowCalloutInput): Promise<AftershowCallout | null> {
    const row = await this.prisma.aftershowCallout.update({
      where: { id },
      data: {
        ...(input.notification_id !== undefined ? { notificationId: input.notification_id } : {}),
        ...(input.invalidated_at !== undefined ? { invalidatedAt: input.invalidated_at } : {}),
      },
    }).catch((err) => (err?.code === 'P2025' ? null : Promise.reject(err)))
    return row ? toCallout(row) : null
  }

  async listCalloutsByArtifact(artifactId: string): Promise<AftershowCallout[]> {
    const rows = await this.prisma.aftershowCallout.findMany({
      where: { artifactId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => toCallout(row))
  }

  async countNotifiedCalloutsByUserSince(userId: string, since: Date): Promise<number> {
    return this.prisma.aftershowCallout.count({
      where: { userId, notificationId: { not: null }, createdAt: { gte: since } },
    })
  }

  async countNotifiedCalloutsByUserAndPostSince(userId: string, postId: string, since: Date): Promise<number> {
    return this.prisma.aftershowCallout.count({
      where: {
        userId,
        notificationId: { not: null },
        createdAt: { gte: since },
        artifact: {
          postId,
        },
      },
    })
  }

  async countNotifiedCalloutsByPostSince(postId: string, since: Date): Promise<number> {
    return this.prisma.aftershowCallout.count({
      where: {
        notificationId: { not: null },
        createdAt: { gte: since },
        artifact: {
          postId,
        },
      },
    })
  }
}
