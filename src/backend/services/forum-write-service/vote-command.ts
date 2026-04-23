import { NotFoundError, ValidationError } from '../../lib/errors.js'
import type {
  DomainEvent,
  Vote,
} from '../../repos/index.js'
import { normalizeChainDepth } from './stage-gates.js'
import { notifyEvent, resolveGovernanceLineageFields } from './shared.js'
import type { ForumWriteContext, GovernanceWriteContextInput } from './types.js'

export async function upsertVote(
  context: ForumWriteContext,
  input: {
    actor_agent_id: string
    run_id: string
    target_type: 'POST' | 'THREAD' | 'TURN' | 'MESSAGE'
    target_id: string
    direction: 'UP' | 'DOWN' | 'NEUTRAL'
    is_autonomous?: boolean
    chain_depth?: number
    governance_context?: GovernanceWriteContextInput
    source_event_id?: string
    idempotency_key?: string
  },
): Promise<
  | { outcome: 'cast'; vote: Vote; event: DomainEvent }
  | { outcome: 'cleared'; vote: null; event: DomainEvent; previous_direction: 'UP' | 'DOWN' }
  | { outcome: 'noop'; vote: null; event: null; reason: 'clear_without_existing_vote' }
> {
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
  } else if (input.target_type === 'THREAD' || input.target_type === 'TURN') {
    const target = input.target_type === 'THREAD'
      ? await context.deps.publicStageThreadRepo.findById(input.target_id)
      : await context.deps.publicStageTurnRepo.findById(input.target_id)
    if (!target) {
      throw new NotFoundError(input.target_type === 'THREAD' ? 'Thread' : 'Turn', input.target_id)
    }
    targetAuthorAgentId = target.author_agent_id
    const post = await context.deps.postRepo.findById(target.post_id)
    if (!post) throw new NotFoundError('Post', target.post_id)
    communityId = post.community_id
    relatedPostId = post.id
  }

  if (targetAuthorAgentId && targetAuthorAgentId === input.actor_agent_id) {
    throw new ValidationError('Self-vote is not allowed')
  }

  const existingVote = context.deps.voteRepo.findByVoterAndTarget(
    input.actor_agent_id,
    input.target_type,
    input.target_id,
  )

  if (input.direction === 'NEUTRAL') {
    if (!existingVote) {
      return {
        outcome: 'noop',
        vote: null,
        event: null,
        reason: 'clear_without_existing_vote',
      }
    }

    await context.deps.voteRepo.deleteByVoterAndTarget(
      input.actor_agent_id,
      input.target_type,
      input.target_id,
    )

    const clearEventType = input.is_autonomous ? 'AGENT_VOTE_CLEARED' : 'VOTE_CLEARED'
    const clearIdempotencyKey = input.idempotency_key
      ?? buildVoteEventIdempotencyKey({
        source_event_id: input.source_event_id,
        actor_agent_id: input.actor_agent_id,
        target_type: input.target_type,
        target_id: input.target_id,
        transition: existingVote.direction === 'DOWN' ? 'CLEAR_DOWN' : 'CLEAR_UP',
      })
    const clearEvent = context.deps.eventRepo.create({
      event_type: clearEventType,
      plane: 'DATA',
      schema_version: 'v1',
      community_id: communityId,
      post_id: relatedPostId,
      actor_type: 'agent',
      actor_id: input.actor_agent_id,
      correlation_id: communityId ? `community:${communityId}` : null,
      ...(clearIdempotencyKey ? { idempotency_key: clearIdempotencyKey } : {}),
      payload_json: {
        voter_agent_id: input.actor_agent_id,
        target_type: input.target_type,
        target_id: input.target_id,
        target_author_agent_id: targetAuthorAgentId,
        community_id: communityId,
        post_id: relatedPostId,
        is_autonomous: !!input.is_autonomous,
        chain_depth: chainDepth,
        previous_direction: existingVote.direction === 'DOWN' ? 'DOWN' : 'UP',
        ...resolveGovernanceLineageFields(input.governance_context),
      },
    })

    await notifyEvent(context, clearEvent)

    return {
      outcome: 'cleared',
      vote: null,
      event: clearEvent,
      previous_direction: existingVote.direction === 'DOWN' ? 'DOWN' : 'UP',
    }
  }

  const vote = await context.deps.voteRepo.upsert({
    voter_agent_id: input.actor_agent_id,
    target_type: input.target_type,
    target_id: input.target_id,
    direction: input.direction,
  })

  const eventType = input.is_autonomous ? 'AGENT_VOTE_CAST' : 'VOTE_CAST'
  const castIdempotencyKey = input.idempotency_key
    ?? buildVoteEventIdempotencyKey({
      source_event_id: input.source_event_id,
      actor_agent_id: input.actor_agent_id,
      target_type: input.target_type,
      target_id: input.target_id,
      transition: input.direction === 'DOWN' ? 'CAST_DOWN' : 'CAST_UP',
    })
  const event = context.deps.eventRepo.create({
    event_type: eventType,
    plane: 'DATA',
    schema_version: 'v1',
    community_id: communityId,
    post_id: relatedPostId,
    actor_type: 'agent',
    actor_id: input.actor_agent_id,
    correlation_id: communityId ? `community:${communityId}` : null,
    ...(castIdempotencyKey ? { idempotency_key: castIdempotencyKey } : {}),
    payload_json: {
      vote_id: vote.id,
      voter_agent_id: vote.voter_agent_id,
      target_type: vote.target_type,
      target_id: vote.target_id,
      direction: vote.direction,
      target_author_agent_id: targetAuthorAgentId,
      community_id: communityId,
      post_id: relatedPostId,
      is_autonomous: !!input.is_autonomous,
      chain_depth: chainDepth,
      ...resolveGovernanceLineageFields(input.governance_context),
    },
  })

  await notifyEvent(context, event)

  return { outcome: 'cast', vote, event }
}

function buildVoteEventIdempotencyKey(input: {
  source_event_id?: string
  actor_agent_id: string
  target_type: string
  target_id: string
  transition: 'CAST_UP' | 'CAST_DOWN' | 'CLEAR_UP' | 'CLEAR_DOWN'
}): string | null {
  if (!input.source_event_id) {
    return null
  }
  return [
    'runtime-vote',
    input.source_event_id,
    input.actor_agent_id,
    input.target_type,
    input.target_id,
    input.transition,
  ].join(':')
}
