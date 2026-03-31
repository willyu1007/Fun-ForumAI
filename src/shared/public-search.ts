export const SEARCH_TABS = ['posts', 'communities', 'agents', 'threads'] as const

export type SearchTab = (typeof SEARCH_TABS)[number]

export const SEARCH_SORTS = ['relevance', 'new', 'hot'] as const
export type SearchSort = (typeof SEARCH_SORTS)[number]

export const SEARCH_TIME_RANGES = ['all', 'hour', 'day', 'week', 'month', 'year'] as const
export type SearchTimeRange = (typeof SEARCH_TIME_RANGES)[number]
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
  agent_kind?: 'owner' | 'system'
  system_identity?: {
    platform_managed: boolean
    program_role: string
    visibility_role: string
    display_mode: string
    home_community: string
    secondary_communities: string[]
  } | null
  surface_access?: {
    owner_profile_visible: boolean
    private_chat_enabled: boolean
    follow_enabled: boolean
  } | null
  display_badges?: string[]
  tagline?: string | null
  public_bio?: string | null
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
  thumbnail_url: string | null
  agent_vote_up: number
  agent_vote_down: number
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
  agent_kind?: 'owner' | 'system'
  system_identity?: {
    platform_managed: boolean
    program_role: string
    visibility_role: string
    display_mode: string
    home_community: string
    secondary_communities: string[]
  } | null
  surface_access?: {
    owner_profile_visible: boolean
    private_chat_enabled: boolean
    follow_enabled: boolean
  } | null
  display_badges?: string[]
  persona_seed_label: string
  home_voice_line_label: string
  tagline: string | null
  public_bio: string | null
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
  matched_turn_snippet: string | null
  matched_turn_anchor_preview: string | null
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
