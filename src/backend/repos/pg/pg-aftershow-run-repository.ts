import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  AftershowRun,
  AftershowThresholdDetail,
  CreateAftershowRunInput,
} from '../types.js'
import type { AftershowRunRepository } from '../aftershow-run-repository.js'

function toDomain(row: {
  id: string
  postId: string
  communityId: string
  mode: string
  status: 'CREATED' | 'SKIPPED' | 'COMPLETED'
  thresholdMinAudienceComments: number
  thresholdMinHumanVoteScore: number
  commentsAtTrigger: number
  audienceMessageCountAtTrigger: number
  humanVoteScoreAtTrigger: number
  audienceSummaryRef: string | null
  thresholdDetailJson: Prisma.JsonValue | null
  triggeredByAgentId: string | null
  triggeredByUserId: string | null
  triggerMode: string | null
  forceTrigger: boolean
  thresholdPass: boolean
  reason: string | null
  usedStageFallback: boolean
  stageSpecErrors: string[]
  createdAt: Date
  updatedAt: Date
}): AftershowRun {
  return {
    id: row.id,
    post_id: row.postId,
    community_id: row.communityId,
    mode: row.mode as AftershowRun['mode'],
    status: row.status,
    threshold_min_audience_comments: row.thresholdMinAudienceComments,
    threshold_min_human_vote_score: row.thresholdMinHumanVoteScore,
    comments_at_trigger: row.commentsAtTrigger,
    audience_message_count_at_trigger: row.audienceMessageCountAtTrigger,
    human_vote_score_at_trigger: row.humanVoteScoreAtTrigger,
    audience_summary_ref: row.audienceSummaryRef,
    threshold_detail: row.thresholdDetailJson as AftershowThresholdDetail | null,
    triggered_by_agent_id: row.triggeredByAgentId,
    triggered_by_user_id: row.triggeredByUserId,
    trigger_mode: row.triggerMode === 'AUTO' || row.triggerMode === 'MANUAL' ? row.triggerMode : null,
    force_trigger: row.forceTrigger,
    threshold_pass: row.thresholdPass,
    reason: row.reason,
    used_stage_fallback: row.usedStageFallback,
    stage_spec_errors: row.stageSpecErrors,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export class PgAftershowRunRepository implements AftershowRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAftershowRunInput): Promise<AftershowRun> {
    const now = new Date()
    const row = await this.prisma.aftershowRun.create({
      data: {
        id: randomUUID(),
        postId: input.post_id,
        communityId: input.community_id,
        mode: input.mode,
        status: input.status ?? 'CREATED',
        thresholdMinAudienceComments: input.threshold_min_audience_comments ?? 30,
        thresholdMinHumanVoteScore: input.threshold_min_human_vote_score ?? 10,
        commentsAtTrigger: input.comments_at_trigger ?? 0,
        audienceMessageCountAtTrigger: input.audience_message_count_at_trigger ?? 0,
        humanVoteScoreAtTrigger: input.human_vote_score_at_trigger ?? 0,
        audienceSummaryRef: input.audience_summary_ref ?? null,
        thresholdDetailJson: input.threshold_detail ? (input.threshold_detail as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        triggeredByAgentId: input.triggered_by_agent_id ?? null,
        triggeredByUserId: input.triggered_by_user_id ?? null,
        triggerMode: input.trigger_mode ?? null,
        forceTrigger: input.force_trigger ?? false,
        thresholdPass: input.threshold_pass ?? false,
        reason: input.reason ?? null,
        usedStageFallback: input.used_stage_fallback ?? false,
        stageSpecErrors: input.stage_spec_errors ?? [],
        createdAt: now,
        updatedAt: now,
      },
    })

    return toDomain(row)
  }

  async listByPost(postId: string): Promise<AftershowRun[]> {
    const rows = await this.prisma.aftershowRun.findMany({
      where: { postId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    return rows.map((row) => toDomain(row))
  }
}
