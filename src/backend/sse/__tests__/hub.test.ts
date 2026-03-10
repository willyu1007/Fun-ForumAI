import { EventEmitter } from 'node:events'
import type { Response } from 'express'
import { afterEach, describe, expect, it } from 'vitest'
import { SseHub } from '../hub.js'
import type {
  SseBroadcastAdapter,
  SseBroadcastAdapterStats,
  SseBroadcastEnvelope,
} from '../contracts.js'

class StubResponse extends EventEmitter {
  readonly writes: string[] = []
  ended = false

  writeHead(_status: number, _headers: Record<string, string>): void {
    // no-op
  }

  write(chunk: string): boolean {
    if (this.ended) {
      throw new Error('write on closed response')
    }
    this.writes.push(String(chunk))
    return true
  }

  end(): this {
    if (!this.ended) {
      this.ended = true
      this.emit('close')
    }
    return this
  }
}

class MemoryBusBroadcastAdapter implements SseBroadcastAdapter {
  readonly backend = 'redis'

  private static adapters = new Set<MemoryBusBroadcastAdapter>()

  private onEnvelope: ((envelope: SseBroadcastEnvelope) => void) | null = null
  private readonly stats: SseBroadcastAdapterStats = {
    backend: 'redis',
    published: 0,
    received: 0,
    dropped: 0,
    last_error: null,
  }

  async start(onEnvelope: (envelope: SseBroadcastEnvelope) => void): Promise<void> {
    this.onEnvelope = onEnvelope
    MemoryBusBroadcastAdapter.adapters.add(this)
  }

  async publish(envelope: SseBroadcastEnvelope): Promise<void> {
    this.stats.published += 1
    for (const adapter of MemoryBusBroadcastAdapter.adapters) {
      adapter.receive(envelope)
    }
  }

  async close(): Promise<void> {
    MemoryBusBroadcastAdapter.adapters.delete(this)
    this.onEnvelope = null
  }

  getStats(): SseBroadcastAdapterStats {
    return { ...this.stats }
  }

  static reset(): void {
    MemoryBusBroadcastAdapter.adapters.clear()
  }

  private receive(envelope: SseBroadcastEnvelope): void {
    this.stats.received += 1
    this.onEnvelope?.(envelope)
  }
}

function collectEvents(res: StubResponse): Array<{ type: string; payload: unknown }> {
  const events: Array<{ type: string; payload: unknown; timestamp?: string }> = []
  for (const row of res.writes) {
    if (!row.startsWith('data: ')) continue
    const payload = JSON.parse(row.slice('data: '.length).trim()) as {
      type: string
      payload: unknown
      timestamp?: string
    }
    if (payload.type === 'connected') continue
    events.push(payload)
  }
  return events
}

