import type { SearchCommunityItem, SearchMatchExplanation } from '../../../shared/public-search.js'
import type { SearchDocRepository } from '../../repos/index.js'
import { buildMatchPresentation, buildPreviewSource, buildSnippet } from './search-snippet.js'
import type {
  SearchDiscoverInput,
  SearchProvider,
  SearchProviderInput,
  SearchProviderResult,
} from './search-provider.js'

function extractDominantTags(summary: string, sceneTags: string): string[] {
  return `${summary} ${sceneTags}`
    .split(/[、,，·]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 6)
}

function mergeExplanations(
  base: SearchMatchExplanation[],
  extras: SearchMatchExplanation[],
): SearchMatchExplanation[] {
  return Array.from(new Map(
    [...base, ...extras].map((item) => [`${item.code}:${item.label}:${item.kind}:${item.chip ?? ''}`, item]),
  ).values()).slice(0, 4)
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
      sort: input.sort,
      since: input.since,
    })

    const items: SearchCommunityItem[] = hits.items.map((hit) => this.buildItem(hit.doc, input.query, hit.score))

    return {
      items,
      next_cursor: hits.next_cursor,
    }
  }

  async discover(input: SearchDiscoverInput): Promise<SearchCommunityItem[]> {
    const docs = await this.deps.searchDocRepo.listTopCommunityDocs(input.limit)
    return docs.map((doc) => this.buildItem(doc, '', Number((doc.activity_7d + doc.activity_30d / 10 + doc.active_member_count / 10).toFixed(4))))
  }

  private buildItem(hitDoc: Awaited<ReturnType<SearchDocRepository['searchCommunityDocs']>>['items'][number]['doc'], query: string, score: number): SearchCommunityItem {
    const snippetSource = buildPreviewSource([
      hitDoc.representative_post_snippet,
      hitDoc.description,
      hitDoc.dominant_tags_summary,
      hitDoc.resident_agent_names_text,
    ])
    const presentation = buildMatchPresentation(query, [
      { reason: '命中社区名', code: 'name', field: 'name', value: hitDoc.name },
      { reason: '命中社区家族', code: 'community_family', kind: 'semantic', chip: hitDoc.community_family ?? undefined, field: 'community_family', value: hitDoc.community_family },
      { reason: '命中氛围摘要', code: 'activity', field: 'dominant_tags', value: hitDoc.dominant_tags_summary },
      { reason: '命中常驻角色', code: 'resident_agent', field: 'resident_agents', value: hitDoc.resident_agent_names_text },
      { reason: '命中代表内容', code: 'representative_content', field: 'representative_content', value: `${hitDoc.representative_post_title} ${hitDoc.representative_post_snippet}` },
      { reason: '命中场景标签', code: 'scene_tag', field: 'scene_tags', value: hitDoc.scene_tags_text },
    ], { fallback_text: snippetSource })
    const matchExplanations = mergeExplanations(
      presentation.match_explanations,
      [
        ...(hitDoc.activity_7d >= 5
          ? [{ code: 'activity' as const, label: '命中近期热度', kind: 'social' as const, chip: '本周活跃' }]
          : []),
      ],
    )
    return {
      type: 'community',
      id: hitDoc.community_id,
      href: `/c/${hitDoc.slug}`,
      name: hitDoc.name,
      slug: hitDoc.slug,
      ...(hitDoc.community_family ? { community_family: hitDoc.community_family } : {}),
      ...(hitDoc.community_shell_category ? { community_shell_category: hitDoc.community_shell_category } : {}),
      ...(hitDoc.publication_review_profile_id ? { publication_review_profile_id: hitDoc.publication_review_profile_id } : {}),
      score,
      description: hitDoc.description,
      snippet: buildSnippet(snippetSource, query),
      highlights: presentation.highlights,
      match_explanations: matchExplanations,
      match_reasons: matchExplanations.map((item) => item.label),
      match_reason_codes: matchExplanations.map((item) => item.code),
      dominant_tags: extractDominantTags(hitDoc.dominant_tags_summary, hitDoc.scene_tags_text),
      activity_7d: hitDoc.activity_7d,
      activity_30d: hitDoc.activity_30d,
      active_member_count: hitDoc.active_member_count,
      representative_post_id: hitDoc.representative_post_id,
      representative_agent_id: hitDoc.representative_agent_id,
    }
  }
}
