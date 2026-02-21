import { describe, it, expect, beforeEach } from 'vitest'
import { ForumReadService } from '../forum-read-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'

function setup() {
  const postRepo = new InMemoryPostRepository()
  const commentRepo = new InMemoryCommentRepository()
  const voteRepo = new InMemoryVoteRepository()
  const communityRepo = new InMemoryCommunityRepository()
  const svc = new ForumReadService({ postRepo, commentRepo, voteRepo, communityRepo })
  return { svc, postRepo, commentRepo, voteRepo, communityRepo }
}

describe('ForumReadService', () => {
  let ctx: ReturnType<typeof setup>

  beforeEach(() => {
    ctx = setup()
  })

  describe('getFeed', () => {
    it('returns empty feed', () => {
      const result = ctx.svc.getFeed({})
      expect(result.items).toHaveLength(0)
    })

    it('returns approved posts with meta', () => {
      const post = ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'Hello',
        body: 'World',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      ctx.commentRepo.create({
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

      const result = ctx.svc.getFeed({})
      expect(result.items).toHaveLength(1)
      expect(result.items[0].comment_count).toBe(1)
      expect(result.items[0].vote_score).toBe(1)
    })

    it('filters by communityId', () => {
      ctx.postRepo.create({
        community_id: 'c1', author_agent_id: 'a1', title: 'A', body: 'B',
        visibility: 'PUBLIC', state: 'APPROVED',
      })
      ctx.postRepo.create({
        community_id: 'c2', author_agent_id: 'a1', title: 'C', body: 'D',
        visibility: 'PUBLIC', state: 'APPROVED',
      })

      const result = ctx.svc.getFeed({ communityId: 'c1' })
      expect(result.items).toHaveLength(1)
    })

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) {
        ctx.postRepo.create({
          community_id: 'c1', author_agent_id: 'a1', title: `P${i}`, body: 'B',
          visibility: 'PUBLIC', state: 'APPROVED',
        })
      }
      const result = ctx.svc.getFeed({ limit: 2 })
      expect(result.items).toHaveLength(2)
      expect(result.next_cursor).toBeTruthy()
    })
  })

  describe('getPost', () => {
    it('returns the post with meta', () => {
      const post = ctx.postRepo.create({
        community_id: 'c1', author_agent_id: 'a1', title: 'T', body: 'B',
        visibility: 'PUBLIC', state: 'APPROVED',
      })
      const result = ctx.svc.getPost(post.id)
      expect(result.title).toBe('T')
      expect(result.comment_count).toBe(0)
      expect(result.vote_score).toBe(0)
    })

    it('throws NotFoundError for unknown id', () => {
      expect(() => ctx.svc.getPost('unknown')).toThrow('not found')
    })
  })

  describe('getComments', () => {
    it('returns comments for a post', () => {
      const post = ctx.postRepo.create({
        community_id: 'c1', author_agent_id: 'a1', title: 'T', body: 'B',
        visibility: 'PUBLIC', state: 'APPROVED',
      })
      ctx.commentRepo.create({
        post_id: post.id, author_agent_id: 'a2', body: 'C1',
        visibility: 'PUBLIC', state: 'APPROVED',
      })
      const result = ctx.svc.getComments(post.id, {})
      expect(result.items).toHaveLength(1)
    })

    it('throws for unknown post', () => {
      expect(() => ctx.svc.getComments('nope', {})).toThrow('not found')
    })
  })

  describe('getCommunities', () => {
    it('returns communities', () => {
      ctx.communityRepo.create({ name: 'Tech', slug: 'tech' })
      const result = ctx.svc.getCommunities({})
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
