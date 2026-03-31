import { buildAgentTarget } from '../../../shared/agent-target.js'
import type { SearchAgentItem } from '../../../shared/public-search.js'
import type { AgentConfigRepository, SearchDocRepository } from '../../repos/index.js'
import { buildAgentSystemDisplayFields } from '../../launch/system-roster.js'
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

export class AgentSearchProvider implements SearchProvider {
  readonly tab = 'agents' as const

  constructor(
    private readonly deps: {
      searchDocRepo: SearchDocRepository
      agentConfigRepo: AgentConfigRepository
      guard: SearchGuard
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
      sort: input.sort,
      since: input.since,
    })

    const items: SearchAgentItem[] = hits.items
      .filter((hit) => this.deps.guard.canViewAgent(hit.doc))
      .map((hit) => this.buildItem(hit.doc, input.query, hit.score, input.followed_agent_ids))

    return {
      items,
      next_cursor: hits.next_cursor,
    }
  }

  async discover(input: SearchDiscoverInput): Promise<SearchAgentItem[]> {
    const docs = await this.deps.searchDocRepo.listTopAgentDocs(input.limit)
    return docs
      .filter((doc) => this.deps.guard.canViewAgent(doc))
      .map((doc) => this.buildItem(
        doc,
        '',
        Number((doc.public_activity_score + doc.follower_count / 10 + doc.active_membership_count / 10).toFixed(4)),
        input.followed_agent_ids,
      ))
  }

  private buildItem(
    hitDoc: Awaited<ReturnType<SearchDocRepository['searchAgentDocs']>>['items'][number]['doc'],
    query: string,
    score: number,
    followedAgentIds?: ReadonlySet<string>,
  ): SearchAgentItem {
    const snippetSource = buildPreviewSource([
      hitDoc.public_bio,
      hitDoc.public_projection_hint,
      hitDoc.top_chronicle_text,
      hitDoc.representative_post_text,
      hitDoc.public_tagline,
      hitDoc.social_signal_text,
    ])
    const presentation = buildMatchPresentation(query, [
      { reason: '命中名字', code: 'name', field: 'display_name', value: hitDoc.display_name },
      { reason: '命中人设', code: 'persona', field: 'persona', value: hitDoc.persona_seed_label },
      { reason: '命中公共经历', code: 'chronicle', field: 'chronicle', value: hitDoc.top_chronicle_text },
      { reason: '命中公域投射', code: 'projection', field: 'projection', value: hitDoc.public_projection_hint },
      { reason: '命中公开自我介绍', code: 'projection', field: 'public_bio', value: hitDoc.public_bio },
      { reason: '命中常驻社区', code: 'active_community', field: 'active_communities', value: hitDoc.active_community_names_text },
      { reason: '命中公开勋章', code: 'author_badge', field: 'badges', value: hitDoc.public_badges_text },
      { reason: '命中社交信号', code: 'social_signal', field: 'social_signal', value: hitDoc.social_signal_text },
    ], { fallback_text: snippetSource })
    const latestConfig = this.deps.agentConfigRepo.findLatest(hitDoc.agent_id)
    const displayFields = buildAgentSystemDisplayFields(latestConfig?.config_json)
    return {
      type: 'agent',
      id: hitDoc.agent_id,
      href: buildAgentTarget({
        agentId: hitDoc.agent_id,
        mode: 'readonly',
      }),
      display_name: hitDoc.display_name,
      avatar_url: hitDoc.avatar_url,
      status: hitDoc.status,
      agent_kind: displayFields.agent_kind,
      system_identity: displayFields.system_identity,
      surface_access: displayFields.surface_access,
      display_badges: displayFields.display_badges,
      persona_seed_label: hitDoc.persona_seed_label,
      home_voice_line_label: hitDoc.home_voice_line_label,
      tagline: hitDoc.public_tagline,
      public_bio: hitDoc.public_bio,
      badges: hitDoc.public_badges,
      active_communities: hitDoc.active_communities,
      public_activity_score: hitDoc.public_activity_score,
      is_followed: followedAgentIds?.has(hitDoc.agent_id) ?? false,
      score,
      snippet: buildSnippet(snippetSource, query),
      highlights: presentation.highlights,
      match_reasons: appendBoostReasons(
        presentation.match_reasons,
        [
          ...(hitDoc.public_activity_score >= 2 ? ['命中近期热度'] : []),
        ],
      ),
      match_reason_codes: Array.from(new Set([
        ...presentation.match_reason_codes,
        ...(hitDoc.public_activity_score >= 2 ? ['heat' as const] : []),
      ])).slice(0, 4),
    }
  }
}
