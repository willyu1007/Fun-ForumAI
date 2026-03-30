import type {
  PrismaClient,
  AuthVerificationChallenge as PrismaAuthVerificationChallenge,
  Prisma,
} from '@prisma/client'
import type {
  AuthVerificationChallenge,
  AuthVerificationChannel,
  AuthVerificationPurpose,
} from '../types.js'
import type {
  AuthVerificationChallengeRepository,
  ConsumeAuthVerificationChallengeResult,
  CountRecentChallengesInput,
  CreateAuthVerificationChallengeInput,
} from '../auth-verification-challenge-repository.js'

function toDomain(row: PrismaAuthVerificationChallenge): AuthVerificationChallenge {
  return {
    id: row.id,
    channel: row.channel as AuthVerificationChannel,
    purpose: row.purpose as AuthVerificationPurpose,
    target: row.target,
    code_hash: row.codeHash,
    payload_json: (row.payloadJson as Record<string, unknown> | null) ?? null,
    requested_from_ip: row.requestedFromIp,
    expires_at: row.expiresAt,
    consumed_at: row.consumedAt,
    attempt_count: row.attemptCount,
    resend_count: row.resendCount,
    last_sent_at: row.lastSentAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export class PgAuthVerificationChallengeRepository implements AuthVerificationChallengeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createReplacingActive(input: CreateAuthVerificationChallengeInput): Promise<AuthVerificationChallenge> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.authVerificationChallenge.updateMany({
        where: {
          target: input.target,
          purpose: input.purpose,
          consumedAt: null,
          expiresAt: { gt: input.last_sent_at },
        },
        data: {
          expiresAt: input.last_sent_at,
        },
      })

      return tx.authVerificationChallenge.create({
        data: {
          channel: input.channel,
          purpose: input.purpose,
          target: input.target,
          codeHash: input.code_hash,
          payloadJson: (input.payload_json ?? null) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
          requestedFromIp: input.requested_from_ip ?? null,
          expiresAt: input.expires_at,
          resendCount: input.resend_count ?? 0,
          lastSentAt: input.last_sent_at,
        },
      })
    })

    return toDomain(row)
  }

  async findById(id: string): Promise<AuthVerificationChallenge | null> {
    const row = await this.prisma.authVerificationChallenge.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async countRecent(input: CountRecentChallengesInput): Promise<number> {
    return this.prisma.authVerificationChallenge.count({
      where: {
        channel: input.channel,
        purpose: input.purpose,
        createdAt: { gte: input.since },
        ...(input.target ? { target: input.target } : {}),
        ...(input.requested_from_ip ? { requestedFromIp: input.requested_from_ip } : {}),
      },
    })
  }

  async consume(input: {
    id: string
    code_hash: string
    now: Date
    max_attempts: number
  }): Promise<ConsumeAuthVerificationChallengeResult> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.authVerificationChallenge.findUnique({ where: { id: input.id } })
      if (!row) {
        return { kind: 'not_found' }
      }
      if (row.consumedAt) {
        return { kind: 'already_used' }
      }
      if (row.expiresAt <= input.now) {
        return { kind: 'expired' }
      }
      if (row.attemptCount >= input.max_attempts) {
        return { kind: 'max_attempts_reached' }
      }

      if (row.codeHash !== input.code_hash) {
        const updateResult = await tx.authVerificationChallenge.updateMany({
          where: {
            id: row.id,
            consumedAt: null,
            expiresAt: { gt: input.now },
            attemptCount: { lt: input.max_attempts },
          },
          data: {
            attemptCount: { increment: 1 },
          },
        })

        if (updateResult.count === 0) {
          const latest = await tx.authVerificationChallenge.findUnique({ where: { id: row.id } })
          return latest ? resolveChallengeConflictState(latest, input.now, input.max_attempts) : { kind: 'not_found' }
        }

        const updated = await tx.authVerificationChallenge.findUnique({ where: { id: row.id } })
        if (!updated) {
          return { kind: 'not_found' }
        }

        if (updated.attemptCount >= input.max_attempts) {
          return { kind: 'max_attempts_reached' }
        }
        return { kind: 'invalid_code', challenge: toDomain(updated) }
      }

      const updateResult = await tx.authVerificationChallenge.updateMany({
        where: {
          id: row.id,
          consumedAt: null,
          expiresAt: { gt: input.now },
          attemptCount: { lt: input.max_attempts },
        },
        data: {
          consumedAt: input.now,
        },
      })

      if (updateResult.count === 0) {
        const latest = await tx.authVerificationChallenge.findUnique({ where: { id: row.id } })
        return latest ? resolveChallengeConflictState(latest, input.now, input.max_attempts) : { kind: 'not_found' }
      }

      const consumed = await tx.authVerificationChallenge.findUnique({ where: { id: row.id } })
      if (!consumed) {
        return { kind: 'not_found' }
      }

      return { kind: 'consumed', challenge: toDomain(consumed) }
    })
  }
}

function resolveChallengeConflictState(
  row: PrismaAuthVerificationChallenge,
  now: Date,
  maxAttempts: number,
): ConsumeAuthVerificationChallengeResult {
  if (row.consumedAt) {
    return { kind: 'already_used' }
  }
  if (row.expiresAt <= now) {
    return { kind: 'expired' }
  }
  if (row.attemptCount >= maxAttempts) {
    return { kind: 'max_attempts_reached' }
  }
  return { kind: 'invalid_code', challenge: toDomain(row) }
}
