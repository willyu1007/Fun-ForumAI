import type { Redis } from 'ioredis'
import type {
  SseBroadcastAdapter,
  SseBroadcastAdapterStats,
  SseBroadcastEnvelope,
} from '../contracts.js'

export interface RedisPubSubSseBroadcastAdapterOptions {
  channel: string
  publisher: Redis
  subscriber: Redis
}

export class RedisPubSubSseBroadcastAdapter implements SseBroadcastAdapter {
  readonly backend = 'redis'

  private started = false
  private onEnvelope: ((envelope: SseBroadcastEnvelope) => void) | null = null
  private readonly stats: SseBroadcastAdapterStats = {
    backend: 'redis',
    published: 0,
    received: 0,
    dropped: 0,
    last_error: null,
  }

  constructor(private readonly options: RedisPubSubSseBroadcastAdapterOptions) {}

  async start(onEnvelope: (envelope: SseBroadcastEnvelope) => void): Promise<void> {
    if (this.started) return
    this.onEnvelope = onEnvelope
    this.options.subscriber.on('message', this.handleMessage)
    await this.options.subscriber.subscribe(this.options.channel)
    this.started = true
  }

  async publish(envelope: SseBroadcastEnvelope): Promise<void> {
    try {
      await this.options.publisher.publish(this.options.channel, JSON.stringify(envelope))
      this.stats.published += 1
    } catch (err) {
      this.stats.last_error = err instanceof Error ? err.message : String(err)
      throw err
    }
  }

  async close(): Promise<void> {
    if (!this.started) return
    this.options.subscriber.off('message', this.handleMessage)
    await this.options.subscriber.unsubscribe(this.options.channel).catch(() => undefined)
    this.onEnvelope = null
    this.started = false
  }

  getStats(): SseBroadcastAdapterStats {
    return { ...this.stats }
  }

  private readonly handleMessage = (_channel: string, raw: string): void => {
    let envelope: SseBroadcastEnvelope
    try {
      envelope = JSON.parse(raw) as SseBroadcastEnvelope
    } catch (err) {
      this.stats.dropped += 1
      this.stats.last_error = err instanceof Error ? err.message : String(err)
      return
    }

    this.stats.received += 1
    this.onEnvelope?.(envelope)
  }
}
