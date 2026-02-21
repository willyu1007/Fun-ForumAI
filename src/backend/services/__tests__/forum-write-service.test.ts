import { describe, it, expect, beforeEach } from 'vitest'
import { ForumWriteService, type ModerationEvaluator } from '../forum-write-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryEventRepository, InMemoryAgentRunRepository } from '../../repos/event-repository.js'
import type { ModerationResult } from '../../moderation/types.js'

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
  const moderator: ModerationEvaluator = { evaluate: () => modResult }
  const svc = new ForumWriteService({
    postRepo, commentRepo, voteRepo, eventRepo, agentRunRepo, moderator,
  })
  return { svc, postRepo, commentRepo, voteRepo, eventRepo, agentRunRepo }
}

describe('ForumWriteService', () => {
  describe('createPost', () => {
    it('creates a post with moderation results', () => {
      const { svc, postRepo, eventRepo } = setup()
      const result = svc.createPost({
        actor_agent_id: 'a1',
        run_id: 'run_1',
        community_id: 'c1',
        title: 'Hello',
        body: 'World',
      })

      expect(result.post.title).toBe('Hello')
      expect(result.post.visibility).toBe('PUBLIC')
      expect(result.post.state).toBe('APPROVED')
      expect(result.moderation.verdict).toBe('APPROVE')
      expect(result.event.event_type).toBe('POST_CREATED')
      expect(result.agentRun.agent_id).toBe('a1')

      expect(postRepo.findById(result.post.id)).toBeTruthy()
      expect(eventRepo.findById(result.event.id)).toBeTruthy()
    })

    it('applies moderation visibility when content is risky', () => {
      const { svc } = setup(GRAY_RESULT)
      const result = svc.createPost({
        actor_agent_id: 'a1',
        run_id: 'run_1',
        community_id: 'c1',
        title: 'Hello',
        body: 'Some risky content',
      })
      expect(result.post.visibility).toBe('GRAY')
      expect(result.post.state).toBe('PENDING')
    })

    it('throws on empty title', () => {
      const { svc } = setup()
      expect(() =>
        svc.createPost({
          actor_agent_id: 'a1', run_id: 'r1', community_id: 'c1',
          title: '  ', body: 'OK',
        }),
      ).toThrow('Title is required')
    })

    it('throws on empty body', () => {
      const { svc } = setup()
      expect(() =>
        svc.createPost({
          actor_agent_id: 'a1', run_id: 'r1', community_id: 'c1',
          title: 'OK', body: '',
        }),
      ).toThrow('Body is required')
    })
  })

  describe('createComment', () => {
    let ctx: ReturnType<typeof setup>
    let postId: string

    beforeEach(() => {
      ctx = setup()
      const post = ctx.postRepo.create({
        community_id: 'c1', author_agent_id: 'a0', title: 'T', body: 'B',
        visibility: 'PUBLIC', state: 'APPROVED',
      })
      postId = post.id
    })

    it('creates a comment on an existing post', () => {
      const result = ctx.svc.createComment({
        actor_agent_id: 'a1', run_id: 'r1', post_id: postId, body: 'Great!',
      })
      expect(result.comment.body).toBe('Great!')
      expect(result.event.event_type).toBe('COMMENT_CREATED')
    })

    it('supports nested comments', () => {
      const parent = ctx.svc.createComment({
        actor_agent_id: 'a1', run_id: 'r1', post_id: postId, body: 'Parent',
      })
      const child = ctx.svc.createComment({
        actor_agent_id: 'a2', run_id: 'r2', post_id: postId,
        parent_comment_id: parent.comment.id, body: 'Reply',
      })
      expect(child.comment.parent_comment_id).toBe(parent.comment.id)
    })

    it('throws for nonexistent post', () => {
      expect(() =>
        ctx.svc.createComment({
          actor_agent_id: 'a1', run_id: 'r1', post_id: 'nope', body: 'Hi',
        }),
      ).toThrow('not found')
    })

    it('throws for nonexistent parent comment', () => {
      expect(() =>
        ctx.svc.createComment({
          actor_agent_id: 'a1', run_id: 'r1', post_id: postId,
          parent_comment_id: 'nope', body: 'Hi',
        }),
      ).toThrow('not found')
    })

    it('throws on empty body', () => {
      expect(() =>
        ctx.svc.createComment({
          actor_agent_id: 'a1', run_id: 'r1', post_id: postId, body: '',
        }),
      ).toThrow('Body is required')
    })
  })

  describe('upsertVote', () => {
    let ctx: ReturnType<typeof setup>
    let postId: string

    beforeEach(() => {
      ctx = setup()
      const post = ctx.postRepo.create({
        community_id: 'c1', author_agent_id: 'a0', title: 'T', body: 'B',
        visibility: 'PUBLIC', state: 'APPROVED',
      })
      postId = post.id
    })

    it('creates a vote and emits an event', () => {
      const result = ctx.svc.upsertVote({
        actor_agent_id: 'a1', run_id: 'r1',
        target_type: 'POST', target_id: postId, direction: 'UP',
      })
      expect(result.vote.direction).toBe('UP')
      expect(result.event.event_type).toBe('VOTE_CAST')
    })

    it('throws for nonexistent post target', () => {
      expect(() =>
        ctx.svc.upsertVote({
          actor_agent_id: 'a1', run_id: 'r1',
          target_type: 'POST', target_id: 'nope', direction: 'UP',
        }),
      ).toThrow('not found')
    })

    it('throws for nonexistent comment target', () => {
      expect(() =>
        ctx.svc.upsertVote({
          actor_agent_id: 'a1', run_id: 'r1',
          target_type: 'COMMENT', target_id: 'nope', direction: 'UP',
        }),
      ).toThrow('not found')
    })

    it('upserts the same vote from the same agent', () => {
      ctx.svc.upsertVote({
        actor_agent_id: 'a1', run_id: 'r1',
        target_type: 'POST', target_id: postId, direction: 'UP',
      })
      const result = ctx.svc.upsertVote({
        actor_agent_id: 'a1', run_id: 'r2',
        target_type: 'POST', target_id: postId, direction: 'DOWN',
      })
      expect(result.vote.direction).toBe('DOWN')
    })
  })
})
