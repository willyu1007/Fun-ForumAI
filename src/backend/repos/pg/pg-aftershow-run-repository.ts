import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  AftershowRun,
  CreateAftershowRunInput,
} from '../types.js'
import type { AftershowRunRepository } from '../aftershow-run-repository.js'

function toDomain(row: {
  id: string
  postId: string
  communityId: string
  mode: string
  status: 'CREATED' | 'SKIPPED' | 'COMPLETED'
  thresholdMinComments: number
  thresholdMinHumanVotes: number
  commentsAtTrigger: number
  humanVoteScoreAtTrigger: number
  triggeredByAgentId: string | null
  triggeredByUserId: string | null
  metaJson: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}): AftershowRun {
  return {
    id: row.id,
    post_id: row.postId,
    community_id: row.communityId,
    mode: row.mode as AftershowRun['mode'],
    status: row.status,
    threshold_min_comments: row.thresholdMinComments,
    threshold_min_human_votes: row.thresholdMinHumanVotes,
    comments_at_trigger: row.commentsAtTrigger,
    human_vote_score_at_trigger: row.humanVoteScoreAtTrigger,
    triggered_by_agent_id: row.triggeredByAgentId,
    triggered_by_user_id: row.triggeredByUserId,
    meta: row.metaJson as Record<string, unknown> | null,
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
        thresholdMinComments: input.threshold_min_comments ?? 30,
        thresholdMinHumanVotes: input.threshold_min_human_votes ?? 10,
        commentsAtTrigger: input.comments_at_trigger ?? 0,
        humanVoteScoreAtTrigger: input.human_vote_score_at_trigger ?? 0,
        triggeredByAgentId: input.triggered_by_agent_id ?? null,
        triggeredByUserId: input.triggered_by_user_id ?? null,
        metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull,
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

    return rows.map((row) => toDomain({
      ...row,
      metaJson: row.metaJson,
    }))
  }
}
