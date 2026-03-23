import type { SearchCommunityItem } from '../../../shared/public-search.js'
import type { SearchDocRepository } from '../../repos/index.js'
import { buildMatchReasons, buildSnippet } from './search-snippet.js'
import type { SearchProvider, SearchProviderInput, SearchProviderResult } from './search-provider.js'

function extractDominantTags(summary: string, sceneTags: string): string[] {
  return `${summary} ${sceneTags}`
    .split(/[、,，·]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 6)
}

function appendBoostReasons(reasons: string[], extras: string[]): string[] {
  return Array.from(new Set([...reasons, ...extras])).slice(0, 4)
}

export class CommunitySearchProvider implements SearchProvider {
  readonly tab = 'communities' as const

  constructor(
    private readonly deps: {
      searchDocRepo: SearchDocRepository
    },
  ) {}

  async count(query: string): Promise<number> {
    return this.deps.searchDocRepo.countCommunityDocs(query)
  }

  async search(input: SearchProviderInput): Promise<SearchProviderResult> {
    const hits = await this.deps.searchDocRepo.searchCommunityDocs({
      query: input.query,
      cursor: input.cursor,
      limit: input.limit,
    })

    const items: SearchCommunityItem[] = hits.items.map((hit) => ({
      type: 'community',
      id: hit.doc.community_id,
      href: `/c/${hit.doc.slug}`,
      name: hit.doc.name,
      slug: hit.doc.slug,
      description: hit.doc.description,
      snippet: buildSnippet(
        [
          hit.doc.representative_post_snippet,
          hit.doc.description,
          hit.doc.dominant_tags_summary,
          hit.doc.resident_agent_names_text,
        ]
          .filter((value) => value.trim().length > 0)
          .join(' · '),
        input.query,
      ),
      match_reasons: appendBoostReasons(
        buildMatchReasons(input.query, [
          { reason: '命中社区名', value: hit.doc.name },
          { reason: '命中氛围摘要', value: hit.doc.dominant_tags_summary },
          { reason: '命中常驻角色', value: hit.doc.resident_agent_names_text },
          { reason: '命中代表内容', value: `${hit.doc.representative_post_title} ${hit.doc.representative_post_snippet}` },
          { reason: '命中场景标签', value: hit.doc.scene_tags_text },
        ]),
        [
          ...(hit.doc.activity_7d >= 5 ? ['命中近期热度'] : []),
        ],
      ),
      dominant_tags: extractDominantTags(hit.doc.dominant_tags_summary, hit.doc.scene_tags_text),
      activity_7d: hit.doc.activity_7d,
      activity_30d: hit.doc.activity_30d,
      active_member_count: hit.doc.active_member_count,
      representative_post_id: hit.doc.representative_post_id,
      representative_agent_id: hit.doc.representative_agent_id,
    }))

    return {
      items,
      next_cursor: hits.next_cursor,
    }
  }
}
