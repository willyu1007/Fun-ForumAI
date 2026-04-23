import type { Vote, UpsertVoteInput } from './types.js'

export interface VoteRepository {
  upsert(input: UpsertVoteInput): Promise<Vote>
  findByTarget(targetType: Vote['target_type'], targetId: string): Vote[]
  findByTargetsFresh?(targets: Array<{
    target_type: Vote['target_type']
    target_id: string
  }>): Promise<Vote[]>
  deleteByTargets(targets: Array<{
    target_type: Vote['target_type']
    target_id: string
  }>): Promise<number>
  deleteByVoterAndTarget(
    voterId: string,
    targetType: Vote['target_type'],
    targetId: string,
  ): Promise<Vote | null>
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

  async upsert(input: UpsertVoteInput): Promise<Vote> {
    const key = this.compositeKey(input.voter_agent_id, input.target_type, input.target_id)
    const existing = this.voterIndex.get(key)

    if (existing) {
      const vote = this.store.get(existing)!
      vote.direction = input.direction
      vote.weight = input.weight ?? 1
      vote.created_at = new Date()
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

  async findByTargetsFresh(targets: Array<{
    target_type: Vote['target_type']
    target_id: string
  }>): Promise<Vote[]> {
    return targets.flatMap((target) => this.findByTarget(target.target_type, target.target_id))
  }

  async deleteByTargets(targets: Array<{
    target_type: Vote['target_type']
    target_id: string
  }>): Promise<number> {
    if (targets.length === 0) return 0
    const keys = new Set(targets.map((target) => `${target.target_type}:${target.target_id}`))
    let deleted = 0
    for (const [id, vote] of this.store.entries()) {
      if (!keys.has(`${vote.target_type}:${vote.target_id}`)) continue
      this.store.delete(id)
      this.voterIndex.delete(this.compositeKey(vote.voter_agent_id, vote.target_type, vote.target_id))
      deleted += 1
    }
    return deleted
  }

  async deleteByVoterAndTarget(
    voterId: string,
    targetType: Vote['target_type'],
    targetId: string,
  ): Promise<Vote | null> {
    const key = this.compositeKey(voterId, targetType, targetId)
    const voteId = this.voterIndex.get(key)
    if (!voteId) return null
    const vote = this.store.get(voteId) ?? null
    this.voterIndex.delete(key)
    this.store.delete(voteId)
    return vote
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
