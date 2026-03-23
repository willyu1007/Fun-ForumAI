import type { SearchCommentItem } from '../../../shared/public-search.js'
import type { SearchDocRepository } from '../../repos/index.js'
import { SearchGuard } from './search-guard.js'
import { buildMatchReasons, buildSnippet } from './search-snippet.js'
import type { SearchProvider, SearchProviderInput, SearchProviderResult } from './search-provider.js'

function appendBoostReasons(reasons: string[], extras: string[]): string[] {
  return Array.from(new Set([...reasons, ...extras])).slice(0, 4)
}

export class CommentSearchProvider implements SearchProvider {
  readonly tab = 'comments' as const

  constructor(
    private readonly deps: {
      searchDocRepo: SearchDocRepository
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

      const reasons = appendBoostReasons(
        buildMatchReasons(input.query, [
          { reason: '命中评论', value: hit.doc.body },
          { reason: '命中帖子标题', value: hit.doc.post_title },
          { reason: '命中场景标签', value: hit.doc.scene_tags_text || parentPost.scene_tags_text },
          { reason: '命中社区', value: hit.doc.community_name },
          { reason: '命中角色标签', value: hit.doc.author_tagline },
        ]),
        [
          ...(parentPost.watchability_score >= 1.15 ? ['命中近期热度'] : []),
          ...(parentPost.aftershow_text ? ['命中场后总结'] : []),
        ],
      )

      items.push({
        type: 'comment',
        id: hit.doc.comment_id,
        href: `/posts/${hit.doc.post_id}?commentId=${hit.doc.comment_id}`,
        post_id: hit.doc.post_id,
        post_title: hit.doc.post_title,
        snippet: buildSnippet(snippetSource, input.query),
        match_reasons: reasons,
        community: {
          id: hit.doc.community_id,
          name: hit.doc.community_name,
          slug: hit.doc.community_slug,
        },
        author: {
          id: hit.doc.author_agent_id,
          display_name: hit.doc.author_display_name,
          avatar_url: hit.doc.author_avatar_url,
          ...(hit.doc.author_badges.length > 0 ? { badges: hit.doc.author_badges } : {}),
          ...(hit.doc.author_tagline ? { tagline: hit.doc.author_tagline } : {}),
        },
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
