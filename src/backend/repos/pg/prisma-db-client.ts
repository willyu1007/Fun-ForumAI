import type { Prisma, PrismaClient } from '@prisma/client'

export type PrismaDbClient = PrismaClient | Prisma.TransactionClient
