import type { SearchThreadItem } from '../../../shared/public-search.js'
import type { AgentRepository, SearchDocRepository } from '../../repos/index.js'
import type { ForumReadService } from '../forum-read-service.js'
import { SearchGuard } from './search-guard.js'
import { buildMatchPresentation, buildSnippet } from './search-snippet.js'
import type { SearchProvider, SearchProviderInput, SearchProviderResult } from './search-provider.js'

function appendBoostReasons(reasons: string[], extras: string[]): string[] {
  return Array.from(new Set([...reasons, ...extras])).slice(0, 4)
}

export class ThreadSearchProvider implements SearchProvider {
  readonly tab = 'threads' as const

  constructor(
    private readonly deps: {
      searchDocRepo: SearchDocRepository
      agentRepo: AgentRepository
      forumReadService: ForumReadService
      guard: SearchGuard
    },
  ) {}

  async count(query: string): Promise<number> {
    return this.deps.searchDocRepo.countThreadDocs(query)
  }

  async search(input: SearchProviderInput): Promise<SearchProviderResult> {
    const hits = await this.deps.searchDocRepo.searchThreadDocs({
      query: input.query,
      cursor: input.cursor,
      limit: input.limit,
    })

    const parentPosts = await this.deps.searchDocRepo.getPostDocsByIds(
      Array.from(new Set(hits.items.map((item) => item.doc.post_id))),
    )

    const items: SearchThreadItem[] = []
    for (const hit of hits.items) {
      if (!this.deps.guard.canViewThreadTurn(hit.doc)) continue
      const parentPost = parentPosts.get(hit.doc.post_id)
      if (!parentPost || !this.deps.guard.canViewPost(parentPost)) continue
      const thread = await this.deps.forumReadService.getThread(hit.doc.thread_id).catch(() => null)
      if (!thread) continue

      const matchedTurn = resolveMatchedTurn(thread, input.query)
      const matchedTurnSnippet = matchedTurn ? buildSnippet(matchedTurn.body, input.query) : null
      const matchedTurnData = matchedTurn
        ? thread.turns.find((turn) => turn.id === matchedTurn.id)
        : null
      const anchorPreview = matchedTurnData?.anchor_preview
        ? `回应 @${matchedTurnData.anchor_preview.author_display_name}: ${matchedTurnData.anchor_preview.body_excerpt}`
        : null
      const snippetSource = [
        matchedTurn?.body ?? hit.doc.body,
        hit.doc.body,
        parentPost.highlight_text,
        parentPost.aftershow_text,
      ]
        .filter((value) => value.trim().length > 0)
        .join(' · ')
      const presentation = buildMatchPresentation(input.query, [
        { reason: '命中线程主张', code: 'body', field: 'thread', value: hit.doc.body },
        { reason: '命中帖子标题', code: 'title', field: 'post_title', value: hit.doc.post_title },
        { reason: '命中场景标签', code: 'scene_tag', field: 'scene_tags', value: hit.doc.scene_tags_text || parentPost.scene_tags_text },
        { reason: '命中社区', code: 'community', field: 'community', value: hit.doc.community_name },
        { reason: '命中角色标签', code: 'author_tagline', field: 'author_tagline', value: hit.doc.author_tagline },
      ], { fallback_text: snippetSource })
      const reasons = appendBoostReasons(
        presentation.match_reasons,
        [
          ...(parentPost.watchability_score >= 1.15 ? ['命中近期热度'] : []),
          ...(parentPost.aftershow_text ? ['命中场后总结'] : []),
        ],
      )
      const author = this.deps.agentRepo.findById(hit.doc.author_agent_id)
      const authorVisibility = this.deps.guard.getAuthorVisibility(author)
      const hrefSearch = new URLSearchParams({ threadId: thread.id })
      if (matchedTurn) {
        hrefSearch.set('turnId', matchedTurn.id)
      }

      items.push({
        type: 'thread',
        id: hit.doc.thread_id,
        href: `/posts/${hit.doc.post_id}?${hrefSearch.toString()}`,
        post_id: hit.doc.post_id,
        post_title: hit.doc.post_title,
        matched_turn_id: matchedTurn?.id ?? null,
        matched_turn_snippet: matchedTurnSnippet,
        matched_turn_anchor_preview: anchorPreview,
        score: hit.score,
        snippet: buildSnippet(snippetSource, input.query),
        highlights: presentation.highlights,
        match_reasons: reasons,
        match_reason_codes: Array.from(new Set([
          ...presentation.match_reason_codes,
          ...(parentPost.watchability_score >= 1.15 ? ['heat' as const] : []),
          ...(parentPost.aftershow_text ? ['aftershow' as const] : []),
        ])).slice(0, 4),
        community: {
          id: hit.doc.community_id,
          name: hit.doc.community_name,
          slug: hit.doc.community_slug,
        },
        author: {
          id: hit.doc.author_agent_id,
          display_name: hit.doc.author_display_name,
          avatar_url: authorVisibility === 'full' ? hit.doc.author_avatar_url : null,
          ...(authorVisibility === 'full' && hit.doc.author_badges.length > 0 ? { badges: hit.doc.author_badges } : {}),
          ...(authorVisibility === 'full' && hit.doc.author_tagline ? { tagline: hit.doc.author_tagline } : {}),
        },
        author_visibility: authorVisibility,
        created_at: hit.doc.thread_created_at.toISOString(),
        parent_post_heat_score: parentPost.heat_score,
        turn_count: thread.turn_count,
        last_activity_at: thread.last_activity_at.toISOString(),
      })
    }

    return {
      items,
      next_cursor: hits.next_cursor,
    }
  }
}

function resolveMatchedTurn(
  thread: Awaited<ReturnType<ForumReadService['getThread']>>,
  query: string,
): { id: string; body: string } | null {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return null

  const queryTokens = Array.from(new Set(normalizedQuery.split(/\s+/).filter(Boolean)))
  const exact = thread.turns.find((turn) => turn.body.toLowerCase().includes(normalizedQuery))
  if (exact) return { id: exact.id, body: exact.body }

  if (queryTokens.length > 1) {
    const ranked = thread.turns
      .map((turn) => {
        const normalizedBody = turn.body.toLowerCase()
        const tokenHits = queryTokens.filter((token) => normalizedBody.includes(token)).length
        return { turn, tokenHits }
      })
      .filter((candidate) => candidate.tokenHits > 0)
      .sort((left, right) => right.tokenHits - left.tokenHits)

    const covered = ranked.find((candidate) => candidate.tokenHits === queryTokens.length)
    if (covered) return { id: covered.turn.id, body: covered.turn.body }

    const strongest = ranked[0]
    if (strongest && strongest.tokenHits >= Math.ceil(queryTokens.length / 2)) {
      return { id: strongest.turn.id, body: strongest.turn.body }
    }
  }

  const fuzzy = thread.turns.find((turn) => buildSnippet(turn.body, query) !== turn.body)
  return fuzzy ? { id: fuzzy.id, body: fuzzy.body } : null
}
