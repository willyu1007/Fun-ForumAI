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
} from './types.js'

export interface ListAudienceMessagesAggregatedOptions {
  viewer_user_id?: string | null
  include_deleted?: boolean
  authors?: ReadonlyMap<string, AudienceMessageAuthor>
}

export interface AudienceRepository {
  upsertThreadByPost(input: CreateAudienceThreadInput): Promise<AudienceThread>
  findThreadByPost(postId: string): Promise<AudienceThread | null>
  findThreadById(threadId: string): Promise<AudienceThread | null>
  createMessage(input: CreateAudienceMessageInput): Promise<AudienceMessage>
  listMessagesByThread(threadId: string): Promise<AudienceMessage[]>
  listMessagesWithAggregates(
    threadId: string,
    options?: ListAudienceMessagesAggregatedOptions,
  ): Promise<AudienceMessageAggregate[]>
  findMessageById(messageId: string): Promise<AudienceMessage | null>
  softDeleteMessage(messageId: string): Promise<void>
  updateMessageTimestamps(
    messageId: string,
    input: { created_at: Date; updated_at?: Date },
  ): Promise<AudienceMessage | null>
  countMessagesByThread(threadId: string): Promise<number>
  createSummary(input: CreateAudienceSummaryInput): Promise<AudienceSummary>
  findLatestSummaryByThread(threadId: string): Promise<AudienceSummary | null>
  likeMessage(input: ToggleAudienceMessageLikeInput): Promise<AudienceMessageLike>
  unlikeMessage(input: ToggleAudienceMessageLikeInput): Promise<void>
  countLikes(messageIds: readonly string[]): Promise<Map<string, number>>
  listLikedMessageIdsByViewer(
    messageIds: readonly string[],
    userId: string,
  ): Promise<Set<string>>
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

export class InMemoryAudienceRepository implements AudienceRepository {
  private readonly threads = new Map<string, AudienceThread>()
  private readonly threadByPost = new Map<string, string>()
  private readonly messages = new Map<string, AudienceMessage>()
  private readonly likes = new Map<string, AudienceMessageLike>()
  private readonly summaries = new Map<string, AudienceSummary>()

  async upsertThreadByPost(input: CreateAudienceThreadInput): Promise<AudienceThread> {
    const existingId = this.threadByPost.get(input.post_id)
    if (existingId) {
      const existing = this.threads.get(existingId)
      if (existing) {
        existing.status = input.status ?? existing.status
        existing.updated_at = new Date()
        return existing
      }
    }

    const now = new Date()
    const row: AudienceThread = {
      id: cuid('aud_thread'),
      post_id: input.post_id,
      community_id: input.community_id,
      status: input.status ?? 'OPEN',
      created_at: now,
      updated_at: now,
    }
    this.threads.set(row.id, row)
    this.threadByPost.set(row.post_id, row.id)
    return row
  }

  async findThreadByPost(postId: string): Promise<AudienceThread | null> {
    const id = this.threadByPost.get(postId)
    if (!id) return null
    return this.threads.get(id) ?? null
  }

  async findThreadById(threadId: string): Promise<AudienceThread | null> {
    return this.threads.get(threadId) ?? null
  }

  async createMessage(input: CreateAudienceMessageInput): Promise<AudienceMessage> {
    const now = new Date()
    const row: AudienceMessage = {
      id: cuid('aud_msg'),
      thread_id: input.thread_id,
      author_user_id: input.author_user_id,
      body: input.body,
      parent_message_id: input.parent_message_id ?? null,
      quoted_turn_id: input.quoted_turn_id ?? null,
      quoted_turn_excerpt: input.quoted_turn_excerpt ?? null,
      quoted_turn_author_name: input.quoted_turn_author_name ?? null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }
    this.messages.set(row.id, row)
    return row
  }

