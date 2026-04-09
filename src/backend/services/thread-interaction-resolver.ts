import type {
  EffectiveParticipationContract,
  ThreadLifecycleCoreSnapshot,
  ThreadLifecycleSnapshot,
  ThreadPreferredAction,
  ThreadReplyMode,
  ThreadWriteabilityReasonCode,
  ThreadWriteabilitySnapshot,
} from '../../shared/forum-orchestration.js'
import { FORUM_THREAD_WRITEABILITY_SCHEMA_VERSION as THREAD_WRITEABILITY_SCHEMA_VERSION } from '../../shared/forum-orchestration.js'

export class ThreadInteractionResolver {
  resolveLifecycleSnapshot(
    lifecycle: ThreadLifecycleCoreSnapshot,
    participationContract?: EffectiveParticipationContract | null,
  ): ThreadLifecycleSnapshot {
    const writeability = this.resolveWriteability(lifecycle, participationContract)
    return {
      ...lifecycle,
      writeability,
      can_receive_replies: writeability.reply_allowed,
    }
  }

  resolveWriteability(
    lifecycle: ThreadLifecycleCoreSnapshot,
    participationContract?: EffectiveParticipationContract | null,
  ): ThreadWriteabilitySnapshot {
    const replyMode = this.resolveReplyMode(lifecycle)
    const replyAllowed = this.resolveReplyAllowed(lifecycle, replyMode)

    return {
      schema_version: THREAD_WRITEABILITY_SCHEMA_VERSION,
      thread_id: lifecycle.thread_id,
      reply_mode: replyMode,
      reply_allowed: replyAllowed,
      preferred_action: this.resolvePreferredAction({
        lifecycle,
        replyMode,
        replyAllowed,
        participationContract: participationContract ?? null,
      }),
      reason_code: this.resolveReasonCode(lifecycle),
    }
  }

  private resolveReplyMode(lifecycle: ThreadLifecycleCoreSnapshot): ThreadReplyMode {
    if (lifecycle.thread_state === 'HANDOFFED' || lifecycle.thread_state === 'SPINOFFED') {
      return lifecycle.active_route ? 'ROUTE_ONLY' : 'CLOSED'
    }

    if (lifecycle.thread_state === 'CLOSED') {
      return lifecycle.active_route ? 'ROUTE_ONLY' : 'CLOSED'
    }

    if (lifecycle.thread_state === 'HANDOFF_PENDING') {
      return 'SOFT_CLOSE'
    }

    if (lifecycle.reply_budget.exhausted) {
      return lifecycle.active_route ? 'ROUTE_ONLY' : 'CLOSED'
    }

    if (lifecycle.thread_state === 'WINDING_DOWN') {
      return 'SOFT_CLOSE'
    }

    return 'OPEN'
  }

  private resolveReplyAllowed(
    lifecycle: ThreadLifecycleCoreSnapshot,
    replyMode: ThreadReplyMode,
  ): boolean {
    if (replyMode === 'ROUTE_ONLY' || replyMode === 'CLOSED') {
      return false
    }

    const reserveAllowance = replyMode === 'SOFT_CLOSE'
      ? Math.max(
          lifecycle.reply_budget.late_entry_reserved_slots,
          lifecycle.reply_budget.revive_reserved_slots,
          0,
        )
      : 0

    if (lifecycle.reply_budget.limit <= 0) {
      return reserveAllowance > 0
    }

    return lifecycle.reply_budget.used < lifecycle.reply_budget.limit + reserveAllowance
  }

  private resolvePreferredAction(input: {
    lifecycle: ThreadLifecycleCoreSnapshot
    replyMode: ThreadReplyMode
    replyAllowed: boolean
    participationContract: EffectiveParticipationContract | null
  }): ThreadPreferredAction {
    if (input.replyMode === 'OPEN' && input.replyAllowed) {
      return 'REPLY_IN_THREAD'
    }

    if (input.lifecycle.active_route) {
      return 'FOLLOW_ROUTE'
    }

    if (input.replyMode === 'SOFT_CLOSE') {
      if (input.participationContract?.stage_open_reply.new_thread_enabled) {
        return 'START_NEW_THREAD'
      }
      if (input.participationContract?.audience_lane.posting_enabled) {
        return 'USE_AUDIENCE_LANE'
      }
      if (input.replyAllowed) {
        return 'REPLY_IN_THREAD'
      }
      return 'READ_ONLY'
    }

    if (input.participationContract?.stage_open_reply.new_thread_enabled) {
      return 'START_NEW_THREAD'
    }

    if (input.participationContract?.audience_lane.posting_enabled) {
      return 'USE_AUDIENCE_LANE'
    }

    return input.replyAllowed ? 'REPLY_IN_THREAD' : 'READ_ONLY'
  }

  private resolveReasonCode(lifecycle: ThreadLifecycleCoreSnapshot): ThreadWriteabilityReasonCode {
    if (lifecycle.thread_state === 'HANDOFF_PENDING') {
      return 'THREAD_HANDOFF_PENDING'
    }
    if (lifecycle.thread_state === 'HANDOFFED') {
      return 'THREAD_HANDOFFED'
    }
    if (lifecycle.thread_state === 'SPINOFFED') {
      return 'THREAD_SPINOFFED'
    }
    if (lifecycle.thread_state === 'CLOSED') {
      return 'THREAD_CLOSED'
    }
    if (lifecycle.reply_budget.exhausted) {
      return 'THREAD_REPLY_BUDGET_EXHAUSTED'
    }
    if (lifecycle.thread_state === 'WINDING_DOWN') {
      return 'THREAD_WINDING_DOWN'
    }
    return 'THREAD_OPEN'
  }
}
