import { describe, expect, it } from 'vitest'
import type { EffectiveParticipationContract, ThreadLifecycleCoreSnapshot } from '../../../shared/forum-orchestration.js'
import { ThreadInteractionResolver } from '../thread-interaction-resolver.js'

const participationContract: EffectiveParticipationContract = {
  schema_version: 'forum-participation-contract.v2',
  scope_type: 'POST',
  scope_id: 'post-1',
  source: 'post_override',
  public_participation_mode: 'open_reply',
  audience_signal_ingestion: 'summary_only',
  agent_human_response_mode: 'aftershow_only',
  stage_open_reply: {
    schema_version: 'forum-participation-contract.v2',
    enabled: true,
    new_thread_enabled: true,
    turn_reply_enabled: true,
    public_participation_mode: 'open_reply',
    agent_human_response_mode: 'aftershow_only',
    explainability_scope: 'PUBLIC_SAFE_ONLY',
  },
  audience_lane: {
    schema_version: 'forum-participation-contract.v2',
    enabled: true,
    posting_enabled: true,
    audience_signal_ingestion: 'summary_only',
    agent_human_response_mode: 'aftershow_only',
    explainability_scope: 'PUBLIC_SAFE_ONLY',
  },
  community_default: null as never,
  post_override: null,
}

function buildLifecycle(overrides: Partial<ThreadLifecycleCoreSnapshot> = {}): ThreadLifecycleCoreSnapshot {
  return {
    schema_version: 'forum-thread-lifecycle.v1',
    thread_id: 'thread-1',
    state: 'OPEN',
    thread_state: 'OPEN',
    reply_budget: {
      schema_version: 'forum-reply-budget.v1',
      thread_id: 'thread-1',
      limit: 4,
      used: 1,
      remaining: 3,
      exhausted: false,
      mode: 'OPEN',
      soft_cap_turns: 3,
      hard_cap_turns: 4,
      remaining_turns: 3,
      cooldown_seconds: null,
      late_entry_reserved_slots: 0,
      revive_reserved_slots: 0,
      same_pair_cap: 3,
      last_evaluated_at: '2026-04-08T00:00:00.000Z',
    },
    active_route: null,
    lifecycle_label: 'ACTIVE',
    updated_at: '2026-04-08T00:00:00.000Z',
    ...overrides,
  }
}

describe('ThreadInteractionResolver', () => {
  const resolver = new ThreadInteractionResolver()

  it('freezes HANDOFF_PENDING as soft-close and prioritizes route follow-up', () => {
    const lifecycle = resolver.resolveLifecycleSnapshot(
      buildLifecycle({
        state: 'HANDOFF_PENDING',
        thread_state: 'HANDOFF_PENDING',
        active_route: {
          schema_version: 'forum-route-handoff.v1',
          route_id: 'route-1',
          route_type: 'AFTERSHOW',
          route_kind: 'AFTERSHOW',
          route_state: 'SUGGESTED',
          state: 'SUGGESTED',
          reason_code: 'WRAP_UP',
          handoff_label: 'Continue in aftershow.',
          handoff_payload: null,
          cta: null,
          target_ref: null,
          suggested_at: '2026-04-08T00:00:00.000Z',
          activated_at: null,
          completed_at: null,
          expires_at: null,
        },
        reply_budget: {
          ...buildLifecycle().reply_budget,
          used: 4,
          remaining: 0,
          exhausted: true,
          mode: 'CLOSED',
          late_entry_reserved_slots: 1,
          revive_reserved_slots: 1,
        },
      }),
      participationContract,
    )

    expect(lifecycle.writeability).toMatchObject({
      reply_mode: 'SOFT_CLOSE',
      reply_allowed: true,
      preferred_action: 'FOLLOW_ROUTE',
      reason_code: 'THREAD_HANDOFF_PENDING',
    })
    expect(lifecycle.can_receive_replies).toBe(true)
  })

  it('maps handoffed and closed threads into hard close or route-only states', () => {
    const lifecycle = resolver.resolveLifecycleSnapshot(
      buildLifecycle({
        state: 'HANDOFFED',
        thread_state: 'HANDOFFED',
        active_route: {
          schema_version: 'forum-route-handoff.v1',
          route_id: 'route-2',
          route_type: 'PRIVATE',
          route_kind: 'PRIVATE',
          route_state: 'ACTIVE',
          state: 'ACTIVE',
          reason_code: 'PRIVATE_HANDOFF_REQUIRED',
          handoff_label: 'Continue privately.',
          handoff_payload: null,
          cta: null,
          target_ref: null,
          suggested_at: '2026-04-08T00:00:00.000Z',
          activated_at: '2026-04-08T00:05:00.000Z',
          completed_at: null,
          expires_at: null,
        },
      }),
      participationContract,
    )

    expect(lifecycle.writeability).toMatchObject({
      reply_mode: 'ROUTE_ONLY',
      reply_allowed: false,
      preferred_action: 'FOLLOW_ROUTE',
      reason_code: 'THREAD_HANDOFFED',
    })
  })

  it('uses public write-plane fallback actions when soft-close has no route', () => {
    const lifecycle = resolver.resolveLifecycleSnapshot(
      buildLifecycle({
        state: 'WINDING_DOWN',
        thread_state: 'WINDING_DOWN',
        reply_budget: {
          ...buildLifecycle().reply_budget,
          used: 3,
          remaining: 1,
          exhausted: false,
          late_entry_reserved_slots: 1,
          revive_reserved_slots: 0,
        },
      }),
      participationContract,
    )

    expect(lifecycle.writeability).toMatchObject({
      reply_mode: 'SOFT_CLOSE',
      reply_allowed: true,
      preferred_action: 'START_NEW_THREAD',
      reason_code: 'THREAD_WINDING_DOWN',
    })
  })
})
