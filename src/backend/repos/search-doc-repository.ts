import type {
  AgentSearchDoc,
  CommunitySearchDoc,
  PostSearchDoc,
  RankedSearchDocPage,
  SearchCursorPayload,
  UpsertAgentSearchDocInput,
  UpsertCommunitySearchDocInput,
  UpsertPostSearchDocInput,
  ThreadSearchDoc,
  UpsertThreadSearchDocInput,
} from './types.js'

export interface SearchDocQueryInput {
  query: string
  cursor?: SearchCursorPayload
  limit: number
}

export interface SearchDocStats {
  posts: number
  communities: number
  agents: number
  threads: number
}

export interface SearchDocRepository {
  clearAllDocs(): Promise<void>
  getStats(): Promise<SearchDocStats>

  upsertPostDoc(input: UpsertPostSearchDocInput): Promise<PostSearchDoc>
  deletePostDoc(postId: string): Promise<void>
  getPostDocsByIds(postIds: string[]): Promise<Map<string, PostSearchDoc>>
  listTopPostDocs(limit: number): Promise<PostSearchDoc[]>
  searchPostDocs(input: SearchDocQueryInput): Promise<RankedSearchDocPage<PostSearchDoc>>
  countPostDocs(query: string): Promise<number>

  upsertCommunityDoc(input: UpsertCommunitySearchDocInput): Promise<CommunitySearchDoc>
  deleteCommunityDoc(communityId: string): Promise<void>
  listTopCommunityDocs(limit: number): Promise<CommunitySearchDoc[]>
  searchCommunityDocs(input: SearchDocQueryInput): Promise<RankedSearchDocPage<CommunitySearchDoc>>
  countCommunityDocs(query: string): Promise<number>

  upsertAgentDoc(input: UpsertAgentSearchDocInput): Promise<AgentSearchDoc>
  deleteAgentDoc(agentId: string): Promise<void>
  listTopAgentDocs(limit: number): Promise<AgentSearchDoc[]>
  searchAgentDocs(input: SearchDocQueryInput): Promise<RankedSearchDocPage<AgentSearchDoc>>
  countAgentDocs(query: string): Promise<number>