  async listMessagesByThread(threadId: string): Promise<AudienceMessage[]> {
    return Array.from(this.messages.values())
      .filter((item) => item.thread_id === threadId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  async listMessagesWithAggregates(
    threadId: string,
    options?: ListAudienceMessagesAggregatedOptions,
  ): Promise<AudienceMessageAggregate[]> {
    const messages = await this.listMessagesByThread(threadId)
    const visible = options?.include_deleted ? messages : messages
    const ids = visible.map((message) => message.id)
    const likeCounts = await this.countLikes(ids)
    const likedByViewer = options?.viewer_user_id
      ? await this.listLikedMessageIdsByViewer(ids, options.viewer_user_id)
      : new Set<string>()
    const authors = options?.authors ?? new Map<string, AudienceMessageAuthor>()
    return visible.map((message) => ({
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
    return this.messages.get(messageId) ?? null
  }

  async softDeleteMessage(messageId: string): Promise<void> {
    const existing = this.messages.get(messageId)
    if (!existing) return
    existing.deleted_at = new Date()
    existing.updated_at = new Date()
  }

  async updateMessageTimestamps(
    messageId: string,
    input: { created_at: Date; updated_at?: Date },
  ): Promise<AudienceMessage | null> {
    const existing = this.messages.get(messageId)
    if (!existing) return null
    existing.created_at = input.created_at
    existing.updated_at = input.updated_at ?? input.created_at
    return existing
  }

  async countMessagesByThread(threadId: string): Promise<number> {
    return (await this.listMessagesByThread(threadId)).length
  }

  async createSummary(input: CreateAudienceSummaryInput): Promise<AudienceSummary> {
    const now = new Date()
    const row: AudienceSummary = {
      id: cuid('aud_sum'),
      thread_id: input.thread_id,
      post_id: input.post_id,
      community_id: input.community_id,
      window_start: input.window_start,
      window_end: input.window_end,
      summary_text: input.summary_text,
      message_count: input.message_count,
      summary_source: input.summary_source ?? null,
      safe_mode: input.safe_mode ?? false,
      created_at: now,
      updated_at: now,
    }
    this.summaries.set(row.id, row)
    return row
  }

  async findLatestSummaryByThread(threadId: string): Promise<AudienceSummary | null> {
    const rows = Array.from(this.summaries.values())
      .filter((item) => item.thread_id === threadId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return rows[0] ?? null
  }

  async likeMessage(input: ToggleAudienceMessageLikeInput): Promise<AudienceMessageLike> {
    const key = `${input.message_id}:${input.user_id}`
    const existing = Array.from(this.likes.values()).find(
      (like) => like.message_id === input.message_id && like.user_id === input.user_id,
    )
    if (existing) return existing
    const now = new Date()
    const row: AudienceMessageLike = {
      id: cuid('aud_like'),
      message_id: input.message_id,
      user_id: input.user_id,
      created_at: now,
    }
    this.likes.set(key, row)
    return row
  }

  async unlikeMessage(input: ToggleAudienceMessageLikeInput): Promise<void> {
    const key = `${input.message_id}:${input.user_id}`
    this.likes.delete(key)
    for (const [entryKey, value] of this.likes.entries()) {
      if (value.message_id === input.message_id && value.user_id === input.user_id) {
        this.likes.delete(entryKey)
      }
    }
  }

  async countLikes(messageIds: readonly string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    if (messageIds.length === 0) return result
    const wanted = new Set(messageIds)
    for (const like of this.likes.values()) {
      if (!wanted.has(like.message_id)) continue
      result.set(like.message_id, (result.get(like.message_id) ?? 0) + 1)
    }
    return result
  }

  async listLikedMessageIdsByViewer(
    messageIds: readonly string[],
    userId: string,
  ): Promise<Set<string>> {
    const result = new Set<string>()
    if (messageIds.length === 0 || !userId) return result
    const wanted = new Set(messageIds)
    for (const like of this.likes.values()) {
      if (like.user_id !== userId) continue
      if (!wanted.has(like.message_id)) continue
      result.add(like.message_id)
    }
    return result
  }
}
