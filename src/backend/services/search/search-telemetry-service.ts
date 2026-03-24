import type { PublicSearchItem, SearchTab } from '../../../shared/public-search.js'

export interface SearchTelemetryEvent {
  at: string
  normalized_query: string
  tab: SearchTab
  limit: number
  result_count: number
  took_ms: number
  counts_cache_hit: boolean
  status: 'ok' | 'error'
  error_code?: string
}

interface SearchTelemetryAggregate {
  ok: number
  error: number
  zero_result: number
  last_took_ms: number
}

function createAggregate(): SearchTelemetryAggregate {
  return {
    ok: 0,
    error: 0,
    zero_result: 0,
    last_took_ms: 0,
  }
}

export type SearchInteractionEventType =
  | 'reformulation'
  | 'result_click'
  | 'follow'

export interface SearchInteractionEvent {
  at: string
  event_type: SearchInteractionEventType
  normalized_query: string
  tab: SearchTab
  result_type?: PublicSearchItem['type']
  result_id?: string
  previous_normalized_query?: string
}

export interface SearchFunnelCounters {
  query_ok: number
  query_error: number
  zero_result: number
  reformulation: number
  result_click: number
  follow: number
}

function createFunnelCounters(): SearchFunnelCounters {
  return {
    query_ok: 0,
    query_error: 0,
    zero_result: 0,
    reformulation: 0,
    result_click: 0,
    follow: 0,
  }
}

export class SearchTelemetryService {
  private readonly recent: SearchTelemetryEvent[] = []
  private readonly aggregates = new Map<SearchTab, SearchTelemetryAggregate>()
  private readonly interactions: SearchInteractionEvent[] = []
  private readonly funnelCounters = createFunnelCounters()

  constructor(private readonly maxRecent = 200, private readonly maxInteractions = 200) {}

  recordSuccess(input: Omit<SearchTelemetryEvent, 'status' | 'at'>): void {
    this.record({
      ...input,
      at: new Date().toISOString(),
      status: 'ok',
    })
  }

  recordFailure(input: Omit<SearchTelemetryEvent, 'status' | 'at' | 'result_count'> & { error_code?: string }): void {
    this.record({
      ...input,
      at: new Date().toISOString(),
      result_count: 0,
      status: 'error',
    })
  }

  snapshot(): {
    recent: SearchTelemetryEvent[]
    aggregates: Record<SearchTab, SearchTelemetryAggregate>
    funnel: {
      recent: SearchInteractionEvent[]
      counters: SearchFunnelCounters
    }
  } {
    return {
      recent: [...this.recent],
      aggregates: {
        posts: { ...(this.aggregates.get('posts') ?? createAggregate()) },
        communities: { ...(this.aggregates.get('communities') ?? createAggregate()) },
        agents: { ...(this.aggregates.get('agents') ?? createAggregate()) },
        threads: { ...(this.aggregates.get('threads') ?? createAggregate()) },
      },
      funnel: {
        recent: [...this.interactions],
        counters: { ...this.funnelCounters },
      },
    }
  }

  recordInteraction(input: Omit<SearchInteractionEvent, 'at'>): void {
    const event: SearchInteractionEvent = {
      ...input,
      at: new Date().toISOString(),
    }
    this.interactions.unshift(event)
    if (this.interactions.length > this.maxInteractions) {
      this.interactions.length = this.maxInteractions
    }
    this.funnelCounters[event.event_type] += 1
  }

  private record(event: SearchTelemetryEvent): void {
    this.recent.unshift(event)
    if (this.recent.length > this.maxRecent) {
      this.recent.length = this.maxRecent
    }

    const aggregate = this.aggregates.get(event.tab) ?? createAggregate()
    if (event.status === 'ok') {
      aggregate.ok += 1
      this.funnelCounters.query_ok += 1
      if (event.result_count === 0) {
        aggregate.zero_result += 1
        this.funnelCounters.zero_result += 1
      }
    } else {
      aggregate.error += 1
      this.funnelCounters.query_error += 1
    }
    aggregate.last_took_ms = event.took_ms
    this.aggregates.set(event.tab, aggregate)
  }
}
