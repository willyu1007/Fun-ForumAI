import { describe, it, expect, beforeEach } from 'vitest'
import { ForumReadService } from '../forum-read-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'

function setup() {
  const postRepo = new InMemoryPostRepository()
  const commentRepo = new InMemoryCommentRepository()
  const voteRepo = new InMemoryVoteRepository()
  const communityRepo = new InMemoryCommunityRepository()
  const agentRepo = new InMemoryAgentRepository()
  const svc = new ForumReadService({ postRepo, commentRepo, voteRepo, communityRepo, agentRepo })
  return { svc, postRepo, commentRepo, voteRepo, communityRepo, agentRepo }
}

describe('ForumReadService', () => {
  let ctx: ReturnType<typeof setup>

  beforeEach(() => {
    ctx = setup()
  })

  describe('getFeed', () => {
    it('returns empty feed', async () => {
      const result = await ctx.svc.getFeed({})
      expect(result.items).toHaveLength(0)
    })

    it('returns approved posts with meta', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'Hello',
        body: 'World',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a2',
        body: 'Nice!',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      ctx.voteRepo.upsert({
        voter_agent_id: 'a2',
        target_type: 'POST',
        target_id: post.id,
        direction: 'UP',
      })

      const result = await ctx.svc.getFeed({})
      expect(result.items).toHaveLength(1)
      expect(result.items[0].comment_count).toBe(1)
      expect(result.items[0].vote_score).toBe(1)
      expect(result.items[0].vote_up).toBe(1)
      expect(result.items[0].vote_down).toBe(0)
      expect(result.items[0].participant_count).toBe(2)
      expect(result.items[0].last_reply_at).toBeInstanceOf(Date)
      expect(Number.isFinite(result.items[0].heat_score)).toBe(true)
      expect(result.items[0].community_slug).toBe('c1')
      expect(result.items[0].community_name).toBe('c1')
    })

    it('filters by communityId', async () => {
      await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'A',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await ctx.postRepo.create({
        community_id: 'c2',
        author_agent_id: 'a1',
        title: 'C',
        body: 'D',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const result = await ctx.svc.getFeed({ communityId: 'c1' })
      expect(result.items).toHaveLength(1)
    })

    it('respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        await ctx.postRepo.create({
          community_id: 'c1',
          author_agent_id: 'a1',
          title: `P${i}`,
          body: 'B',
          visibility: 'PUBLIC',
          state: 'APPROVED',
        })
      }
      const result = await ctx.svc.getFeed({ limit: 2 })
      expect(result.items).toHaveLength(2)
      expect(result.next_cursor).toBeTruthy()
    })

    it('sorts hot by v2 score with recent activity signal', async () => {
      const old = new Date(Date.now() - 48 * 3_600_000)
      const stale = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'stale',
        body: 'x',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const active = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a2',
        title: 'active',
        body: 'x',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      stale.created_at = old
      stale.updated_at = old
      active.created_at = old
      active.updated_at = old

      await ctx.commentRepo.create({
        post_id: active.id,
        author_agent_id: 'a3',
        body: 'recent',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const result = await ctx.svc.getFeed({ sort: 'hot' })
      expect(result.items[0].id).toBe(active.id)
      expect(result.items[0].heat_score).toBeGreaterThanOrEqual(result.items[1].heat_score)
    })
  })

  describe('getPost', () => {
    it('returns the post with meta', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const result = await ctx.svc.getPost(post.id)
      expect(result.title).toBe('T')
      expect(result.comment_count).toBe(0)
      expect(result.vote_score).toBe(0)
      expect(result.vote_up).toBe(0)
      expect(result.vote_down).toBe(0)
      expect(result.participant_count).toBe(1)
      expect(result.last_reply_at).toBeNull()
      expect(Number.isFinite(result.heat_score)).toBe(true)
      expect(result.community_slug).toBe('c1')
      expect(result.community_name).toBe('c1')
    })

    it('throws NotFoundError for unknown id', async () => {
      await expect(ctx.svc.getPost('unknown')).rejects.toThrow('not found')
    })
  })

  describe('getComments', () => {
    it('returns comments for a post', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a2',
        body: 'C1',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const result = await ctx.svc.getComments(post.id, {})
      expect(result.items).toHaveLength(1)
    })

    it('throws for unknown post', async () => {
      await expect(ctx.svc.getComments('nope', {})).rejects.toThrow('not found')
    })
  })

  describe('getCommunities', () => {
    it('returns communities', async () => {
      ctx.communityRepo.create({ name: 'Tech', slug: 'tech' })
      const result = await ctx.svc.getCommunities({})
      expect(result.items).toHaveLength(1)
    })
  })

  describe('getVoteSummary', () => {
    it('returns vote counts', () => {
      ctx.voteRepo.upsert({ voter_agent_id: 'a1', target_type: 'POST', target_id: 'p1', direction: 'UP' })
      ctx.voteRepo.upsert({ voter_agent_id: 'a2', target_type: 'POST', target_id: 'p1', direction: 'DOWN' })
      const result = ctx.svc.getVoteSummary('POST', 'p1')
      expect(result.score).toBe(0)
    })
  })
})
