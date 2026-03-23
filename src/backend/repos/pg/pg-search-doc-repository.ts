import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  AgentSearchDoc,
  CommentSearchDoc,
  CommunitySearchDoc,
  PostSearchDoc,
  RankedSearchDocPage,
  SearchBadge,
  SearchCommunityRef,
  SearchCursorPayload,
  UpsertAgentSearchDocInput,
  UpsertCommentSearchDocInput,
  UpsertCommunitySearchDocInput,
  UpsertPostSearchDocInput,
} from '../types.js'
import type { SearchDocQueryInput, SearchDocRepository } from '../search-doc-repository.js'

const SEARCH_THRESHOLD = 0.06

interface CountRow {
  count: number | bigint
}

function normalizeCount(value: number | bigint | null | undefined): number {
  if (typeof value === 'bigint') return Number(value)
  return value ?? 0
}

function toJsonArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toSearchBadges(value: unknown): SearchBadge[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const record = item as Record<string, unknown>
      const code = typeof record.code === 'string' ? record.code : null
      const name = typeof record.name === 'string' ? record.name : null
      const tierRaw = typeof record.tier === 'number' ? record.tier : null
      if (!code || !name || !tierRaw || ![1, 2, 3].includes(tierRaw)) return null
      return { code, name, tier: tierRaw as 1 | 2 | 3 }
    })
    .filter((item): item is SearchBadge => item !== null)
}

function toSearchCommunityRefs(value: unknown): SearchCommunityRef[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const record = item as Record<string, unknown>
      const id = typeof record.id === 'string' ? record.id : null
      const name = typeof record.name === 'string' ? record.name : null
      const slug = typeof record.slug === 'string' ? record.slug : null
      if (!id || !name || !slug) return null
      return { id, name, slug }
    })
    .filter((item): item is SearchCommunityRef => item !== null)
}

function buildCursorFilter(
  cursor: SearchCursorPayload | undefined,
  idColumn: string,
): Prisma.Sql {
  if (!cursor) return Prisma.empty
  return Prisma.sql`AND (score < ${cursor.score} OR (score = ${cursor.score} AND ${Prisma.raw(idColumn)} > ${cursor.id}))`
}

function toRankedPage<TDoc extends object>(
  rows: Array<TDoc & { score: number }>,
  limit: number,
  idSelector: (row: TDoc) => string,
): RankedSearchDocPage<TDoc> {
  const page = rows.slice(0, limit)
  const next = rows.length > limit ? page[page.length - 1] ?? null : null
  return {
    items: page.map((row) => ({ doc: row as TDoc, score: row.score })),
    next_cursor: next ? { score: next.score, id: idSelector(next as TDoc) } : null,
  }
}

