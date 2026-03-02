import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedUser } from '../middleware/human-auth.js'
import { ensureDevAuthUserPersisted } from './dev-auth-user.js'

type PrismaLike = {
  humanUser: {
    upsert: ReturnType<typeof vi.fn>
  }
}

const globalWithPrisma = globalThis as typeof globalThis & {
  __forumPrisma?: PrismaLike
}

afterEach(() => {
  delete globalWithPrisma.__forumPrisma
})

describe('ensureDevAuthUserPersisted', () => {
  it('skips non dev-token users', async () => {
    const upsert = vi.fn()
    globalWithPrisma.__forumPrisma = { humanUser: { upsert } }

    const user: AuthenticatedUser = {
      userId: 'user-1',
      email: 'user@test.com',
      role: 'user',
    }

    await ensureDevAuthUserPersisted(user)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('upserts dev-token users when prisma is available', async () => {
    const upsert = vi.fn(async () => ({}))
    globalWithPrisma.__forumPrisma = { humanUser: { upsert } }

    const user: AuthenticatedUser = {
      userId: 'dev-user-1',
      email: 'dev@test.com',
      role: 'admin',
      _devToken: true,
    }

    await ensureDevAuthUserPersisted(user)

    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dev-user-1' },
        create: expect.objectContaining({
          id: 'dev-user-1',
          planTier: 'ADMIN',
          status: 'ACTIVE',
        }),
        update: expect.objectContaining({
          displayName: 'dev-user-1',
          planTier: 'ADMIN',
          status: 'ACTIVE',
        }),
      }),
    )
  })
})
