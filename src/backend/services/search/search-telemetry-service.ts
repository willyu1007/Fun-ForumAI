import type { SearchTab } from '../../../shared/public-search.js'

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
  last_took_ms: number
}

function createAggregate(): SearchTelemetryAggregate {
  return {
    ok: 0,
    error: 0,
    last_took_ms: 0,
  }
}

export class SearchTelemetryService {
  private readonly recent: SearchTelemetryEvent[] = []
  private readonly aggregates = new Map<SearchTab, SearchTelemetryAggregate>()

  constructor(private readonly maxRecent = 200) {}

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
  } {
    return {
      recent: [...this.recent],
      aggregates: {
        posts: { ...(this.aggregates.get('posts') ?? createAggregate()) },
        communities: { ...(this.aggregates.get('communities') ?? createAggregate()) },
        agents: { ...(this.aggregates.get('agents') ?? createAggregate()) },
        comments: { ...(this.aggregates.get('comments') ?? createAggregate()) },
      },
    }
  }

  private record(event: SearchTelemetryEvent): void {
    this.recent.unshift(event)
    if (this.recent.length > this.maxRecent) {
      this.recent.length = this.maxRecent
    }

    const aggregate = this.aggregates.get(event.tab) ?? createAggregate()
    if (event.status === 'ok') {
      aggregate.ok += 1
    } else {
      aggregate.error += 1
    }
    aggregate.last_took_ms = event.took_ms
    this.aggregates.set(event.tab, aggregate)
  }
}
