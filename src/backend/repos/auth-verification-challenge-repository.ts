import type {
  AuthVerificationChallenge,
  AuthVerificationChannel,
  AuthVerificationPurpose,
} from './types.js'

export interface CreateAuthVerificationChallengeInput {
  channel: AuthVerificationChannel
  purpose: AuthVerificationPurpose
  target: string
  code_hash: string
  payload_json?: Record<string, unknown> | null
  requested_from_ip?: string | null
  expires_at: Date
  last_sent_at: Date
  resend_count?: number
}

export interface CountRecentChallengesInput {
  channel: AuthVerificationChannel
  purpose: AuthVerificationPurpose
  since: Date
  target?: string
  requested_from_ip?: string | null
}

export type ConsumeAuthVerificationChallengeResult =
  | { kind: 'consumed'; challenge: AuthVerificationChallenge }
  | { kind: 'not_found' }
  | { kind: 'already_used' }
  | { kind: 'expired' }
  | { kind: 'max_attempts_reached' }
  | { kind: 'invalid_code'; challenge: AuthVerificationChallenge }

export interface AuthVerificationChallengeRepository {
  createReplacingActive(input: CreateAuthVerificationChallengeInput): Promise<AuthVerificationChallenge>
  findById(id: string): Promise<AuthVerificationChallenge | null>
  countRecent(input: CountRecentChallengesInput): Promise<number>
  consume(input: {
    id: string
    code_hash: string
    now: Date
    max_attempts: number
  }): Promise<ConsumeAuthVerificationChallengeResult>
}

let counter = 0

function cuid(): string {
  return `auth_challenge_${Date.now()}_${++counter}`
}

function cloneChallenge(challenge: AuthVerificationChallenge): AuthVerificationChallenge {
  return {
    ...challenge,
    payload_json: challenge.payload_json ? { ...challenge.payload_json } : null,
  }
}

export class InMemoryAuthVerificationChallengeRepository implements AuthVerificationChallengeRepository {
  private readonly store = new Map<string, AuthVerificationChallenge>()

  async createReplacingActive(input: CreateAuthVerificationChallengeInput): Promise<AuthVerificationChallenge> {
    const now = input.last_sent_at

    for (const [id, challenge] of this.store.entries()) {
      if (challenge.target !== input.target || challenge.purpose !== input.purpose) continue
      if (challenge.consumed_at || challenge.expires_at <= now) continue
      this.store.set(id, {
        ...challenge,
        expires_at: now,
        updated_at: now,
      })
    }

    const challenge: AuthVerificationChallenge = {
      id: cuid(),
      channel: input.channel,
      purpose: input.purpose,
      target: input.target,
      code_hash: input.code_hash,
      payload_json: input.payload_json ?? null,
      requested_from_ip: input.requested_from_ip ?? null,
      expires_at: input.expires_at,
      consumed_at: null,
      attempt_count: 0,
      resend_count: input.resend_count ?? 0,
      last_sent_at: input.last_sent_at,
      created_at: now,
      updated_at: now,
    }

    this.store.set(challenge.id, challenge)
    return cloneChallenge(challenge)
  }

  async findById(id: string): Promise<AuthVerificationChallenge | null> {
    const challenge = this.store.get(id)
    return challenge ? cloneChallenge(challenge) : null
  }

  async countRecent(input: CountRecentChallengesInput): Promise<number> {
    let count = 0
    for (const challenge of this.store.values()) {
      if (challenge.channel !== input.channel || challenge.purpose !== input.purpose) continue
      if (challenge.created_at < input.since) continue
      if (input.target && challenge.target !== input.target) continue
      if (input.requested_from_ip && challenge.requested_from_ip !== input.requested_from_ip) continue
      count += 1
    }
    return count
  }

  async consume(input: {
    id: string
    code_hash: string
    now: Date
    max_attempts: number
  }): Promise<ConsumeAuthVerificationChallengeResult> {
    const challenge = this.store.get(input.id)
    if (!challenge) {
      return { kind: 'not_found' }
    }
    if (challenge.consumed_at) {
      return { kind: 'already_used' }
    }
    if (challenge.expires_at <= input.now) {
      return { kind: 'expired' }
    }
    if (challenge.attempt_count >= input.max_attempts) {
      return { kind: 'max_attempts_reached' }
    }

    if (challenge.code_hash !== input.code_hash) {
      const updated: AuthVerificationChallenge = {
        ...challenge,
        attempt_count: challenge.attempt_count + 1,
        updated_at: input.now,
      }
      this.store.set(challenge.id, updated)
      if (updated.attempt_count >= input.max_attempts) {
        return { kind: 'max_attempts_reached' }
      }
      return { kind: 'invalid_code', challenge: cloneChallenge(updated) }
    }

    const consumed: AuthVerificationChallenge = {
      ...challenge,
      consumed_at: input.now,
      updated_at: input.now,
    }
    this.store.set(challenge.id, consumed)
    return { kind: 'consumed', challenge: cloneChallenge(consumed) }
  }
}
