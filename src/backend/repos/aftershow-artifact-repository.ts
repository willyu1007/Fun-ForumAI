import type {
  AftershowArtifact,
  AftershowCallout,
  CreateAftershowArtifactInput,
  UpdateAftershowArtifactInput,
  CreateAftershowCalloutInput,
  UpdateAftershowCalloutInput,
} from './types.js'

export interface AftershowArtifactRepository {
  createArtifact(input: CreateAftershowArtifactInput): Promise<AftershowArtifact>
  updateArtifact(id: string, input: UpdateAftershowArtifactInput): Promise<AftershowArtifact | null>
  findArtifactById(id: string): Promise<AftershowArtifact | null>
  findLatestByPost(postId: string): Promise<AftershowArtifact | null>
  findLatestPublishedByPost(postId: string): Promise<AftershowArtifact | null>
  countPublishedByPostSince(postId: string, since: Date): Promise<number>

  createCallout(input: CreateAftershowCalloutInput): Promise<AftershowCallout>
  updateCallout(id: string, input: UpdateAftershowCalloutInput): Promise<AftershowCallout | null>
  listCalloutsByArtifact(artifactId: string): Promise<AftershowCallout[]>
  countCalloutsByUserSince(userId: string, since: Date): Promise<number>
  countCalloutsByPostSince(postId: string, since: Date): Promise<number>
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

export class InMemoryAftershowArtifactRepository implements AftershowArtifactRepository {
  private artifacts = new Map<string, AftershowArtifact>()
  private callouts = new Map<string, AftershowCallout>()
  private calloutDedup = new Map<string, string>()

  async createArtifact(input: CreateAftershowArtifactInput): Promise<AftershowArtifact> {
    if (input.idempotency_key) {
      const existingId = this.calloutDedup.get(`artifact:${input.idempotency_key}`)
      if (existingId) {
        const existing = this.artifacts.get(existingId)
        if (existing) return existing
      }
    }
    const now = new Date()
    const row: AftershowArtifact = {
      id: cuid('as_art'),
      run_id: input.run_id ?? null,
      post_id: input.post_id,
      community_id: input.community_id,
      status: input.status ?? 'DUE',
      window_start: input.window_start,
      window_end: input.window_end,
      summary_text: input.summary_text,
      content: input.content ?? null,
      audience_summary_ref: input.audience_summary_ref ?? null,
      correlation_id: input.correlation_id ?? null,
      cause_event_id: input.cause_event_id ?? null,
      idempotency_key: input.idempotency_key ?? null,
      published_at: input.published_at ?? null,
      meta: input.meta ?? null,
      created_at: now,
      updated_at: now,
    }
    this.artifacts.set(row.id, row)
    if (row.idempotency_key) this.calloutDedup.set(`artifact:${row.idempotency_key}`, row.id)
    return row
  }

  async updateArtifact(id: string, input: UpdateAftershowArtifactInput): Promise<AftershowArtifact | null> {
    const row = this.artifacts.get(id)
    if (!row) return null
    if (input.status !== undefined) row.status = input.status
    if (input.summary_text !== undefined) row.summary_text = input.summary_text
    if (input.content !== undefined) row.content = input.content
    if (input.audience_summary_ref !== undefined) row.audience_summary_ref = input.audience_summary_ref
    if (input.published_at !== undefined) row.published_at = input.published_at
    if (input.meta !== undefined) row.meta = input.meta
    row.updated_at = new Date()
    this.artifacts.set(row.id, row)
    return row
  }

  async findArtifactById(id: string): Promise<AftershowArtifact | null> {
    return this.artifacts.get(id) ?? null
  }

  async findLatestByPost(postId: string): Promise<AftershowArtifact | null> {
    const rows = Array.from(this.artifacts.values())
      .filter((item) => item.post_id === postId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return rows[0] ?? null
  }

  async findLatestPublishedByPost(postId: string): Promise<AftershowArtifact | null> {
    const rows = Array.from(this.artifacts.values())
      .filter((item) => item.post_id === postId && item.status === 'PUBLISHED')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return rows[0] ?? null
  }

  async countPublishedByPostSince(postId: string, since: Date): Promise<number> {
    return Array.from(this.artifacts.values()).filter((item) =>
      item.post_id === postId
      && item.status === 'PUBLISHED'
      && item.created_at.getTime() >= since.getTime()).length
  }

  async createCallout(input: CreateAftershowCalloutInput): Promise<AftershowCallout> {
    const dedupKey = `${input.artifact_id}:${input.user_id}:${input.audience_message_id}`
    const existingId = this.calloutDedup.get(dedupKey)
    if (existingId) {
      const existing = this.callouts.get(existingId)
      if (existing) return existing
    }
    const row: AftershowCallout = {
      id: cuid('as_call'),
      artifact_id: input.artifact_id,
      user_id: input.user_id,
      audience_message_id: input.audience_message_id,
      reason: input.reason,
      evidence_ref: input.evidence_ref ?? null,
      notification_id: input.notification_id ?? null,
      invalidated_at: input.invalidated_at ?? null,
      meta: input.meta ?? null,
      created_at: new Date(),
    }
    this.callouts.set(row.id, row)
    this.calloutDedup.set(dedupKey, row.id)
    return row
  }

  async updateCallout(id: string, input: UpdateAftershowCalloutInput): Promise<AftershowCallout | null> {
    const row = this.callouts.get(id)
    if (!row) return null
    if (input.notification_id !== undefined) row.notification_id = input.notification_id
    if (input.invalidated_at !== undefined) row.invalidated_at = input.invalidated_at
    if (input.meta !== undefined) row.meta = input.meta
    this.callouts.set(row.id, row)
    return row
  }

  async listCalloutsByArtifact(artifactId: string): Promise<AftershowCallout[]> {
    return Array.from(this.callouts.values())
      .filter((item) => item.artifact_id === artifactId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  async countCalloutsByUserSince(userId: string, since: Date): Promise<number> {
    return Array.from(this.callouts.values())
      .filter((item) => item.user_id === userId && item.created_at.getTime() >= since.getTime()).length
  }

  async countCalloutsByPostSince(postId: string, since: Date): Promise<number> {
    const artifactIds = new Set(
      Array.from(this.artifacts.values())
        .filter((item) => item.post_id === postId)
        .map((item) => item.id),
    )
    return Array.from(this.callouts.values())
      .filter((item) => artifactIds.has(item.artifact_id) && item.created_at.getTime() >= since.getTime())
      .length
  }
}
