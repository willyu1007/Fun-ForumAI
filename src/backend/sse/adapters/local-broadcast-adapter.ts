import type {
  SseBroadcastAdapter,
  SseBroadcastAdapterStats,
  SseBroadcastEnvelope,
} from '../contracts.js'

export class LocalSseBroadcastAdapter implements SseBroadcastAdapter {
  readonly backend = 'local'

  async start(_onEnvelope: (envelope: SseBroadcastEnvelope) => void): Promise<void> {
    // no-op: local mode does not subscribe to an external broker
  }

  async publish(_envelope: SseBroadcastEnvelope): Promise<void> {
    // no-op: local mode does not publish to an external broker
  }

  async close(): Promise<void> {
    // no-op
  }

  getStats(): SseBroadcastAdapterStats {
    return {
      backend: 'local',
      published: 0,
      received: 0,
      dropped: 0,
      last_error: null,
    }
  }
}

