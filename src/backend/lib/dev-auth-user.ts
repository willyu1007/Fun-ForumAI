import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '../middleware/human-auth.js'

function getPrismaOrNull(): PrismaClient | null {
  return ((globalThis as Record<string, unknown>).__forumPrisma as PrismaClient) ?? null
}

function toDevTokenEmail(userId: string): string {
  const hex = Buffer.from(userId, 'utf8').toString('hex').slice(0, 40)
  return `dev-${hex || 'user'}@dev.local`
}

export async function ensureDevAuthUserPersisted(user: AuthenticatedUser): Promise<void> {
  if (!user._devToken) {
    return
  }

  const prisma = getPrismaOrNull()
  if (!prisma) {
    return
  }

  await prisma.humanUser.upsert({
    where: { id: user.userId },
    update: {
      displayName: user.userId,
      planTier: user.role === 'admin' ? 'ADMIN' : 'FREE',
      status: 'ACTIVE',
    },
    create: {
      id: user.userId,
      email: toDevTokenEmail(user.userId),
      passwordHash: 'dev-token-no-login',
      displayName: user.userId,
      planTier: user.role === 'admin' ? 'ADMIN' : 'FREE',
      status: 'ACTIVE',
    },
  })
}
