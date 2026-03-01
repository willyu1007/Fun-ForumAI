import type { HumanVote, UpsertHumanVoteInput } from './types.js'

export interface HumanVoteRepository {
  upsert(input: UpsertHumanVoteInput): Promise<HumanVote>
  findByTarget(targetType: HumanVote['target_type'], targetId: string): HumanVote[]
  countByTarget(targetType: HumanVote['target_type'], targetId: string): { up: number; down: number; score: number }
  findByVoterAndTarget(
    voterUserId: string,
    targetType: HumanVote['target_type'],
    targetId: string,
  ): HumanVote | null
}

let counter = 0
function cuid(): string {
  return `hvote_${Date.now()}_${++counter}`
}

export class InMemoryHumanVoteRepository implements HumanVoteRepository {
  private store = new Map<string, HumanVote>()
  private voterIndex = new Map<string, string>()

  private compositeKey(voterUserId: string, targetType: string, targetId: string): string {
    return `${voterUserId}:${targetType}:${targetId}`
  }

  async upsert(input: UpsertHumanVoteInput): Promise<HumanVote> {
    const key = this.compositeKey(input.voter_user_id, input.target_type, input.target_id)
    const existingId = this.voterIndex.get(key)

    if (existingId) {
      const vote = this.store.get(existingId)!
      vote.direction = input.direction
      return vote
    }

    const vote: HumanVote = {
      id: cuid(),
      voter_user_id: input.voter_user_id,
      target_type: input.target_type,
      target_id: input.target_id,
      direction: input.direction,
      created_at: new Date(),
    }
    this.store.set(vote.id, vote)
    this.voterIndex.set(key, vote.id)
    return vote
  }

  findByTarget(targetType: HumanVote['target_type'], targetId: string): HumanVote[] {
    return Array.from(this.store.values()).filter(
      (v) => v.target_type === targetType && v.target_id === targetId,
    )
  }

  countByTarget(targetType: HumanVote['target_type'], targetId: string): { up: number; down: number; score: number } {
    const votes = this.findByTarget(targetType, targetId)
    let up = 0
    let down = 0
    for (const v of votes) {
      if (v.direction === 'UP') up += 1
      else if (v.direction === 'DOWN') down += 1
    }
    return { up, down, score: up - down }
  }

  findByVoterAndTarget(
    voterUserId: string,
    targetType: HumanVote['target_type'],
    targetId: string,
  ): HumanVote | null {
    const key = this.compositeKey(voterUserId, targetType, targetId)
    const voteId = this.voterIndex.get(key)
    if (!voteId) return null
    return this.store.get(voteId) ?? null
  }
}
