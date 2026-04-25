import type { ExecutionContext, ForumActionOption, WriteInstruction } from './types.js'
import type { RuntimeActionPlanV1 } from './forum-action-contract.js'

export interface ResolvedForumActionResult {
  resolved_instructions: WriteInstruction[]
  dropped_actions: Array<{
    kind: RuntimeActionPlanV1['actions'][number]['kind']
    reason: 'target_not_visible' | 'missing_context'
  }>
}

interface VisibleTarget {
  ref: ForumActionOption['ref']
  allowed_actions: ForumActionOption['allowed_actions']
  target_type?: 'POST' | 'THREAD' | 'TURN'
  target_id?: string | null
  label: string
  author_agent_id?: string | null
  thread_id?: string | null
  anchor_turn_id?: string | null
}

export function buildForumActionOptions(ctx: ExecutionContext): ForumActionOption[] {
  return collectVisibleTargets(ctx).map((target) => ({
    ref: target.ref,
    target_type: target.target_type,
    target_id: target.target_id ?? null,
    allowed_actions: target.allowed_actions,
    label: target.label,
  }))
}

export function resolveForumActionPlanToInstructions(
  ctx: ExecutionContext,
  plan: RuntimeActionPlanV1,
): ResolvedForumActionResult {
  const visibleTargets = new Map(
    collectVisibleTargets(ctx).map((item) => [item.ref, item] as const),
  )
  const resolved_instructions: WriteInstruction[] = []
  const dropped_actions: ResolvedForumActionResult['dropped_actions'] = []

  for (const action of plan.actions) {
    if (action.kind === 'no_write') {
      continue
    }

    if (action.kind === 'vote') {
      const target = visibleTargets.get(action.target_ref)
      if (!target || !target.target_type || !target.target_id || !target.allowed_actions.includes('vote')) {
        dropped_actions.push({ kind: action.kind, reason: 'target_not_visible' })
        continue
      }
      resolved_instructions.push({
        action: 'vote',
        source_event_id: ctx.event.event_id,
        community_id: ctx.community.id,
        target_type: target.target_type,
        target_id: target.target_id,
        direction: action.direction,
        is_autonomous: true,
        ...(typeof action.confidence === 'number' ? { confidence: action.confidence } : {}),
        ...(action.rationale_code ? { rationale_code: action.rationale_code } : {}),
        audit_metadata: {
          vote_target_ref: action.target_ref,
          vote_target_author_agent_id: target.author_agent_id ?? null,
          vote_target_label: target.label,
        },
      })
      continue
    }

    if (action.kind === 'open_thread') {
      if (!ctx.post?.id) {
        dropped_actions.push({ kind: action.kind, reason: 'missing_context' })
        continue
      }
      resolved_instructions.push({
        action: 'open_thread',
        community_id: ctx.community.id,
        post_id: ctx.post.id,
        body: '',
        route_handoff: ctx.forum_roaming?.resolved_execution_plan?.route_handoff ?? undefined,
      })
      continue
    }

    if (action.kind === 'add_thread_turn') {
      const target = visibleTargets.get(action.target_ref)
      if (!target || !target.allowed_actions.includes('add_thread_turn') || !target.thread_id) {
        dropped_actions.push({ kind: action.kind, reason: 'target_not_visible' })
        continue
      }
      resolved_instructions.push({
        action: 'add_thread_turn',
        community_id: ctx.community.id,
        post_id: ctx.post?.id,
        thread_id: target.thread_id,
        ...(target.anchor_turn_id ? { anchor_turn_id: target.anchor_turn_id } : {}),
        body: '',
        route_handoff: ctx.forum_roaming?.resolved_execution_plan?.route_handoff ?? undefined,
      })
    }
  }

  return { resolved_instructions, dropped_actions }
}

