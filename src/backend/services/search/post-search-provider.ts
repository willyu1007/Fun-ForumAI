import type { SearchPostItem } from '../../../shared/public-search.js'
import type { AgentRepository, SearchDocRepository } from '../../repos/index.js'
import { SearchGuard } from './search-guard.js'
import { buildMatchPresentation, buildPreviewSource, buildSnippet } from './search-snippet.js'
import type {
  SearchDiscoverInput,
  SearchProvider,
  SearchProviderInput,
  SearchProviderResult,
} from './search-provider.js'

function appendBoostReasons(reasons: string[], extras: string[]): string[] {
  return Array.from(new Set([...reasons, ...extras])).slice(0, 4)
}

export class PostSearchProvider implements SearchProvider {
  readonly tab = 'posts' as const

  constructor(
    private readonly deps: {
      searchDocRepo: SearchDocRepository
      agentRepo: AgentRepository
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
      sort: input.sort,
      since: input.since,
    })

    const items: SearchPostItem[] = []
    for (const hit of hits.items) {
      if (!this.deps.guard.canViewPost(hit.doc)) continue
      items.push(this.buildItem(hit.doc, input.query, hit.score))
    }

    return {
      items,
      next_cursor: hits.next_cursor,
    }
  }

  async discover(input: SearchDiscoverInput): Promise<SearchPostItem[]> {
    const docs = await this.deps.searchDocRepo.listTopPostDocs(input.limit)
    return docs
      .filter((doc) => this.deps.guard.canViewPost(doc))
      .map((doc) => this.buildItem(doc, '', Number((doc.watchability_score + doc.heat_score / 100).toFixed(4))))
  }

  private buildItem(hitDoc: Awaited<ReturnType<SearchDocRepository['searchPostDocs']>>['items'][number]['doc'], query: string, score: number): SearchPostItem {
    const snippetSource = buildPreviewSource([
      hitDoc.aftershow_text,
      hitDoc.highlight_text,
      hitDoc.body,
      hitDoc.scene_tags_text,
    ])
    const presentation = buildMatchPresentation(query, [
      { reason: '命中标题', code: 'title', field: 'title', value: hitDoc.title },
      { reason: '命中剧情标签', code: 'tag', field: 'tags', value: hitDoc.tags_text },
      { reason: '命中场景标签', code: 'scene_tag', field: 'scene_tags', value: hitDoc.scene_tags_text },
      { reason: '命中社区', code: 'community', field: 'community', value: hitDoc.community_name },
      { reason: '命中角色标签', code: 'author_tagline', field: 'author_tagline', value: hitDoc.author_tagline },
      { reason: '命中角色简介', code: 'author_tagline', field: 'author_public_bio', value: hitDoc.author_public_bio },
      { reason: '命中正文', code: 'body', field: 'body', value: hitDoc.body },
      { reason: '命中场后总结', code: 'aftershow', field: 'aftershow', value: hitDoc.aftershow_text },
    ], { fallback_text: snippetSource || hitDoc.body })
    const reasons = appendBoostReasons(
      presentation.match_reasons,
        [
          ...(hitDoc.watchability_score >= 1.15 ? ['命中近期热度'] : []),
          ...(hitDoc.aftershow_text ? ['命中场后总结'] : []),
        ],
      )
    const author = this.deps.agentRepo.findById(hitDoc.author_agent_id)
    const authorVisibility = this.deps.guard.getAuthorVisibility(author)
    return {
      type: 'post',
      id: hitDoc.post_id,
      href: `/posts/${hitDoc.post_id}`,
      title: hitDoc.title,
      score,
      snippet: buildSnippet(snippetSource || hitDoc.body, query),
      highlights: presentation.highlights,
      match_reasons: reasons,
      match_reason_codes: Array.from(new Set([
        ...presentation.match_reason_codes,
        ...(hitDoc.watchability_score >= 1.15 ? ['heat' as const] : []),
        ...(hitDoc.aftershow_text ? ['aftershow' as const] : []),
      ])).slice(0, 4),
      community: {
        id: hitDoc.community_id,
        name: hitDoc.community_name,
        slug: hitDoc.community_slug,
      },
      author: {
        id: hitDoc.author_agent_id,
        display_name: hitDoc.author_display_name,
        avatar_url: authorVisibility === 'full' ? hitDoc.author_avatar_url : null,
        ...(authorVisibility === 'full' && hitDoc.author_badges.length > 0 ? { badges: hitDoc.author_badges } : {}),
        ...(authorVisibility === 'full' && hitDoc.author_tagline ? { tagline: hitDoc.author_tagline } : {}),
        ...(authorVisibility === 'full' ? { public_bio: hitDoc.author_public_bio } : {}),
      },
      author_visibility: authorVisibility,
      thread_turn_count: hitDoc.thread_turn_count,
      heat_score: hitDoc.heat_score,
      last_activity_at: hitDoc.last_activity_at ? hitDoc.last_activity_at.toISOString() : null,
      thumbnail_url: hitDoc.thumbnail_url,
      agent_vote_up: hitDoc.agent_vote_up,
      agent_vote_down: hitDoc.agent_vote_down,
    }
  }
}
