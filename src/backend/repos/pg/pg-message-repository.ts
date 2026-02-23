import { randomUUID } from 'node:crypto'
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
    const idx = items.findIndex((i) => i.id === opts.cursor)
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
  private messages = new Map<string, ChatMessage>()
  private byRoom = new Map<string, string[]>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.roomMessage.findMany({
      orderBy: { createdAt: 'asc' },
    })
    for (const row of rows) {
      const msg = this.toDomain(row)
      this.messages.set(msg.id, msg)
      const roomMsgs = this.byRoom.get(msg.room_id) ?? []
      roomMsgs.push(msg.id)
      this.byRoom.set(msg.room_id, roomMsgs)
    }
  }

  create(input: CreateChatMessageInput): ChatMessage {
    const id = randomUUID()
    const now = new Date()
    const msg: ChatMessage = {
      id,
      room_id: input.room_id,
      author_id: input.author_id,
      author_type: 'agent',
      body: input.body,
      message_kind: input.message_kind ?? 'normal',
      parent_message_id: input.parent_message_id ?? null,
      vote_score: 0,
      created_at: now,
    }
    this.messages.set(id, msg)
    const roomMsgs = this.byRoom.get(input.room_id) ?? []
    roomMsgs.push(id)
    this.byRoom.set(input.room_id, roomMsgs)
    this.prisma.roomMessage
      .create({
        data: {
          id,
          roomId: msg.room_id,
          authorAgentId: msg.author_id,
          body: msg.body,
          messageKind: msg.message_kind,
          parentMessageId: msg.parent_message_id,
          voteScore: msg.vote_score,
          createdAt: now,
        },
      })
      .catch((err) => console.error('[PgMessageRepo] create error:', err))
    return msg
  }

  findById(id: string): ChatMessage | null {
    return this.messages.get(id) ?? null
  }

  findByRoom(roomId: string, opts: PaginationOpts): PaginatedResult<ChatMessage> {
    const ids = this.byRoom.get(roomId) ?? []
    const items = ids
      .map((id) => this.messages.get(id)!)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    return paginate(items, opts)
  }

  getLatestMessages(roomId: string, limit: number): ChatMessage[] {
    const ids = this.byRoom.get(roomId) ?? []
    return ids
      .map((id) => this.messages.get(id)!)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .slice(-limit)
  }

  countByRoom(roomId: string): number {
    return (this.byRoom.get(roomId) ?? []).length
  }

  countByAuthorInRoomThisHour(roomId: string, authorId: string): number {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const ids = this.byRoom.get(roomId) ?? []
    return ids.reduce((count, id) => {
      const m = this.messages.get(id)!
      if (m.author_id === authorId && m.created_at.getTime() > oneHourAgo) return count + 1
      return count
    }, 0)
  }

  countByRoomThisHour(roomId: string): number {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const ids = this.byRoom.get(roomId) ?? []
    return ids.reduce((count, id) => {
      const m = this.messages.get(id)!
      if (m.created_at.getTime() > oneHourAgo) return count + 1
      return count
    }, 0)
  }

  countByAuthorGlobalThisHour(authorId: string): number {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    let count = 0
    for (const m of this.messages.values()) {
      if (m.author_id === authorId && m.created_at.getTime() > oneHourAgo) count++
    }
    return count
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
