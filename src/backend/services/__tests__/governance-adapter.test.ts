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
    it('approve changes post to PUBLIC/APPROVED', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'GRAY',
        state: 'PENDING',
      })
      const result = await ctx.adapter.execute({
        action: 'approve',
        target_type: 'post',
        target_id: post.id,
        admin_user_id: 'admin1',
      })
      expect(result.success).toBe(true)
      const updated = await ctx.postRepo.findById(post.id)
      expect(updated?.visibility).toBe('PUBLIC')
      expect(updated?.state).toBe('APPROVED')
    })

    it('fold changes post to GRAY/APPROVED', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await ctx.adapter.execute({
        action: 'fold',
        target_type: 'post',
        target_id: post.id,
        admin_user_id: 'admin1',
      })
      const updated = await ctx.postRepo.findById(post.id)
      expect(updated?.visibility).toBe('GRAY')
      expect(updated?.state).toBe('APPROVED')
    })

    it('quarantine changes post to QUARANTINE/PENDING', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await ctx.adapter.execute({
        action: 'quarantine',
        target_type: 'post',
        target_id: post.id,
        admin_user_id: 'admin1',
      })
      const updated = await ctx.postRepo.findById(post.id)
      expect(updated?.visibility).toBe('QUARANTINE')
      expect(updated?.state).toBe('PENDING')
    })

    it('reject changes post to QUARANTINE/REJECTED', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await ctx.adapter.execute({
        action: 'reject',
        target_type: 'post',
        target_id: post.id,
        admin_user_id: 'admin1',
      })
      const updated = await ctx.postRepo.findById(post.id)
      expect(updated?.visibility).toBe('QUARANTINE')
      expect(updated?.state).toBe('REJECTED')
    })

    it('throws for nonexistent post', async () => {
      await expect(
        ctx.adapter.execute({
          action: 'approve',
          target_type: 'post',
          target_id: 'nope',
          admin_user_id: 'admin1',
        }),
      ).rejects.toThrow('not found')
    })
  })

  describe('comment actions', () => {
    it('approve changes comment to PUBLIC/APPROVED', async () => {
      const comment = await ctx.commentRepo.create({
        post_id: 'p1',
        author_agent_id: 'a1',
        body: 'Risky',
        visibility: 'GRAY',
        state: 'PENDING',
      })
      await ctx.adapter.execute({
        action: 'approve',
        target_type: 'comment',
        target_id: comment.id,
        admin_user_id: 'admin1',
      })
      const updated = await ctx.commentRepo.findById(comment.id)
      expect(updated?.visibility).toBe('PUBLIC')
      expect(updated?.state).toBe('APPROVED')
    })
  })

  describe('agent actions', () => {
    it('ban_agent changes status to BANNED', async () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Bot' })
      await ctx.adapter.execute({
        action: 'ban_agent',
        target_type: 'agent',
        target_id: agent.id,
        admin_user_id: 'admin1',
      })
      expect(ctx.agentRepo.findById(agent.id)!.status).toBe('BANNED')
    })

    it('unban_agent changes status to ACTIVE', async () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Bot' })
      ctx.agentRepo.updateStatus(agent.id, 'BANNED')
      await ctx.adapter.execute({
        action: 'unban_agent',
        target_type: 'agent',
        target_id: agent.id,
        admin_user_id: 'admin1',
      })
      expect(ctx.agentRepo.findById(agent.id)!.status).toBe('ACTIVE')
    })

    it('limit_agent changes status to LIMITED', async () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Bot' })
      await ctx.adapter.execute({
        action: 'limit_agent',
        target_type: 'agent',
        target_id: agent.id,
        admin_user_id: 'admin1',
      })
      expect(ctx.agentRepo.findById(agent.id)!.status).toBe('LIMITED')
    })

    it('restore_agent changes status to ACTIVE', async () => {
      const agent = ctx.agentRepo.create({ owner_id: 'u1', display_name: 'Bot' })
      ctx.agentRepo.updateStatus(agent.id, 'LIMITED')
      await ctx.adapter.execute({
        action: 'restore_agent',
        target_type: 'agent',
        target_id: agent.id,
        admin_user_id: 'admin1',
      })
      expect(ctx.agentRepo.findById(agent.id)!.status).toBe('ACTIVE')
    })

    it('throws for nonexistent agent', async () => {
      await expect(
        ctx.adapter.execute({
          action: 'ban_agent',
          target_type: 'agent',
          target_id: 'nope',
          admin_user_id: 'admin1',
        }),
      ).rejects.toThrow('not found')
    })
  })
})
