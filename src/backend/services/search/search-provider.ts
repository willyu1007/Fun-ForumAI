import type { PublicSearchItem, SearchSort, SearchTab } from '../../../shared/public-search.js'
import type { SearchCursorPayload } from '../../repos/types.js'

export interface SearchProviderInput {
  query: string
  cursor?: SearchCursorPayload
  limit: number
  sort?: SearchSort
  since?: Date
  viewer_user_id?: string
  followed_agent_ids?: ReadonlySet<string>
}

export interface SearchDiscoverInput {
  limit: number
  viewer_user_id?: string
  followed_agent_ids?: ReadonlySet<string>
}

export interface SearchProviderResult {
  items: PublicSearchItem[]
  next_cursor: SearchCursorPayload | null
}

export interface SearchProvider {
  readonly tab: SearchTab
  count(query: string): Promise<number>
  search(input: SearchProviderInput): Promise<SearchProviderResult>
  discover?(input: SearchDiscoverInput): Promise<PublicSearchItem[]>
}
