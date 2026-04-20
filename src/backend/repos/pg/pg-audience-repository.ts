import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type {
  AudienceThread,
  AudienceMessage,
  AudienceMessageAggregate,
  AudienceMessageAuthor,
  AudienceMessageLike,
  AudienceSummary,
  CreateAudienceThreadInput,
  CreateAudienceMessageInput,
  CreateAudienceSummaryInput,
  ToggleAudienceMessageLikeInput,
} from '../types.js'
import type {
  AudienceRepository,
  ListAudienceMessagesAggregatedOptions,
} from '../audience-repository.js'

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

interface RawMessageRow {
  id: string
  threadId: string
  authorUserId: string
  body: string
  parentMessageId: string | null
  quotedTurnId: string | null
  quotedTurnExcerpt: string | null
  quotedTurnAuthorName: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function toMessage(row: RawMessageRow): AudienceMessage {
  return {
    id: row.id,
    thread_id: row.threadId,
    author_user_id: row.authorUserId,
    body: row.body,
    parent_message_id: row.parentMessageId,
    quoted_turn_id: row.quotedTurnId,
    quoted_turn_excerpt: row.quotedTurnExcerpt,
    quoted_turn_author_name: row.quotedTurnAuthorName,
    deleted_at: row.deletedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toLike(row: { id: string; messageId: string; userId: string; createdAt: Date }): AudienceMessageLike {
  return {
    id: row.id,
    message_id: row.messageId,
    user_id: row.userId,
    created_at: row.createdAt,
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
        parentMessageId: input.parent_message_id ?? null,
        quotedTurnId: input.quoted_turn_id ?? null,
        quotedTurnExcerpt: input.quoted_turn_excerpt ?? null,
        quotedTurnAuthorName: input.quoted_turn_author_name ?? null,
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

  async listMessagesWithAggregates(
    threadId: string,
    options?: ListAudienceMessagesAggregatedOptions,
  ): Promise<AudienceMessageAggregate[]> {
    const rows = await this.prisma.audienceMessage.findMany({
      where: { threadId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        authorUser: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    })
    const messages = rows.map(toMessage)
    const ids = messages.map((message) => message.id)
    const [likeCounts, likedByViewer] = await Promise.all([
      this.countLikes(ids),
      options?.viewer_user_id
        ? this.listLikedMessageIdsByViewer(ids, options.viewer_user_id)
        : Promise.resolve(new Set<string>()),
    ])
    const authors = new Map<string, AudienceMessageAuthor>()
    for (const row of rows) {
      if (row.authorUser) {
        authors.set(row.authorUser.id, {
          id: row.authorUser.id,
          display_name: row.authorUser.displayName,
          avatar_url: row.authorUser.avatarUrl,
        })
      }
    }
    if (options?.authors) {
      for (const [id, author] of options.authors.entries()) {
        authors.set(id, author)
      }
    }
    return messages.map((message) => ({
      ...message,
      author:
        authors.get(message.author_user_id) ??
        ({
          id: message.author_user_id,
          display_name: `用户 ${message.author_user_id.slice(0, 6)}`,
          avatar_url: null,
        } satisfies AudienceMessageAuthor),
      like_count: likeCounts.get(message.id) ?? 0,
      viewer_has_liked: likedByViewer.has(message.id),
    }))
  }

  async findMessageById(messageId: string): Promise<AudienceMessage | null> {
    const row = await this.prisma.audienceMessage.findUnique({ where: { id: messageId } })
    return row ? toMessage(row) : null
  }

  async softDeleteMessage(messageId: string): Promise<void> {
    const now = new Date()
    await this.prisma.audienceMessage.update({
      where: { id: messageId },
      data: { deletedAt: now, updatedAt: now },
    })
  }

  async updateMessageTimestamps(
    messageId: string,
    input: { created_at: Date; updated_at?: Date },
  ): Promise<AudienceMessage | null> {
    const row = await this.prisma.audienceMessage.update({
      where: { id: messageId },
      data: {
        createdAt: input.created_at,
        updatedAt: input.updated_at ?? input.created_at,
      },
    })
    return row ? toMessage(row as unknown as RawMessageRow) : null
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

  async likeMessage(input: ToggleAudienceMessageLikeInput): Promise<AudienceMessageLike> {
    const row = await this.prisma.audienceMessageLike.upsert({
      where: { messageId_userId: { messageId: input.message_id, userId: input.user_id } },
      create: {
        id: randomUUID(),
        messageId: input.message_id,
        userId: input.user_id,
      },
      update: {},
    })
    return toLike(row)
  }

  async unlikeMessage(input: ToggleAudienceMessageLikeInput): Promise<void> {
    await this.prisma.audienceMessageLike.deleteMany({
      where: { messageId: input.message_id, userId: input.user_id },
    })
  }

  async countLikes(messageIds: readonly string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    if (messageIds.length === 0) return result
    const rows = await this.prisma.audienceMessageLike.groupBy({
      by: ['messageId'],
      where: { messageId: { in: [...messageIds] } },
      _count: { _all: true },
    })
    for (const row of rows) {
      result.set(row.messageId, row._count._all)
    }
    return result
  }

  async listLikedMessageIdsByViewer(
    messageIds: readonly string[],
    userId: string,
  ): Promise<Set<string>> {
    const result = new Set<string>()
    if (messageIds.length === 0 || !userId) return result
    const rows = await this.prisma.audienceMessageLike.findMany({
      where: { userId, messageId: { in: [...messageIds] } },
      select: { messageId: true },
    })
    for (const row of rows) result.add(row.messageId)
    return result
  }
}
