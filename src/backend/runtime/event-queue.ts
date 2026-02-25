import type { EventPayload } from '../allocator/types.js'

export interface QueuedEventHandle {
  event: EventPayload
  ack(): Promise<void>
  retry(reason?: string): Promise<void>
}

export interface RuntimeEventQueue {
  enqueue(event: EventPayload): Promise<void>
  dequeue(opts?: { timeoutMs?: number }): Promise<QueuedEventHandle | null>
  size(): Promise<number>
  oldestTimestampMs(): Promise<number | null>
  clear(): Promise<void>
  close(): Promise<void>
}

export class InMemoryRuntimeEventQueue implements RuntimeEventQueue {
  private items: EventPayload[] = []

  async enqueue(event: EventPayload): Promise<void> {
    this.items.push(event)
  }

  async dequeue(): Promise<QueuedEventHandle | null> {
    const event = this.items.shift() ?? null
    if (!event) return null
    return {
      event,
      ack: async () => undefined,
      retry: async () => {
        this.items.push(event)
      },
    }
  }

  async size(): Promise<number> {
    return this.items.length
  }

  async oldestTimestampMs(): Promise<number | null> {
    if (this.items.length === 0) return null
    return new Date(this.items[0].created_at).getTime()
  }

  async clear(): Promise<void> {
    this.items = []
  }

  async close(): Promise<void> {
    // no-op
  }
}

interface RedisLike {
  call(command: string, ...args: (string | number)[]): Promise<unknown>
  xadd(key: string, ...args: unknown[]): Promise<unknown>
  xlen(key: string): Promise<number>
  xrange(key: string, start: string, end: string, ...args: unknown[]): Promise<unknown>
  xack(key: string, group: string, id: string): Promise<number>
  xdel(key: string, ...ids: string[]): Promise<number>
  del(...keys: string[]): Promise<number>
}

interface RedisEventQueueConfig {
  streamKey: string
  deadLetterStreamKey: string
  consumerGroup: string
  consumerName: string
  visibilityTimeoutMs: number
  maxRetries: number
  pollTimeoutMs: number
}

interface StreamMessage {
  id: string
  event: EventPayload
  retryCount: number
}

const DEFAULT_QUEUE_CONFIG: RedisEventQueueConfig = {
  streamKey: 'llm-forum:runtime:events',
  deadLetterStreamKey: 'llm-forum:runtime:events:dlq',
  consumerGroup: 'runtime-loop',
  consumerName: `consumer-${Math.random().toString(36).slice(2, 8)}`,
  visibilityTimeoutMs: 60_000,
  maxRetries: 3,
  pollTimeoutMs: 100,
}

/**
 * Redis Streams queue for multi-instance runtime processing.
 * Uses consumer groups for claiming + ack semantics, with manual retry/dead-letter.
 */
export class RedisStreamRuntimeEventQueue implements RuntimeEventQueue {
  private readonly cfg: RedisEventQueueConfig
  private readonly initPromise: Promise<void>

  constructor(
    private readonly redis: RedisLike,
    cfg: Partial<RedisEventQueueConfig> = {},
  ) {
    this.cfg = { ...DEFAULT_QUEUE_CONFIG, ...cfg }
    this.initPromise = this.ensureConsumerGroup()
  }

  async enqueue(event: EventPayload): Promise<void> {
    await this.initPromise
    await this.redis.xadd(
      this.cfg.streamKey,
      '*',
      'event',
      JSON.stringify(event),
      'retry_count',
      '0',
    )
  }