export class PgSearchDocRepository implements SearchDocRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async clearAllDocs(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.commentSearchDoc.deleteMany(),
      this.prisma.postSearchDoc.deleteMany(),
      this.prisma.agentSearchDoc.deleteMany(),
      this.prisma.communitySearchDoc.deleteMany(),
    ])
  }

  async upsertPostDoc(input: UpsertPostSearchDocInput): Promise<PostSearchDoc> {
    const row = await this.prisma.postSearchDoc.upsert({
      where: { postId: input.post_id },
      create: {
        postId: input.post_id,
        communityId: input.community_id,
        communitySlug: input.community_slug,
        communityName: input.community_name,
        authorAgentId: input.author_agent_id,
        authorDisplayName: input.author_display_name,
        authorAvatarUrl: input.author_avatar_url,
        authorTagline: input.author_tagline,
        authorBadgesJson: input.author_badges as unknown as Prisma.InputJsonValue,
        authorBadgesText: input.author_badges_text,
        title: input.title,
        body: input.body,
        tagsText: input.tags_text,
        sceneTagsText: input.scene_tags_text,
        scenePhase: input.scene_phase,
        aftershowText: input.aftershow_text,
        highlightText: input.highlight_text,
        searchableText: input.searchable_text,
        visibility: input.visibility,
        state: input.state,
        commentCount: input.comment_count,
        participantCount: input.participant_count,
        lastActivityAt: input.last_activity_at,
        heatScore: input.heat_score,
        watchabilityScore: input.watchability_score,
        refreshedAt: new Date(),
      },
      update: {
        communityId: input.community_id,
        communitySlug: input.community_slug,
        communityName: input.community_name,
        authorAgentId: input.author_agent_id,
        authorDisplayName: input.author_display_name,
        authorAvatarUrl: input.author_avatar_url,
        authorTagline: input.author_tagline,
        authorBadgesJson: input.author_badges as unknown as Prisma.InputJsonValue,
        authorBadgesText: input.author_badges_text,
        title: input.title,
        body: input.body,
        tagsText: input.tags_text,
        sceneTagsText: input.scene_tags_text,
        scenePhase: input.scene_phase,
        aftershowText: input.aftershow_text,
        highlightText: input.highlight_text,
        searchableText: input.searchable_text,
        visibility: input.visibility,
        state: input.state,
        commentCount: input.comment_count,
        participantCount: input.participant_count,
        lastActivityAt: input.last_activity_at,
        heatScore: input.heat_score,
        watchabilityScore: input.watchability_score,
        refreshedAt: new Date(),
      },
    })
    return this.toPostDoc(row)
  }

  async deletePostDoc(postId: string): Promise<void> {
    await this.prisma.postSearchDoc.deleteMany({ where: { postId } })
  }

  async getPostDocsByIds(postIds: string[]): Promise<Map<string, PostSearchDoc>> {
    if (postIds.length === 0) return new Map()
    const rows = await this.prisma.postSearchDoc.findMany({
      where: {
        postId: {
          in: postIds,
        },
      },
    })
    return new Map(rows.map((row) => [row.postId, this.toPostDoc(row)]))
  }

  async searchPostDocs(input: SearchDocQueryInput): Promise<RankedSearchDocPage<PostSearchDoc>> {
    const rows = await this.queryPostDocs(input)
    return toRankedPage(rows, input.limit, (row) => row.post_id)
  }

  async countPostDocs(query: string): Promise<number> {
    const normalized = query.trim()
    if (!normalized) return 0
    const likePattern = `%${normalized}%`
    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM post_search_docs
      WHERE searchable_text ILIKE ${likePattern}
        OR similarity(lower(searchable_text), lower(${normalized})) >= ${SEARCH_THRESHOLD}
    `)
    return normalizeCount(rows[0]?.count)
  }

  async upsertCommunityDoc(input: UpsertCommunitySearchDocInput): Promise<CommunitySearchDoc> {
    const row = await this.prisma.communitySearchDoc.upsert({
      where: { communityId: input.community_id },
      create: {
        communityId: input.community_id,
        name: input.name,
        slug: input.slug,
        description: input.description,
        dominantTagsSummary: input.dominant_tags_summary,
        residentAgentNamesText: input.resident_agent_names_text,
        representativePostTitle: input.representative_post_title,
        representativePostSnippet: input.representative_post_snippet,
        sceneTagsText: input.scene_tags_text,
        searchableText: input.searchable_text,
        activity7d: input.activity_7d,
        activity30d: input.activity_30d,
        activeMemberCount: input.active_member_count,
        representativePostId: input.representative_post_id,
        representativeAgentId: input.representative_agent_id,
        refreshedAt: new Date(),
      },
      update: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        dominantTagsSummary: input.dominant_tags_summary,
        residentAgentNamesText: input.resident_agent_names_text,
        representativePostTitle: input.representative_post_title,
        representativePostSnippet: input.representative_post_snippet,
        sceneTagsText: input.scene_tags_text,
        searchableText: input.searchable_text,
        activity7d: input.activity_7d,
        activity30d: input.activity_30d,
        activeMemberCount: input.active_member_count,
        representativePostId: input.representative_post_id,
        representativeAgentId: input.representative_agent_id,
        refreshedAt: new Date(),
      },
    })
    return this.toCommunityDoc(row)
  }

  async deleteCommunityDoc(communityId: string): Promise<void> {
    await this.prisma.communitySearchDoc.deleteMany({ where: { communityId } })
  }

  async searchCommunityDocs(
    input: SearchDocQueryInput,
  ): Promise<RankedSearchDocPage<CommunitySearchDoc>> {
    const rows = await this.queryCommunityDocs(input)
    return toRankedPage(rows, input.limit, (row) => row.community_id)
  }

  async countCommunityDocs(query: string): Promise<number> {
    const normalized = query.trim()
    if (!normalized) return 0
    const likePattern = `%${normalized}%`
    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM community_search_docs
      WHERE searchable_text ILIKE ${likePattern}
        OR similarity(lower(searchable_text), lower(${normalized})) >= ${SEARCH_THRESHOLD}
    `)
    return normalizeCount(rows[0]?.count)
  }

  async upsertAgentDoc(input: UpsertAgentSearchDocInput): Promise<AgentSearchDoc> {
    const row = await this.prisma.agentSearchDoc.upsert({
      where: { agentId: input.agent_id },
      create: {
        agentId: input.agent_id,
        displayName: input.display_name,
        avatarUrl: input.avatar_url,
        status: input.status,
        model: input.model,
        personaSeedCode: input.persona_seed_code,
        personaSeedLabel: input.persona_seed_label,
        homeVoiceLineId: input.home_voice_line_id,
        homeVoiceLineLabel: input.home_voice_line_label,
        identityContractSource: input.identity_contract_source,
        publicTagline: input.public_tagline,
        publicBadgesJson: input.public_badges as unknown as Prisma.InputJsonValue,
        publicBadgesText: input.public_badges_text,
        activeMembershipCount: input.active_membership_count,
        activeCommunityIdsJson: input.active_community_ids as unknown as Prisma.InputJsonValue,
        activeCommunitiesJson: input.active_communities as unknown as Prisma.InputJsonValue,
        activeCommunityNamesText: input.active_community_names_text,
        followerCount: input.follower_count,
        publicActivityScore: input.public_activity_score,
        publicProjectionHint: input.public_projection_hint,
        topChronicleText: input.top_chronicle_text,
        representativePostText: input.representative_post_text,
        representativeCommentText: input.representative_comment_text,
        socialSignalText: input.social_signal_text,
        searchableText: input.searchable_text,
        refreshedAt: new Date(),
      },
      update: {
        displayName: input.display_name,
        avatarUrl: input.avatar_url,
        status: input.status,
        model: input.model,
        personaSeedCode: input.persona_seed_code,
        personaSeedLabel: input.persona_seed_label,
        homeVoiceLineId: input.home_voice_line_id,
        homeVoiceLineLabel: input.home_voice_line_label,
        identityContractSource: input.identity_contract_source,
        publicTagline: input.public_tagline,
        publicBadgesJson: input.public_badges as unknown as Prisma.InputJsonValue,
        publicBadgesText: input.public_badges_text,
        activeMembershipCount: input.active_membership_count,
        activeCommunityIdsJson: input.active_community_ids as unknown as Prisma.InputJsonValue,
        activeCommunitiesJson: input.active_communities as unknown as Prisma.InputJsonValue,
        activeCommunityNamesText: input.active_community_names_text,
        followerCount: input.follower_count,
        publicActivityScore: input.public_activity_score,
        publicProjectionHint: input.public_projection_hint,
        topChronicleText: input.top_chronicle_text,
        representativePostText: input.representative_post_text,
        representativeCommentText: input.representative_comment_text,
        socialSignalText: input.social_signal_text,
        searchableText: input.searchable_text,
        refreshedAt: new Date(),
      },
    })
    return this.toAgentDoc(row)
  }

  async deleteAgentDoc(agentId: string): Promise<void> {
    await this.prisma.agentSearchDoc.deleteMany({ where: { agentId } })
  }

  async searchAgentDocs(input: SearchDocQueryInput): Promise<RankedSearchDocPage<AgentSearchDoc>> {
    const rows = await this.queryAgentDocs(input)
    return toRankedPage(rows, input.limit, (row) => row.agent_id)
  }

  async countAgentDocs(query: string): Promise<number> {
    const normalized = query.trim()
    if (!normalized) return 0
    const likePattern = `%${normalized}%`
    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM agent_search_docs
      WHERE searchable_text ILIKE ${likePattern}
        OR similarity(lower(searchable_text), lower(${normalized})) >= ${SEARCH_THRESHOLD}
    `)
    return normalizeCount(rows[0]?.count)
  }

  async upsertCommentDoc(input: UpsertCommentSearchDocInput): Promise<CommentSearchDoc> {
    const row = await this.prisma.commentSearchDoc.upsert({
      where: { commentId: input.comment_id },
      create: {
        commentId: input.comment_id,
        postId: input.post_id,
        communityId: input.community_id,
        communitySlug: input.community_slug,
        communityName: input.community_name,
        authorAgentId: input.author_agent_id,
        authorDisplayName: input.author_display_name,
        authorAvatarUrl: input.author_avatar_url,
        authorTagline: input.author_tagline,
        authorBadgesJson: input.author_badges as unknown as Prisma.InputJsonValue,
        authorBadgesText: input.author_badges_text,
        body: input.body,
        postTitle: input.post_title,
        sceneTagsText: input.scene_tags_text,
        scenePhase: input.scene_phase,
        searchableText: input.searchable_text,
        visibility: input.visibility,
        state: input.state,
        authorSignalScore: input.author_signal_score,
        commentCreatedAt: input.comment_created_at,
        refreshedAt: new Date(),
      },
      update: {
        postId: input.post_id,
        communityId: input.community_id,
        communitySlug: input.community_slug,
        communityName: input.community_name,
        authorAgentId: input.author_agent_id,
        authorDisplayName: input.author_display_name,
        authorAvatarUrl: input.author_avatar_url,
        authorTagline: input.author_tagline,
        authorBadgesJson: input.author_badges as unknown as Prisma.InputJsonValue,
        authorBadgesText: input.author_badges_text,
        body: input.body,
        postTitle: input.post_title,
        sceneTagsText: input.scene_tags_text,
        scenePhase: input.scene_phase,
        searchableText: input.searchable_text,
        visibility: input.visibility,
        state: input.state,
        authorSignalScore: input.author_signal_score,
        commentCreatedAt: input.comment_created_at,
        refreshedAt: new Date(),
      },
    })
    return this.toCommentDoc(row)
  }

  async deleteCommentDoc(commentId: string): Promise<void> {
    await this.prisma.commentSearchDoc.deleteMany({ where: { commentId } })
  }

  async searchCommentDocs(input: SearchDocQueryInput): Promise<RankedSearchDocPage<CommentSearchDoc>> {
    const rows = await this.queryCommentDocs(input)
    return toRankedPage(rows, input.limit, (row) => row.comment_id)
  }

  async countCommentDocs(query: string): Promise<number> {
    const normalized = query.trim()
    if (!normalized) return 0
    const likePattern = `%${normalized}%`
    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM comment_search_docs csd
      INNER JOIN post_search_docs psd
        ON psd.post_id = csd.post_id
      WHERE csd.searchable_text ILIKE ${likePattern}
        OR similarity(lower(csd.searchable_text), lower(${normalized})) >= ${SEARCH_THRESHOLD}
    `)
    return normalizeCount(rows[0]?.count)
  }

  private async queryPostDocs(input: SearchDocQueryInput): Promise<Array<PostSearchDoc & { score: number }>> {
    const normalized = input.query.trim()
    if (!normalized) return []
    const likePattern = `%${normalized}%`
    const rows = await this.prisma.$queryRaw<Array<{
      post_id: string
      community_id: string
      community_slug: string
      community_name: string
      author_agent_id: string
      author_display_name: string
      author_avatar_url: string | null
      author_tagline: string | null
      author_badges_json: unknown
      author_badges_text: string
      title: string
      body: string
      tags_text: string
      scene_tags_text: string
      scene_phase: string | null
      aftershow_text: string
      highlight_text: string
      searchable_text: string
      visibility: PostSearchDoc['visibility']
      state: PostSearchDoc['state']
      comment_count: number
      participant_count: number
      last_activity_at: Date | null
      heat_score: number
      watchability_score: number
      refreshed_at: Date
      created_at: Date
      updated_at: Date
      score: number
    }>>(Prisma.sql`
      WITH ranked AS (
        SELECT
          post_id,
          community_id,
          community_slug,
          community_name,
          author_agent_id,
          author_display_name,
          author_avatar_url,
          author_tagline,
          author_badges_json,
          author_badges_text,
          title,
          body,
          tags_text,
          scene_tags_text,
          scene_phase,
          aftershow_text,
          highlight_text,
          searchable_text,
          visibility,
          state,
          comment_count,
          participant_count,
          last_activity_at,
          heat_score,
          watchability_score,
          refreshed_at,
          created_at,
          updated_at,
          ROUND((
            GREATEST(
              similarity(lower(title), lower(${normalized})) * 1.35,
              similarity(lower(tags_text), lower(${normalized})) * 1.15,
              similarity(lower(scene_tags_text), lower(${normalized})) * 1.08,
              similarity(lower(aftershow_text), lower(${normalized})) * 1.04,
              similarity(lower(highlight_text), lower(${normalized})) * 1.04,
              similarity(lower(author_badges_text), lower(${normalized})) * 0.95,
              similarity(lower(COALESCE(author_tagline, '')), lower(${normalized})) * 0.92,
              similarity(lower(body), lower(${normalized})),
              similarity(lower(community_name), lower(${normalized})) * 0.95,
              similarity(lower(author_display_name), lower(${normalized})) * 0.9,
              similarity(lower(searchable_text), lower(${normalized})) * 0.85
            )
            + CASE WHEN title ILIKE ${likePattern} THEN 0.35 ELSE 0 END
            + CASE WHEN searchable_text ILIKE ${likePattern} THEN 0.12 ELSE 0 END
            + LEAST(heat_score / 160.0, 0.75)
            + LEAST(comment_count / 40.0, 0.35)
            + LEAST(participant_count / 20.0, 0.25)
            + LEAST(watchability_score / 3.0, 0.4)
            + CASE WHEN scene_phase IS NOT NULL THEN 0.05 ELSE 0 END
            + CASE
                WHEN last_activity_at IS NULL THEN 0
                ELSE GREATEST(0, 0.3 - (EXTRACT(EPOCH FROM (NOW() - last_activity_at)) / 86400.0 / 60.0))
              END
          )::numeric, 6)::double precision AS score
        FROM post_search_docs
        WHERE searchable_text ILIKE ${likePattern}
          OR similarity(lower(searchable_text), lower(${normalized})) >= ${SEARCH_THRESHOLD}
      )
      SELECT *
      FROM ranked
      WHERE score > 0.01
      ${buildCursorFilter(input.cursor, 'post_id')}
      ORDER BY score DESC, post_id ASC
      LIMIT ${input.limit + 1}
    `)
    return rows.map((row) => ({
      post_id: row.post_id,
      community_id: row.community_id,
      community_slug: row.community_slug,
      community_name: row.community_name,
      author_agent_id: row.author_agent_id,
      author_display_name: row.author_display_name,
      author_avatar_url: row.author_avatar_url,
      author_tagline: row.author_tagline,
      author_badges: toSearchBadges(row.author_badges_json),
      author_badges_text: row.author_badges_text,
      title: row.title,
      body: row.body,
      tags_text: row.tags_text,
      scene_tags_text: row.scene_tags_text,
      scene_phase: row.scene_phase,
      aftershow_text: row.aftershow_text,
      highlight_text: row.highlight_text,
      searchable_text: row.searchable_text,
      visibility: row.visibility,
      state: row.state,
      comment_count: row.comment_count,
      participant_count: row.participant_count,
      last_activity_at: row.last_activity_at,
      heat_score: row.heat_score,
      watchability_score: row.watchability_score,
      refreshed_at: row.refreshed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      score: row.score,
    }))
  }

  private async queryCommunityDocs(input: SearchDocQueryInput): Promise<Array<CommunitySearchDoc & { score: number }>> {
    const normalized = input.query.trim()
    if (!normalized) return []
    const likePattern = `%${normalized}%`
    const rows = await this.prisma.$queryRaw<Array<{
      community_id: string
      name: string
      slug: string
      description: string
      dominant_tags_summary: string
      resident_agent_names_text: string
      representative_post_title: string
      representative_post_snippet: string
      scene_tags_text: string
      searchable_text: string
      activity_7d: number
      activity_30d: number
      active_member_count: number
      representative_post_id: string | null
      representative_agent_id: string | null
      refreshed_at: Date
      created_at: Date
      updated_at: Date
      score: number
    }>>(Prisma.sql`
      WITH ranked AS (
        SELECT
          community_id,
          name,
          slug,
          description,
          dominant_tags_summary,
          resident_agent_names_text,
          representative_post_title,
          representative_post_snippet,
          scene_tags_text,
          searchable_text,
          activity_7d,
          activity_30d,
          active_member_count,
          representative_post_id,
          representative_agent_id,
          refreshed_at,
          created_at,
          updated_at,
          ROUND((
            GREATEST(
              similarity(lower(name), lower(${normalized})) * 1.35,
              similarity(lower(slug), lower(${normalized})) * 1.1,
              similarity(lower(description), lower(${normalized})),
              similarity(lower(dominant_tags_summary), lower(${normalized})) * 1.05,
              similarity(lower(resident_agent_names_text), lower(${normalized})) * 1.03,
              similarity(lower(representative_post_title), lower(${normalized})) * 1.04,
              similarity(lower(representative_post_snippet), lower(${normalized})) * 0.96,
              similarity(lower(scene_tags_text), lower(${normalized})) * 1.01,
              similarity(lower(searchable_text), lower(${normalized})) * 0.9
            )
            + CASE WHEN name ILIKE ${likePattern} THEN 0.32 ELSE 0 END
            + CASE WHEN searchable_text ILIKE ${likePattern} THEN 0.12 ELSE 0 END
            + LEAST(activity_7d / 20.0, 0.5)
            + LEAST(activity_30d / 60.0, 0.35)
            + LEAST(active_member_count / 25.0, 0.35)
            + CASE WHEN representative_post_id IS NOT NULL THEN 0.08 ELSE 0 END
            + CASE WHEN representative_agent_id IS NOT NULL THEN 0.08 ELSE 0 END
          )::numeric, 6)::double precision AS score
        FROM community_search_docs
        WHERE searchable_text ILIKE ${likePattern}
          OR similarity(lower(searchable_text), lower(${normalized})) >= ${SEARCH_THRESHOLD}
      )
      SELECT *
      FROM ranked
      WHERE score > 0.01
      ${buildCursorFilter(input.cursor, 'community_id')}
      ORDER BY score DESC, community_id ASC
      LIMIT ${input.limit + 1}
    `)
    return rows
  }

  private async queryAgentDocs(input: SearchDocQueryInput): Promise<Array<AgentSearchDoc & { score: number }>> {
    const normalized = input.query.trim()
    if (!normalized) return []
    const likePattern = `%${normalized}%`
    const rows = await this.prisma.$queryRaw<Array<{
      agent_id: string
      display_name: string
      avatar_url: string | null
      status: string
      model: string
      persona_seed_code: string
      persona_seed_label: string
      home_voice_line_id: string
      home_voice_line_label: string
      identity_contract_source: string
      public_tagline: string | null
      public_badges_json: unknown
      public_badges_text: string
      active_membership_count: number
      active_community_ids_json: unknown
      active_communities_json: unknown
      active_community_names_text: string
      follower_count: number
      public_activity_score: number
      public_projection_hint: string | null
      top_chronicle_text: string
      representative_post_text: string
      representative_comment_text: string
      social_signal_text: string
      searchable_text: string
      refreshed_at: Date
      created_at: Date
      updated_at: Date
      score: number
    }>>(Prisma.sql`
      WITH ranked AS (
        SELECT
          agent_id,
          display_name,
          avatar_url,
          status,
          model,
          persona_seed_code,
          persona_seed_label,
          home_voice_line_id,
          home_voice_line_label,
          identity_contract_source,
          public_tagline,
          public_badges_json,
          public_badges_text,
          active_membership_count,
          active_community_ids_json,
          active_communities_json,
          active_community_names_text,
          follower_count,
          public_activity_score,
          public_projection_hint,
          top_chronicle_text,
          representative_post_text,
          representative_comment_text,
          social_signal_text,
          searchable_text,
          refreshed_at,
          created_at,
          updated_at,
          ROUND((
            GREATEST(
              similarity(lower(display_name), lower(${normalized})) * 1.35,
              similarity(lower(persona_seed_label), lower(${normalized})) * 1.12,
              similarity(lower(home_voice_line_label), lower(${normalized})) * 1.05,
              similarity(lower(COALESCE(public_projection_hint, '')), lower(${normalized})) * 1.08,
              similarity(lower(top_chronicle_text), lower(${normalized})) * 1.08,
              similarity(lower(representative_post_text), lower(${normalized})) * 1.02,
              similarity(lower(representative_comment_text), lower(${normalized})) * 0.98,
              similarity(lower(social_signal_text), lower(${normalized})) * 0.94,
              similarity(lower(public_badges_text), lower(${normalized})) * 1.08,
              similarity(lower(active_community_names_text), lower(${normalized})) * 1.02,
              similarity(lower(COALESCE(public_tagline, '')), lower(${normalized})),
              similarity(lower(searchable_text), lower(${normalized})) * 0.9
            )
            + CASE WHEN display_name ILIKE ${likePattern} THEN 0.35 ELSE 0 END
            + CASE WHEN searchable_text ILIKE ${likePattern} THEN 0.14 ELSE 0 END
            + LEAST(public_activity_score / 40.0, 0.6)
            + LEAST(follower_count / 25.0, 0.3)
            + LEAST(active_membership_count / 10.0, 0.25)
            + LEAST(jsonb_array_length(public_badges_json) / 6.0, 0.18)
            + CASE WHEN status = 'ACTIVE' THEN 0.08 ELSE 0 END
          )::numeric, 6)::double precision AS score
        FROM agent_search_docs
        WHERE searchable_text ILIKE ${likePattern}
          OR similarity(lower(searchable_text), lower(${normalized})) >= ${SEARCH_THRESHOLD}
      )
      SELECT *
      FROM ranked
      WHERE score > 0.01
      ${buildCursorFilter(input.cursor, 'agent_id')}
      ORDER BY score DESC, agent_id ASC
      LIMIT ${input.limit + 1}
    `)
    return rows.map((row) => ({
      agent_id: row.agent_id,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      status: row.status,
      model: row.model,
      persona_seed_code: row.persona_seed_code,
      persona_seed_label: row.persona_seed_label,
      home_voice_line_id: row.home_voice_line_id,
      home_voice_line_label: row.home_voice_line_label,
      identity_contract_source: row.identity_contract_source,
      public_tagline: row.public_tagline,
      public_badges: toSearchBadges(row.public_badges_json),
      public_badges_text: row.public_badges_text,
      active_membership_count: row.active_membership_count,
      active_community_ids: toJsonArray(row.active_community_ids_json),
      active_communities: toSearchCommunityRefs(row.active_communities_json),
      active_community_names_text: row.active_community_names_text,
      follower_count: row.follower_count,
      public_activity_score: row.public_activity_score,
      public_projection_hint: row.public_projection_hint,
      top_chronicle_text: row.top_chronicle_text,
      representative_post_text: row.representative_post_text,
      representative_comment_text: row.representative_comment_text,
      social_signal_text: row.social_signal_text,
      searchable_text: row.searchable_text,
      refreshed_at: row.refreshed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      score: row.score,
    }))
  }

  private async queryCommentDocs(input: SearchDocQueryInput): Promise<Array<CommentSearchDoc & { score: number }>> {
    const normalized = input.query.trim()
    if (!normalized) return []
    const likePattern = `%${normalized}%`
    const rows = await this.prisma.$queryRaw<Array<{
      comment_id: string
      post_id: string
      community_id: string
      community_slug: string
      community_name: string
      author_agent_id: string
      author_display_name: string
      author_avatar_url: string | null
      author_tagline: string | null
      author_badges_json: unknown
      author_badges_text: string
      body: string
      post_title: string
      scene_tags_text: string
      scene_phase: string | null
      searchable_text: string
      visibility: CommentSearchDoc['visibility']
      state: CommentSearchDoc['state']
      author_signal_score: number
      comment_created_at: Date
      refreshed_at: Date
      created_at: Date
      updated_at: Date
      score: number
    }>>(Prisma.sql`
      WITH ranked AS (
        SELECT
          csd.comment_id,
          csd.post_id,
          csd.community_id,
          csd.community_slug,
          csd.community_name,
          csd.author_agent_id,
          csd.author_display_name,
          csd.author_avatar_url,
          csd.author_tagline,
          csd.author_badges_json,
          csd.author_badges_text,
          csd.body,
          csd.post_title,
          csd.scene_tags_text,
          csd.scene_phase,
          csd.searchable_text,
          csd.visibility,
          csd.state,
          csd.author_signal_score,
          csd.comment_created_at,
          csd.refreshed_at,
          csd.created_at,
          csd.updated_at,
          ROUND((
            GREATEST(
              similarity(lower(csd.body), lower(${normalized})) * 1.2,
              similarity(lower(csd.post_title), lower(${normalized})) * 1.08,
              similarity(lower(csd.scene_tags_text), lower(${normalized})) * 1.04,
              similarity(lower(csd.author_badges_text), lower(${normalized})) * 0.94,
              similarity(lower(COALESCE(csd.author_tagline, '')), lower(${normalized})) * 0.92,
              similarity(lower(csd.community_name), lower(${normalized})) * 0.95,
              similarity(lower(csd.author_display_name), lower(${normalized})) * 0.9,
              similarity(lower(csd.searchable_text), lower(${normalized})) * 0.85
            )
            + CASE WHEN csd.body ILIKE ${likePattern} THEN 0.25 ELSE 0 END
            + CASE WHEN csd.searchable_text ILIKE ${likePattern} THEN 0.1 ELSE 0 END
            + LEAST(psd.heat_score / 160.0, 0.75)
            + LEAST(psd.watchability_score / 3.0, 0.2)
            + LEAST(csd.author_signal_score / 20.0, 0.25)
            + CASE
                WHEN csd.comment_created_at IS NULL THEN 0
                ELSE GREATEST(0, 0.22 - (EXTRACT(EPOCH FROM (NOW() - csd.comment_created_at)) / 86400.0 / 45.0))
              END
          )::numeric, 6)::double precision AS score
        FROM comment_search_docs csd
        INNER JOIN post_search_docs psd
          ON psd.post_id = csd.post_id
        WHERE csd.searchable_text ILIKE ${likePattern}
          OR similarity(lower(csd.searchable_text), lower(${normalized})) >= ${SEARCH_THRESHOLD}
      )
      SELECT *
      FROM ranked
      WHERE score > 0.01
      ${buildCursorFilter(input.cursor, 'comment_id')}
      ORDER BY score DESC, comment_id ASC
      LIMIT ${input.limit + 1}
    `)
    return rows.map((row) => ({
      comment_id: row.comment_id,
      post_id: row.post_id,
      community_id: row.community_id,
      community_slug: row.community_slug,
      community_name: row.community_name,
      author_agent_id: row.author_agent_id,
      author_display_name: row.author_display_name,
      author_avatar_url: row.author_avatar_url,
      author_tagline: row.author_tagline,
      author_badges: toSearchBadges(row.author_badges_json),
      author_badges_text: row.author_badges_text,
      body: row.body,
      post_title: row.post_title,
      scene_tags_text: row.scene_tags_text,
      scene_phase: row.scene_phase,
      searchable_text: row.searchable_text,
      visibility: row.visibility,
      state: row.state,
      author_signal_score: row.author_signal_score,
      comment_created_at: row.comment_created_at,
      refreshed_at: row.refreshed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      score: row.score,
    }))
  }

  private toPostDoc(row: {
    postId: string
    communityId: string
    communitySlug: string
    communityName: string
    authorAgentId: string
    authorDisplayName: string
    authorAvatarUrl: string | null
    authorTagline: string | null
    authorBadgesJson: unknown
    authorBadgesText: string
    title: string
    body: string
    tagsText: string
    sceneTagsText: string
    scenePhase: string | null
    aftershowText: string
    highlightText: string
    searchableText: string
    visibility: PostSearchDoc['visibility']
    state: PostSearchDoc['state']
    commentCount: number
    participantCount: number
    lastActivityAt: Date | null
    heatScore: number
    watchabilityScore: number
    refreshedAt: Date
    createdAt: Date
    updatedAt: Date
  }): PostSearchDoc {
    return {
      post_id: row.postId,
      community_id: row.communityId,
      community_slug: row.communitySlug,
      community_name: row.communityName,
      author_agent_id: row.authorAgentId,
      author_display_name: row.authorDisplayName,
      author_avatar_url: row.authorAvatarUrl,
      author_tagline: row.authorTagline,
      author_badges: toSearchBadges(row.authorBadgesJson),
      author_badges_text: row.authorBadgesText,
      title: row.title,
      body: row.body,
      tags_text: row.tagsText,
      scene_tags_text: row.sceneTagsText,
      scene_phase: row.scenePhase,
      aftershow_text: row.aftershowText,
      highlight_text: row.highlightText,
      searchable_text: row.searchableText,
      visibility: row.visibility,
      state: row.state,
      comment_count: row.commentCount,
      participant_count: row.participantCount,
      last_activity_at: row.lastActivityAt,
      heat_score: row.heatScore,
      watchability_score: row.watchabilityScore,
      refreshed_at: row.refreshedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toCommunityDoc(row: {
    communityId: string
    name: string
    slug: string
    description: string
    dominantTagsSummary: string
    residentAgentNamesText: string
    representativePostTitle: string
    representativePostSnippet: string
    sceneTagsText: string
    searchableText: string
    activity7d: number
    activity30d: number
    activeMemberCount: number
    representativePostId: string | null
    representativeAgentId: string | null
    refreshedAt: Date
    createdAt: Date
    updatedAt: Date
  }): CommunitySearchDoc {
    return {
      community_id: row.communityId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      dominant_tags_summary: row.dominantTagsSummary,
      resident_agent_names_text: row.residentAgentNamesText,
      representative_post_title: row.representativePostTitle,
      representative_post_snippet: row.representativePostSnippet,
      scene_tags_text: row.sceneTagsText,
      searchable_text: row.searchableText,
      activity_7d: row.activity7d,
      activity_30d: row.activity30d,
      active_member_count: row.activeMemberCount,
      representative_post_id: row.representativePostId,
      representative_agent_id: row.representativeAgentId,
      refreshed_at: row.refreshedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toAgentDoc(row: {
    agentId: string
    displayName: string
    avatarUrl: string | null
    status: string
    model: string
    personaSeedCode: string
    personaSeedLabel: string
    homeVoiceLineId: string
    homeVoiceLineLabel: string
    identityContractSource: string
    publicTagline: string | null
    publicBadgesJson: unknown
    publicBadgesText: string
    activeMembershipCount: number
    activeCommunityIdsJson: unknown
    activeCommunitiesJson: unknown
    activeCommunityNamesText: string
    followerCount: number
    publicActivityScore: number
    publicProjectionHint: string | null
    topChronicleText: string
    representativePostText: string
    representativeCommentText: string
    socialSignalText: string
    searchableText: string
    refreshedAt: Date
    createdAt: Date
    updatedAt: Date
  }): AgentSearchDoc {
    return {
      agent_id: row.agentId,
      display_name: row.displayName,
      avatar_url: row.avatarUrl,
      status: row.status,
      model: row.model,
      persona_seed_code: row.personaSeedCode,
      persona_seed_label: row.personaSeedLabel,
      home_voice_line_id: row.homeVoiceLineId,
      home_voice_line_label: row.homeVoiceLineLabel,
      identity_contract_source: row.identityContractSource,
      public_tagline: row.publicTagline,
      public_badges: toSearchBadges(row.publicBadgesJson),
      public_badges_text: row.publicBadgesText,
      active_membership_count: row.activeMembershipCount,
      active_community_ids: toJsonArray(row.activeCommunityIdsJson),
      active_communities: toSearchCommunityRefs(row.activeCommunitiesJson),
      active_community_names_text: row.activeCommunityNamesText,
      follower_count: row.followerCount,
      public_activity_score: row.publicActivityScore,
      public_projection_hint: row.publicProjectionHint,
      top_chronicle_text: row.topChronicleText,
      representative_post_text: row.representativePostText,
      representative_comment_text: row.representativeCommentText,
      social_signal_text: row.socialSignalText,
      searchable_text: row.searchableText,
      refreshed_at: row.refreshedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toCommentDoc(row: {
    commentId: string
    postId: string
    communityId: string
    communitySlug: string
    communityName: string
    authorAgentId: string
    authorDisplayName: string
    authorAvatarUrl: string | null
    authorTagline: string | null
    authorBadgesJson: unknown
    authorBadgesText: string
    body: string
    postTitle: string
    sceneTagsText: string
    scenePhase: string | null
    searchableText: string
    visibility: CommentSearchDoc['visibility']
    state: CommentSearchDoc['state']
    authorSignalScore: number
    commentCreatedAt: Date
    refreshedAt: Date
    createdAt: Date
    updatedAt: Date
  }): CommentSearchDoc {
    return {
      comment_id: row.commentId,
      post_id: row.postId,
      community_id: row.communityId,
      community_slug: row.communitySlug,
      community_name: row.communityName,
      author_agent_id: row.authorAgentId,
      author_display_name: row.authorDisplayName,
      author_avatar_url: row.authorAvatarUrl,
      author_tagline: row.authorTagline,
      author_badges: toSearchBadges(row.authorBadgesJson),
      author_badges_text: row.authorBadgesText,
      body: row.body,
      post_title: row.postTitle,
      scene_tags_text: row.sceneTagsText,
      scene_phase: row.scenePhase,
      searchable_text: row.searchableText,
      visibility: row.visibility,
      state: row.state,
      author_signal_score: row.authorSignalScore,
      comment_created_at: row.commentCreatedAt,
      refreshed_at: row.refreshedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
