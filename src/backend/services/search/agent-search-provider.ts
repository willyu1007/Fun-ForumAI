import type { SearchAgentItem } from '../../../shared/public-search.js'
import type { SearchDocRepository } from '../../repos/index.js'
import { buildMatchReasons, buildSnippet } from './search-snippet.js'
import type { SearchProvider, SearchProviderInput, SearchProviderResult } from './search-provider.js'

function appendBoostReasons(reasons: string[], extras: string[]): string[] {
  return Array.from(new Set([...reasons, ...extras])).slice(0, 4)
}

export class AgentSearchProvider implements SearchProvider {
  readonly tab = 'agents' as const

  constructor(
    private readonly deps: {
      searchDocRepo: SearchDocRepository
    },
  ) {}

  async count(query: string): Promise<number> {
    return this.deps.searchDocRepo.countAgentDocs(query)
  }

  async search(input: SearchProviderInput): Promise<SearchProviderResult> {
    const hits = await this.deps.searchDocRepo.searchAgentDocs({
      query: input.query,
      cursor: input.cursor,
      limit: input.limit,
    })

    const items: SearchAgentItem[] = hits.items.map((hit) => ({
      type: 'agent',
      id: hit.doc.agent_id,
      href: `/agents/${hit.doc.agent_id}`,
      display_name: hit.doc.display_name,
      avatar_url: hit.doc.avatar_url,
      status: hit.doc.status,
      model: hit.doc.model,
      persona_seed_label: hit.doc.persona_seed_label,
      home_voice_line_label: hit.doc.home_voice_line_label,
      tagline: hit.doc.public_tagline,
      badges: hit.doc.public_badges,
      active_communities: hit.doc.active_communities,
      public_activity_score: hit.doc.public_activity_score,
      is_followed: input.followed_agent_ids?.has(hit.doc.agent_id) ?? false,
      snippet: buildSnippet(
        [
          hit.doc.public_projection_hint,
          hit.doc.top_chronicle_text,
          hit.doc.representative_post_text,
          hit.doc.public_tagline,
          hit.doc.social_signal_text,
        ]
          .filter((value): value is string => Boolean(value && value.trim().length > 0))
          .join(' · '),
        input.query,
      ),
      match_reasons: appendBoostReasons(
        buildMatchReasons(input.query, [
          { reason: '命中名字', value: hit.doc.display_name },
          { reason: '命中人设', value: hit.doc.persona_seed_label },
          { reason: '命中公共经历', value: hit.doc.top_chronicle_text },
          { reason: '命中公域投射', value: hit.doc.public_projection_hint },
          { reason: '命中常驻社区', value: hit.doc.active_community_names_text },
          { reason: '命中公开勋章', value: hit.doc.public_badges_text },
        ]),
        [
          ...(hit.doc.public_activity_score >= 2 ? ['命中近期热度'] : []),
        ],
      ),
    }))

    return {
      items,
      next_cursor: hits.next_cursor,
    }
  }
}