async function flushAsync(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

const hubsToClose: SseHub[] = []

afterEach(async () => {
  for (const hub of hubsToClose.splice(0)) {
    await hub.close()
  }
  MemoryBusBroadcastAdapter.reset()
})

describe('SseHub', () => {
  it('broadcasts global events to connected local clients', () => {
    const hub = new SseHub({ instanceId: 'hub-local' })
    hubsToClose.push(hub)

    const r1 = new StubResponse()
    const r2 = new StubResponse()
    hub.addClient('c1', r1 as unknown as Response)
    hub.addClient('c2', r2 as unknown as Response)

    hub.broadcast({ type: 'POST_CREATED', payload: { post_id: 'post-1' } })

    expect(collectEvents(r1)).toEqual([expect.objectContaining({ type: 'POST_CREATED', payload: { post_id: 'post-1' } })])
    expect(collectEvents(r2)).toEqual([expect.objectContaining({ type: 'POST_CREATED', payload: { post_id: 'post-1' } })])
  })

  it('broadcasts room events only to subscribed local clients', () => {
    const hub = new SseHub({ instanceId: 'hub-room' })
    hubsToClose.push(hub)

    const r1 = new StubResponse()
    const r2 = new StubResponse()
    hub.addClient('c1', r1 as unknown as Response)
    hub.addClient('c2', r2 as unknown as Response)
    hub.subscribeRoom('c1', 'room-1')

    hub.broadcastToRoom('room-1', { type: 'MESSAGE_CREATED', payload: { room_id: 'room-1' } })

    expect(collectEvents(r1)).toEqual([expect.objectContaining({ type: 'MESSAGE_CREATED', payload: { room_id: 'room-1' } })])
    expect(collectEvents(r2)).toEqual([])
  })

  it('broadcasts session events only to subscribed local clients', () => {
    const hub = new SseHub({ instanceId: 'hub-session' })
    hubsToClose.push(hub)

    const r1 = new StubResponse()
    const r2 = new StubResponse()
    hub.addClient('c1', r1 as unknown as Response)
    hub.addClient('c2', r2 as unknown as Response)
    hub.subscribeSession('c1', 'session-1')

    hub.broadcastToSession('session-1', {
      type: 'PRIVATE_MESSAGE_CREATED',
      payload: { session_id: 'session-1' },
    })

    expect(collectEvents(r1)).toEqual([expect.objectContaining({
      type: 'PRIVATE_MESSAGE_CREATED',
      payload: { session_id: 'session-1' },
    })])
    expect(collectEvents(r2)).toEqual([])
  })

  it('broadcasts actor-scoped events only to subscribed local clients', () => {
    const hub = new SseHub({ instanceId: 'hub-actor' })
    hubsToClose.push(hub)

    const r1 = new StubResponse()
    const r2 = new StubResponse()
    hub.addClient('c1', r1 as unknown as Response)
    hub.addClient('c2', r2 as unknown as Response)
    hub.subscribeActor('c1', 'USER:user-1')

    hub.broadcastToActor('USER:user-1', {
      type: 'GUIDANCE_UPDATED',
      payload: {},
    })

    expect(collectEvents(r1)).toEqual([expect.objectContaining({
      type: 'GUIDANCE_UPDATED',
      payload: {},
    })])
    expect(collectEvents(r2)).toEqual([])
  })

  it('fans out global events across hubs via broadcast adapter without local duplication', async () => {
    const hub1 = new SseHub({ instanceId: 'hub-1' })
    const hub2 = new SseHub({ instanceId: 'hub-2' })
    hubsToClose.push(hub1, hub2)

    await hub1.setBroadcastAdapter(new MemoryBusBroadcastAdapter())
    await hub2.setBroadcastAdapter(new MemoryBusBroadcastAdapter())

    const r1 = new StubResponse()
    const r2 = new StubResponse()
    hub1.addClient('c1', r1 as unknown as Response)
    hub2.addClient('c2', r2 as unknown as Response)

    hub1.broadcast({ type: 'POST_CREATED', payload: { post_id: 'post-2' } })
    await flushAsync()

    expect(collectEvents(r1)).toEqual([expect.objectContaining({ type: 'POST_CREATED', payload: { post_id: 'post-2' } })])
    expect(collectEvents(r2)).toEqual([expect.objectContaining({ type: 'POST_CREATED', payload: { post_id: 'post-2' } })])
  })

  it('fans out room-scoped events across hubs while honoring room subscriptions', async () => {
    const hub1 = new SseHub({ instanceId: 'hub-1' })
    const hub2 = new SseHub({ instanceId: 'hub-2' })
    hubsToClose.push(hub1, hub2)

    await hub1.setBroadcastAdapter(new MemoryBusBroadcastAdapter())
    await hub2.setBroadcastAdapter(new MemoryBusBroadcastAdapter())

    const r1 = new StubResponse()
    const r2 = new StubResponse()
    const r3 = new StubResponse()
    hub1.addClient('c1', r1 as unknown as Response)
    hub2.addClient('c2', r2 as unknown as Response)
    hub2.addClient('c3', r3 as unknown as Response)

    hub1.subscribeRoom('c1', 'room-9')
    hub2.subscribeRoom('c2', 'room-9')
    hub2.subscribeRoom('c3', 'room-other')

    hub1.broadcastToRoom('room-9', { type: 'MESSAGE_CREATED', payload: { room_id: 'room-9', id: 'm-1' } })
    await flushAsync()

    expect(collectEvents(r1)).toEqual([expect.objectContaining({ type: 'MESSAGE_CREATED', payload: { room_id: 'room-9', id: 'm-1' } })])
    expect(collectEvents(r2)).toEqual([expect.objectContaining({ type: 'MESSAGE_CREATED', payload: { room_id: 'room-9', id: 'm-1' } })])
    expect(collectEvents(r3)).toEqual([])
  })

  it('fans out session-scoped events across hubs while honoring session subscriptions', async () => {
    const hub1 = new SseHub({ instanceId: 'hub-1' })
    const hub2 = new SseHub({ instanceId: 'hub-2' })
    hubsToClose.push(hub1, hub2)

    await hub1.setBroadcastAdapter(new MemoryBusBroadcastAdapter())
    await hub2.setBroadcastAdapter(new MemoryBusBroadcastAdapter())

    const r1 = new StubResponse()
    const r2 = new StubResponse()
    const r3 = new StubResponse()
    hub1.addClient('c1', r1 as unknown as Response)
    hub2.addClient('c2', r2 as unknown as Response)
    hub2.addClient('c3', r3 as unknown as Response)

    hub1.subscribeSession('c1', 'session-9')
    hub2.subscribeSession('c2', 'session-9')
    hub2.subscribeSession('c3', 'session-other')

    hub1.broadcastToSession('session-9', {
      type: 'PRIVATE_MESSAGE_CREATED',
      payload: { session_id: 'session-9', id: 'pm-1' },
    })
    await flushAsync()

    expect(collectEvents(r1)).toEqual([expect.objectContaining({
      type: 'PRIVATE_MESSAGE_CREATED',
      payload: { session_id: 'session-9', id: 'pm-1' },
    })])
    expect(collectEvents(r2)).toEqual([expect.objectContaining({
      type: 'PRIVATE_MESSAGE_CREATED',
      payload: { session_id: 'session-9', id: 'pm-1' },
    })])
    expect(collectEvents(r3)).toEqual([])
  })

  it('fans out actor-scoped events across hubs while honoring actor subscriptions', async () => {
    const hub1 = new SseHub({ instanceId: 'hub-1' })
    const hub2 = new SseHub({ instanceId: 'hub-2' })
    hubsToClose.push(hub1, hub2)

    await hub1.setBroadcastAdapter(new MemoryBusBroadcastAdapter())
    await hub2.setBroadcastAdapter(new MemoryBusBroadcastAdapter())

    const r1 = new StubResponse()
    const r2 = new StubResponse()
    const r3 = new StubResponse()
    hub1.addClient('c1', r1 as unknown as Response)
    hub2.addClient('c2', r2 as unknown as Response)
    hub2.addClient('c3', r3 as unknown as Response)

    hub1.subscribeActor('c1', 'USER:user-9')
    hub2.subscribeActor('c2', 'USER:user-9')
    hub2.subscribeActor('c3', 'USER:user-other')

    hub1.broadcastToActor('USER:user-9', {
      type: 'GUIDANCE_UPDATED',
      payload: {},
    })
    await flushAsync()

    expect(collectEvents(r1)).toEqual([expect.objectContaining({ type: 'GUIDANCE_UPDATED', payload: {} })])
    expect(collectEvents(r2)).toEqual([expect.objectContaining({ type: 'GUIDANCE_UPDATED', payload: {} })])
    expect(collectEvents(r3)).toEqual([])
  })
})
