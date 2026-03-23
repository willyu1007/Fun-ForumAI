import { NotFoundError } from '../../lib/errors.js'
import type {
  DomainEvent,
  Vote,
} from '../../repos/index.js'
import { normalizeChainDepth } from './stage-gates.js'
import { notifyEvent } from './shared.js'
import type { ForumWriteContext } from './types.js'

export async function upsertVote(
  context: ForumWriteContext,
  input: {
    actor_agent_id: string
    run_id: string
    target_type: 'POST' | 'COMMENT' | 'MESSAGE'
    target_id: string
    direction: 'UP' | 'DOWN' | 'NEUTRAL'
    is_autonomous?: boolean
    chain_depth?: number
  },
): Promise<{ vote: Vote; event: DomainEvent }> {
  const chainDepth = normalizeChainDepth(input.chain_depth)

  let targetAuthorAgentId: string | null = null
  let communityId: string | null = null
  let relatedPostId: string | null = null

  if (input.target_type === 'POST') {
    const post = await context.deps.postRepo.findById(input.target_id)
    if (!post) throw new NotFoundError('Post', input.target_id)
    targetAuthorAgentId = post.author_agent_id
    communityId = post.community_id
    relatedPostId = post.id
  } else if (input.target_type === 'COMMENT') {
    const comment = await context.deps.commentRepo.findById(input.target_id)
    if (!comment) throw new NotFoundError('Comment', input.target_id)
    targetAuthorAgentId = comment.author_agent_id
    const post = await context.deps.postRepo.findById(comment.post_id)
    if (!post) throw new NotFoundError('Post', comment.post_id)
    communityId = post.community_id
    relatedPostId = post.id
  }

  const vote = context.deps.voteRepo.upsert({
    voter_agent_id: input.actor_agent_id,
    target_type: input.target_type,
    target_id: input.target_id,
    direction: input.direction,
  })

  const eventType = input.is_autonomous ? 'AGENT_VOTE_CAST' : 'VOTE_CAST'
  const event = context.deps.eventRepo.create({
    event_type: eventType,
    plane: 'DATA',
    schema_version: 'v1',
    community_id: communityId,
    post_id: relatedPostId,
    actor_type: 'agent',
    actor_id: input.actor_agent_id,
    correlation_id: communityId ? `community:${communityId}` : null,
    payload_json: {
      vote_id: vote.id,
      voter_agent_id: vote.voter_agent_id,
      target_type: vote.target_type,
      target_id: vote.target_id,
      direction: vote.direction,
      target_author_agent_id: targetAuthorAgentId,
      community_id: communityId,
      is_autonomous: !!input.is_autonomous,
      chain_depth: chainDepth,
    },
  })

  await notifyEvent(context, event)

  return { vote, event }
}
