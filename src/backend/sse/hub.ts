import type { Response } from 'express'
import { randomUUID } from 'node:crypto'
import type {
  SseBroadcastAdapter,
  SseBroadcastAdapterStats,
  SseBroadcastEnvelope,
  SseBroadcastScope,
  SseEvent,
} from './contracts.js'

interface SseClient {
  id: string
  res: Response
  connectedAt: number
}

const HEARTBEAT_INTERVAL_MS = 30_000
const CLIENT_TIMEOUT_MS = 5 * 60 * 1000

interface SseHubOptions {
  instanceId?: string
}

export class SseHub {
  private readonly instanceId: string
  private clients = new Map<string, SseClient>()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private roomSubscriptions = new Map<string, Set<string>>()
  private clientRooms = new Map<string, Set<string>>()
  private sessionSubscriptions = new Map<string, Set<string>>()
  private clientSessions = new Map<string, Set<string>>()
  private actorSubscriptions = new Map<string, Set<string>>()
  private clientActors = new Map<string, Set<string>>()
  private broadcastAdapter: SseBroadcastAdapter | null = null

  constructor(options: SseHubOptions = {}) {
    this.instanceId = options.instanceId ?? `sse-${process.pid}-${randomUUID()}`
    this.startHeartbeat()
  }

  async setBroadcastAdapter(adapter: SseBroadcastAdapter): Promise<void> {
    if (this.broadcastAdapter) {
      await this.broadcastAdapter.close().catch(() => undefined)
    }
    this.broadcastAdapter = adapter
    await this.broadcastAdapter.start(this.onBroadcastEnvelope)
  }

  addClient(id: string, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    res.write(`data: ${JSON.stringify({ type: 'connected', payload: { client_id: id } })}\n\n`)

    this.clients.set(id, { id, res, connectedAt: Date.now() })

    res.on('close', () => {
      this.cleanupClient(id)
    })
  }

  subscribeRoom(clientId: string, roomId: string): void {
    let roomClients = this.roomSubscriptions.get(roomId)
    if (!roomClients) {
      roomClients = new Set()
      this.roomSubscriptions.set(roomId, roomClients)
    }
    roomClients.add(clientId)

    let rooms = this.clientRooms.get(clientId)
    if (!rooms) {
      rooms = new Set()
      this.clientRooms.set(clientId, rooms)
    }
    rooms.add(roomId)
  }

  unsubscribeRoom(clientId: string, roomId: string): void {
    const roomClients = this.roomSubscriptions.get(roomId)
    if (roomClients) {
      roomClients.delete(clientId)
      if (roomClients.size === 0) {
        this.roomSubscriptions.delete(roomId)
      }
    }

    const rooms = this.clientRooms.get(clientId)
    if (rooms) {
      rooms.delete(roomId)
      if (rooms.size === 0) {
        this.clientRooms.delete(clientId)
      }
    }
  }

  subscribeSession(clientId: string, sessionId: string): void {
    let sessionClients = this.sessionSubscriptions.get(sessionId)
    if (!sessionClients) {
      sessionClients = new Set()
      this.sessionSubscriptions.set(sessionId, sessionClients)
    }
    sessionClients.add(clientId)

    let sessions = this.clientSessions.get(clientId)
    if (!sessions) {
      sessions = new Set()
      this.clientSessions.set(clientId, sessions)
    }
    sessions.add(sessionId)
  }

  unsubscribeSession(clientId: string, sessionId: string): void {
    const sessionClients = this.sessionSubscriptions.get(sessionId)
    if (sessionClients) {
      sessionClients.delete(clientId)
      if (sessionClients.size === 0) {
        this.sessionSubscriptions.delete(sessionId)
      }
    }

    const sessions = this.clientSessions.get(clientId)
    if (sessions) {
      sessions.delete(sessionId)
      if (sessions.size === 0) {
        this.clientSessions.delete(clientId)
      }
    }
  }

