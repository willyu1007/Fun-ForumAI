import { describe, expect, it } from 'vitest'
import { ThreadLifecycleService } from '../thread-lifecycle-service.js'

describe('ThreadLifecycleService', () => {
  const service = new ThreadLifecycleService()

  it('maps closed threads with a suggested route into HANDOFF_PENDING and preserves reserve fields', () => {
    const lifecycle = service.buildThreadLifecycle({
      id: 'thread-1',
      thread_state: 'CLOSED',
      reply_budget: 4,
      active_route: {
        route_type: 'AFTERSHOW',
        route_state: 'SUGGESTED',
        reason_code: 'WRAP_UP',
        handoff_label: 'Move to aftershow.',
        handoff_payload: {
          route_id: 'route-1',
          target_ref: { kind: 'POST', id: 'post-1' },
          suggested_at: '2026-04-07T08:00:00.000Z',
        },
        cta: { label: 'Open aftershow' },
      },
      updated_at: new Date('2026-04-07T08:00:00.000Z'),
    }, 4)

    expect(lifecycle).toMatchObject({
      thread_id: 'thread-1',
      thread_state: 'HANDOFF_PENDING',
      lifecycle_label: 'HANDOFF_READY',
      reply_budget: {
        mode: 'CLOSED',
        exhausted: true,
        late_entry_reserved_slots: 1,
        revive_reserved_slots: 1,
        same_pair_cap: 2,
      },
      active_route: {
        route_id: 'route-1',
        state: 'SUGGESTED',
        target_ref: {
          kind: 'POST',
          id: 'post-1',
        },
      },
    })
  })

  it('maps active or completed routes into HANDOFFED and keeps timestamps on the handoff', () => {
    const lifecycle = service.buildThreadLifecycle({
      id: 'thread-2',
      thread_state: 'OPEN',
      reply_budget: 6,
      active_route: {
        route_type: 'PRIVATE',
        route_state: 'ACTIVE',
        reason_code: 'PRIVATE_HANDOFF_REQUIRED',
        handoff_label: 'Continue privately.',
        handoff_payload: {
          route_id: 'route-2',
          activated_at: '2026-04-07T09:00:00.000Z',
          completed_at: '2026-04-07T09:05:00.000Z',
        },
        cta: { label: 'Open DM' },
      },
      updated_at: new Date('2026-04-07T09:05:00.000Z'),
    }, 2)

    expect(lifecycle).toMatchObject({
      thread_id: 'thread-2',
      thread_state: 'HANDOFFED',
      lifecycle_label: 'CLOSED',
      active_route: {
        route_id: 'route-2',
        state: 'ACTIVE',
        activated_at: '2026-04-07T09:00:00.000Z',
        completed_at: '2026-04-07T09:05:00.000Z',
      },
    })
  })
})
