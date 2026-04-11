import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type {
  AudienceThread,
  AudienceMessage,
  AudienceSummary,
  CreateAudienceThreadInput,
  CreateAudienceMessageInput,
  CreateAudienceSummaryInput,
} from '../types.js'
import type { AudienceRepository } from '../audience-repository.js'

function toThread(row: {
  id: string
  postId: string
  communityId: string
  status: 'OPEN' | 'CLOSED'
  createdAt: Date
  updatedAt: Date
}): AudienceThread {
  return {
    id: row.id,
    post_id: row.postId,
    community_id: row.communityId,
    status: row.status,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toMessage(row: {
  id: string
  threadId: string
  authorUserId: string
  body: string
  createdAt: Date
  updatedAt: Date
}): AudienceMessage {
  return {
    id: row.id,
    thread_id: row.threadId,
    author_user_id: row.authorUserId,
    body: row.body,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toSummary(row: {
  id: string
  threadId: string
  postId: string
  communityId: string
  windowStart: Date
  windowEnd: Date
  summaryText: string
  messageCount: number
  source: string | null
  safeMode: boolean
  createdAt: Date
  updatedAt: Date
}): AudienceSummary {
  return {
    id: row.id,
    thread_id: row.threadId,
    post_id: row.postId,
    community_id: row.communityId,
    window_start: row.windowStart,
    window_end: row.windowEnd,
    summary_text: row.summaryText,
    message_count: row.messageCount,
    summary_source: row.source === 'aftershow_trigger' ? 'aftershow_trigger' : null,
    safe_mode: row.safeMode,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export class PgAudienceRepository implements AudienceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertThreadByPost(input: CreateAudienceThreadInput): Promise<AudienceThread> {
    const now = new Date()
    const row = await this.prisma.audienceThread.upsert({
      where: { postId: input.post_id },
      create: {
        id: randomUUID(),
        postId: input.post_id,
        communityId: input.community_id,
        status: input.status ?? 'OPEN',
        createdAt: now,
        updatedAt: now,
      },
      update: {
        status: input.status ?? 'OPEN',
        updatedAt: now,
      },
    })

    return toThread(row)
  }

  async findThreadByPost(postId: string): Promise<AudienceThread | null> {
    const row = await this.prisma.audienceThread.findUnique({ where: { postId } })
    return row ? toThread(row) : null
  }

  async findThreadById(threadId: string): Promise<AudienceThread | null> {
    const row = await this.prisma.audienceThread.findUnique({ where: { id: threadId } })
    return row ? toThread(row) : null
  }

  async createMessage(input: CreateAudienceMessageInput): Promise<AudienceMessage> {
    const now = new Date()
    const row = await this.prisma.audienceMessage.create({
      data: {
        id: randomUUID(),
        threadId: input.thread_id,
        authorUserId: input.author_user_id,
        body: input.body,
        createdAt: now,
        updatedAt: now,
      },
    })
    return toMessage(row)
  }

  async listMessagesByThread(threadId: string): Promise<AudienceMessage[]> {
    const rows = await this.prisma.audienceMessage.findMany({
      where: { threadId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map(toMessage)
  }

  async countMessagesByThread(threadId: string): Promise<number> {
    return this.prisma.audienceMessage.count({ where: { threadId } })
  }

  async createSummary(input: CreateAudienceSummaryInput): Promise<AudienceSummary> {
    const now = new Date()
    const row = await this.prisma.audienceSummary.create({
      data: {
        id: randomUUID(),
        threadId: input.thread_id,
        postId: input.post_id,
        communityId: input.community_id,
        windowStart: input.window_start,
        windowEnd: input.window_end,
        summaryText: input.summary_text,
        messageCount: input.message_count,
        source: input.summary_source ?? null,
        safeMode: input.safe_mode ?? false,
        createdAt: now,
        updatedAt: now,
      },
    })
    return toSummary(row)
  }

  async findLatestSummaryByThread(threadId: string): Promise<AudienceSummary | null> {
    const row = await this.prisma.audienceSummary.findFirst({
      where: { threadId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    if (!row) return null
    return toSummary(row)
  }
}