  broadcastToRoom(roomId: string, event: SseEvent): void {
    const normalized = this.normalizeEvent(event)
    this.broadcastToRoomLocal(roomId, normalized)
    this.publishToCluster('room', normalized, { roomId })
  }

  broadcastToSession(sessionId: string, event: SseEvent): void {
    const normalized = this.normalizeEvent(event)
    this.broadcastToSessionLocal(sessionId, normalized)
    this.publishToCluster('session', normalized, { sessionId })
  }

  subscribeActor(clientId: string, actorKey: string): void {
    let actorClients = this.actorSubscriptions.get(actorKey)
    if (!actorClients) {
      actorClients = new Set()
      this.actorSubscriptions.set(actorKey, actorClients)
    }
    actorClients.add(clientId)

    let actors = this.clientActors.get(clientId)
    if (!actors) {
      actors = new Set()
      this.clientActors.set(clientId, actors)
    }
    actors.add(actorKey)
  }

  unsubscribeActor(clientId: string, actorKey: string): void {
    const actorClients = this.actorSubscriptions.get(actorKey)
    if (actorClients) {
      actorClients.delete(clientId)
      if (actorClients.size === 0) {
        this.actorSubscriptions.delete(actorKey)
      }
    }

    const actors = this.clientActors.get(clientId)
    if (actors) {
      actors.delete(actorKey)
      if (actors.size === 0) {
        this.clientActors.delete(clientId)
      }
    }
  }

  broadcastToActor(actorKey: string, event: SseEvent): void {
    const normalized = this.normalizeEvent(event)
    this.broadcastToActorLocal(actorKey, normalized)
    this.publishToCluster('actor', normalized, { actorKey })
  }

  broadcast(event: SseEvent): void {
    const normalized = this.normalizeEvent(event)
    this.broadcastLocal(normalized)
    this.publishToCluster('global', normalized, {})
  }

  getStats(): {
    connected_clients: number
    subscribed_rooms: number
    subscribed_sessions: number
    broadcast_backend: SseBroadcastAdapterStats['backend']
    broadcast_published: number
    broadcast_received: number
    broadcast_dropped: number
    broadcast_last_error: string | null
  } {
    const stats = this.broadcastAdapter?.getStats() ?? {
      backend: 'local' as const,
      published: 0,
      received: 0,
      dropped: 0,
      last_error: null,
    }
    return {
      connected_clients: this.clientCount,
      subscribed_rooms: this.roomSubscriptions.size,
      subscribed_sessions: this.sessionSubscriptions.size,
      broadcast_backend: stats.backend,
      broadcast_published: stats.published,
      broadcast_received: stats.received,
      broadcast_dropped: stats.dropped,
      broadcast_last_error: stats.last_error,
    }
  }

  get clientCount(): number {
    return this.clients.size
  }

  async close(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    for (const [id, client] of this.clients) {
      try {
        client.res.end()
      } catch {
        // already closed
      }
      this.cleanupClient(id)
    }
    this.clients.clear()

    if (this.broadcastAdapter) {
      await this.broadcastAdapter.close().catch(() => undefined)
      this.broadcastAdapter = null
    }
  }

  destroy(): void {
    void this.close()
  }

