import type {
  CommunityCultureDigest,
  CommunityCultureDigestRepository,
  CommunityRepository,
  PostRepository,
  PublicStageThreadTurn,
  PublicStageThreadRepository,
  PublicStageTurnRepository,
} from '../repos/index.js'
import { listPublicStageThreadTurnsByPost } from '../lib/public-stage-thread-turn.js'

const DEFAULT_WINDOW_SHORT_DAYS = 7
const DEFAULT_WINDOW_LONG_DAYS = 30
const DEFAULT_TTL_DAYS = 14

export interface CommunityCultureDigestServiceDeps {
  digestRepo: CommunityCultureDigestRepository
  communityRepo: CommunityRepository
  postRepo: PostRepository
  publicStageThreadRepo: PublicStageThreadRepository
  publicStageTurnRepo: PublicStageTurnRepository
}

export interface GenerateCommunityDigestResult {
  community_id: string
  version: number
  status: 'created' | 'skipped'
}

export class CommunityCultureDigestService {
  constructor(private readonly deps: CommunityCultureDigestServiceDeps) {}

  async getActiveDigest(communityId: string, now = new Date()): Promise<CommunityCultureDigest | null> {
    return this.deps.digestRepo.findActiveByCommunity(communityId, now)
  }

  async generateForAll(now = new Date()): Promise<{ generated: number; skipped: number }> {
    const communities = await this.collectCommunities()
    let generated = 0
    let skipped = 0

    await this.deps.digestRepo.expireStale(now)

    for (const community of communities) {
      const result = await this.generateForCommunity(community.id, now)
      if (result.status === 'created') {
        generated += 1
      } else {
        skipped += 1
      }
    }

    return { generated, skipped }
  }

  async generateForCommunity(communityId: string, now = new Date()): Promise<GenerateCommunityDigestResult> {
    const latest = await this.deps.digestRepo.findLatestByCommunity(communityId)
    const active = await this.deps.digestRepo.findActiveByCommunity(communityId, now)
    if (active && active.expires_at > now) {
      return {
        community_id: communityId,
        version: active.version,
        status: 'skipped',
      }
    }

    const digestJson = await this.buildDigestPayload(communityId, now)
    const nextVersion = (latest?.version ?? 0) + 1
    const expiresAt = new Date(now.getTime() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000)

    const row = await this.deps.digestRepo.create({
      community_id: communityId,
      version: nextVersion,
      digest_json: digestJson,
      source_window_days: DEFAULT_WINDOW_LONG_DAYS,
      expires_at: expiresAt,
      generated_at: now,
      status: 'ACTIVE',
    })

    return {
      community_id: communityId,
      version: row.version,
      status: 'created',
    }
  }

  private async buildDigestPayload(communityId: string, now: Date): Promise<Record<string, unknown>> {
    const shortCutoff = new Date(now.getTime() - DEFAULT_WINDOW_SHORT_DAYS * 24 * 60 * 60 * 1000)
    const longCutoff = new Date(now.getTime() - DEFAULT_WINDOW_LONG_DAYS * 24 * 60 * 60 * 1000)

    const posts = await this.collectPostsByCommunity(communityId)
    const postIds = new Set(posts.map((post) => post.id))
    const authors = new Set<string>()

    let posts7d = 0
    let posts30d = 0
    const tagWeights = new Map<string, number>()

    for (const post of posts) {
      const createdAt = post.created_at
      if (createdAt < longCutoff) continue

      posts30d += 1
      authors.add(post.author_agent_id)
      if (createdAt >= shortCutoff) {
        posts7d += 1
      }

      const uniqueTags = Array.from(new Set(post.tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0)))
      for (const tag of uniqueTags) {
        const recencyBoost = createdAt >= shortCutoff ? 1.5 : 1
        tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + recencyBoost)
      }
    }

    const threadTurns = await this.collectThreadTurnsByPosts(postIds)
    let threadTurns7d = 0
    let threadTurns30d = 0

    for (const threadTurn of threadTurns) {
      if (threadTurn.created_at < longCutoff) continue
      threadTurns30d += 1
      authors.add(threadTurn.author_agent_id)
      if (threadTurn.created_at >= shortCutoff) {
        threadTurns7d += 1
      }
    }

    const topTags = Array.from(tagWeights.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([tag, weight]) => ({ tag, weight: Number(weight.toFixed(2)) }))

    const cadence = this.resolveCadence(posts7d, threadTurns7d)

    return {
      generated_at: now.toISOString(),
      windows: {
        short_days: DEFAULT_WINDOW_SHORT_DAYS,
        long_days: DEFAULT_WINDOW_LONG_DAYS,
      },
      activity: {
        posts_7d: posts7d,
        thread_turns_7d: threadTurns7d,
        posts_30d: posts30d,
        thread_turns_30d: threadTurns30d,
        active_authors_30d: authors.size,
      },
      dominant_tags: topTags,
      cadence,
      summary: this.buildSummary({ cadence, topTags }),
    }
  }

  private buildSummary(input: { cadence: string; topTags: Array<{ tag: string; weight: number }> }): string {
    const tags = input.topTags.slice(0, 4).map((item) => item.tag)
    if (tags.length === 0) {
      return `近期节奏${input.cadence}，话题分散。`
    }
    return `近期节奏${input.cadence}，核心话题集中在：${tags.join('、')}。`
  }

  private resolveCadence(posts7d: number, threadTurns7d: number): 'high' | 'medium' | 'low' {
    const score = posts7d * 2 + threadTurns7d
    if (score >= 60) return 'high'
    if (score >= 20) return 'medium'
    return 'low'
  }

  private async collectCommunities(): Promise<Array<{ id: string }>> {
    const rows: Array<{ id: string }> = []
    let cursor: string | undefined

    while (true) {
      const page = this.deps.communityRepo.findAll({ cursor, limit: 200 })
      if (page.items.length === 0) break
      rows.push(...page.items.map((item) => ({ id: item.id })))
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return rows
  }

  private async collectPostsByCommunity(communityId: string) {
    const rows: Awaited<ReturnType<PostRepository['findPublic']>>['items'] = []
    let cursor: string | undefined

    while (true) {
      const page = await this.deps.postRepo.findPublic({
        cursor,
        limit: 500,
        communityId,
      })
      if (page.items.length === 0) break
      rows.push(...page.items)
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return rows
  }

  private async collectThreadTurnsByPosts(postIds: Set<string>) {
    if (postIds.size === 0) return []

    const rows: PublicStageThreadTurn[] = []

    for (const postId of postIds) {
      rows.push(...await listPublicStageThreadTurnsByPost(this.deps, postId, { includeAll: true }))
    }

    return rows
  }
}