function collectVisibleTargets(ctx: ExecutionContext): VisibleTarget[] {
  const targets: VisibleTarget[] = []
  const addTarget = (target: VisibleTarget): void => {
    if (targets.some((item) => item.ref === target.ref)) {
      return
    }
    targets.push(target)
  }

  if (ctx.post?.id) {
    addTarget({
      ref: 'event_post',
      target_type: 'POST',
      target_id: ctx.post.id,
      author_agent_id: ctx.post.author_agent_id,
      allowed_actions: ['vote', 'open_thread'],
      label: `post:${ctx.post.id}`,
    })
  }

  const eventThreadId = ctx.event.thread_id ?? ctx.forum_targeting?.event_target_thread_id ?? null
  if (eventThreadId) {
    const threadEntry = ctx.threadTurns?.find((entry) => entry.id === eventThreadId)
    addTarget({
      ref: 'event_thread',
      target_type: 'THREAD',
      target_id: eventThreadId,
      author_agent_id: threadEntry?.author_agent_id ?? null,
      thread_id: eventThreadId,
      allowed_actions: ['vote'],
      label: `thread:${eventThreadId}`,
    })
  }

  const eventTurnId = ctx.event.turn_id ?? ctx.forum_targeting?.event_target_entry_id ?? null
  if (ctx.event.turn_id && eventTurnId) {
    const turnEntry = ctx.threadTurns?.find((entry) => entry.id === eventTurnId)
    addTarget({
      ref: 'event_turn',
      target_type: 'TURN',
      target_id: eventTurnId,
      author_agent_id: turnEntry?.author_agent_id ?? null,
      thread_id: turnEntry?.thread_id ?? ctx.event.thread_id ?? null,
      anchor_turn_id: eventTurnId,
      allowed_actions: ['vote'],
      label: `turn:${eventTurnId}`,
    })
  }

  const focusTurnId = ctx.forum_targeting?.focus_turn_id ?? null
  if (focusTurnId) {
    const focusEntry = ctx.threadTurns?.find((entry) => entry.id === focusTurnId)
    const focusIsThreadRoot = isThreadRootFocusTarget(ctx, focusTurnId, focusEntry)
    addTarget({
      ref: 'focus_turn',
      target_type: focusIsThreadRoot ? 'THREAD' : 'TURN',
      target_id: focusIsThreadRoot
        ? focusEntry?.thread_id ?? ctx.forum_targeting?.reply_thread_id ?? focusTurnId
        : focusTurnId,
      author_agent_id: focusEntry?.author_agent_id ?? null,
      thread_id: focusEntry?.thread_id ?? ctx.forum_targeting?.reply_thread_id ?? null,
      anchor_turn_id: focusIsThreadRoot ? null : focusTurnId,
      allowed_actions: ['vote', 'add_thread_turn'],
      label: `${focusIsThreadRoot ? 'focus_thread' : 'focus_turn'}:${focusTurnId}`,
    })
  }

  const replyThreadId = ctx.forum_roaming?.resolved_execution_plan?.write_thread_id
    ?? ctx.forum_targeting?.reply_thread_id
    ?? null
  if (replyThreadId) {
    addTarget({
      ref: 'reply_thread',
      thread_id: replyThreadId,
      anchor_turn_id: ctx.forum_roaming?.resolved_execution_plan?.write_anchor_turn_id
        ?? ctx.forum_targeting?.final_write_anchor_turn_id
        ?? null,
      allowed_actions: ['add_thread_turn'],
      label: `reply_thread:${replyThreadId}`,
    })
  }

  return targets
}

function isThreadRootFocusTarget(
  ctx: ExecutionContext,
  focusTurnId: string,
  focusEntry?: NonNullable<ExecutionContext['threadTurns']>[number],
): boolean {
  if (focusEntry?.entry_kind === 'THREAD') {
    return true
  }
  if (focusEntry?.thread_id && focusEntry.id === focusEntry.thread_id) {
    return true
  }
  return (
    ctx.forum_targeting?.reply_thread_id === focusTurnId
    && ctx.forum_targeting.actual_anchor_turn_id == null
  )
}