  async dequeue(
    opts: { timeoutMs?: number } = {},
  ): Promise<QueuedEventHandle | null> {
    await this.initPromise
    const timeoutMs = opts.timeoutMs ?? this.cfg.pollTimeoutMs

    const reclaimed = await this.tryReclaimStale()
    const msg = reclaimed ?? await this.readNext(timeoutMs)
    if (!msg) return null

    return {
      event: msg.event,
      ack: async () => {
        await this.redis.xack(this.cfg.streamKey, this.cfg.consumerGroup, msg.id)
        await this.redis.xdel(this.cfg.streamKey, msg.id)
      },
      retry: async (reason?: string) => {
        const nextRetry = msg.retryCount + 1
        if (nextRetry > this.cfg.maxRetries) {
          await this.redis.xadd(
            this.cfg.deadLetterStreamKey,
            '*',
            'event',
            JSON.stringify(msg.event),
            'retry_count',
            String(nextRetry),
            'reason',
            reason ?? 'retry_limit_exceeded',
            'failed_at',
            new Date().toISOString(),
          )
          await this.redis.xack(this.cfg.streamKey, this.cfg.consumerGroup, msg.id)
          await this.redis.xdel(this.cfg.streamKey, msg.id)
          return
        }

        await this.redis.xadd(
          this.cfg.streamKey,
          '*',
          'event',
          JSON.stringify(msg.event),
          'retry_count',
          String(nextRetry),
        )
        await this.redis.xack(this.cfg.streamKey, this.cfg.consumerGroup, msg.id)
        await this.redis.xdel(this.cfg.streamKey, msg.id)
      },
    }
  }

  async size(): Promise<number> {
    await this.initPromise
    return this.redis.xlen(this.cfg.streamKey)
  }

  async oldestTimestampMs(): Promise<number | null> {
    await this.initPromise
    const raw = await this.redis.xrange(this.cfg.streamKey, '-', '+', 'COUNT', 1)
    const rows = Array.isArray(raw) ? raw as Array<[string, string[]]> : []
    if (!rows.length) return null
    const [id] = rows[0]
    const ms = parseInt(id.split('-')[0], 10)
    return Number.isFinite(ms) ? ms : null
  }

  async clear(): Promise<void> {
    await this.initPromise
    await this.redis.del(this.cfg.streamKey, this.cfg.deadLetterStreamKey)
    await this.ensureConsumerGroup()
  }

  async close(): Promise<void> {
    // Connection lifecycle is managed by the owner (container).
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redis.call(
        'XGROUP',
        'CREATE',
        this.cfg.streamKey,
        this.cfg.consumerGroup,
        '0',
        'MKSTREAM',
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('BUSYGROUP')) throw err
    }
  }

  private async tryReclaimStale(): Promise<StreamMessage | null> {
    const res = await this.redis.call(
      'XAUTOCLAIM',
      this.cfg.streamKey,
      this.cfg.consumerGroup,
      this.cfg.consumerName,
      String(this.cfg.visibilityTimeoutMs),
      '0-0',
      'COUNT',
      '1',
    ) as [string, Array<[string, string[]]>, string[]]

    const rows = Array.isArray(res) ? res[1] : []
    if (!rows || rows.length === 0) return null
    return this.parseStreamRow(rows[0])
  }

  private async readNext(timeoutMs: number): Promise<StreamMessage | null> {
    const res = await this.redis.call(
      'XREADGROUP',
      'GROUP',
      this.cfg.consumerGroup,
      this.cfg.consumerName,
      'COUNT',
      '1',
      'BLOCK',
      String(timeoutMs),
      'STREAMS',
      this.cfg.streamKey,
      '>',
    ) as Array<[string, Array<[string, string[]]>]> | null

    if (!res || res.length === 0) return null
    const [, rows] = res[0]
    if (!rows || rows.length === 0) return null
    return this.parseStreamRow(rows[0])
  }

  private parseStreamRow(row: [string, string[]]): StreamMessage {
    const [id, fields] = row
    const map = new Map<string, string>()
    for (let i = 0; i < fields.length; i += 2) {
      map.set(fields[i], fields[i + 1])
    }
    const eventRaw = map.get('event')
    if (!eventRaw) {
      throw new Error(`Missing event payload in stream row ${id}`)
    }
    const retryCount = parseInt(map.get('retry_count') ?? '0', 10)
    return {
      id,
      event: JSON.parse(eventRaw) as EventPayload,
      retryCount: Number.isFinite(retryCount) ? retryCount : 0,
    }
  }
}
