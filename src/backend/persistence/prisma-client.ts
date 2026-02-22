import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { config } from '../lib/config.js'

let _client: PrismaClient | null = null
let _pool: pg.Pool | null = null

export function getPrismaClient(): PrismaClient {
  if (!_client) {
    _pool = new pg.Pool({ connectionString: config.db.url })
    const adapter = new PrismaPg(_pool)
    _client = new PrismaClient({
      adapter,
      log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
    })
  }
  return _client
}

export async function disconnectPrisma(): Promise<void> {
  if (_client) {
    await _client.$disconnect()
    _client = null
  }
  if (_pool) {
    await _pool.end()
    _pool = null
  }
}
