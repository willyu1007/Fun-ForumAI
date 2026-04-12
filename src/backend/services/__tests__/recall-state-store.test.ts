import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { Redis } from 'ioredis'
import { RedisRecallStateStore } from '../recall-state-store.js'

const REDIS_SERVER_BIN = spawnSync('sh', ['-lc', 'command -v redis-server'], {
  encoding: 'utf8',
}).stdout.trim() || null

const describeIfRedis = REDIS_SERVER_BIN
  ? describe.sequential
  : describe.skip

describeIfRedis('RedisRecallStateStore', () => {
  let port = 0
  let tempDir = ''
  let processRef: ChildProcessWithoutNullStreams | null = null
  let redis: Redis | null = null
  let startupError = ''

  beforeAll(async () => {
    port = await findFreePort()
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'ff-recall-store-'))
    processRef = spawn(
      REDIS_SERVER_BIN,
      [
        '--save',
        '',
        '--appendonly',
        'no',
        '--bind',
        '127.0.0.1',
        '--port',
        String(port),
        '--dir',
        tempDir,
      ],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    )
    processRef.stderr.on('data', (chunk) => {
      startupError += chunk.toString()
    })

    redis = new Redis(port, '127.0.0.1', {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })
    redis.on('error', () => {
      // Startup retries are expected before the child process begins accepting connections.
    })
    await waitForRedis(redis, startupError)
  })

  afterAll(async () => {
    if (redis) {
      await redis.quit().catch(() => undefined)
    }
    if (processRef && !processRef.killed) {
      processRef.kill('SIGTERM')
      await waitForExit(processRef)
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  beforeEach(async () => {
    await redis?.flushdb()
  })

  it('enforces pair-window caps atomically across concurrent store instances', async () => {
    const storeA = new RedisRecallStateStore(redis!, { keyPrefix: 'test:recall:atomic' })
    const storeB = new RedisRecallStateStore(redis!, { keyPrefix: 'test:recall:atomic' })

    const attempts = await Promise.all([
      storeA.attemptGrant({
        thread_id: 'thread-1',
        event_author_key: 'agent-author',
        candidate_agent_id: 'agent-target',
        pair_window_seconds: 30,
        pair_max_exchanges: 1,
        quota_kind: 'neutral',
        reactive_recall_decay: 'moderate',
        is_revive_branch: false,
        revive_old_branch_budget: 1,
      }),
      storeB.attemptGrant({
        thread_id: 'thread-1',
        event_author_key: 'agent-author',
        candidate_agent_id: 'agent-target',
        pair_window_seconds: 30,
        pair_max_exchanges: 1,
        quota_kind: 'neutral',
        reactive_recall_decay: 'moderate',
        is_revive_branch: false,
        revive_old_branch_budget: 1,
      }),
      storeA.attemptGrant({
        thread_id: 'thread-1',
        event_author_key: 'agent-author',
        candidate_agent_id: 'agent-target',
        pair_window_seconds: 30,
        pair_max_exchanges: 1,
        quota_kind: 'neutral',
        reactive_recall_decay: 'moderate',
        is_revive_branch: false,
        revive_old_branch_budget: 1,
      }),
    ])

    expect(attempts.filter((attempt) => attempt.granted)).toHaveLength(1)
    expect(attempts.filter((attempt) => !attempt.granted)).toEqual([
      expect.objectContaining({ suppression_reason: 'pair_window_cap' }),
      expect.objectContaining({ suppression_reason: 'pair_window_cap' }),
    ])
  })

  it('shares revive-old-branch budgets across store instances', async () => {
    const storeA = new RedisRecallStateStore(redis!, { keyPrefix: 'test:recall:revive' })
    const storeB = new RedisRecallStateStore(redis!, { keyPrefix: 'test:recall:revive' })

    const first = await storeA.attemptGrant({
      thread_id: 'thread-1',
      event_author_key: 'agent-author',
      candidate_agent_id: 'agent-target-a',
      pair_window_seconds: 30,
      pair_max_exchanges: 3,
      quota_kind: 'neutral',
      reactive_recall_decay: 'moderate',
      is_revive_branch: true,
      revive_old_branch_budget: 1,
    })
    const second = await storeB.attemptGrant({
      thread_id: 'thread-1',
      event_author_key: 'agent-author',
      candidate_agent_id: 'agent-target-b',
      pair_window_seconds: 30,
      pair_max_exchanges: 3,
      quota_kind: 'neutral',
      reactive_recall_decay: 'moderate',
      is_revive_branch: true,
      revive_old_branch_budget: 1,
    })

    expect(first).toMatchObject({
      granted: true,
      revive_count_before: 0,
      revive_count_after: 1,
    })
    expect(second).toMatchObject({
      granted: false,
      suppression_reason: 'revive_budget_exhausted',
      revive_count_before: 1,
      revive_count_after: 1,
    })
  })

  it('respects pair-window TTL expiry in Redis-backed recall state', async () => {
    const store = new RedisRecallStateStore(redis!, { keyPrefix: 'test:recall:ttl' })

    const first = await store.attemptGrant({
      thread_id: 'thread-1',
      event_author_key: 'agent-author',
      candidate_agent_id: 'agent-target',
      pair_window_seconds: 1,
      pair_max_exchanges: 1,
      quota_kind: 'neutral',
      reactive_recall_decay: 'moderate',
      is_revive_branch: false,
      revive_old_branch_budget: 1,
    })
    const blocked = await store.attemptGrant({
      thread_id: 'thread-1',
      event_author_key: 'agent-author',
      candidate_agent_id: 'agent-target',
      pair_window_seconds: 1,
      pair_max_exchanges: 1,
      quota_kind: 'neutral',
      reactive_recall_decay: 'moderate',
      is_revive_branch: false,
      revive_old_branch_budget: 1,
    })

    await sleep(1_100)

    const afterExpiry = await store.attemptGrant({
      thread_id: 'thread-1',
      event_author_key: 'agent-author',
      candidate_agent_id: 'agent-target',
      pair_window_seconds: 1,
      pair_max_exchanges: 1,
      quota_kind: 'neutral',
      reactive_recall_decay: 'moderate',
      is_revive_branch: false,
      revive_old_branch_budget: 1,
    })

    expect(first.granted).toBe(true)
    expect(blocked.suppression_reason).toBe('pair_window_cap')
    expect(afterExpiry).toMatchObject({
      granted: true,
      pair_count_before: 0,
      pair_count_after: 1,
    })
  })
})

async function findFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        if (!address || typeof address === 'string') {
          reject(new Error('Failed to resolve free port'))
          return
        }
        resolve(address.port)
      })
    })
  })
}

async function waitForRedis(redis: Redis, startupError: string): Promise<void> {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    try {
      const pong = await redis.ping()
      if (pong === 'PONG') {
        return
      }
    } catch {
      // Retry until the child process finishes booting.
    }
    await sleep(50)
  }
  throw new Error(`Redis test server did not become ready. ${startupError}`.trim())
}

async function waitForExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve())
  })
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
