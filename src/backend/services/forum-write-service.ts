import type {
  AgentRun,
  DomainEvent,
  Post,
  PublicStageThreadTurn,
  PublicStageThread,
  RouteHandoff,
  Vote,
} from '../repos/index.js'
import { buildAgentTarget } from '../../shared/agent-target.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import {
  countVisiblePublicStageThreadTurnsByPost,
  toPublicStageThreadTurnFromThread,
  toPublicStageThreadTurnFromTurn,
} from '../lib/public-stage-thread-turn.js'
import { buildPublicScenePayloadJson } from './public-scene-runtime.js'
import { createPost } from './forum-write-service/post-command.js'
import {
  applyPolicyDecisionToModeration,
  applyPremodOverride,
} from './forum-write-service/moderation-pipeline.js'
import {
  createSceneThread,
  createSceneThreadTurn,
} from './forum-write-service/scene-write.js'
import { normalizeChainDepth, resolveStageWriteContext } from './forum-write-service/stage-gates.js'
import { notifyEvent } from './forum-write-service/shared.js'
import { ThreadLifecycleService as DefaultThreadLifecycleService } from './thread-lifecycle-service.js'
import { ThreadInteractionResolver as DefaultThreadInteractionResolver } from './thread-interaction-resolver.js'
import type {
  EventHook,
  ForumSceneCarrierInput,
  ForumWriteContext,
  ForumWriteServiceDeps,
  RouteHandoffInput,
} from './forum-write-service/types.js'
import { upsertVote } from './forum-write-service/vote-command.js'

export type {
  EventHook,
  ForumSceneCarrierInput,
  ForumWriteServiceDeps,
  ModerationEvaluator,
} from './forum-write-service/types.js'

export class ForumWriteService {
  constructor(private readonly deps: ForumWriteServiceDeps) {}

  setEventHook(hook: EventHook): void {
    this.deps.onEventCreated = hook
  }

  async createPost(input: {
    actor_agent_id: string
    run_id: string
    community_id: string
    title: string
    body: string
    tags?: string[]
    chain_depth?: number
    trust_context?: import('./forum-write-service/types.js').TrustContextInput
    scene?: ForumSceneCarrierInput
  }): Promise<{ post: Post; moderation: import('../moderation/types.js').ModerationResult; event: DomainEvent; agentRun: AgentRun }> {
    return createPost({ deps: this.deps }, input)
  }

  async createThread(input: {
    actor_agent_id: string
    run_id: string
    post_id: string
    body: string
    channel?: 'STAGE' | 'ASIDE'
    chain_depth?: number
    route_handoff?: RouteHandoffInput
    scene?: ForumSceneCarrierInput
  }): Promise<{ entry: PublicStageThreadTurn; moderation: import('../moderation/types.js').ModerationResult; event: DomainEvent }> {
    return createThreadEntry({ deps: this.deps }, input)
  }

  async addThreadTurn(input: {
    actor_agent_id: string
    run_id: string
    thread_id: string
    anchor_turn_id?: string
    body: string
    channel?: 'STAGE' | 'ASIDE'
    chain_depth?: number
    route_handoff?: RouteHandoffInput
    scene?: ForumSceneCarrierInput
  }): Promise<{ entry: PublicStageThreadTurn; moderation: import('../moderation/types.js').ModerationResult; event: DomainEvent }> {
    return createThreadTurnEntry({ deps: this.deps }, input)
  }

  async upsertVote(input: {
    actor_agent_id: string
    run_id: string
    target_type: 'POST' | 'THREAD' | 'TURN' | 'MESSAGE'
    target_id: string
    direction: 'UP' | 'DOWN' | 'NEUTRAL'
    is_autonomous?: boolean
    chain_depth?: number
  }): Promise<{ vote: Vote; event: DomainEvent }> {
    return upsertVote({ deps: this.deps }, input)
  }
}

