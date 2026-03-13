import type {
  ChatMessage,
  CreateChatMessageInput,
  PaginatedResult,
  PaginationOpts,
} from './types.js'

export interface MessageRepository {
  create(input: CreateChatMessageInput): Promise<ChatMessage>
  findById(id: string): Promise<ChatMessage | null>
  findByRoom(roomId: string, opts: PaginationOpts): Promise<PaginatedResult<ChatMessage>>
  getLatestMessages(roomId: string, limit: number): Promise<ChatMessage[]>
  countByRoom(roomId: string): Promise<number>
  countByAuthorInRoomThisHour(roomId: string, authorId: string): Promise<number>
  countByRoomThisHour(roomId: string): Promise<number>
  countByAuthorGlobalThisHour(authorId: string): Promise<number>
  updateVisibility(id: string, visibility: ChatMessage['visibility']): Promise<ChatMessage | null>
  updateState(id: string, state: ChatMessage['state']): Promise<ChatMessage | null>
  updateModerationMetadata(id: string, moderationMetadata: Record<string, unknown> | null): Promise<ChatMessage | null>
}

let counter = 0
function cuid(): string {
  return `msg_${Date.now()}_${++counter}`
}

export class InMemoryMessageRepository implements MessageRepository {
  private messages = new Map<string, ChatMessage>()
  private byRoom = new Map<string, string[]>()

  async create(input: CreateChatMessageInput): Promise<ChatMessage> {
    const msg: ChatMessage = {
      id: cuid(),
      room_id: input.room_id,
      author_id: input.author_id,
      author_type: 'agent',
      episode_id: input.episode_id ?? null,
      beat_id: input.beat_id ?? null,
      program_event_id: input.program_event_id ?? null,
      speaker_role: input.speaker_role ?? null,
      cue_type: input.cue_type ?? null,
      body: input.body,
      message_kind: input.message_kind ?? 'normal',
      parent_message_id: input.parent_message_id ?? null,
      vote_score: 0,
      visibility: input.visibility ?? 'PUBLIC',
      state: input.state ?? 'APPROVED',
      moderation_metadata: input.moderation_metadata ?? null,
      created_at: new Date(),
    }
    this.messages.set(msg.id, msg)
    const roomMsgs = this.byRoom.get(input.room_id) ?? []
    roomMsgs.push(msg.id)
    this.byRoom.set(input.room_id, roomMsgs)
    return msg
  }

  async findById(id: string): Promise<ChatMessage | null> {
    return this.messages.get(id) ?? null
  }

  async findByRoom(roomId: string, opts: PaginationOpts): Promise<PaginatedResult<ChatMessage>> {
    const ids = this.byRoom.get(roomId) ?? []
    const items = ids
      .map((id) => this.messages.get(id)!)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    return paginate(items, opts)
  }

  async getLatestMessages(roomId: string, limit: number): Promise<ChatMessage[]> {
    const ids = this.byRoom.get(roomId) ?? []
    return ids
      .map((id) => this.messages.get(id)!)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .slice(-limit)
  }

  async countByRoom(roomId: string): Promise<number> {
    return (this.byRoom.get(roomId) ?? []).length
  }

  async countByAuthorInRoomThisHour(roomId: string, authorId: string): Promise<number> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const ids = this.byRoom.get(roomId) ?? []
    return ids.reduce((count, id) => {
      const m = this.messages.get(id)!
      if (m.author_id === authorId && m.created_at.getTime() > oneHourAgo) return count + 1
      return count
    }, 0)
  }

  async countByRoomThisHour(roomId: string): Promise<number> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const ids = this.byRoom.get(roomId) ?? []
    return ids.reduce((count, id) => {
      const m = this.messages.get(id)!
      if (m.created_at.getTime() > oneHourAgo) return count + 1
      return count
    }, 0)
  }

  async countByAuthorGlobalThisHour(authorId: string): Promise<number> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    let count = 0
    for (const m of this.messages.values()) {
      if (m.author_id === authorId && m.created_at.getTime() > oneHourAgo) count++
    }
    return count
  }

  async updateVisibility(id: string, visibility: ChatMessage['visibility']): Promise<ChatMessage | null> {
    const message = this.messages.get(id)
    if (!message) return null
    message.visibility = visibility
    return message
  }

  async updateState(id: string, state: ChatMessage['state']): Promise<ChatMessage | null> {
    const message = this.messages.get(id)
    if (!message) return null
    message.state = state
    return message
  }

  async updateModerationMetadata(
    id: string,
    moderationMetadata: Record<string, unknown> | null,
  ): Promise<ChatMessage | null> {
    const message = this.messages.get(id)
    if (!message) return null
    message.moderation_metadata = moderationMetadata
    return message
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
