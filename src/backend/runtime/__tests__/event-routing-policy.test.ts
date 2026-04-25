import { describe, expect, it } from 'vitest'
import { getEventRouteRule } from '../event-routing-policy.js'

describe('event-routing-policy', () => {
  it('maps new community config events to CONTROL plane without allocator enqueue', () => {
    const eventTypes = [
      'COMMUNITY_CONFIG_VALIDATED',
      'COMMUNITY_CONFIG_VALIDATION_FAILED',
      'COMMUNITY_CONFIG_APPROVED',
      'COMMUNITY_CONFIG_REJECTED',
      'COMMUNITY_CONFIG_APPLIED',
      'COMMUNITY_CONFIG_ACTIVATED',
      'COMMUNITY_CONFIG_ROLLED_BACK',
    ]

    for (const eventType of eventTypes) {
      const rule = getEventRouteRule(eventType)
      expect(rule).toBeTruthy()
      expect(rule?.plane).toBe('CONTROL')
      expect(rule?.enqueue_allocator).toBe(false)
    }
  })

  it('maps role assignment control events without allocator enqueue', () => {
    const controlEvents = [
      'ROLE_ASSIGNED',
      'ROLE_REVOKED',
      'ROLE_EXPIRED',
    ]

    for (const eventType of controlEvents) {
      const rule = getEventRouteRule(eventType)
      expect(rule).toBeTruthy()
      expect(rule?.plane).toBe('CONTROL')
      expect(rule?.enqueue_allocator).toBe(false)
    }
  })

  it('maps aftershow notification/control events without allocator enqueue', () => {
    const controlEvents = [
      'AGENT_RELATION_STATE_CHANGED',
      'AFTERSHOW_CALLOUTS_EXTRACTED',
      'HUMAN_NOTIFICATION_CREATED',
      'HUMAN_NOTIFICATION_INVALIDATED',
    ]

    for (const eventType of controlEvents) {
      const rule = getEventRouteRule(eventType)
      expect(rule).toBeTruthy()
      expect(rule?.plane).toBe('CONTROL')
      expect(rule?.enqueue_allocator).toBe(false)
    }
  })

  it('maps aftershow runtime events without allocator enqueue', () => {
    const runtimeEvents = [
      'AFTERSHOW_DUE',
      'AFTERSHOW_SNAPSHOT_CREATED',
      'AFTERSHOW_INPUT_SNAPSHOT_CREATED',
      'AFTERSHOW_COMPOSE_REQUESTED',
      'AFTERSHOW_COMPOSED',
      'AFTERSHOW_PUBLISHED',
      'AFTERSHOW_ABORTED',
    ]

    for (const eventType of runtimeEvents) {
      const rule = getEventRouteRule(eventType)
      expect(rule).toBeTruthy()
      expect(rule?.plane).toBe('RUNTIME')
      expect(rule?.enqueue_allocator).toBe(false)
    }
  })
  it('maps micro-action data events without allocator enqueue', () => {
    const microActionEvents = [
      'ASIDE_THREAD_CREATED',
      'ASIDE_TURN_CREATED',
      'AGENT_VOTE_CAST',
      'AFTERSHOW_ENTRY_CREATED',
    ]

    for (const eventType of microActionEvents) {
      const rule = getEventRouteRule(eventType)
      expect(rule).toBeTruthy()
      expect(rule?.plane).toBe('DATA')
      expect(rule?.enqueue_allocator).toBe(false)
    }
  })

  it('maps community membership control events without allocator enqueue', () => {
    const membershipEvents = [
      'COMMUNITY_MEMBER_ADDED',
      'COMMUNITY_MEMBER_LEFT',
      'COMMUNITY_MEMBER_STATUS_CHANGED',
    ]

    for (const eventType of membershipEvents) {
      const rule = getEventRouteRule(eventType)
      expect(rule).toBeTruthy()
      expect(rule?.plane).toBe('CONTROL')
      expect(rule?.enqueue_allocator).toBe(false)
    }
  })

  it('maps allocator-enqueued data events correctly', () => {
    const enqueueEvents = [
      { type: 'POST_CREATED', allocator: 'NewPostCreated' },
      { type: 'THREAD_OPENED', allocator: 'ThreadOpened' },
      { type: 'THREAD_TURN_ADDED', allocator: 'ThreadTurnAdded' },
      { type: 'VOTE_CAST', allocator: 'VoteCast' },
    ]

    for (const { type, allocator } of enqueueEvents) {
      const rule = getEventRouteRule(type)
      expect(rule).toBeTruthy()
      expect(rule?.plane).toBe('DATA')
      expect(rule?.enqueue_allocator).toBe(true)
      expect(rule?.allocator_event_type).toBe(allocator)
    }
  })

  it('maps non-enqueued data events correctly', () => {
    const noEnqueueEvents = [
      'THREAD_ROUTE_UPDATED',
      'MESSAGE_CREATED',
      'VOTE_CLEARED',
      'AGENT_VOTE_CLEARED',
      'HUMAN_VOTE_CAST',
      'HUMAN_VOTE_CLEARED',
    ]

    for (const eventType of noEnqueueEvents) {
      const rule = getEventRouteRule(eventType)
      expect(rule).toBeTruthy()
      expect(rule?.plane).toBe('DATA')
      expect(rule?.enqueue_allocator).toBe(false)
    }
  })

  it('does not retain legacy COMMUNITY_CONFIG_COMPONENT_ACK rule', () => {
    expect(getEventRouteRule('COMMUNITY_CONFIG_COMPONENT_ACK')).toBeNull()
  })

  it('returns null for unknown event types', () => {
    expect(getEventRouteRule('UNKNOWN_EVENT')).toBeNull()
    expect(getEventRouteRule('')).toBeNull()
  })
})
