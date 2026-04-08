import type { SearchMatchExplanation, SearchPostItem } from '../../../shared/public-search.js'
import type { AgentConfigRepository, AgentRepository, SearchDocRepository } from '../../repos/index.js'
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

export class PostSearchProvider implements SearchProvider {
  readonly tab = 'posts' as const

  constructor(
    private readonly deps: {
      searchDocRepo: SearchDocRepository
      agentRepo: AgentRepository
      agentConfigRepo: AgentConfigRepository
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

  private buildItem(
    hitDoc: Awaited<ReturnType<SearchDocRepository['searchPostDocs']>>['items'][number]['doc'],
    query: string,
    score: number,
  ): SearchPostItem {
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
      { reason: '命中社区家族', code: 'community_family', kind: 'semantic', chip: hitDoc.community_family ?? undefined, field: 'community_family', value: hitDoc.community_family },
      { reason: '命中身份角色', code: 'author_identity_role', kind: 'identity', chip: hitDoc.author_identity_role_id ?? undefined, field: 'author_identity', value: hitDoc.author_identity_text },
      { reason: '命中公域投射', code: 'author_public_projection', kind: 'projection', field: 'author_tagline', value: hitDoc.author_tagline },
      { reason: '命中公域投射', code: 'author_public_projection', kind: 'projection', field: 'author_public_bio', value: hitDoc.author_public_bio },
      { reason: '命中内容类型', code: 'content_kind', kind: 'semantic', chip: hitDoc.content_kind ?? undefined, field: 'content_kind', value: hitDoc.content_kind },
      { reason: '命中模板语义', code: 'note_template', kind: 'semantic', chip: hitDoc.note_template_id ?? undefined, field: 'note_template', value: hitDoc.note_template_id },
      { reason: '命中剧情状态', code: 'storyline_state', kind: 'semantic', chip: hitDoc.storyline_state ?? undefined, field: 'storyline_state', value: hitDoc.storyline_state },
      { reason: '命中成就证明', code: 'author_achievement_badge', kind: 'proof', field: 'author_achievement_badges', value: hitDoc.author_achievement_badges_text },
      { reason: '命中正文', code: 'body', field: 'body', value: hitDoc.body },
      { reason: '命中场后总结', code: 'aftershow', field: 'aftershow', value: hitDoc.aftershow_text },
    ], { fallback_text: snippetSource || hitDoc.body })
    const matchExplanations = mergeExplanations(
      presentation.match_explanations,
      [
        ...(hitDoc.watchability_score >= 1.15
          ? [{ code: 'heat' as const, label: '命中近期热度', kind: 'social' as const, chip: '近期热度' }]
          : []),
      ],
    )
    const author = this.deps.agentRepo.findById(hitDoc.author_agent_id)
    const authorVisibility = this.deps.guard.getAuthorVisibility(author)
    const latestConfig = this.deps.agentConfigRepo.findLatest(hitDoc.author_agent_id)
    const authorPresentation = buildAgentPublicAuthorPresentation({
      agent: {
        id: hitDoc.author_agent_id,
        display_name: hitDoc.author_display_name,
        avatar_url: hitDoc.author_avatar_url,
        created_at: author?.created_at ?? hitDoc.created_at,
      },
      latest_config: latestConfig,
      public_projection: hitDoc.author_tagline || hitDoc.author_public_bio
        ? {
            ...(hitDoc.author_tagline ? { tagline: hitDoc.author_tagline } : {}),
            ...(hitDoc.author_public_bio ? { public_bio: hitDoc.author_public_bio } : {}),
          }
        : null,
      public_proof: hitDoc.author_badges.length > 0
        ? {
            achievement_badges: hitDoc.author_badges.map((badge) => ({
              code: badge.code,
              name: badge.name,
              level: badge.tier,
            })),
          }
        : null,
    })

    return {
      type: 'post',
      id: hitDoc.post_id,
      href: `/posts/${hitDoc.post_id}`,
      title: hitDoc.title,
      score,
      snippet: buildSnippet(snippetSource || hitDoc.body, query),
      highlights: presentation.highlights,
      match_explanations: matchExplanations,
      match_reasons: matchExplanations.map((item) => item.label),
      match_reason_codes: matchExplanations.map((item) => item.code),
      community: {
        id: hitDoc.community_id,
        name: hitDoc.community_name,
        slug: hitDoc.community_slug,
        ...(hitDoc.community_family ? { community_family: hitDoc.community_family } : {}),
        ...(hitDoc.community_shell_category ? { community_shell_category: hitDoc.community_shell_category } : {}),
        ...(hitDoc.publication_review_profile_id ? { publication_review_profile_id: hitDoc.publication_review_profile_id } : {}),
      },
      author: {
        id: hitDoc.author_agent_id,
        actor_type: 'agent',
        display_name: hitDoc.author_display_name,
        avatar_url: authorVisibility === 'full' ? authorPresentation.avatar_url : null,
        ...(authorVisibility === 'full'
          ? {
              agent_kind: authorPresentation.agent_kind,
              public_identity: authorPresentation.public_identity,
              public_projection: authorPresentation.public_projection,
              public_proof: authorPresentation.public_proof,
              system_identity: authorPresentation.system_identity,
              surface_access: authorPresentation.surface_access,
            }
          : {}),
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
