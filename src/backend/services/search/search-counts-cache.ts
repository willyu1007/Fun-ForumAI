import type { SearchCounts } from '../../../shared/public-search.js'

interface SearchCountsCacheEntry {
  counts: SearchCounts
  expires_at_ms: number
}

function cloneCounts(counts: SearchCounts): SearchCounts {
  return {
    posts: counts.posts,
    communities: counts.communities,
    agents: counts.agents,
    threads: counts.threads,
  }
}

export interface SearchCountsCacheOptions {
  ttl_ms?: number
  now?: () => number
}

export class SearchCountsCache {
  private readonly store = new Map<string, SearchCountsCacheEntry>()
  private readonly ttlMs: number
  private readonly now: () => number

  constructor(options: SearchCountsCacheOptions = {}) {
    this.ttlMs = options.ttl_ms ?? 15_000
    this.now = options.now ?? (() => Date.now())
  }

  get(normalizedQuery: string): SearchCounts | null {
    const entry = this.store.get(normalizedQuery)
    if (!entry) return null
    if (entry.expires_at_ms <= this.now()) {
      this.store.delete(normalizedQuery)
      return null
    }
    return cloneCounts(entry.counts)
  }

  set(normalizedQuery: string, counts: SearchCounts): void {
    this.store.set(normalizedQuery, {
      counts: cloneCounts(counts),
      expires_at_ms: this.now() + this.ttlMs,
    })
  }

  clear(): void {
    this.store.clear()
  }
}
