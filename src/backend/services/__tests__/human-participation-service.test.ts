import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryHumanVoteRepository } from '../../repos/human-vote-repository.js'
import { InMemoryHumanFollowRepository } from '../../repos/human-follow-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { HumanParticipationService, HUMAN_VOTE_WEIGHT } from '../human-participation-service.js'

function createService() {
  const postRepo = new InMemoryPostRepository()
  const commentRepo = new InMemoryCommentRepository()
  const voteRepo = new InMemoryVoteRepository()
  const humanVoteRepo = new InMemoryHumanVoteRepository()
  const humanFollowRepo = new InMemoryHumanFollowRepository()
  const agentRepo = new InMemoryAgentRepository()
  const eventRepo = new InMemoryEventRepository()

  const service = new HumanParticipationService({
    postRepo,
    commentRepo,
    voteRepo,
    humanVoteRepo,
    humanFollowRepo,
    agentRepo,
    eventRepo,
  })

  return { service, postRepo, commentRepo, voteRepo, humanVoteRepo, humanFollowRepo, agentRepo, eventRepo }
}

describe('HumanParticipationService', () => {
  let ctx: ReturnType<typeof createService>

  beforeEach(() => {
    ctx = createService()
  })

  describe('upsertHumanVote', () => {
    it('creates a new vote and returns correct summary', async () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Agent1' })
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: agent.id,
        title: 'Test',
        body: 'body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const result = await ctx.service.upsertHumanVote({
        voter_user_id: 'user1',
        target_type: 'POST',
        target_id: post.id,
        direction: 'UP',
      })

      expect(result.vote.direction).toBe('UP')
      expect(result.summary.human_up).toBe(1)
      expect(result.summary.human_down).toBe(0)
      expect(result.summary.weighted_score).toBe(Number((0 + 1 * HUMAN_VOTE_WEIGHT).toFixed(2)))
    })

    it('upserts same voter to change direction', async () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Agent1' })
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: agent.id,
        title: 'Test',
        body: 'body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      await ctx.service.upsertHumanVote({
        voter_user_id: 'user1',
        target_type: 'POST',
        target_id: post.id,
        direction: 'UP',
      })

      const result = await ctx.service.upsertHumanVote({
        voter_user_id: 'user1',
        target_type: 'POST',
        target_id: post.id,
        direction: 'DOWN',
      })

      expect(result.vote.direction).toBe('DOWN')
      expect(result.summary.human_up).toBe(0)
      expect(result.summary.human_down).toBe(1)
    })

    it('throws NotFoundError when target post does not exist', async () => {
      await expect(
        ctx.service.upsertHumanVote({
          voter_user_id: 'user1',
          target_type: 'POST',
          target_id: 'nonexistent',
          direction: 'UP',
        }),
      ).rejects.toThrow('Post')
    })

    it('throws ValidationError for missing voter_user_id', async () => {
      await expect(
        ctx.service.upsertHumanVote({
          voter_user_id: '',
          target_type: 'POST',
          target_id: 'p1',
          direction: 'UP',
        }),
      ).rejects.toThrow('voter_user_id is required')
    })
  })

  describe('getVoteSummary', () => {
    it('combines agent and human votes with correct weighting', async () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Agent1' })
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: agent.id,
        title: 'Test',
        body: 'body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      ctx.voteRepo.upsert({
        voter_agent_id: agent.id,
        target_type: 'POST',
        target_id: post.id,
        direction: 'UP',
      })

      await ctx.humanVoteRepo.upsert({
        voter_user_id: 'user1',
        target_type: 'POST',
        target_id: post.id,
        direction: 'UP',
      })
      await ctx.humanVoteRepo.upsert({
        voter_user_id: 'user2',
        target_type: 'POST',
        target_id: post.id,
        direction: 'UP',
      })
      await ctx.humanVoteRepo.upsert({
        voter_user_id: 'user3',
        target_type: 'POST',
        target_id: post.id,
        direction: 'DOWN',
      })

      const summary = ctx.service.getVoteSummary('POST', post.id)
      expect(summary.agent_up).toBe(1)
      expect(summary.agent_score).toBe(1)
      expect(summary.human_up).toBe(2)
      expect(summary.human_down).toBe(1)
      expect(summary.human_score).toBe(1)
      expect(summary.weighted_score).toBe(Number((1 + 1 * HUMAN_VOTE_WEIGHT).toFixed(2)))
    })
  })

  describe('followAgent / unfollowAgent', () => {
    it('follows an agent and returns follow data', async () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Agent1' })
      const result = await ctx.service.followAgent('user1', agent.id)

      expect(result.follow_id).toBeTruthy()
      expect(result.created_at).toBeTruthy()
      expect(ctx.service.isFollowing('user1', agent.id)).toBe(true)
    })

    it('follow is idempotent', async () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Agent1' })
      const first = await ctx.service.followAgent('user1', agent.id)
      const second = await ctx.service.followAgent('user1', agent.id)

      expect(first.follow_id).toBe(second.follow_id)
    })

    it('unfollows an agent', async () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Agent1' })
      await ctx.service.followAgent('user1', agent.id)

      const result = await ctx.service.unfollowAgent('user1', agent.id)
      expect(result.removed).toBe(true)
      expect(ctx.service.isFollowing('user1', agent.id)).toBe(false)
    })

    it('unfollow returns false when not following', async () => {
      const result = await ctx.service.unfollowAgent('user1', 'nonexistent')
      expect(result.removed).toBe(false)
    })

    it('throws NotFoundError when agent does not exist', async () => {
      await expect(ctx.service.followAgent('user1', 'nonexistent')).rejects.toThrow('Agent')
    })
  })
})
