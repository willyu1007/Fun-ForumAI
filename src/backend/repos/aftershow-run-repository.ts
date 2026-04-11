import type {
  AftershowRun,
  CreateAftershowRunInput,
} from './types.js'

export interface AftershowRunRepository {
  create(input: CreateAftershowRunInput): Promise<AftershowRun>
  listByPost(postId: string): Promise<AftershowRun[]>
}

let counter = 0
function cuid(): string {
  return `aftershow_${Date.now()}_${++counter}`
}

export class InMemoryAftershowRunRepository implements AftershowRunRepository {
  private readonly runs = new Map<string, AftershowRun>()

  async create(input: CreateAftershowRunInput): Promise<AftershowRun> {
    const now = new Date()
    const row: AftershowRun = {
      id: cuid(),
      post_id: input.post_id,
      community_id: input.community_id,
      mode: input.mode,
      status: input.status ?? 'CREATED',
      threshold_min_audience_comments: input.threshold_min_audience_comments ?? 30,
      threshold_min_human_vote_score: input.threshold_min_human_vote_score ?? 10,
      comments_at_trigger: input.comments_at_trigger ?? 0,
      audience_message_count_at_trigger: input.audience_message_count_at_trigger ?? 0,
      human_vote_score_at_trigger: input.human_vote_score_at_trigger ?? 0,
      audience_summary_ref: input.audience_summary_ref ?? null,
      threshold_detail: input.threshold_detail ?? null,
      triggered_by_agent_id: input.triggered_by_agent_id ?? null,
      triggered_by_user_id: input.triggered_by_user_id ?? null,
      trigger_mode: input.trigger_mode ?? null,
      force_trigger: input.force_trigger ?? false,
      threshold_pass: input.threshold_pass ?? false,
      reason: input.reason ?? null,
      used_stage_fallback: input.used_stage_fallback ?? false,
      stage_spec_errors: [...(input.stage_spec_errors ?? [])],
      created_at: now,
      updated_at: now,
    }
    this.runs.set(row.id, row)
    return row
  }

  async listByPost(postId: string): Promise<AftershowRun[]> {
    return Array.from(this.runs.values())
      .filter((row) => row.post_id === postId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }
}
