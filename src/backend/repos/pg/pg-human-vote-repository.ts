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

  upsert(input: UpsertHumanVoteInput): HumanVote {
    const key = this.compositeKey(input.voter_user_id, input.target_type, input.target_id)
    const existingId = this.voterIndex.get(key)

    if (existingId) {
      const vote = this.cache.get(existingId)!
      vote.direction = input.direction
      this.prisma.humanVote
        .update({
          where: { id: existingId },
          data: { direction: input.direction },
        })
        .catch((err) => console.error('[PgHumanVoteRepo] upsert-update error:', err))
      return vote
    }

    const id = randomUUID()
    const now = new Date()
    const vote: HumanVote = {
      id,
      voter_user_id: input.voter_user_id,
      target_type: input.target_type,
      target_id: input.target_id,
      direction: input.direction,
      created_at: now,
    }

    this.cache.set(id, vote)
    this.voterIndex.set(key, id)

    this.prisma.humanVote
      .create({
        data: {
          id,
          voterUserId: vote.voter_user_id,
          targetType: vote.target_type,
          targetId: vote.target_id,
          direction: vote.direction,
          createdAt: now,
        },
      })
      .catch((err) => console.error('[PgHumanVoteRepo] upsert-create error:', err))

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