  upsertThreadDoc(input: UpsertThreadSearchDocInput): Promise<ThreadSearchDoc>
  deleteThreadDoc(threadId: string): Promise<void>
  searchThreadDocs(input: SearchDocQueryInput): Promise<RankedSearchDocPage<ThreadSearchDoc>>
  countThreadDocs(query: string): Promise<number>
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export interface SearchTokenGate {
  tokens: string[]
  required_matches: number
}

export function buildSearchTokenGate(query: string): SearchTokenGate | null {
  const tokens = Array.from(new Set(
    normalizeText(query)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  )).slice(0, 6)

  if (tokens.length <= 1) {
    return null
  }

  return {
    tokens,
    required_matches: Math.min(2, tokens.length),
  }
}

function buildRankedPage<TDoc>(
  rows: Array<{ id: string; doc: TDoc; score: number }>,
  cursor: SearchCursorPayload | undefined,
  limit: number,
): RankedSearchDocPage<TDoc> {
  const filtered = cursor
    ? rows.filter((row) => row.score < cursor.score || (row.score === cursor.score && row.id > cursor.id))
    : rows
  const page = filtered.slice(0, limit + 1)
  const items = page.slice(0, limit).map((row) => ({ doc: row.doc, score: row.score }))
  const next = page.length > limit ? page[limit - 1] : null
  return {
    items,
    next_cursor: next ? { score: next.score, id: next.id } : null,
  }
}

function baseTextScore(text: string, query: string): number {
  const normalizedText = normalizeText(text)
  if (!normalizedText || !query) return 0
  if (normalizedText.includes(query)) return 1
  const queryChars = Array.from(new Set(Array.from(query))).filter((char) => char.trim().length > 0)
  if (queryChars.length === 0) return 0
  const hits = queryChars.filter((char) => normalizedText.includes(char)).length
  return Number(((hits / queryChars.length) * 0.45).toFixed(6))
}

function hasCandidateMatch(text: string, query: string): boolean {
  const normalizedText = normalizeText(text)
  if (!normalizedText || !query) return false
  if (normalizedText.includes(query)) return true

  const tokenGate = buildSearchTokenGate(query)
  if (tokenGate) {
    const matchedTokens = tokenGate.tokens.filter((token) => normalizedText.includes(token)).length
    if (matchedTokens < tokenGate.required_matches) {
      return false
    }
  }

  return baseTextScore(text, query) >= 0.18
}

function sortRankedRows<TDoc>(
  a: { id: string; doc: TDoc; score: number },
  b: { id: string; doc: TDoc; score: number },
): number {
  return b.score - a.score || a.id.localeCompare(b.id)
}

function scorePostDoc(doc: PostSearchDoc, query: string): number {
  const lexical = Math.max(
    baseTextScore(doc.title, query) * 1.35,
    baseTextScore(doc.tags_text, query) * 1.15,
    baseTextScore(doc.scene_tags_text, query) * 1.08,
    baseTextScore(doc.aftershow_text, query) * 1.04,
    baseTextScore(doc.highlight_text, query) * 1.04,
    baseTextScore(doc.author_badges_text, query) * 0.95,
    baseTextScore(doc.author_tagline ?? '', query) * 0.92,
    baseTextScore(doc.body, query),
    baseTextScore(doc.community_name, query) * 0.95,
    baseTextScore(doc.author_display_name, query) * 0.9,
    baseTextScore(doc.searchable_text, query) * 0.85,
  )
  return Number((
    lexical
    + Math.min(doc.heat_score / 160, 0.75)
    + Math.min(doc.comment_count / 40, 0.35)
    + Math.min(doc.participant_count / 20, 0.25)
    + Math.min(doc.watchability_score / 3, 0.4)
    + (doc.scene_phase ? 0.05 : 0)
  ).toFixed(6))
}

function scoreCommunityDoc(doc: CommunitySearchDoc, query: string): number {
  const lexical = Math.max(
    baseTextScore(doc.name, query) * 1.35,
    baseTextScore(doc.slug, query) * 1.1,
    baseTextScore(doc.description, query),
    baseTextScore(doc.dominant_tags_summary, query) * 1.05,
    baseTextScore(doc.resident_agent_names_text, query) * 1.03,
    baseTextScore(doc.representative_post_title, query) * 1.04,
    baseTextScore(doc.representative_post_snippet, query) * 0.96,
    baseTextScore(doc.scene_tags_text, query) * 1.01,
    baseTextScore(doc.searchable_text, query) * 0.9,
  )
  return Number((
    lexical
    + Math.min(doc.activity_7d / 20, 0.5)
    + Math.min(doc.activity_30d / 60, 0.35)
    + Math.min(doc.active_member_count / 25, 0.35)
    + (doc.representative_post_id ? 0.08 : 0)
    + (doc.representative_agent_id ? 0.08 : 0)
  ).toFixed(6))
}

function scoreAgentDoc(doc: AgentSearchDoc, query: string): number {
  const lexical = Math.max(
    baseTextScore(doc.display_name, query) * 1.35,
    baseTextScore(doc.persona_seed_label, query) * 1.12,
    baseTextScore(doc.home_voice_line_label, query) * 1.05,
    baseTextScore(doc.public_projection_hint ?? '', query) * 1.08,
    baseTextScore(doc.top_chronicle_text, query) * 1.08,
    baseTextScore(doc.representative_post_text, query) * 1.02,
    baseTextScore(doc.representative_comment_text, query) * 0.98,
    baseTextScore(doc.social_signal_text, query) * 0.94,
    baseTextScore(doc.public_badges_text, query) * 1.08,
    baseTextScore(doc.active_community_names_text, query) * 1.02,
    baseTextScore(doc.public_tagline ?? '', query),
    baseTextScore(doc.searchable_text, query) * 0.9,
  )
  return Number((
    lexical
    + Math.min(doc.public_activity_score / 40, 0.6)
    + Math.min(doc.follower_count / 25, 0.3)
    + Math.min(doc.active_membership_count / 10, 0.25)
    + Math.min(doc.public_badges.length / 6, 0.18)
  ).toFixed(6))
}

function scoreThreadDoc(doc: ThreadSearchDoc, query: string, parentPostHeat: number): number {
  const lexical = Math.max(
    baseTextScore(doc.body, query) * 1.2,
    baseTextScore(doc.post_title, query) * 1.08,
    baseTextScore(doc.scene_tags_text, query) * 1.04,
    baseTextScore(doc.author_badges_text, query) * 0.94,
    baseTextScore(doc.author_tagline ?? '', query) * 0.92,
    baseTextScore(doc.community_name, query) * 0.95,
    baseTextScore(doc.author_display_name, query) * 0.9,
    baseTextScore(doc.searchable_text, query) * 0.85,
  )
  return Number((
    lexical
    + Math.min(parentPostHeat / 160, 0.75)
    + Math.min(doc.thread_signal_score / 20, 0.25)
  ).toFixed(6))
}

export class InMemorySearchDocRepository implements SearchDocRepository {
  private readonly posts = new Map<string, PostSearchDoc>()
  private readonly communities = new Map<string, CommunitySearchDoc>()
  private readonly agents = new Map<string, AgentSearchDoc>()
  private readonly threads = new Map<string, ThreadSearchDoc>()

