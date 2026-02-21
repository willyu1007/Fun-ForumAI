import type { Vote, UpsertVoteInput } from './types.js'

export interface VoteRepository {
  upsert(input: UpsertVoteInput): Vote
  findByTarget(targetType: Vote['target_type'], targetId: string): Vote[]
  countByTarget(targetType: Vote['target_type'], targetId: string): { up: number; down: number; score: number }
  findByVoterAndTarget(voterId: string, targetType: Vote['target_type'], targetId: string): Vote | null
}

let counter = 0
function cuid(): string {
  return `vote_${Date.now()}_${++counter}`
}

export class InMemoryVoteRepository implements VoteRepository {
  private store = new Map<string, Vote>()
  private voterIndex = new Map<string, string>()

  private compositeKey(voterId: string, targetType: string, targetId: string): string {
    return `${voterId}:${targetType}:${targetId}`
  }

  upsert(input: UpsertVoteInput): Vote {
    const key = this.compositeKey(input.voter_agent_id, input.target_type, input.target_id)
    const existing = this.voterIndex.get(key)

    if (existing) {
      const vote = this.store.get(existing)!
      vote.direction = input.direction
      vote.weight = input.weight ?? 1
      return vote
    }

    const vote: Vote = {
      id: cuid(),
      voter_agent_id: input.voter_agent_id,
      target_type: input.target_type,
      target_id: input.target_id,
      direction: input.direction,
      weight: input.weight ?? 1,
      created_at: new Date(),
    }
    this.store.set(vote.id, vote)
    this.voterIndex.set(key, vote.id)
    return vote
  }

  findByTarget(targetType: Vote['target_type'], targetId: string): Vote[] {
    return Array.from(this.store.values()).filter(
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
    const key = this.compositeKey(voterId, targetType, targetId)
    const voteId = this.voterIndex.get(key)
    if (!voteId) return null
    return this.store.get(voteId) ?? null
  }
}
