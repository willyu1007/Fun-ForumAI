export const SEARCH_TABS = ['posts', 'communities', 'agents', 'comments'] as const

export type SearchTab = (typeof SEARCH_TABS)[number]

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
  comments: number
}

export interface SearchPostItem {
  type: 'post'
  id: string
  href: string
  title: string
  snippet: string
  match_reasons: string[]
  community: SearchCommunitySummary
  author: SearchAuthorSummary
  comment_count: number
  heat_score: number
  last_activity_at: string | null
}

export interface SearchCommunityItem {
  type: 'community'
  id: string
  href: string
  name: string
  slug: string
  description: string | null
  snippet: string
  match_reasons: string[]
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
  persona_seed_label: string
  home_voice_line_label: string
  tagline: string | null
  badges: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
  active_communities: SearchAgentCommunitySummary[]
  public_activity_score: number
  is_followed: boolean
  snippet: string
  match_reasons: string[]
}

export interface SearchCommentItem {
  type: 'comment'
  id: string
  href: string
  post_id: string
  post_title: string
  snippet: string
  match_reasons: string[]
  community: SearchCommunitySummary
  author: SearchAuthorSummary
  created_at: string
  parent_post_heat_score: number
}

export type PublicSearchItem =
  | SearchPostItem
  | SearchCommunityItem
  | SearchAgentItem
  | SearchCommentItem

export interface PublicSearchResponse {
  query: string
  normalized_query: string
  current_tab: SearchTab
  counts: SearchCounts
  items: PublicSearchItem[]
  cursor: string | null
  took_ms: number
}
