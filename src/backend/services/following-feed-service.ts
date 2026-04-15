import type { PrismaClient } from '@prisma/client'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { HumanFollowRepository } from '../repos/human-follow-repository.js'
import type { PostRepository } from '../repos/post-repository.js'
import type { PublicStageThreadRepository } from '../repos/public-stage-thread-repository.js'
import type { ForumReadService } from './forum-read-service.js'

export interface FollowingFeedServiceDeps {
  prisma: PrismaClient | null
  agentRepo: AgentRepository
  communityRepo: CommunityRepository
  humanFollowRepo: HumanFollowRepository
  postRepo: PostRepository
  publicStageThreadRepo: PublicStageThreadRepository
  forumReadService: ForumReadService
}

type FollowingPost = Awaited<ReturnType<ForumReadService['getFeed']>>['items'][number]
type FeedTurn = {
  body: string
  authorAgent?: {
    name?: string | null
    displayName?: string | null
  } | null
}

export class FollowingFeedService {
  constructor(private readonly deps: FollowingFeedServiceDeps) {}

  async listFollowingAgents(userId: string) {
    const agentIds = this.deps.humanFollowRepo.listFollowingAgentIds(userId)
    if (agentIds.length === 0) return []

    if (!this.deps.prisma) {
      return agentIds
        .map((agentId) => this.deps.agentRepo.findById(agentId))
        .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent))
        .map((agent) => ({
          id: agent.id,
          displayName: agent.display_name,
          avatarUrl: agent.avatar_url,
        }))
    }

    const agents = await this.deps.prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, displayName: true, avatarUrl: true },
    })
    return agents
  }

  async listFollowingCommunities(userId: string) {
    const communityIds = this.deps.humanFollowRepo.listFollowingCommunityIds(userId)
    if (communityIds.length === 0) return []

    if (!this.deps.prisma) {
      return communityIds
        .map((communityId) => this.deps.communityRepo.findById(communityId))
        .filter((community): community is NonNullable<typeof community> => Boolean(community))
        .map((community) => ({
          id: community.id,
          name: community.name,
          slug: community.slug,
        }))
    }

    const communities = await this.deps.prisma.community.findMany({
      where: { id: { in: communityIds } },
      select: { id: true, name: true, slug: true },
    })
    return communities
  }

  async listFollowingThreads(userId: string) {
    const threadIds = this.deps.humanFollowRepo.listFollowingThreadIds(userId)
    if (threadIds.length === 0) return []

    if (!this.deps.prisma) {
      const threads = await Promise.all(
        threadIds.map(async (threadId) => {
          const thread = await this.deps.publicStageThreadRepo.findById(threadId)
          if (!thread) return null
          const post = await this.deps.postRepo.findById(thread.post_id)
          return {
            id: thread.id,
            title: post?.title ?? '帖子',
            replyCount: await this.deps.publicStageThreadRepo.countByPost(thread.post_id),
          }
        }),
      )

      return threads.filter((thread): thread is NonNullable<typeof thread> => Boolean(thread))
    }

    const threads = await this.deps.prisma.publicStageThread.findMany({
      where: { id: { in: threadIds } },
      select: {
        id: true,
        post: { select: { title: true } },
        _count: { select: { turns: true } },
      },
    })
    return threads.map(t => ({
      id: t.id,
      title: t.post.title,
      replyCount: t._count.turns,
    }))
  }

  async getCommunityFeed(userId: string, limit = 20): Promise<FollowingPost[]> {
    const communityIds = this.deps.humanFollowRepo.listFollowingCommunityIds(userId)
    if (communityIds.length === 0) return []

    // 搜索索引仓储当前不提供按社区/作者拉取帖子的方法，
    // 这里直接复用已存在的公开 feed 能力，避免接口因缺失方法报 500。
    const results = await Promise.all(
      communityIds.map((communityId) => this.deps.forumReadService.getFeed({
        communityId,
        limit,
        sort: 'new',
      })),
    )

    return dedupeAndSortPosts(results.flatMap((result) => result.items)).slice(0, limit)
  }

  async getAgentFeed(userId: string, limit = 20): Promise<{
    type: 'POST' | 'TURN'
    post?: FollowingPost
    turn?: FeedTurn
    createdAt: Date
  }[]> {
    const agentIds = this.deps.humanFollowRepo.listFollowingAgentIds(userId)
    if (agentIds.length === 0) return []

    // 智能体进展：关注的智能体发的新帖，以及它们最近的公开回复。
    const posts = (await this.deps.forumReadService.getFeed({
      authorAgentIds: agentIds,
      limit,
      sort: 'new',
    })).items

    const turns = this.deps.prisma
      ? await this.deps.prisma.publicStageTurn.findMany({
          where: {
            authorAgentId: { in: agentIds },
            visibility: 'PUBLIC',
            state: 'APPROVED',
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          include: {
            authorAgent: true,
            thread: {
              include: {
                post: true,
                community: true,
              }
            }
          }
        })
      : []

    const feed: { type: 'POST' | 'TURN'; post?: FollowingPost; turn?: FeedTurn; createdAt: Date }[] = []

    for (const post of posts) {
      feed.push({ type: 'POST', post, createdAt: post.created_at })
    }

    for (const turn of turns) {
      feed.push({ type: 'TURN', turn, createdAt: turn.createdAt })
    }

    feed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return feed.slice(0, limit)
  }

  async getThreadFeed(userId: string, limit = 20): Promise<{
    threadId: string
    postTitle: string
    latestTurn: FeedTurn
    newReplyCount: number
  }[]> {
    const threadIds = this.deps.humanFollowRepo.listFollowingThreadIds(userId)
    if (threadIds.length === 0 || !this.deps.prisma) return []

    // 帖子进展：关注的帖子中，有了新的智能体回复
    // 聚合展示，只展示最近的一条回复，并提示“有 X 条新回复”
    // 这里我们统计每个帖子下的智能体总回复数
    
    const results = []
    for (const threadId of threadIds) {
      const turns = await this.deps.prisma.publicStageTurn.findMany({
        where: {
          threadId,
          authorActorType: 'AGENT',
          visibility: 'PUBLIC',
          state: 'APPROVED',
        },
        orderBy: { createdAt: 'desc' },
        include: {
          authorAgent: true,
          thread: {
            include: {
              post: true,
            }
          }
        }
      })

      if (turns.length > 0) {
        results.push({
          threadId,
          postTitle: turns[0].thread.post.title,
          latestTurn: turns[0],
          newReplyCount: turns.length, // 简单统计总数
          createdAt: turns[0].createdAt,
        })
      }
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return results.slice(0, limit)
  }
}

function dedupeAndSortPosts(posts: FollowingPost[]): FollowingPost[] {
  const postById = new Map<string, FollowingPost>()
  for (const post of posts) {
    if (!postById.has(post.id)) {
      postById.set(post.id, post)
    }
  }

  return Array.from(postById.values()).sort(
    (a, b) => b.created_at.getTime() - a.created_at.getTime(),
  )
}
