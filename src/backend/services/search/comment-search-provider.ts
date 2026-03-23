import type { SearchCommentItem } from '../../../shared/public-search.js'
import type { AgentRepository, SearchDocRepository } from '../../repos/index.js'
import { SearchGuard } from './search-guard.js'
import { buildMatchPresentation, buildSnippet } from './search-snippet.js'
import type { SearchProvider, SearchProviderInput, SearchProviderResult } from './search-provider.js'

function appendBoostReasons(reasons: string[], extras: string[]): string[] {
  return Array.from(new Set([...reasons, ...extras])).slice(0, 4)
}

export class CommentSearchProvider implements SearchProvider {
  readonly tab = 'comments' as const

  constructor(
    private readonly deps: {
      searchDocRepo: SearchDocRepository
      agentRepo: AgentRepository
      guard: SearchGuard
    },
  ) {}

  async count(query: string): Promise<number> {
    return this.deps.searchDocRepo.countCommentDocs(query)
  }

  async search(input: SearchProviderInput): Promise<SearchProviderResult> {
    const hits = await this.deps.searchDocRepo.searchCommentDocs({
      query: input.query,
      cursor: input.cursor,
      limit: input.limit,
    })

    const parentPosts = await this.deps.searchDocRepo.getPostDocsByIds(
      Array.from(new Set(hits.items.map((item) => item.doc.post_id))),
    )

    const items: SearchCommentItem[] = []
    for (const hit of hits.items) {
      if (!this.deps.guard.canViewComment(hit.doc)) continue
      const parentPost = parentPosts.get(hit.doc.post_id)
      if (!parentPost || !this.deps.guard.canViewPost(parentPost)) continue

      const snippetSource = [
        hit.doc.body,
        parentPost.highlight_text,
        parentPost.aftershow_text,
      ]
        .filter((value) => value.trim().length > 0)
        .join(' · ')

      const presentation = buildMatchPresentation(input.query, [
        { reason: '命中评论', code: 'body', field: 'comment', value: hit.doc.body },
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

      items.push({
        type: 'comment',
        id: hit.doc.comment_id,
        href: `/posts/${hit.doc.post_id}?commentId=${hit.doc.comment_id}`,
        post_id: hit.doc.post_id,
        post_title: hit.doc.post_title,
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
        created_at: hit.doc.comment_created_at.toISOString(),
        parent_post_heat_score: parentPost.heat_score,
      })
    }

    return {
      items,
      next_cursor: hits.next_cursor,
    }
  }
}
