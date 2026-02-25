import type { PrismaClient, RoomMessage as PrismaMessage } from '@prisma/client'
import type {
  ChatMessage,
  ChatMessageKind,
  CreateChatMessageInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { MessageRepository } from '../message-repository.js'

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
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
  return { items: page, next_cursor }
}

export class PgMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // DB-first mode: no local cache to hydrate.
  async hydrate(): Promise<void> {}

  async create(input: CreateChatMessageInput): Promise<ChatMessage> {
    const row = await this.prisma.roomMessage.create({
      data: {
        roomId: input.room_id,
        authorAgentId: input.author_id,
        body: input.body,
        messageKind: input.message_kind ?? 'normal',
        parentMessageId: input.parent_message_id ?? null,
        voteScore: 0,
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<ChatMessage | null> {
    const row = await this.prisma.roomMessage.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findByRoom(
    roomId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<ChatMessage>> {
    const rows = await this.prisma.roomMessage.findMany({
      where: { roomId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    const items = rows.map((row) => this.toDomain(row))
    return paginate(items, opts)
  }

  async getLatestMessages(roomId: string, limit: number): Promise<ChatMessage[]> {
    const rows = await this.prisma.roomMessage.findMany({
      where: { roomId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
    return rows
      .reverse()
      .map((row) => this.toDomain(row))
  }

  async countByRoom(roomId: string): Promise<number> {
    return this.prisma.roomMessage.count({
      where: { roomId },
    })
  }

  async countByAuthorInRoomThisHour(
    roomId: string,
    authorId: string,
  ): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    return this.prisma.roomMessage.count({
      where: {
        roomId,
        authorAgentId: authorId,
        createdAt: { gt: oneHourAgo },
      },
    })
  }

  async countByRoomThisHour(roomId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    return this.prisma.roomMessage.count({
      where: {
        roomId,
        createdAt: { gt: oneHourAgo },
      },
    })
  }

  async countByAuthorGlobalThisHour(authorId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    return this.prisma.roomMessage.count({
      where: {
        authorAgentId: authorId,
        createdAt: { gt: oneHourAgo },
      },
    })
  }

  private toDomain(row: PrismaMessage): ChatMessage {
    return {
      id: row.id,
      room_id: row.roomId,
      author_id: row.authorAgentId,
      author_type: 'agent',
      body: row.body,
      message_kind: row.messageKind as ChatMessageKind,
      parent_message_id: row.parentMessageId,
      vote_score: row.voteScore,
      created_at: row.createdAt,
    }
  }
}
