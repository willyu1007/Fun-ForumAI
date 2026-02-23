import { randomUUID } from 'node:crypto'
import type { PrismaClient, Vote as PrismaVote } from '@prisma/client'
import type { Vote, UpsertVoteInput } from '../types.js'
import type { VoteRepository } from '../vote-repository.js'

export class PgVoteRepository implements VoteRepository {
  private cache = new Map<string, Vote>()
  private voterIndex = new Map<string, string>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.vote.findMany()
    for (const row of rows) {
      const vote = this.toDomain(row)
      this.cache.set(vote.id, vote)
      this.voterIndex.set(
        this.compositeKey(vote.voter_agent_id, vote.target_type, vote.target_id),
        vote.id,
      )
    }
  }

  upsert(input: UpsertVoteInput): Vote {
    const key = this.compositeKey(input.voter_agent_id, input.target_type, input.target_id)
    const existingId = this.voterIndex.get(key)

    if (existingId) {
      const vote = this.cache.get(existingId)!
      vote.direction = input.direction
      vote.weight = input.weight ?? 1
      this.prisma.vote
        .update({
          where: { id: existingId },
          data: { direction: input.direction, weight: vote.weight },
        })
        .catch((err) => console.error('[PgVoteRepo] upsert-update error:', err))
      return vote
    }

    const id = randomUUID()
    const now = new Date()
    const vote: Vote = {
      id,
      voter_agent_id: input.voter_agent_id,
      target_type: input.target_type,
      target_id: input.target_id,
      direction: input.direction,
      weight: input.weight ?? 1,
      created_at: now,
    }
    this.cache.set(id, vote)
    this.voterIndex.set(key, id)
    this.prisma.vote
      .create({
        data: {
          id,
          voterAgentId: vote.voter_agent_id,
          targetType: vote.target_type,
          targetId: vote.target_id,
          direction: vote.direction,
          weight: vote.weight,
          createdAt: now,
        },
      })
      .catch((err) => console.error('[PgVoteRepo] upsert-create error:', err))
    return vote
  }

  findByTarget(targetType: Vote['target_type'], targetId: string): Vote[] {
    return Array.from(this.cache.values()).filter(
      (v) => v.target_type === targetType && v.target_id === targetId,
    )
  }

  countByTarget(
    targetType: Vote['target_type'],
    targetId: string,
  ): { up: number; down: number; score: number } {
    const votes = this.findByTarget(targetType, targetId)
    let up = 0
    let down = 0
    for (const v of votes) {
      if (v.direction === 'UP') up += v.weight
      else if (v.direction === 'DOWN') down += v.weight
    }
    return { up, down, score: up - down }
  }

  findByVoterAndTarget(
    voterId: string,
    targetType: Vote['target_type'],
    targetId: string,
  ): Vote | null {
    const voteId = this.voterIndex.get(this.compositeKey(voterId, targetType, targetId))
    if (!voteId) return null
    return this.cache.get(voteId) ?? null
  }

  private compositeKey(voterId: string, targetType: string, targetId: string): string {
    return `${voterId}:${targetType}:${targetId}`
  }

  private toDomain(row: PrismaVote): Vote {
    return {
      id: row.id,
      voter_agent_id: row.voterAgentId,
      target_type: row.targetType,
      target_id: row.targetId,
      direction: row.direction,
      weight: row.weight,
      created_at: row.createdAt,
    }
  }
}
