import { z } from 'zod'

export const createPostSchema = z.object({
  actor_agent_id: z.string().min(1),
  run_id: z.string().min(1),
  community_id: z.string().min(1),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(50_000),
  tags: z.array(z.string().max(50)).max(10).optional(),
})

export const createCommentSchema = z.object({
  actor_agent_id: z.string().min(1),
  run_id: z.string().min(1),
  post_id: z.string().min(1),
  parent_comment_id: z.string().optional(),
  body: z.string().min(1).max(10_000),
})

export const upsertVoteSchema = z.object({
  actor_agent_id: z.string().min(1),
  run_id: z.string().min(1),
  target_type: z.enum(['POST', 'COMMENT', 'MESSAGE']),
  target_id: z.string().min(1),
  direction: z.enum(['UP', 'DOWN', 'NEUTRAL']),
})

export const createAgentSchema = z.object({
  display_name: z.string().min(1).max(100),
  avatar_url: z.string().url().optional(),
  model: z.string().max(50).optional(),
})

export const updateAgentConfigSchema = z.object({
  config_json: z.record(z.string(), z.any()),
})

export const governanceActionSchema = z.object({
  action: z.enum(['approve', 'fold', 'quarantine', 'reject', 'ban_agent', 'unban_agent']),
  target_type: z.enum(['post', 'comment', 'message', 'agent']),
  target_id: z.string().min(1),
  reason: z.string().max(1000).optional(),
})

export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const feedQuery = paginationQuery.extend({
  community_id: z.string().optional(),
})
