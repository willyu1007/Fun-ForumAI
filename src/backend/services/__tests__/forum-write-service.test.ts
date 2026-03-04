import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ForumWriteService, type ModerationEvaluator } from '../forum-write-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryEventRepository, InMemoryAgentRunRepository } from '../../repos/event-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryAgentCommunityMembershipRepository } from '../../repos/agent-community-membership-repository.js'
import type { ModerationResult } from '../../moderation/types.js'
import { config } from '../../lib/config.js'

const CLEAN_RESULT: ModerationResult = {
  risk_level: 'low',
  risk_score: 0,
  risk_categories: ['clean'],
  visibility: 'PUBLIC',
  state: 'APPROVED',
  verdict: 'APPROVE',
  details: {
    rule_filter: { passed: true, matched_rules: [] },
    classifier_score: 0,
    classifier_categories: ['clean'],
    decision_reason: 'clean content',
    fail_closed: false,
  },
}

const GRAY_RESULT: ModerationResult = {
  ...CLEAN_RESULT,
  risk_level: 'medium',
  risk_score: 0.5,
  visibility: 'GRAY',
  state: 'PENDING',
  verdict: 'FOLD',
}

function setup(modResult: ModerationResult = CLEAN_RESULT) {
  const postRepo = new InMemoryPostRepository()
  const commentRepo = new InMemoryCommentRepository()
  const voteRepo = new InMemoryVoteRepository()
  const eventRepo = new InMemoryEventRepository()
  const agentRunRepo = new InMemoryAgentRunRepository()
  const communityRepo = new InMemoryCommunityRepository()
  const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
  const community = communityRepo.create({
    name: 'Test Community',
    slug: `test-community-${Date.now()}`,
  })
  void membershipRepo.upsertActive({ agent_id: 'a0', community_id: community.id })
  void membershipRepo.upsertActive({ agent_id: 'a1', community_id: community.id })
  void membershipRepo.upsertActive({ agent_id: 'a2', community_id: community.id })
  const moderator: ModerationEvaluator = { evaluate: () => modResult }
  const svc = new ForumWriteService({
    postRepo,
    commentRepo,
    voteRepo,
    eventRepo,
    agentRunRepo,
    communityRepo,
    membershipRepo,
    moderator,
  })
  return { svc, postRepo, commentRepo, voteRepo, eventRepo, agentRunRepo, communityId: community.id, membershipRepo }
}

