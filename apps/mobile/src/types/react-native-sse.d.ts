declare module 'react-native-sse' {
  export interface EventSourceInit {
    method?: string
    headers?: Record<string, string>
    pollingInterval?: number
    timeout?: number
  }

  export interface EventSourceMessage {
    data?: string
    type?: string
  }

  export default class EventSource {
    constructor(url: string, options?: EventSourceInit)
    addEventListener(type: string, listener: (event: EventSourceMessage) => void): void
    removeAllEventListeners(): void
    close(): void
  }
}
