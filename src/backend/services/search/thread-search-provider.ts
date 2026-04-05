import type { SearchMatchExplanation, SearchThreadItem } from '../../../shared/public-search.js'
import type { AgentConfigRepository, AgentRepository, SearchDocRepository } from '../../repos/index.js'
import { buildAgentPublicAuthorPresentation } from '../../identity/public-author-presentation.js'
import type { ForumReadService } from '../forum-read-service.js'
import { SearchGuard } from './search-guard.js'
import { buildMatchPresentation, buildPreviewSource, buildSnippet } from './search-snippet.js'
import type { SearchProvider, SearchProviderInput, SearchProviderResult } from './search-provider.js'

function mergeExplanations(
  base: SearchMatchExplanation[],
  extras: SearchMatchExplanation[],
): SearchMatchExplanation[] {
  return Array.from(new Map(
    [...base, ...extras].map((item) => [`${item.code}:${item.label}:${item.kind}:${item.chip ?? ''}`, item]),
  ).values()).slice(0, 4)
}

export class ThreadSearchProvider implements SearchProvider {
  readonly tab = 'threads' as const

  constructor(
    private readonly deps: {
      searchDocRepo: SearchDocRepository
      agentRepo: AgentRepository
      agentConfigRepo: AgentConfigRepository
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
      sort: input.sort,
      since: input.since,
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
      const snippetSource = buildPreviewSource([
        matchedTurn?.body ?? hit.doc.body,
        hit.doc.body,
        parentPost.highlight_text,
        parentPost.aftershow_text,
      ])
      const presentation = buildMatchPresentation(input.query, [
        { reason: '命中线程主张', code: 'body', field: 'thread', value: hit.doc.body },
        { reason: '命中帖子标题', code: 'title', field: 'post_title', value: hit.doc.post_title },
        { reason: '命中场景标签', code: 'scene_tag', field: 'scene_tags', value: hit.doc.scene_tags_text || parentPost.scene_tags_text },
        { reason: '命中社区', code: 'community', field: 'community', value: hit.doc.community_name },
        { reason: '命中社区家族', code: 'community_family', kind: 'semantic', chip: hit.doc.community_family ?? undefined, field: 'community_family', value: hit.doc.community_family },
        { reason: '命中身份角色', code: 'author_identity_role', kind: 'identity', chip: hit.doc.author_identity_role_id ?? undefined, field: 'author_identity', value: hit.doc.author_identity_text },
        { reason: '命中公域投射', code: 'author_public_projection', kind: 'projection', field: 'author_tagline', value: hit.doc.author_tagline },
        { reason: '命中公域投射', code: 'author_public_projection', kind: 'projection', field: 'author_public_bio', value: hit.doc.author_public_bio },
        { reason: '命中内容类型', code: 'content_kind', kind: 'semantic', chip: hit.doc.content_kind ?? undefined, field: 'content_kind', value: hit.doc.content_kind },
        { reason: '命中模板语义', code: 'note_template', kind: 'semantic', chip: hit.doc.note_template_id ?? undefined, field: 'note_template', value: hit.doc.note_template_id },
        { reason: '命中剧情状态', code: 'storyline_state', kind: 'semantic', chip: hit.doc.storyline_state ?? undefined, field: 'storyline_state', value: hit.doc.storyline_state },
        { reason: '命中成就证明', code: 'author_achievement_badge', kind: 'proof', field: 'author_achievement_badges', value: hit.doc.author_achievement_badges_text },
      ], { fallback_text: snippetSource })
      const matchExplanations = mergeExplanations(
        presentation.match_explanations,
        [
          ...(parentPost.watchability_score >= 1.15
            ? [{ code: 'heat' as const, label: '命中近期热度', kind: 'social' as const, chip: '近期热度' }]
            : []),
        ],
      )
      const author = hit.doc.author_actor_type === 'agent' && hit.doc.author_agent_id
        ? this.deps.agentRepo.findById(hit.doc.author_agent_id)
        : null
      const authorVisibility = hit.doc.author_actor_type === 'agent'
        ? this.deps.guard.getAuthorVisibility(author)
        : 'full'
      const latestConfig = hit.doc.author_actor_type === 'agent' && hit.doc.author_agent_id
        ? this.deps.agentConfigRepo.findLatest(hit.doc.author_agent_id)
        : null
      const authorPresentation = hit.doc.author_actor_type === 'agent' && hit.doc.author_agent_id
        ? buildAgentPublicAuthorPresentation({
            agent: {
              id: hit.doc.author_agent_id,
              display_name: hit.doc.author_display_name,
              avatar_url: hit.doc.author_avatar_url,
              created_at: author?.created_at ?? null,
            },
            latest_config: latestConfig,
            tagline: hit.doc.author_tagline,
            public_bio: hit.doc.author_public_bio,
            badges: hit.doc.author_badges,
          })
        : null
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
        match_explanations: matchExplanations,
        match_reasons: matchExplanations.map((item) => item.label),
        match_reason_codes: matchExplanations.map((item) => item.code),
        community: {
          id: hit.doc.community_id,
          name: hit.doc.community_name,
          slug: hit.doc.community_slug,
          ...(hit.doc.community_family ? { community_family: hit.doc.community_family } : {}),
          ...(hit.doc.community_shell_category ? { community_shell_category: hit.doc.community_shell_category } : {}),
          ...(hit.doc.publication_review_profile_id ? { publication_review_profile_id: hit.doc.publication_review_profile_id } : {}),
        },
        author: hit.doc.author_actor_type === 'agent' && hit.doc.author_agent_id && authorPresentation
          ? {
              id: hit.doc.author_agent_id,
              actor_type: 'agent',
              display_name: hit.doc.author_display_name,
              avatar_url: authorVisibility === 'full' ? authorPresentation.avatar_url : null,
              ...(authorVisibility === 'full'
                ? {
                    agent_kind: authorPresentation.agent_kind,
                    public_identity: authorPresentation.public_identity,
                    public_projection: authorPresentation.public_projection,
                    public_proof: authorPresentation.public_proof,
                    system_identity: authorPresentation.system_identity,
                    surface_access: authorPresentation.surface_access,
                    display_badges: authorPresentation.display_badges,
                    ...(authorPresentation.badges ? { badges: authorPresentation.badges } : {}),
                    ...(authorPresentation.tagline ? { tagline: authorPresentation.tagline } : {}),
                    ...(authorPresentation.public_bio !== undefined ? { public_bio: authorPresentation.public_bio } : {}),
                  }
                : {}),
            }
          : {
              id: hit.doc.author_user_id ?? hit.doc.thread_id,
              actor_type: 'human',
              display_name: hit.doc.author_display_name,
              avatar_url: hit.doc.author_avatar_url,
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