describe('ForumWriteService', () => {
  describe('createPost', () => {
    it('creates a post with moderation results', async () => {
      const { svc, postRepo, eventRepo, communityId } = setup()
      const result = await svc.createPost({
        actor_agent_id: 'a1',
        run_id: 'run_1',
        community_id: communityId,
        title: 'Hello',
        body: 'World',
      })

      expect(result.post.title).toBe('Hello')
      expect(result.post.visibility).toBe('PUBLIC')
      expect(result.post.state).toBe('APPROVED')
      expect(result.moderation.verdict).toBe('APPROVE')
      expect(result.event.event_type).toBe('POST_CREATED')
      expect(result.agentRun.agent_id).toBe('a1')

      expect(await postRepo.findById(result.post.id)).toBeTruthy()
      expect(eventRepo.findById(result.event.id)).toBeTruthy()
    })

    it('applies moderation visibility when content is risky', async () => {
      const { svc, communityId } = setup(GRAY_RESULT)
      const result = await svc.createPost({
        actor_agent_id: 'a1',
        run_id: 'run_1',
        community_id: communityId,
        title: 'Hello',
        body: 'Some risky content',
      })
      expect(result.post.visibility).toBe('GRAY')
      expect(result.post.state).toBe('PENDING')
    })

    it('throws on empty title', async () => {
      const { svc, communityId } = setup()
      await expect(
        svc.createPost({
          actor_agent_id: 'a1',
          run_id: 'r1',
          community_id: communityId,
          title: '  ',
          body: 'OK',
        }),
      ).rejects.toThrow('Title is required')
    })

    it('throws on empty body', async () => {
      const { svc, communityId } = setup()
      await expect(
        svc.createPost({
          actor_agent_id: 'a1',
          run_id: 'r1',
          community_id: communityId,
          title: 'OK',
          body: '',
        }),
      ).rejects.toThrow('Body is required')
    })

    it('blocks post write when membership status is MUTED', async () => {
      const featureFlags = config.features as unknown as Record<string, boolean>
      const originalMembershipStatus = featureFlags.membershipStatusV1
      featureFlags.membershipStatusV1 = true

      try {
        const { svc, communityId, membershipRepo } = setup()
        await membershipRepo.updateStatus({
          agent_id: 'a1',
          community_id: communityId,
          status: 'MUTED',
          reason: 'test',
          set_by: 'admin',
        })

        await expect(
          svc.createPost({
            actor_agent_id: 'a1',
            run_id: 'r-muted',
            community_id: communityId,
            title: 'Muted title',
            body: 'Muted body',
          }),
        ).rejects.toThrow('cannot write runtime content')
      } finally {
        featureFlags.membershipStatusV1 = originalMembershipStatus
      }
    })
  })

  describe('createComment', () => {
    let ctx: ReturnType<typeof setup>
    let postId: string

    beforeEach(async () => {
      ctx = setup()
      const post = await ctx.postRepo.create({
        community_id: ctx.communityId,
        author_agent_id: 'a0',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      postId = post.id
    })

    it('creates a comment on an existing post', async () => {
      const result = await ctx.svc.createComment({
        actor_agent_id: 'a1',
        run_id: 'r1',
        post_id: postId,
        body: 'Great!',
      })
      expect(result.comment.body).toBe('Great!')
      expect(result.event.event_type).toBe('COMMENT_CREATED')
    })

    it('supports nested comments', async () => {
      const parent = await ctx.svc.createComment({
        actor_agent_id: 'a1',
        run_id: 'r1',
        post_id: postId,
        body: 'Parent',
      })
      const child = await ctx.svc.createComment({
        actor_agent_id: 'a2',
        run_id: 'r2',
        post_id: postId,
        parent_comment_id: parent.comment.id,
        body: 'Reply',
      })
      expect(child.comment.parent_comment_id).toBe(parent.comment.id)
    })

    it('throws for nonexistent post', async () => {
      await expect(
        ctx.svc.createComment({
          actor_agent_id: 'a1',
          run_id: 'r1',
          post_id: 'nope',
          body: 'Hi',
        }),
      ).rejects.toThrow('not found')
    })

    it('throws for nonexistent parent comment', async () => {
      await expect(
        ctx.svc.createComment({
          actor_agent_id: 'a1',
          run_id: 'r1',
          post_id: postId,
          parent_comment_id: 'nope',
          body: 'Hi',
        }),
      ).rejects.toThrow('not found')
    })

    it('throws on empty body', async () => {
      await expect(
        ctx.svc.createComment({
          actor_agent_id: 'a1',
          run_id: 'r1',
          post_id: postId,
          body: '',
        }),
      ).rejects.toThrow('Body is required')
    })
  })

  describe('upsertVote', () => {
    let ctx: ReturnType<typeof setup>
    let postId: string

    beforeEach(async () => {
      ctx = setup()
      const post = await ctx.postRepo.create({
        community_id: ctx.communityId,
        author_agent_id: 'a0',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      postId = post.id
    })

    it('creates a vote and emits an event', async () => {
      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r1',
        target_type: 'POST',
        target_id: postId,
        direction: 'UP',
      })
      expect(result.vote.direction).toBe('UP')
      expect(result.event.event_type).toBe('VOTE_CAST')
      expect((result.event.payload_json as Record<string, unknown>).community_id).toBe(ctx.communityId)
    })

    it('resolves community_id for comment vote events', async () => {
      const comment = await ctx.svc.createComment({
        actor_agent_id: 'a2',
        run_id: 'r-comment',
        post_id: postId,
        body: 'Comment target',
      })

      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r1',
        target_type: 'COMMENT',
        target_id: comment.comment.id,
        direction: 'UP',
      })

      expect(result.event.event_type).toBe('VOTE_CAST')
      expect((result.event.payload_json as Record<string, unknown>).community_id).toBe(ctx.communityId)
    })

    it('notifies event hook after vote creation', async () => {
      const hook = vi.fn()
      ctx.svc.setEventHook(hook)

      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r1',
        target_type: 'POST',
        target_id: postId,
        direction: 'UP',
      })

      expect(hook).toHaveBeenCalledTimes(1)
      expect(hook).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result.event.id,
          event_type: 'VOTE_CAST',
        }),
      )
    })

    it('throws for nonexistent post target', async () => {
      await expect(
        ctx.svc.upsertVote({
          actor_agent_id: 'a1',
          run_id: 'r1',
          target_type: 'POST',
          target_id: 'nope',
          direction: 'UP',
        }),
      ).rejects.toThrow('not found')
    })

    it('throws for nonexistent comment target', async () => {
      await expect(
        ctx.svc.upsertVote({
          actor_agent_id: 'a1',
          run_id: 'r1',
          target_type: 'COMMENT',
          target_id: 'nope',
          direction: 'UP',
        }),
      ).rejects.toThrow('not found')
    })

    it('upserts the same vote from the same agent', async () => {
      await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r1',
        target_type: 'POST',
        target_id: postId,
        direction: 'UP',
      })
      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r2',
        target_type: 'POST',
        target_id: postId,
        direction: 'DOWN',
      })
      expect(result.vote.direction).toBe('DOWN')
    })
  })
})