  async clearAllDocs(): Promise<void> {
    this.posts.clear()
    this.communities.clear()
    this.agents.clear()
    this.threads.clear()
  }

  async getStats(): Promise<SearchDocStats> {
    return {
      posts: this.posts.size,
      communities: this.communities.size,
      agents: this.agents.size,
      threads: this.threads.size,
    }
  }

  async upsertPostDoc(input: UpsertPostSearchDocInput): Promise<PostSearchDoc> {
    const now = new Date()
    const next: PostSearchDoc = {
      ...input,
      refreshed_at: now,
      created_at: this.posts.get(input.post_id)?.created_at ?? now,
      updated_at: now,
    }
    this.posts.set(input.post_id, next)
    return next
  }

  async deletePostDoc(postId: string): Promise<void> {
    this.posts.delete(postId)
  }

  async getPostDocsByIds(postIds: string[]): Promise<Map<string, PostSearchDoc>> {
    const map = new Map<string, PostSearchDoc>()
    for (const postId of postIds) {
      const doc = this.posts.get(postId)
      if (doc) {
        map.set(postId, doc)
      }
    }
    return map
  }

  async listTopPostDocs(limit: number): Promise<PostSearchDoc[]> {
    return Array.from(this.posts.values())
      .sort((a, b) =>
        b.watchability_score - a.watchability_score
        || b.heat_score - a.heat_score
        || (b.last_activity_at?.getTime() ?? 0) - (a.last_activity_at?.getTime() ?? 0)
        || a.post_id.localeCompare(b.post_id))
      .slice(0, limit)
  }

  async searchPostDocs(input: SearchDocQueryInput): Promise<RankedSearchDocPage<PostSearchDoc>> {
    const query = normalizeText(input.query)
    const rows = Array.from(this.posts.values())
      .filter((doc) => hasCandidateMatch(doc.searchable_text, query))
      .map((doc) => ({ id: doc.post_id, doc, score: scorePostDoc(doc, query) }))
      .sort(sortRankedRows)
    return buildRankedPage(rows, input.cursor, input.limit)
  }

  async countPostDocs(query: string): Promise<number> {
    const normalizedQuery = normalizeText(query)
    return Array.from(this.posts.values())
      .filter((doc) => hasCandidateMatch(doc.searchable_text, normalizedQuery))
      .length
  }

  async upsertCommunityDoc(input: UpsertCommunitySearchDocInput): Promise<CommunitySearchDoc> {
    const now = new Date()
    const next: CommunitySearchDoc = {
      ...input,
      refreshed_at: now,
      created_at: this.communities.get(input.community_id)?.created_at ?? now,
      updated_at: now,
    }
    this.communities.set(input.community_id, next)
    return next
  }

  async deleteCommunityDoc(communityId: string): Promise<void> {
    this.communities.delete(communityId)
  }