async function createThreadEntry(
  context: ForumWriteContext,
  input: {
    actor_agent_id: string
    run_id: string
    post_id: string
    body: string
    channel?: 'STAGE' | 'ASIDE'
    chain_depth?: number
    route_handoff?: RouteHandoffInput
    scene?: ForumSceneCarrierInput
  },
): Promise<{ entry: PublicStageThreadTurn; moderation: import('../moderation/types.js').ModerationResult; event: DomainEvent }> {
  if (!input.body.trim()) throw new ValidationError('Body is required')
  const chainDepth = normalizeChainDepth(input.chain_depth)

  const post = await context.deps.postRepo.findById(input.post_id)
  if (!post) throw new NotFoundError('Post', input.post_id)

  const stageContext = await resolveStageWriteContext(context, {
    agent_id: input.actor_agent_id,
    community_id: post.community_id,
    post_id: post.id,
    content_type: 'thread_turn',
    body: input.body,
    is_longform: false,
  })

  const modResultRaw = context.deps.moderator.evaluate({
    text: input.body,
    author_agent_id: input.actor_agent_id,
    community_id: post.community_id,
    content_type: 'thread_turn',
    ...(stageContext.moderation_thresholds
      ? { community_thresholds: stageContext.moderation_thresholds }
      : {}),
  })
  const modResult = applyPremodOverride(modResultRaw, stageContext.stage_spec, {
    is_longform: false,
  })
  const gatewayDecision = context.deps.policyGatewayService
    ? await context.deps.policyGatewayService.evaluate({
        channel: 'forum_thread',
        text: input.body,
        topic_context_text: [post.title, post.body].filter(Boolean).join('\n\n'),
        topic_context_tags: post.tags,
        author_agent_id: input.actor_agent_id,
        community_id: post.community_id,
        target_type: 'thread_turn',
        scene: 'forum_thread',
        existing_moderation: modResult,
        prefer_rewrite: false,
        sampling_metrics: {
          post_thread_turn_count: await countVisiblePublicStageThreadTurnsByPost(context.deps, post.id),
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
  const eventType = isAside ? 'ASIDE_THREAD_CREATED' : 'THREAD_OPENED'
  const plannedThreadId = input.scene ? crypto.randomUUID() : null
  const plannedThreadEventId = input.scene ? crypto.randomUUID() : null

  const buildPayload = (entry: Pick<PublicStageThreadTurn, 'id' | 'post_id' | 'author_agent_id' | 'visibility' | 'state'>) => ({
    post_id: entry.post_id,
    community_id: post.community_id,
    author_agent_id: entry.author_agent_id,
    thread_id: entry.id,
    turn_id: null,
    entry_kind: 'THREAD',
    visibility: entry.visibility,
    state: entry.state,
    channel: isAside ? 'ASIDE' : 'STAGE',
    chain_depth: chainDepth,
    ...(input.scene ? { public_scene: buildPublicScenePayloadJson(input.scene) } : {}),
  })

  const sceneWrite = input.scene
    ? await createSceneThread(context, {
        community_id: post.community_id,
        thread: {
          id: plannedThreadId!,
          post_id: input.post_id,
          community_id: post.community_id,
          author_agent_id: input.actor_agent_id,
          body: input.body,
          visibility: effectiveModeration.visibility,
          state: effectiveModeration.state,
        },
        scene: input.scene,
        event: {
          id: plannedThreadEventId!,
          event_type: eventType,
          plane: 'DATA',
          schema_version: 'v1',
          community_id: post.community_id,
          post_id: input.post_id,
          actor_type: 'agent',
          actor_id: input.actor_agent_id,
          correlation_id: `post:${input.post_id}`,
          payload_json: buildPayload({
            id: plannedThreadId!,
            post_id: input.post_id,
            author_agent_id: input.actor_agent_id,
            visibility: effectiveModeration.visibility,
            state: effectiveModeration.state,
          }),
        },
      })
    : null

  const thread = sceneWrite?.thread ?? await context.deps.publicStageThreadRepo.create({
    post_id: input.post_id,
    community_id: post.community_id,
    author_agent_id: input.actor_agent_id,
    body: input.body,
    visibility: effectiveModeration.visibility,
    state: effectiveModeration.state,
  })
  const entry = toPublicStageThreadTurnFromThread(thread)

  if (gatewayDecision) {
    await context.deps.policyGatewayService?.finalizeRecordedOutcomeTarget(gatewayDecision, {
      target_id: thread.id,
    })
  }

  const event = sceneWrite?.event ?? context.deps.eventRepo.create({
    event_type: eventType,
    plane: 'DATA',
    schema_version: 'v1',
    community_id: post.community_id,
    post_id: thread.post_id,
    actor_type: 'agent',
    actor_id: input.actor_agent_id,
    correlation_id: `post:${thread.post_id}`,
    payload_json: buildPayload(entry),
  })

  await notifyEvent(context, event)
  await syncThreadRouting(context, {
    actor_agent_id: input.actor_agent_id,
    thread_id: thread.id,
    route_handoff: input.route_handoff,
  })

  return { entry, moderation: effectiveModeration, event }
}

async function createThreadTurnEntry(
  context: ForumWriteContext,
  input: {
    actor_agent_id: string
    run_id: string
    thread_id: string
    anchor_turn_id?: string
    body: string
    channel?: 'STAGE' | 'ASIDE'
    chain_depth?: number
    route_handoff?: RouteHandoffInput
    scene?: ForumSceneCarrierInput
  },
): Promise<{ entry: PublicStageThreadTurn; moderation: import('../moderation/types.js').ModerationResult; event: DomainEvent }> {
  if (!input.body.trim()) throw new ValidationError('Body is required')
  const chainDepth = normalizeChainDepth(input.chain_depth)

  const thread = await context.deps.publicStageThreadRepo.findById(input.thread_id)
  if (!thread) {
    throw new NotFoundError('Thread', input.thread_id)
  }

  const [post, currentTurnCount] = await Promise.all([
    context.deps.postRepo.findById(thread.post_id),
    context.deps.publicStageTurnRepo.countByThread(thread.id),
  ])
  if (!post) throw new NotFoundError('Post', thread.post_id)
  const lifecycle = resolveThreadLifecycleSnapshot(context, thread, currentTurnCount)
  if (!lifecycle.writeability.reply_allowed) {
    throw new ValidationError(`Thread ${lifecycle.thread_state.toLowerCase()} and cannot accept more turns`)
  }

  const anchorTurn = input.anchor_turn_id
    ? await context.deps.publicStageTurnRepo.findById(input.anchor_turn_id)
    : null
  if (input.anchor_turn_id && !anchorTurn) {
    throw new NotFoundError('Turn', input.anchor_turn_id)
  }
  if (anchorTurn && anchorTurn.thread_id !== input.thread_id) {
    throw new ValidationError('anchor_turn_id must belong to the target thread')
  }

  const stageContext = await resolveStageWriteContext(context, {
    agent_id: input.actor_agent_id,
    community_id: post.community_id,
    post_id: post.id,
    content_type: 'thread_turn',
    body: input.body,
    is_longform: false,
  })

  const modResultRaw = context.deps.moderator.evaluate({
    text: input.body,
    author_agent_id: input.actor_agent_id,
    community_id: post.community_id,
    content_type: 'thread_turn',
    ...(stageContext.moderation_thresholds
      ? { community_thresholds: stageContext.moderation_thresholds }
      : {}),
  })
  const modResult = applyPremodOverride(modResultRaw, stageContext.stage_spec, {
    is_longform: false,
  })
  const gatewayDecision = context.deps.policyGatewayService
    ? await context.deps.policyGatewayService.evaluate({
        channel: 'forum_turn',
        text: input.body,
        topic_context_text: [post.title, post.body, anchorTurn?.body ?? thread.body]
          .filter(Boolean)
          .join('\n\n'),
        topic_context_tags: post.tags,
        author_agent_id: input.actor_agent_id,
        community_id: post.community_id,
        target_type: 'thread_turn',
        scene: 'forum_turn',
        existing_moderation: modResult,
        prefer_rewrite: false,
        sampling_metrics: {
          post_thread_turn_count: await countVisiblePublicStageThreadTurnsByPost(context.deps, post.id),
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
  const eventType = isAside ? 'ASIDE_TURN_CREATED' : 'THREAD_TURN_ADDED'
  const nextTurnIndex = currentTurnCount + 1
  const plannedTurnId = input.scene ? crypto.randomUUID() : null
  const plannedTurnEventId = input.scene ? crypto.randomUUID() : null

  const buildPayload = (entry: Pick<
    PublicStageThreadTurn,
    'id' | 'post_id' | 'thread_id' | 'author_agent_id' | 'visibility' | 'state'
  >) => ({
    post_id: entry.post_id,
    community_id: post.community_id,
    author_agent_id: entry.author_agent_id,
    thread_id: entry.thread_id,
    turn_id: entry.id,
    entry_kind: 'TURN',
    visibility: entry.visibility,
    state: entry.state,
    channel: isAside ? 'ASIDE' : 'STAGE',
    chain_depth: chainDepth,
    ...(input.scene ? { public_scene: buildPublicScenePayloadJson(input.scene) } : {}),
  })

  const sceneWrite = input.scene
    ? await createSceneThreadTurn(context, {
        community_id: post.community_id,
        turn: {
          id: plannedTurnId!,
          thread_id: thread.id,
          post_id: post.id,
          author_agent_id: input.actor_agent_id,
          turn_index: nextTurnIndex,
          anchor_turn_id: anchorTurn?.id ?? null,
          body: input.body,
          visibility: effectiveModeration.visibility,
          state: effectiveModeration.state,
        },
        scene: input.scene,
        event: {
          id: plannedTurnEventId!,
          event_type: eventType,
          plane: 'DATA',
          schema_version: 'v1',
          community_id: post.community_id,
          post_id: post.id,
          actor_type: 'agent',
          actor_id: input.actor_agent_id,
          correlation_id: `post:${post.id}`,
          payload_json: buildPayload({
            id: plannedTurnId!,
            post_id: post.id,
            thread_id: thread.id,
            author_agent_id: input.actor_agent_id,
            visibility: effectiveModeration.visibility,
            state: effectiveModeration.state,
          }),
        },
      })
    : null

  const turn = sceneWrite?.turn ?? await context.deps.publicStageTurnRepo.create({
    thread_id: thread.id,
    post_id: post.id,
    author_agent_id: input.actor_agent_id,
    turn_index: nextTurnIndex,
    anchor_turn_id: anchorTurn?.id ?? null,
    body: input.body,
    visibility: effectiveModeration.visibility,
    state: effectiveModeration.state,
  })
  const entry = toPublicStageThreadTurnFromTurn(turn)

  if (gatewayDecision) {
    await context.deps.policyGatewayService?.finalizeRecordedOutcomeTarget(gatewayDecision, {
      target_id: turn.id,
    })
  }

  const event = sceneWrite?.event ?? context.deps.eventRepo.create({
    event_type: eventType,
    plane: 'DATA',
    schema_version: 'v1',
    community_id: post.community_id,
    post_id: post.id,
    actor_type: 'agent',
    actor_id: input.actor_agent_id,
    correlation_id: `post:${post.id}`,
    payload_json: buildPayload(entry),
  })

  await notifyEvent(context, event)
  await syncThreadRouting(context, {
    actor_agent_id: input.actor_agent_id,
    thread_id: thread.id,
    route_handoff: input.route_handoff,
  })

  return { entry, moderation: effectiveModeration, event }
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
        target: thread.author_agent_id
          ? buildAgentTarget({
              agentId: thread.author_agent_id,
              mode: 'readonly',
              tab: 'chat',
            })
          : `/posts/${thread.post_id}?threadId=${thread.id}`,
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
  const lifecycle = resolveThreadLifecycleSnapshot(context, updatedThread, turnCount)

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
      lifecycle: {
        thread_id: lifecycle.thread_id,
        thread_state: lifecycle.thread_state,
        lifecycle_label: lifecycle.lifecycle_label,
        active_route: lifecycle.active_route,
        can_receive_replies: lifecycle.can_receive_replies,
        writeability: lifecycle.writeability,
      },
      writeability: lifecycle.writeability,
    },
  })
  await notifyEvent(context, routeEvent)
}

function resolveThreadLifecycleSnapshot(
  context: ForumWriteContext,
  thread: Pick<PublicStageThread, 'id' | 'thread_state' | 'reply_budget' | 'active_route' | 'updated_at'>,
  turnCount: number,
) {
  const lifecycleService = context.deps.threadLifecycleService ?? new DefaultThreadLifecycleService()
  const interactionResolver = context.deps.threadInteractionResolver ?? new DefaultThreadInteractionResolver()
  return interactionResolver.resolveLifecycleSnapshot(
    lifecycleService.buildThreadLifecycle(thread, turnCount),
  )
}
