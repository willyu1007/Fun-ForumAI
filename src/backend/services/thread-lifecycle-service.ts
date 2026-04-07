import type { PublicStageThread } from '../repos/index.js'
import type {
  ReplyBudgetSnapshot,
  ResourceRef,
  RouteHandoff,
  RouteState,
  ThreadLifecycleSnapshot,
  ThreadState,
} from '../../shared/forum-orchestration.js'
import {
  FORUM_REPLY_BUDGET_SCHEMA_VERSION as REPLY_BUDGET_SCHEMA_VERSION,
  FORUM_ROUTE_HANDOFF_SCHEMA_VERSION as ROUTE_HANDOFF_SCHEMA_VERSION,
  FORUM_THREAD_LIFECYCLE_SCHEMA_VERSION as THREAD_LIFECYCLE_SCHEMA_VERSION,
} from '../../shared/forum-orchestration.js'

export class ThreadLifecycleService {
  buildReplyBudgetSnapshot(
    thread: Pick<PublicStageThread, 'id' | 'reply_budget' | 'updated_at' | 'thread_state'>,
    turnCount: number,
  ): ReplyBudgetSnapshot {
    const used = Math.max(0, turnCount)
    const limit = Math.max(0, thread.reply_budget)
    const remaining = Math.max(0, limit - used)
    const softCapTurns = limit > 0 ? Math.max(1, limit - 1) : null
    const mode = this.resolveReplyBudgetMode({
      thread_state: thread.thread_state,
      limit,
      remaining,
    })
    return {
      schema_version: REPLY_BUDGET_SCHEMA_VERSION,
      thread_id: thread.id,
      limit,
      used,
      remaining,
      exhausted: remaining <= 0,
      mode,
      soft_cap_turns: softCapTurns,
      hard_cap_turns: limit > 0 ? limit : null,
      remaining_turns: limit > 0 ? remaining : null,
      cooldown_seconds: mode === 'SOFT_CAP' || mode === 'HARD_CAP' ? 120 : null,
      late_entry_reserved_slots: mode === 'OPEN' ? 0 : 1,
      revive_reserved_slots: mode === 'CLOSED' ? 1 : 0,
      same_pair_cap: mode === 'OPEN' ? 3 : 2,
      last_evaluated_at: toIsoString(thread.updated_at),
    }
  }

  buildThreadLifecycle(
    thread: Pick<PublicStageThread, 'id' | 'thread_state' | 'reply_budget' | 'active_route' | 'updated_at'>,
    turnCount: number,
  ): ThreadLifecycleSnapshot {
    const replyBudget = this.buildReplyBudgetSnapshot(thread, turnCount)
    const activeRoute = this.normalizeRouteHandoff(thread)
    const threadState = this.resolveThreadState(thread, replyBudget, activeRoute)
    const handoffReady = threadState === 'HANDOFF_PENDING'
    const canReceiveReplies = !replyBudget.exhausted
      && threadState !== 'CLOSED'
      && threadState !== 'HANDOFFED'
      && threadState !== 'SPINOFFED'

    return {
      schema_version: THREAD_LIFECYCLE_SCHEMA_VERSION,
      thread_id: thread.id,
      state: threadState,
      thread_state: threadState,
      reply_budget: replyBudget,
      active_route: activeRoute,
      can_receive_replies: canReceiveReplies,
      lifecycle_label: threadState === 'CLOSED' || threadState === 'HANDOFFED' || threadState === 'SPINOFFED'
        ? 'CLOSED'
        : replyBudget.exhausted
          ? 'AT_CAPACITY'
          : handoffReady
            ? 'HANDOFF_READY'
            : 'ACTIVE',
      updated_at: toIsoString(thread.updated_at),
    }
  }

  private normalizeRouteHandoff(
    thread: Pick<PublicStageThread, 'id' | 'active_route' | 'updated_at'>,
  ): RouteHandoff | null {
    if (!thread.active_route) {
      return null
    }

    const state = normalizeRouteState(thread.active_route.route_state)
    const targetRef = readTargetRef(thread.active_route.handoff_payload)
    const routeId = typeof thread.active_route.handoff_payload?.route_id === 'string'
      ? thread.active_route.handoff_payload.route_id
      : `route:${thread.id}:${thread.active_route.route_type.toLowerCase()}`
    const suggestedAt = readTimestamp(thread.active_route.handoff_payload, 'suggested_at') ?? toIsoString(thread.updated_at)

    return {
      schema_version: ROUTE_HANDOFF_SCHEMA_VERSION,
      route_id: routeId,
      route_type: thread.active_route.route_type,
      route_kind: thread.active_route.route_type,
      route_state: thread.active_route.route_state,
      state,
      reason_code: thread.active_route.reason_code,
      handoff_label: thread.active_route.handoff_label,
      handoff_payload: thread.active_route.handoff_payload,
      cta: thread.active_route.cta,
      target_ref: targetRef,
      suggested_at: suggestedAt,
      activated_at: readTimestamp(thread.active_route.handoff_payload, 'activated_at'),
      completed_at: readTimestamp(thread.active_route.handoff_payload, 'completed_at'),
      expires_at: readTimestamp(thread.active_route.handoff_payload, 'expires_at'),
    }
  }

  private resolveThreadState(
    thread: Pick<PublicStageThread, 'thread_state'>,
    replyBudget: ReplyBudgetSnapshot,
    activeRoute: RouteHandoff | null,
  ): ThreadState {
    if (thread.thread_state === 'SPINOFF') {
      return 'SPINOFFED'
    }
    if (activeRoute?.state === 'ACTIVE' || activeRoute?.state === 'COMPLETED') {
      return 'HANDOFFED'
    }
    if (thread.thread_state === 'CLOSED') {
      return activeRoute ? 'HANDOFF_PENDING' : 'CLOSED'
    }
    if (activeRoute) {
      return 'HANDOFF_PENDING'
    }
    if (thread.thread_state === 'PEAKED') {
      return 'PEAKED'
    }
    if (replyBudget.exhausted || replyBudget.remaining <= 1) {
      return 'WINDING_DOWN'
    }
    if (replyBudget.used >= Math.max(3, Math.ceil(Math.max(replyBudget.limit, 1) * 0.5))) {
      return 'HEATING'
    }
    return 'OPEN'
  }

  private resolveReplyBudgetMode(input: {
    thread_state: PublicStageThread['thread_state']
    limit: number
    remaining: number
  }): ReplyBudgetSnapshot['mode'] {
    if (input.thread_state === 'CLOSED' || input.thread_state === 'SPINOFF') {
      return 'CLOSED'
    }
    if (input.limit <= 0 || input.remaining <= 0) {
      return 'HARD_CAP'
    }
    if (input.remaining <= 1) {
      return 'SOFT_CAP'
    }
    return 'OPEN'
  }
}

function normalizeRouteState(input: string): RouteState {
  const normalized = input.trim().toUpperCase()
  if (normalized === 'ACTIVE' || normalized === 'RUNNING') return 'ACTIVE'
  if (normalized === 'COMPLETED' || normalized === 'DONE') return 'COMPLETED'
  if (normalized === 'EXPIRED') return 'EXPIRED'
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'CANCELLED'
  return 'SUGGESTED'
}

function readTargetRef(input: Record<string, unknown> | null | undefined): ResourceRef | null {
  const raw = input?.target_ref
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const record = raw as Record<string, unknown>
  if (typeof record.kind !== 'string' || typeof record.id !== 'string') {
    return null
  }
  return {
    kind: record.kind as ResourceRef['kind'],
    id: record.id,
  }
}

function readTimestamp(input: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = input?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}
