import type { SearchPostItem } from '../../../shared/public-search.js'
import type { SearchDocRepository } from '../../repos/search-doc-repository.js'
import { SearchGuard } from './search-guard.js'
import { buildMatchReasons, buildSnippet } from './search-snippet.js'
import type { SearchProvider, SearchProviderInput, SearchProviderResult } from './search-provider.js'

function appendBoostReasons(reasons: string[], extras: string[]): string[] {
  return Array.from(new Set([...reasons, ...extras])).slice(0, 4)
}

export class PostSearchProvider implements SearchProvider {
  readonly tab = 'posts' as const

  constructor(
    private readonly deps: {
      searchDocRepo: SearchDocRepository
      guard: SearchGuard
    },
  ) {}

  async count(query: string): Promise<number> {
    return this.deps.searchDocRepo.countPostDocs(query)
  }

  async search(input: SearchProviderInput): Promise<SearchProviderResult> {
    const hits = await this.deps.searchDocRepo.searchPostDocs({
      query: input.query,
      cursor: input.cursor,
      limit: input.limit,
    })

    const items: SearchPostItem[] = []
    for (const hit of hits.items) {
      if (!this.deps.guard.canViewPost(hit.doc)) continue

      const snippetSource = [
        hit.doc.aftershow_text,
        hit.doc.highlight_text,
        hit.doc.body,
        hit.doc.scene_tags_text,
      ]
        .filter((value) => value.trim().length > 0)
        .join(' · ')

      const reasons = appendBoostReasons(
        buildMatchReasons(input.query, [
          { reason: '命中标题', value: hit.doc.title },
          { reason: '命中剧情标签', value: hit.doc.tags_text },
          { reason: '命中场景标签', value: hit.doc.scene_tags_text },
          { reason: '命中社区', value: hit.doc.community_name },
          { reason: '命中角色标签', value: hit.doc.author_tagline },
          { reason: '命中正文', value: hit.doc.body },
        ]),
        [
          ...(hit.doc.watchability_score >= 1.15 ? ['命中近期热度'] : []),
          ...(hit.doc.aftershow_text ? ['命中场后总结'] : []),
        ],
      )

      items.push({
        type: 'post',
        id: hit.doc.post_id,
        href: `/posts/${hit.doc.post_id}`,
        title: hit.doc.title,
        snippet: buildSnippet(snippetSource || hit.doc.body, input.query),
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
        comment_count: hit.doc.comment_count,
        heat_score: hit.doc.heat_score,
        last_activity_at: hit.doc.last_activity_at ? hit.doc.last_activity_at.toISOString() : null,
      })
    }

    return {
      items,
      next_cursor: hits.next_cursor,
    }
  }
}
