import type { Response } from 'express'

export interface SseEvent {
  type: string
  payload: unknown
  timestamp?: string
}

interface SseClient {
  id: string
  res: Response
  connectedAt: number
}

const HEARTBEAT_INTERVAL_MS = 30_000
const CLIENT_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Manages SSE connections and broadcasts events to all connected clients.
 * Includes heartbeat keep-alive and automatic cleanup of stale connections.
 */
export class SseHub {
  private clients = new Map<string, SseClient>()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.startHeartbeat()
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
      this.clients.delete(id)
    })
  }

  broadcast(event: SseEvent): void {
    const data = JSON.stringify({
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    })

    const dead: string[] = []

    for (const [id, client] of this.clients) {
      try {
        client.res.write(`data: ${data}\n\n`)
      } catch {
        dead.push(id)
      }
    }

    for (const id of dead) {
      this.clients.delete(id)
    }
  }

  get clientCount(): number {
    return this.clients.size
  }

  destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    for (const [, client] of this.clients) {
      try {
        client.res.end()
      } catch { /* already closed */ }
    }
    this.clients.clear()
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
          try { client.res.end() } catch { /* noop */ }
          this.clients.delete(id)
        }
      }
    }, HEARTBEAT_INTERVAL_MS)
  }
}
