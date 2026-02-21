import { describe, it, expect, beforeEach } from 'vitest'
import { GovernanceAdapter } from '../governance-adapter.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'

function setup() {
  const postRepo = new InMemoryPostRepository()
  const commentRepo = new InMemoryCommentRepository()
  const agentRepo = new InMemoryAgentRepository()
  const adapter = new GovernanceAdapter({ postRepo, commentRepo, agentRepo })
  return { adapter, postRepo, commentRepo, agentRepo }
}

describe('GovernanceAdapter', () => {
  let ctx: ReturnType<typeof setup>

  beforeEach(() => {
    ctx = setup()
  })

  describe('post actions', () => {
    it('approve changes post to PUBLIC/APPROVED', () => {
      const post = ctx.postRepo.create({
        community_id: 'c1', author_agent_id: 'a1', title: 'T', body: 'B',
        visibility: 'GRAY', state: 'PENDING',
      })
      const result = ctx.adapter.execute({
        action: 'approve', target_type: 'post', target_id: post.id, admin_user_id: 'admin1',
      })
      expect(result.success).toBe(true)
      const updated = ctx.postRepo.findById(post.id)!
      expect(updated.visibility).toBe('PUBLIC')
      expect(updated.state).toBe('APPROVED')
    })

    it('fold changes post to GRAY/APPROVED', () => {
      const post = ctx.postRepo.create({
        community_id: 'c1', author_agent_id: 'a1', title: 'T', body: 'B',
        visibility: 'PUBLIC', state: 'APPROVED',
      })
      ctx.adapter.execute({
        action: 'fold', target_type: 'post', target_id: post.id, admin_user_id: 'admin1',
      })
      const updated = ctx.postRepo.findById(post.id)!
      expect(updated.visibility).toBe('GRAY')
      expect(updated.state).toBe('APPROVED')
    })

    it('quarantine changes post to QUARANTINE/PENDING', () => {
      const post = ctx.postRepo.create({
        community_id: 'c1', author_agent_id: 'a1', title: 'T', body: 'B',
        visibility: 'PUBLIC', state: 'APPROVED',
      })
      ctx.adapter.execute({
        action: 'quarantine', target_type: 'post', target_id: post.id, admin_user_id: 'admin1',
      })
      const updated = ctx.postRepo.findById(post.id)!
      expect(updated.visibility).toBe('QUARANTINE')
      expect(updated.state).toBe('PENDING')
    })

    it('reject changes post to QUARANTINE/REJECTED', () => {
      const post = ctx.postRepo.create({
        community_id: 'c1', author_agent_id: 'a1', title: 'T', body: 'B',
        visibility: 'PUBLIC', state: 'APPROVED',
      })
      ctx.adapter.execute({
        action: 'reject', target_type: 'post', target_id: post.id, admin_user_id: 'admin1',
      })
      const updated = ctx.postRepo.findById(post.id)!
      expect(updated.visibility).toBe('QUARANTINE')
      expect(updated.state).toBe('REJECTED')
    })

    it('throws for nonexistent post', () => {
      expect(() =>
        ctx.adapter.execute({
          action: 'approve', target_type: 'post', target_id: 'nope', admin_user_id: 'admin1',
        }),
      ).toThrow('not found')
    })
  })

  describe('comment actions', () => {
    it('approve changes comment to PUBLIC/APPROVED', () => {
      const comment = ctx.commentRepo.create({
        post_id: 'p1', author_agent_id: 'a1', body: 'Risky',
        visibility: 'GRAY', state: 'PENDING',
      })
      ctx.adapter.execute({
        action: 'approve', target_type: 'comment', target_id: comment.id, admin_user_id: 'admin1',
      })
      const updated = ctx.commentRepo.findById(comment.id)!
      expect(updated.visibility).toBe('PUBLIC')
      expect(updated.state).toBe('APPROVED')
    })
  })

  describe('agent actions', () => {
    it('ban_agent changes status to BANNED', () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Bot' })
      ctx.adapter.execute({
        action: 'ban_agent', target_type: 'agent', target_id: agent.id, admin_user_id: 'admin1',
      })
      expect(ctx.agentRepo.findById(agent.id)!.status).toBe('BANNED')
    })

    it('unban_agent changes status to ACTIVE', () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Bot' })
      ctx.agentRepo.updateStatus(agent.id, 'BANNED')
      ctx.adapter.execute({
        action: 'unban_agent', target_type: 'agent', target_id: agent.id, admin_user_id: 'admin1',
      })
      expect(ctx.agentRepo.findById(agent.id)!.status).toBe('ACTIVE')
    })

    it('throws for nonexistent agent', () => {
      expect(() =>
        ctx.adapter.execute({
          action: 'ban_agent', target_type: 'agent', target_id: 'nope', admin_user_id: 'admin1',
        }),
      ).toThrow('not found')
    })
  })
})
