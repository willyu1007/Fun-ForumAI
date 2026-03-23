import type {
  Comment,
  DomainEvent,
  PublicStageThread,
  RouteHandoff,
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
import type { ForumSceneCarrierInput, ForumWriteContext, RouteHandoffInput } from './types.js'

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
    route_handoff?: RouteHandoffInput
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

  const policyChannel = !parentComment
    ? 'forum_thread'
    : parentComment.comment_kind === 'THREAD' || parentComment.comment_kind === 'TURN'
      ? 'forum_turn'
      : 'forum_thread'

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
        channel: policyChannel,
        text: input.body,
        topic_context_text: [post.title, post.body, parentComment?.body ?? '']
          .filter(Boolean)
          .join('\n\n'),
        topic_context_tags: post.tags,
        author_agent_id: input.actor_agent_id,
        community_id: post.community_id,
        target_type: 'comment',
        scene: policyChannel,
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
  const eventType = isAside
    ? 'ASIDE_COMMENT_CREATED'
    : input.parent_comment_id
      ? 'THREAD_TURN_ADDED'
      : 'THREAD_OPENED'
  const plannedCommentId = input.scene ? crypto.randomUUID() : null
  const plannedCommentEventId = input.scene ? crypto.randomUUID() : null
  const buildCommentCreatedPayload = (
    comment: Pick<
      Comment,
      | 'id'
      | 'post_id'
      | 'parent_comment_id'
      | 'thread_id'
      | 'comment_kind'
      | 'author_agent_id'
      | 'visibility'
      | 'state'
    >,
  ) => ({
    comment_id: comment.id,
    post_id: comment.post_id,
    community_id: post.community_id,
    author_agent_id: comment.author_agent_id,
    parent_comment_id: comment.parent_comment_id,
    thread_id: comment.thread_id ?? (comment.comment_kind === 'THREAD' ? comment.id : null),
    turn_id: comment.comment_kind === 'TURN' ? comment.id : null,
    comment_kind: comment.comment_kind,
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
            thread_id: parentComment?.thread_id ?? parentComment?.id ?? null,
            comment_kind: input.parent_comment_id ? 'TURN' : 'THREAD',
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

  await notifyEvent(context, event)
  await syncThreadRouting(context, {
    actor_agent_id: input.actor_agent_id,
    thread_id: comment.comment_kind === 'THREAD' ? comment.id : comment.thread_id ?? null,
    route_handoff: input.route_handoff,
  })

  return { comment, moderation: effectiveModeration, event }
}

function buildDefaultRouteCta(
  routeType: RouteHandoff['route_type'],
  thread: Pick<PublicStageThread, 'id' | 'post_id' | 'author_agent_id'>,
): Record<string, unknown> {
  switch (routeType) {
    case 'AFTERSHOW':
      return {
        label: '查看 Aftershow',
        target: `/posts/${thread.post_id}#aftershow-panel`,
      }
    case 'AUDIENCE':
      return {
        label: '去观众席补充',
        target: `/posts/${thread.post_id}#audience-message-input`,
      }
    case 'PRIVATE':
      return {
        label: '转入私聊',
        target: `/agents/${thread.author_agent_id}/chat`,
      }
    case 'SPINOFF':
      return {
        label: '锁定衍生线',
        target: `/posts/${thread.post_id}?threadId=${thread.id}&route=spinoff`,
      }
  }
}

function normalizeRouteHandoff(
  input: RouteHandoffInput,
  thread: Pick<PublicStageThread, 'id' | 'post_id' | 'author_agent_id'>,
): {
  thread_state: PublicStageThread['thread_state']
  active_route: RouteHandoff
} {
  return {
    thread_state: input.route_type === 'SPINOFF' ? 'SPINOFF' : 'CLOSED',
    active_route: {
      route_type: input.route_type,
      route_state: input.route_state?.trim() || 'READY',
      reason_code: input.reason_code.trim(),
      handoff_label: input.handoff_label.trim(),
      handoff_payload: input.handoff_payload ?? null,
      cta: input.cta ?? buildDefaultRouteCta(input.route_type, thread),
    },
  }
}

function buildBudgetRouteDecision(
  thread: PublicStageThread,
  turnCount: number,
): {
  thread_state: PublicStageThread['thread_state']
  active_route: RouteHandoff | null
} | null {
  const remaining = Math.max(thread.reply_budget - turnCount, 0)
  if (remaining <= 0) {
    return {
      thread_state: 'CLOSED',
      active_route: thread.active_route ?? {
        route_type: 'AFTERSHOW',
        route_state: 'READY',
        reason_code: 'THREAD_REPLY_BUDGET_EXHAUSTED',
        handoff_label: '该线程已达到回合上限，转入 Aftershow 查看收束。',
        handoff_payload: null,
        cta: buildDefaultRouteCta('AFTERSHOW', thread),
      },
    }
  }

  if (remaining === 1) {
    return {
      thread_state: 'PEAKED',
      active_route: thread.active_route ?? {
        route_type: 'AFTERSHOW',
        route_state: 'SUGGESTED',
        reason_code: 'THREAD_NEAR_BUDGET_LIMIT',
        handoff_label: '该线程接近峰值，适合准备收口或转入 Aftershow。',
        handoff_payload: null,
        cta: buildDefaultRouteCta('AFTERSHOW', thread),
      },
    }
  }

  return null
}

async function syncThreadRouting(
  context: ForumWriteContext,
  input: {
    actor_agent_id: string
    thread_id: string | null
    route_handoff?: RouteHandoffInput
  },
): Promise<void> {
  if (!input.thread_id) return

  const thread = await context.deps.publicStageThreadRepo.findById(input.thread_id)
  if (!thread) return

  const turnCount = await context.deps.publicStageTurnRepo.countByThread(thread.id)
  const manualDecision = input.route_handoff
    ? normalizeRouteHandoff(input.route_handoff, thread)
    : null
  const budgetDecision = manualDecision ? null : buildBudgetRouteDecision(thread, turnCount)

  const nextThreadState = manualDecision?.thread_state ?? budgetDecision?.thread_state ?? thread.thread_state
  const nextActiveRoute = manualDecision?.active_route ?? budgetDecision?.active_route ?? thread.active_route

  const threadStateChanged = nextThreadState !== thread.thread_state
  const activeRouteChanged = JSON.stringify(nextActiveRoute ?? null) !== JSON.stringify(thread.active_route ?? null)
  if (!threadStateChanged && !activeRouteChanged) return

  const updatedThread = await context.deps.publicStageThreadRepo.updateRouting(thread.id, {
    thread_state: nextThreadState,
    active_route: nextActiveRoute,
  })
  if (!updatedThread || !nextActiveRoute) return

  const routeEvent = context.deps.eventRepo.create({
    event_type: 'THREAD_ROUTE_UPDATED',
    plane: 'DATA',
    schema_version: 'v1',
    community_id: updatedThread.community_id,
    post_id: updatedThread.post_id,
    actor_type: 'agent',
    actor_id: input.actor_agent_id,
    correlation_id: `thread:${updatedThread.id}`,
    payload_json: {
      thread_id: updatedThread.id,
      post_id: updatedThread.post_id,
      community_id: updatedThread.community_id,
      author_agent_id: updatedThread.author_agent_id,
      thread_state: updatedThread.thread_state,
      route_type: nextActiveRoute.route_type,
      route_state: nextActiveRoute.route_state,
      reason_code: nextActiveRoute.reason_code,
    },
  })
  await notifyEvent(context, routeEvent)
}
