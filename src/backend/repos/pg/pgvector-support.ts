import { Prisma } from '@prisma/client'
import type { PrismaDbClient } from './prisma-db-client.js'

export type PgVectorStorageMode = 'vector' | 'text'

const storageModeCache = new WeakMap<PrismaDbClient, Promise<PgVectorStorageMode>>()

function serializeVector(vector: number[]): string {
  return `[${vector.map((value) => Number(value).toString()).join(',')}]`
}

export function parseSerializedVector(value: string | null): number[] | null {
  if (!value) return null
  const normalized = value.trim().replace(/^\[/, '').replace(/\]$/, '')
  if (!normalized) return []
  return normalized.split(',').map((item) => Number(item.trim())).filter((item) => !Number.isNaN(item))
}

export async function detectPgVectorStorageMode(prisma: PrismaDbClient): Promise<PgVectorStorageMode> {
  const cached = storageModeCache.get(prisma)
  if (cached) return cached

  // Local dev may replay the historical migration without pgvector installed, which leaves
  // media_embedding_snapshots.embedding_vector as TEXT instead of vector(1024).
  const pending = prisma.$queryRaw<Array<{ udt_name: string | null }>>(Prisma.sql`
    SELECT udt_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'media_embedding_snapshots'
      AND column_name = 'embedding_vector'
    LIMIT 1
  `)
    .then((rows) => rows[0]?.udt_name === 'vector' ? 'vector' : 'text')
    .catch(() => 'text')

  storageModeCache.set(prisma, pending)
  return pending
}

export function vectorSqlLiteral(
  vector: number[] | null | undefined,
  mode: PgVectorStorageMode,
): Prisma.Sql {
  if (!vector || vector.length === 0) return Prisma.sql`NULL`
  const serialized = serializeVector(vector)
  if (mode === 'vector') {
    return Prisma.sql`${Prisma.raw(`'${serialized}'::vector`)}`
  }
  return Prisma.sql`${serialized}`
}
