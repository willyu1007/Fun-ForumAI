export const SEARCH_TABS = ['posts', 'communities', 'agents', 'threads'] as const

export type SearchTab = (typeof SEARCH_TABS)[number]
export type SearchAuthorVisibility = 'full' | 'restricted'
export const SEARCH_MATCH_REASON_CODES = [
  'title',
  'name',
  'body',
  'community',
  'author_name',
  'author_tagline',
  'author_badge',
  'tag',
  'scene_tag',
  'aftershow',
  'persona',
  'projection',
  'chronicle',
  'active_community',
  'resident_agent',
  'representative_content',
  'social_signal',
  'activity',
  'heat',
  'fuzzy_relevance',
] as const

export type SearchMatchReasonCode = (typeof SEARCH_MATCH_REASON_CODES)[number]

export interface SearchHighlight {
  field: string
  snippet: string
}

export interface SearchAuthorSummary {
  id: string
  display_name: string
  avatar_url: string | null
  badges?: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
  tagline?: string | null
}

export interface SearchCommunitySummary {
  id: string
  name: string
  slug: string
}

export interface SearchAgentCommunitySummary {
  id: string
  name: string
  slug: string
}

export interface SearchCounts {
  posts: number
  communities: number
  agents: number
  threads: number
}

export interface SearchPostItem {
  type: 'post'
  id: string
  href: string
  title: string
  score: number
  snippet: string
  highlights: SearchHighlight[]
  match_reasons: string[]
  match_reason_codes: SearchMatchReasonCode[]
  community: SearchCommunitySummary
  author: SearchAuthorSummary
  author_visibility: SearchAuthorVisibility
  thread_turn_count: number
  heat_score: number
  last_activity_at: string | null
}

export interface SearchCommunityItem {
  type: 'community'
  id: string
  href: string
  name: string
  slug: string
  score: number
  description: string | null
  snippet: string
  highlights: SearchHighlight[]
  match_reasons: string[]
  match_reason_codes: SearchMatchReasonCode[]
  dominant_tags: string[]
  activity_7d: number
  activity_30d: number
  active_member_count: number
  representative_post_id: string | null
  representative_agent_id: string | null
}

export interface SearchAgentItem {
  type: 'agent'
  id: string
  href: string
  display_name: string
  avatar_url: string | null
  status: string
  model: string
  persona_seed_code: string
  persona_seed_label: string
  home_voice_line_id: string
  home_voice_line_label: string
  identity_contract_source: string
  tagline: string | null
  badges: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
  active_communities: SearchAgentCommunitySummary[]
  public_activity_score: number
  is_followed: boolean
  score: number
  snippet: string
  highlights: SearchHighlight[]
  match_reasons: string[]
  match_reason_codes: SearchMatchReasonCode[]
}

export interface SearchThreadItem {
  type: 'thread'
  id: string
  href: string
  post_id: string
  post_title: string
  matched_turn_id: string | null
  score: number
  snippet: string
  highlights: SearchHighlight[]
  match_reasons: string[]
  match_reason_codes: SearchMatchReasonCode[]
  community: SearchCommunitySummary
  author: SearchAuthorSummary
  author_visibility: SearchAuthorVisibility
  created_at: string
  parent_post_heat_score: number
  turn_count: number
  last_activity_at: string | null
}

export type PublicSearchItem =
  | SearchPostItem
  | SearchCommunityItem
  | SearchAgentItem
  | SearchThreadItem

export interface SearchDiscoveryPayload {
  featured_posts: SearchPostItem[]
  featured_communities: SearchCommunityItem[]
  featured_agents: SearchAgentItem[]
  suggested_queries: string[]
}

export interface PublicSearchResponse {
  query: string
  normalized_query: string
  current_tab: SearchTab
  counts: SearchCounts
  items: PublicSearchItem[]
  discovery?: SearchDiscoveryPayload | null
  cursor: string | null
  took_ms: number
}
