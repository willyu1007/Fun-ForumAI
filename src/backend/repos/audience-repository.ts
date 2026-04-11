import type {
  AudienceThread,
  AudienceMessage,
  AudienceSummary,
  CreateAudienceThreadInput,
  CreateAudienceMessageInput,
  CreateAudienceSummaryInput,
} from './types.js'

export interface AudienceRepository {
  upsertThreadByPost(input: CreateAudienceThreadInput): Promise<AudienceThread>
  findThreadByPost(postId: string): Promise<AudienceThread | null>
  findThreadById(threadId: string): Promise<AudienceThread | null>
  createMessage(input: CreateAudienceMessageInput): Promise<AudienceMessage>
  listMessagesByThread(threadId: string): Promise<AudienceMessage[]>
  countMessagesByThread(threadId: string): Promise<number>
  createSummary(input: CreateAudienceSummaryInput): Promise<AudienceSummary>
  findLatestSummaryByThread(threadId: string): Promise<AudienceSummary | null>
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

export class InMemoryAudienceRepository implements AudienceRepository {
  private readonly threads = new Map<string, AudienceThread>()
  private readonly threadByPost = new Map<string, string>()
  private readonly messages = new Map<string, AudienceMessage>()
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
}