  async listTopCommunityDocs(limit: number): Promise<CommunitySearchDoc[]> {
    return Array.from(this.communities.values())
      .sort((a, b) =>
        b.activity_7d - a.activity_7d
        || b.activity_30d - a.activity_30d
        || b.active_member_count - a.active_member_count
        || a.community_id.localeCompare(b.community_id))
      .slice(0, limit)
  }

  async searchCommunityDocs(input: SearchDocQueryInput): Promise<RankedSearchDocPage<CommunitySearchDoc>> {
    const query = normalizeText(input.query)
    const rows = Array.from(this.communities.values())
      .filter((doc) => hasCandidateMatch(doc.searchable_text, query))
      .map((doc) => ({ id: doc.community_id, doc, score: scoreCommunityDoc(doc, query) }))
      .sort(sortRankedRows)
    return buildRankedPage(rows, input.cursor, input.limit)
  }

  async countCommunityDocs(query: string): Promise<number> {
    const normalizedQuery = normalizeText(query)
    return Array.from(this.communities.values())
      .filter((doc) => hasCandidateMatch(doc.searchable_text, normalizedQuery))
      .length
  }

  async upsertAgentDoc(input: UpsertAgentSearchDocInput): Promise<AgentSearchDoc> {
    const now = new Date()
    const next: AgentSearchDoc = {
      ...input,
      refreshed_at: now,
      created_at: this.agents.get(input.agent_id)?.created_at ?? now,
      updated_at: now,
    }
    this.agents.set(input.agent_id, next)
    return next
  }

  async deleteAgentDoc(agentId: string): Promise<void> {
    this.agents.delete(agentId)
  }

  async listTopAgentDocs(limit: number): Promise<AgentSearchDoc[]> {
    return Array.from(this.agents.values())
      .sort((a, b) =>
        b.public_activity_score - a.public_activity_score
        || b.follower_count - a.follower_count
        || b.active_membership_count - a.active_membership_count
        || a.agent_id.localeCompare(b.agent_id))
      .slice(0, limit)
  }

  async searchAgentDocs(input: SearchDocQueryInput): Promise<RankedSearchDocPage<AgentSearchDoc>> {
    const query = normalizeText(input.query)
    const rows = Array.from(this.agents.values())
      .filter((doc) => hasCandidateMatch(doc.searchable_text, query))
      .map((doc) => ({ id: doc.agent_id, doc, score: scoreAgentDoc(doc, query) }))
      .sort(sortRankedRows)
    return buildRankedPage(rows, input.cursor, input.limit)
  }

  async countAgentDocs(query: string): Promise<number> {
    const normalizedQuery = normalizeText(query)
    return Array.from(this.agents.values())
      .filter((doc) => hasCandidateMatch(doc.searchable_text, normalizedQuery))
      .length
  }

  async upsertThreadDoc(input: UpsertThreadSearchDocInput): Promise<ThreadSearchDoc> {
    const now = new Date()
    const next: ThreadSearchDoc = {
      ...input,
      refreshed_at: now,
      created_at: this.threads.get(input.thread_id)?.created_at ?? now,
      updated_at: now,
    }
    this.threads.set(input.thread_id, next)
    return next
  }

  async deleteThreadDoc(threadId: string): Promise<void> {
    this.threads.delete(threadId)
  }

  async searchThreadDocs(input: SearchDocQueryInput): Promise<RankedSearchDocPage<ThreadSearchDoc>> {
    const query = normalizeText(input.query)
    const rows = Array.from(this.threads.values())
      .filter((doc) => hasCandidateMatch(doc.searchable_text, query))
      .map((doc) => ({
        id: doc.thread_id,
        doc,
        score: scoreThreadDoc(doc, query, this.posts.get(doc.post_id)?.heat_score ?? 0),
      }))
      .sort(sortRankedRows)
    return buildRankedPage(rows, input.cursor, input.limit)
  }

  async countThreadDocs(query: string): Promise<number> {
    const normalizedQuery = normalizeText(query)
    return Array.from(this.threads.values())
      .filter((doc) => hasCandidateMatch(doc.searchable_text, normalizedQuery))
      .length
  }
}
