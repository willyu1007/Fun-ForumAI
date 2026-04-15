import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { AgentRepository } from '../../repos/agent-repository.js'
import type { CommunityRepository } from '../../repos/community-repository.js'
import type { HumanFollowRepository } from '../../repos/human-follow-repository.js'
import type { PostRepository } from '../../repos/post-repository.js'
import type { PublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import type { ForumReadService } from '../forum-read-service.js'
import { FollowingFeedService } from '../following-feed-service.js'

function buildService(overrides: {
  listFollowingCommunityIds?: string[]
  listFollowingAgentIds?: string[]
  listFollowingThreadIds?: string[]
  getFeedImpl?: (input: Record<string, unknown>) => Promise<{ items: Array<Record<string, unknown>> }>
  findManyImpl?: () => Promise<Array<Record<string, unknown>>>
  usePrisma?: boolean
} = {}) {
  const forumReadService = {
    getFeed: vi.fn(async (input: Record<string, unknown>) => (
      overrides.getFeedImpl
        ? overrides.getFeedImpl(input)
        : { items: [] }
    )),
  } as unknown as ForumReadService

  const prisma = overrides.usePrisma === false
    ? null
    : {
        publicStageTurn: {
          findMany: vi.fn(async () => (
            overrides.findManyImpl
              ? overrides.findManyImpl()
              : []
          )),
        },
        community: {
          findMany: vi.fn(async () => []),
        },
      } as unknown as PrismaClient

  const humanFollowRepo = {
    listFollowingCommunityIds: vi.fn(() => overrides.listFollowingCommunityIds ?? []),
    listFollowingAgentIds: vi.fn(() => overrides.listFollowingAgentIds ?? []),
    listFollowingThreadIds: vi.fn(() => overrides.listFollowingThreadIds ?? []),
  } as unknown as HumanFollowRepository

  const agentRepo = {
    findById: vi.fn((id: string) => ({
      id,
      display_name: `Agent ${id}`,
      avatar_url: `${id}.png`,
    })),
  } as unknown as AgentRepository
  const communityRepo = {
    findById: vi.fn((id: string) => ({
      id,
      name: `Community ${id}`,
      slug: `community-${id}`,
    })),
  } as unknown as CommunityRepository
  const postRepo = {
    findById: vi.fn(async (id: string) => ({
      id,
      title: `Post ${id}`,
    })),
  } as unknown as PostRepository
  const publicStageThreadRepo = {
    findById: vi.fn(async (id: string) => ({
      id,
      post_id: `post-${id}`,
    })),
    countByPost: vi.fn(async () => 3),
  } as unknown as PublicStageThreadRepository

  const service = new FollowingFeedService({
    prisma,
    agentRepo,
    communityRepo,
    humanFollowRepo,
    postRepo,
    publicStageThreadRepo,
    forumReadService,
  })

  return { service, forumReadService, prisma, agentRepo, communityRepo, postRepo, publicStageThreadRepo }
}

describe('FollowingFeedService', () => {
  it('builds agent feed from forumReadService posts instead of missing searchDocRepo helpers', async () => {
    const { service, forumReadService, prisma } = buildService({
      listFollowingAgentIds: ['agent-1'],
      getFeedImpl: async () => ({
        items: [{
          id: 'post-1',
          title: 'Agent post',
          body: 'post body',
          created_at: new Date('2026-04-15T10:00:00.000Z'),
        }],
      }),
      findManyImpl: async () => [{
        id: 'turn-1',
        body: 'reply body',
        createdAt: new Date('2026-04-15T11:00:00.000Z'),
      }],
    })

    const result = await service.getAgentFeed('user-1', 5)

    expect(forumReadService.getFeed).toHaveBeenCalledWith({
      authorAgentIds: ['agent-1'],
      limit: 5,
      sort: 'new',
    })
    expect(prisma.publicStageTurn.findMany).toHaveBeenCalledOnce()
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ type: 'TURN', turn: { id: 'turn-1', body: 'reply body' } })
    expect(result[1]).toMatchObject({ type: 'POST', post: { id: 'post-1', title: 'Agent post' } })
  })

  it('merges followed community posts through forumReadService and sorts them by recency', async () => {
    const { service, forumReadService } = buildService({
      listFollowingCommunityIds: ['community-a', 'community-b'],
      getFeedImpl: async (input) => ({
        items: input.communityId === 'community-a'
          ? [{
              id: 'post-a',
              title: 'From A',
              created_at: new Date('2026-04-15T09:00:00.000Z'),
            }]
          : [{
              id: 'post-b',
              title: 'From B',
              created_at: new Date('2026-04-15T12:00:00.000Z'),
            }],
      }),
    })

    const result = await service.getCommunityFeed('user-1', 5)

    expect(forumReadService.getFeed).toHaveBeenNthCalledWith(1, {
      communityId: 'community-a',
      limit: 5,
      sort: 'new',
    })
    expect(forumReadService.getFeed).toHaveBeenNthCalledWith(2, {
      communityId: 'community-b',
      limit: 5,
      sort: 'new',
    })
    expect(result.map((item) => item.id)).toEqual(['post-b', 'post-a'])
  })

  it('lists followed communities without prisma by falling back to communityRepo', async () => {
    const { service, communityRepo } = buildService({
      listFollowingCommunityIds: ['community-a', 'community-b'],
      usePrisma: false,
    })

    const result = await service.listFollowingCommunities('user-1')

    expect(communityRepo.findById).toHaveBeenNthCalledWith(1, 'community-a')
    expect(communityRepo.findById).toHaveBeenNthCalledWith(2, 'community-b')
    expect(result).toEqual([
      { id: 'community-a', name: 'Community community-a', slug: 'community-community-a' },
      { id: 'community-b', name: 'Community community-b', slug: 'community-community-b' },
    ])
  })

  it('lists followed agents without prisma by falling back to agentRepo', async () => {
    const { service, agentRepo } = buildService({
      listFollowingAgentIds: ['agent-a', 'agent-b'],
      usePrisma: false,
    })

    const result = await service.listFollowingAgents('user-1')

    expect(agentRepo.findById).toHaveBeenNthCalledWith(1, 'agent-a')
    expect(agentRepo.findById).toHaveBeenNthCalledWith(2, 'agent-b')
    expect(result).toEqual([
      { id: 'agent-a', displayName: 'Agent agent-a', avatarUrl: 'agent-a.png' },
      { id: 'agent-b', displayName: 'Agent agent-b', avatarUrl: 'agent-b.png' },
    ])
  })

  it('lists followed threads without prisma by falling back to thread and post repositories', async () => {
    const { service, publicStageThreadRepo, postRepo } = buildService({
      listFollowingThreadIds: ['thread-a', 'thread-b'],
      usePrisma: false,
    })

    const result = await service.listFollowingThreads('user-1')

    expect(publicStageThreadRepo.findById).toHaveBeenNthCalledWith(1, 'thread-a')
    expect(publicStageThreadRepo.findById).toHaveBeenNthCalledWith(2, 'thread-b')
    expect(postRepo.findById).toHaveBeenNthCalledWith(1, 'post-thread-a')
    expect(postRepo.findById).toHaveBeenNthCalledWith(2, 'post-thread-b')
    expect(result).toEqual([
      { id: 'thread-a', title: 'Post post-thread-a', replyCount: 3 },
      { id: 'thread-b', title: 'Post post-thread-b', replyCount: 3 },
    ])
  })
})
