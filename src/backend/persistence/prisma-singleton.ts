import type { PrismaClient } from '@prisma/client'

const G = globalThis as unknown as { __prismaClient?: PrismaClient }

export function setPrisma(client: PrismaClient): void {
  G.__prismaClient = client
}

export function getPrismaOrNull(): PrismaClient | null {
  return G.__prismaClient ?? null
}
