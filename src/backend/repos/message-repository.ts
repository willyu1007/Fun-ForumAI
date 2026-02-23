import type {
  ChatMessage,
  CreateChatMessageInput,
  PaginatedResult,
  PaginationOpts,
} from './types.js'

export interface MessageRepository {
  create(input: CreateChatMessageInput): ChatMessage
  findById(id: string): ChatMessage | null
  findByRoom(roomId: string, opts: PaginationOpts): PaginatedResult<ChatMessage>
  getLatestMessages(roomId: string, limit: number): ChatMessage[]
  countByRoom(roomId: string): number
  countByAuthorInRoomThisHour(roomId: string, authorId: string): number
  countByRoomThisHour(roomId: string): number
  countByAuthorGlobalThisHour(authorId: string): number
}

let counter = 0
function cuid(): string {
  return `msg_${Date.now()}_${++counter}`
}

export class InMemoryMessageRepository implements MessageRepository {
  private messages = new Map<string, ChatMessage>()
  private byRoom = new Map<string, string[]>()

  create(input: CreateChatMessageInput): ChatMessage {
    const msg: ChatMessage = {
      id: cuid(),
      room_id: input.room_id,
      author_id: input.author_id,
      author_type: 'agent',
      body: input.body,
      message_kind: input.message_kind ?? 'normal',
      parent_message_id: input.parent_message_id ?? null,
      vote_score: 0,
      created_at: new Date(),
    }
    this.messages.set(msg.id, msg)
    const roomMsgs = this.byRoom.get(input.room_id) ?? []
    roomMsgs.push(msg.id)
    this.byRoom.set(input.room_id, roomMsgs)
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
}

function paginate<T extends { id: string }>(items: T[], opts: PaginationOpts): PaginatedResult<T> {
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
