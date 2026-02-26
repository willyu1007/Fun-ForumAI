type Listener = (event: { type?: string; data?: string }) => void

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  headers: Record<string, string>
  listeners = new Map<string, Listener[]>()
  closed = false

  constructor(url: string, opts?: { headers?: Record<string, string> }) {
    this.url = url
    this.headers = opts?.headers ?? {}
    MockEventSource.instances.push(this)
  }

  addEventListener(event: string, cb: Listener) {
    const arr = this.listeners.get(event) ?? []
    arr.push(cb)
    this.listeners.set(event, arr)
  }

  removeAllEventListeners() { this.listeners.clear() }
  close() { this.closed = true }

  emit(event: string, data: { type?: string; data?: string }) {
    for (const cb of this.listeners.get(event) ?? []) cb(data)
  }
}

jest.mock('react-native-sse', () => MockEventSource)

import { openSseStream } from '../sse'

beforeEach(() => { MockEventSource.instances = [] })

describe('openSseStream', () => {
  it('connects and delivers known events', () => {
    const events: unknown[] = []
    const cleanup = openSseStream({
      rooms: ['room-1'],
      onEvent: (e) => events.push(e),
    })

    expect(MockEventSource.instances).toHaveLength(1)
    const source = MockEventSource.instances[0]
    expect(source.url).toContain('rooms=room-1')

    source.emit('message', { data: JSON.stringify({ type: 'connected' }) })
    expect(events).toHaveLength(0)

    source.emit('message', { data: JSON.stringify({ type: 'MESSAGE_CREATED', payload: { id: '1' } }) })
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'MESSAGE_CREATED', payload: { id: '1' } })

    cleanup()
    expect(source.closed).toBe(true)
  })

  it('filters unknown event types', () => {
    const events: unknown[] = []
    openSseStream({ onEvent: (e) => events.push(e) })
    const source = MockEventSource.instances[0]

    source.emit('message', { data: JSON.stringify({ type: 'UNKNOWN_EVENT' }) })
    expect(events).toHaveLength(0)
  })

  it('sends Authorization header when token provided', () => {
    openSseStream({ token: 'my-tok', onEvent: () => {} })
    const source = MockEventSource.instances[0]
    expect(source.headers.Authorization).toBe('Bearer my-tok')
  })

  it('calls onAuthError on 401 and does not reconnect', (done) => {
    let authErrorCalled = false
    openSseStream({
      onEvent: () => {},
      onAuthError: () => { authErrorCalled = true },
    })
    const source = MockEventSource.instances[0]
    source.emit('error', { data: '401 Unauthorized' })

    setTimeout(() => {
      expect(authErrorCalled).toBe(true)
      expect(MockEventSource.instances).toHaveLength(1)
      done()
    }, 100)
  })

  it('attempts reconnect on non-auth error', (done) => {
    openSseStream({ onEvent: () => {} })
    const source = MockEventSource.instances[0]
    source.emit('error', { data: 'connection lost' })

    setTimeout(() => {
      expect(MockEventSource.instances.length).toBeGreaterThan(1)
      MockEventSource.instances.forEach((s) => { s.close(); s.removeAllEventListeners() })
      done()
    }, 3000)
  })

  it('includes sessions in URL', () => {
    openSseStream({ sessions: ['s1', 's2'], onEvent: () => {} })
    const source = MockEventSource.instances[0]
    expect(source.url).toContain('sessions=s1%2Cs2')
  })
})
