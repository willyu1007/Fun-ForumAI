import type {
  Comment,
  DomainEvent,
} from '../../repos/index.js'
import { NotFoundError, ValidationError } from '../../lib/errors.js'
import { buildPublicScenePayloadJson } from '../public-scene-runtime.js'
import {
  applyPolicyDecisionToModeration,
  applyPremodOverride,
} from './moderation-pipeline.js'
import { createSceneComment } from './scene-write.js'
import { normalizeChainDepth, resolveStageWriteContext } from './stage-gates.js'
import { notifyEvent } from './shared.js'
import type { ForumSceneCarrierInput, ForumWriteContext } from './types.js'

export async function createComment(
  context: ForumWriteContext,
  input: {
    actor_agent_id: string
    run_id: string
    post_id: string
    parent_comment_id?: string
    body: string
    channel?: 'STAGE' | 'ASIDE'
    chain_depth?: number
    scene?: ForumSceneCarrierInput
  },
): Promise<{ comment: Comment; moderation: import('../../moderation/types.js').ModerationResult; event: DomainEvent }> {
  if (!input.body.trim()) throw new ValidationError('Body is required')
  const chainDepth = normalizeChainDepth(input.chain_depth)

  const post = await context.deps.postRepo.findById(input.post_id)
  if (!post) throw new NotFoundError('Post', input.post_id)

  const stageContext = await resolveStageWriteContext(context, {
    agent_id: input.actor_agent_id,
    community_id: post.community_id,
    post_id: post.id,
    content_type: 'comment',
    body: input.body,
    is_longform: false,
  })

  let parentComment: Comment | null = null
  if (input.parent_comment_id) {
    parentComment = await context.deps.commentRepo.findById(input.parent_comment_id)
    if (!parentComment || parentComment.post_id !== input.post_id) {
      throw new NotFoundError('Parent comment', input.parent_comment_id)
    }
  }

  const modResultRaw = context.deps.moderator.evaluate({
    text: input.body,
    author_agent_id: input.actor_agent_id,
    community_id: post.community_id,
    content_type: 'comment',
    ...(stageContext.moderation_thresholds
      ? { community_thresholds: stageContext.moderation_thresholds }
      : {}),
  })
  const modResult = applyPremodOverride(modResultRaw, stageContext.stage_spec, {
    is_longform: false,
  })
  const gatewayDecision = context.deps.policyGatewayService
    ? await context.deps.policyGatewayService.evaluate({
        channel: 'forum_comment',
        text: input.body,
        topic_context_text: [post.title, post.body, parentComment?.body ?? '']
          .filter(Boolean)
          .join('\n\n'),
        topic_context_tags: post.tags,
        author_agent_id: input.actor_agent_id,
        community_id: post.community_id,
        target_type: 'comment',
        scene: 'forum_comment',
        existing_moderation: modResult,
        prefer_rewrite: false,
        sampling_metrics: {
          post_comment_count: await context.deps.commentRepo.countByPost(post.id),
          room_message_count_hour: 0,
          report_count_24h: 0,
        },
      })
    : null
  if (gatewayDecision) {
    context.deps.policyGatewayService?.assertAllowed(gatewayDecision)
  }
  const effectiveModeration = applyPolicyDecisionToModeration(modResult, gatewayDecision)
  const isAside = input.channel === 'ASIDE'
  const eventType = isAside ? 'ASIDE_COMMENT_CREATED' : 'COMMENT_CREATED'
  const plannedCommentId = input.scene ? crypto.randomUUID() : null
  const plannedCommentEventId = input.scene ? crypto.randomUUID() : null
  const buildCommentCreatedPayload = (
    comment: Pick<
      Comment,
      'id' | 'post_id' | 'parent_comment_id' | 'author_agent_id' | 'visibility' | 'state'
    >,
  ) => ({
    comment_id: comment.id,
    post_id: comment.post_id,
    community_id: post.community_id,
    author_agent_id: comment.author_agent_id,
    parent_comment_id: comment.parent_comment_id,
    visibility: comment.visibility,
    state: comment.state,
    channel: isAside ? 'ASIDE' : 'STAGE',
    chain_depth: chainDepth,
    ...(input.scene
      ? {
          public_scene: buildPublicScenePayloadJson(input.scene),
        }
      : {}),
  })

  const sceneWrite = input.scene
    ? await createSceneComment(context, {
        community_id: post.community_id,
        comment: {
          id: plannedCommentId!,
          post_id: input.post_id,
          parent_comment_id: input.parent_comment_id ?? null,
          author_agent_id: input.actor_agent_id,
          body: input.body,
          visibility: effectiveModeration.visibility,
          state: effectiveModeration.state,
        },
        scene: input.scene,
        event: {
          id: plannedCommentEventId!,
          event_type: eventType,
          plane: 'DATA',
          schema_version: 'v1',
          community_id: post.community_id,
          post_id: input.post_id,
          actor_type: 'agent',
          actor_id: input.actor_agent_id,
          correlation_id: `post:${input.post_id}`,
          payload_json: buildCommentCreatedPayload({
            id: plannedCommentId!,
            post_id: input.post_id,
            parent_comment_id: input.parent_comment_id ?? null,
            author_agent_id: input.actor_agent_id,
            visibility: effectiveModeration.visibility,
            state: effectiveModeration.state,
          }),
        },
      })
    : null

  const comment =
    sceneWrite?.comment ??
    (await context.deps.commentRepo.create({
      post_id: input.post_id,
      parent_comment_id: input.parent_comment_id ?? null,
      author_agent_id: input.actor_agent_id,
      body: input.body,
      visibility: effectiveModeration.visibility,
      state: effectiveModeration.state,
    }))

  if (gatewayDecision) {
    await context.deps.policyGatewayService?.finalizeRecordedOutcomeTarget(gatewayDecision, {
      target_id: comment.id,
    })
  }

  const event =
    sceneWrite?.event ??
    context.deps.eventRepo.create({
      event_type: eventType,
      plane: 'DATA',
      schema_version: 'v1',
      community_id: post.community_id,
      post_id: comment.post_id,
      actor_type: 'agent',
      actor_id: input.actor_agent_id,
      correlation_id: `post:${comment.post_id}`,
      payload_json: buildCommentCreatedPayload(comment),
    })

  notifyEvent(context, event)

  return { comment, moderation: effectiveModeration, event }
}
