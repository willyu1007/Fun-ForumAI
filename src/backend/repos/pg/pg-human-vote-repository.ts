import { randomUUID } from 'node:crypto'
import type { HumanVote as PrismaHumanVote, PrismaClient } from '@prisma/client'
import type { HumanVote, UpsertHumanVoteInput } from '../types.js'
import type { HumanVoteRepository } from '../human-vote-repository.js'

export class PgHumanVoteRepository implements HumanVoteRepository {
  private cache = new Map<string, HumanVote>()
  private voterIndex = new Map<string, string>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.humanVote.findMany()
    for (const row of rows) {
      const vote = this.toDomain(row)
      this.cache.set(vote.id, vote)
      this.voterIndex.set(this.compositeKey(vote.voter_user_id, vote.target_type, vote.target_id), vote.id)
    }
  }

  async upsert(input: UpsertHumanVoteInput): Promise<HumanVote> {
    const key = this.compositeKey(input.voter_user_id, input.target_type, input.target_id)

    const row = await this.prisma.humanVote.upsert({
      where: {
        voterUserId_targetType_targetId: {
          voterUserId: input.voter_user_id,
          targetType: input.target_type,
          targetId: input.target_id,
        },
      },
      update: { direction: input.direction },
      create: {
        id: randomUUID(),
        voterUserId: input.voter_user_id,
        targetType: input.target_type,
        targetId: input.target_id,
        direction: input.direction,
        createdAt: new Date(),
      },
    })

    const vote = this.toDomain(row)
    this.cache.set(vote.id, vote)
    this.voterIndex.set(key, vote.id)
    return vote
  }

  findByTarget(targetType: HumanVote['target_type'], targetId: string): HumanVote[] {
    return Array.from(this.cache.values()).filter(
      (v) => v.target_type === targetType && v.target_id === targetId,
    )
  }

  countByTarget(targetType: HumanVote['target_type'], targetId: string): { up: number; down: number; score: number } {
    const votes = this.findByTarget(targetType, targetId)
    let up = 0
    let down = 0

    for (const vote of votes) {
      if (vote.direction === 'UP') up += 1
      else if (vote.direction === 'DOWN') down += 1
    }

    return { up, down, score: up - down }
  }

  findByVoterAndTarget(
    voterUserId: string,
    targetType: HumanVote['target_type'],
    targetId: string,
  ): HumanVote | null {
    const voteId = this.voterIndex.get(this.compositeKey(voterUserId, targetType, targetId))
    if (!voteId) return null
    return this.cache.get(voteId) ?? null
  }

  private compositeKey(voterUserId: string, targetType: string, targetId: string): string {
    return `${voterUserId}:${targetType}:${targetId}`
  }

  private toDomain(row: PrismaHumanVote): HumanVote {
    return {
      id: row.id,
      voter_user_id: row.voterUserId,
      target_type: row.targetType,
      target_id: row.targetId,
      direction: row.direction,
      created_at: row.createdAt,
    }
  }
}
