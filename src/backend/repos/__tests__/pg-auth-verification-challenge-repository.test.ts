import { describe, expect, it, vi } from 'vitest'
import { PgAuthVerificationChallengeRepository } from '../pg/pg-auth-verification-challenge-repository.js'

describe('PgAuthVerificationChallengeRepository', () => {
  it('returns already_used instead of throwing when a concurrent consume wins the race', async () => {
    const consumedAt = new Date('2026-03-30T12:00:00.000Z')
    const tx = {
      authVerificationChallenge: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'challenge-1',
            channel: 'SMS',
            purpose: 'SMS_AUTH',
            target: '13800000000',
            codeHash: 'hash-1',
            payloadJson: null,
            requestedFromIp: null,
            expiresAt: new Date('2026-03-30T12:10:00.000Z'),
            consumedAt: null,
            attemptCount: 0,
            resendCount: 0,
            lastSentAt: new Date('2026-03-30T12:00:00.000Z'),
            createdAt: new Date('2026-03-30T12:00:00.000Z'),
            updatedAt: new Date('2026-03-30T12:00:00.000Z'),
          })
          .mockResolvedValueOnce({
            id: 'challenge-1',
            channel: 'SMS',
            purpose: 'SMS_AUTH',
            target: '13800000000',
            codeHash: 'hash-1',
            payloadJson: null,
            requestedFromIp: null,
            expiresAt: new Date('2026-03-30T12:10:00.000Z'),
            consumedAt,
            attemptCount: 0,
            resendCount: 0,
            lastSentAt: new Date('2026-03-30T12:00:00.000Z'),
            createdAt: new Date('2026-03-30T12:00:00.000Z'),
            updatedAt: consumedAt,
          }),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    }
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    }

    const repo = new PgAuthVerificationChallengeRepository(prisma as never)
    const result = await repo.consume({
      id: 'challenge-1',
      code_hash: 'hash-1',
      now: new Date('2026-03-30T12:01:00.000Z'),
      max_attempts: 5,
    })

    expect(result).toEqual({ kind: 'already_used' })
    expect(tx.authVerificationChallenge.updateMany).toHaveBeenCalledOnce()
  })
})
