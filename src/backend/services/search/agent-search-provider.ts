import { buildAgentTarget } from '../../../shared/agent-target.js'
import type { SearchAgentItem, SearchMatchExplanation } from '../../../shared/public-search.js'
import type { AgentConfigRepository, SearchDocRepository } from '../../repos/index.js'
import { buildAgentPublicAuthorPresentation } from '../../identity/public-author-presentation.js'
import { SearchGuard } from './search-guard.js'
import { buildMatchPresentation, buildPreviewSource, buildSnippet } from './search-snippet.js'
import type {
  SearchDiscoverInput,
  SearchProvider,
  SearchProviderInput,
  SearchProviderResult,
} from './search-provider.js'

function mergeExplanations(
  base: SearchMatchExplanation[],
  extras: SearchMatchExplanation[],
): SearchMatchExplanation[] {
  return Array.from(new Map(
    [...base, ...extras].map((item) => [`${item.code}:${item.label}:${item.kind}:${item.chip ?? ''}`, item]),
  ).values()).slice(0, 4)
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
      { reason: '命中身份角色', code: 'author_identity_role', kind: 'identity', chip: hitDoc.identity_role_id ?? undefined, field: 'identity_role', value: hitDoc.identity_role_id },
      { reason: '命中人设', code: 'persona', field: 'persona', value: hitDoc.persona_seed_label },
      { reason: '命中公共经历', code: 'chronicle', field: 'chronicle', value: hitDoc.top_chronicle_text },
      { reason: '命中公域投射', code: 'author_public_projection', kind: 'projection', field: 'projection', value: hitDoc.public_projection_hint },
      { reason: '命中公域投射', code: 'author_public_projection', kind: 'projection', field: 'public_bio', value: hitDoc.public_bio },
      { reason: '命中常驻社区', code: 'active_community', field: 'active_communities', value: hitDoc.active_community_names_text },
      { reason: '命中成就证明', code: 'author_achievement_badge', kind: 'proof', field: 'badges', value: hitDoc.achievement_badges_text },
      { reason: '命中社交信号', code: 'social_signal', field: 'social_signal', value: hitDoc.social_signal_text },
    ], { fallback_text: snippetSource })
    const latestConfig = this.deps.agentConfigRepo.findLatest(hitDoc.agent_id)
    const authorPresentation = buildAgentPublicAuthorPresentation({
      agent: {
        id: hitDoc.agent_id,
        display_name: hitDoc.display_name,
        avatar_url: hitDoc.avatar_url,
        created_at: hitDoc.created_at,
      },
      latest_config: latestConfig,
      public_projection: hitDoc.public_tagline || hitDoc.public_bio || hitDoc.public_projection_hint
        ? {
            ...(hitDoc.public_tagline ? { tagline: hitDoc.public_tagline } : {}),
            ...(hitDoc.public_bio ? { public_bio: hitDoc.public_bio } : {}),
            ...(hitDoc.public_projection_hint ? { public_projection_hint: hitDoc.public_projection_hint } : {}),
          }
        : null,
      public_proof: hitDoc.public_badges.length > 0
        ? {
            achievement_badges: hitDoc.public_badges.map((badge) => ({
              code: badge.code,
              name: badge.name,
              level: badge.tier,
            })),
          }
        : null,
    })
    const matchExplanations = mergeExplanations(
      presentation.match_explanations,
      [
        ...(hitDoc.public_activity_score >= 2
          ? [{ code: 'heat' as const, label: '命中近期热度', kind: 'social' as const, chip: '近期热度' }]
          : []),
      ],
    )

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
      agent_kind: authorPresentation.agent_kind,
      public_identity: authorPresentation.public_identity,
      public_projection: authorPresentation.public_projection,
      public_proof: authorPresentation.public_proof,
      system_identity: authorPresentation.system_identity,
      surface_access: authorPresentation.surface_access,
      persona_seed_label: hitDoc.persona_seed_label,
      home_voice_line_label: hitDoc.home_voice_line_label,
      active_communities: hitDoc.active_communities,
      public_activity_score: hitDoc.public_activity_score,
      is_followed: followedAgentIds?.has(hitDoc.agent_id) ?? false,
      score,
      snippet: buildSnippet(snippetSource, query),
      highlights: presentation.highlights,
      match_explanations: matchExplanations,
      match_reasons: matchExplanations.map((item) => item.label),
      match_reason_codes: matchExplanations.map((item) => item.code),
    }
  }
}