  private broadcastToRoomLocal(roomId: string, event: SseEvent): void {
    const clientIds = this.roomSubscriptions.get(roomId)
    if (!clientIds || clientIds.size === 0) return

    const data = JSON.stringify(event)

    const dead: string[] = []
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId)
      if (!client) {
        dead.push(clientId)
        continue
      }
      try {
        client.res.write(`data: ${data}\n\n`)
      } catch {
        dead.push(clientId)
      }
    }

    for (const id of dead) {
      this.cleanupClient(id)
    }
  }

  private broadcastToSessionLocal(sessionId: string, event: SseEvent): void {
    const clientIds = this.sessionSubscriptions.get(sessionId)
    if (!clientIds || clientIds.size === 0) return

    const data = JSON.stringify(event)
    const dead: string[] = []

    for (const clientId of clientIds) {
      const client = this.clients.get(clientId)
      if (!client) {
        dead.push(clientId)
        continue
      }
      try {
        client.res.write(`data: ${data}\n\n`)
      } catch {
        dead.push(clientId)
      }
    }

    for (const id of dead) {
      this.cleanupClient(id)
    }
  }

  private broadcastLocal(event: SseEvent): void {
    const data = JSON.stringify(event)

    const dead: string[] = []

    for (const [id, client] of this.clients) {
      try {
        client.res.write(`data: ${data}\n\n`)
      } catch {
        dead.push(id)
      }
    }

    for (const id of dead) {
      this.cleanupClient(id)
    }
  }

  private cleanupClient(clientId: string): void {
    this.clients.delete(clientId)
    const rooms = this.clientRooms.get(clientId)
    if (rooms) {
      for (const roomId of Array.from(rooms)) {
        this.unsubscribeRoom(clientId, roomId)
      }
    }
    const sessions = this.clientSessions.get(clientId)
    if (sessions) {
      for (const sessionId of Array.from(sessions)) {
        this.unsubscribeSession(clientId, sessionId)
      }
    }
    const actors = this.clientActors.get(clientId)
    if (actors) {
      for (const actorKey of Array.from(actors)) {
        this.unsubscribeActor(clientId, actorKey)
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now()
      const dead: string[] = []

      for (const [id, client] of this.clients) {
        if (now - client.connectedAt > CLIENT_TIMEOUT_MS) {
          dead.push(id)
          continue
        }
        try {
          client.res.write(`: heartbeat\n\n`)
        } catch {
          dead.push(id)
        }
      }

      for (const id of dead) {
        const client = this.clients.get(id)
        if (client) {
          try {
            client.res.end()
          } catch {
            // noop
          }
          this.cleanupClient(id)
        }
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private normalizeEvent(event: SseEvent): SseEvent {
    return {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    }
  }

  private publishToCluster(
    scope: SseBroadcastScope,
    event: SseEvent,
    target: { roomId?: string; sessionId?: string; actorKey?: string },
  ): void {
    if (!this.broadcastAdapter) return

    const envelope: SseBroadcastEnvelope = {
      source: this.instanceId,
      scope,
      room_id: target.roomId,
      session_id: target.sessionId,
      actor_key: target.actorKey,
      event,
      published_at: new Date().toISOString(),
    }

    void this.broadcastAdapter.publish(envelope).catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[SseHub] Failed to publish ${scope} event: ${message}`)
    })
  }

  private readonly onBroadcastEnvelope = (envelope: SseBroadcastEnvelope): void => {
    if (envelope.source === this.instanceId) return

    const event = this.normalizeEvent(envelope.event)
    if (envelope.scope === 'actor') {
      if (!envelope.actor_key) return
      this.broadcastToActorLocal(envelope.actor_key, event)
      return
    }

    if (envelope.scope === 'room') {
      if (!envelope.room_id) return
      this.broadcastToRoomLocal(envelope.room_id, event)
      return
    }

    if (envelope.scope === 'session') {
      if (!envelope.session_id) return
      this.broadcastToSessionLocal(envelope.session_id, event)
      return
    }

    this.broadcastLocal(event)
  }

  private broadcastToActorLocal(actorKey: string, event: SseEvent): void {
    const clientIds = this.actorSubscriptions.get(actorKey)
    if (!clientIds || clientIds.size === 0) return

    const data = JSON.stringify(event)
    const dead: string[] = []

    for (const clientId of clientIds) {
      const client = this.clients.get(clientId)
      if (!client) {
        dead.push(clientId)
        continue
      }
      try {
        client.res.write(`data: ${data}\n\n`)
      } catch {
        dead.push(clientId)
      }
    }

    for (const id of dead) {
      this.cleanupClient(id)
    }
  }
}
