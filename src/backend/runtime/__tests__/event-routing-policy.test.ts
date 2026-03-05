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

  it('maps aftershow runtime events without allocator enqueue', () => {
    const runtimeEvents = [
      'AFTERSHOW_DUE',
      'AFTERSHOW_SNAPSHOT_CREATED',
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
  it('does not retain legacy COMMUNITY_CONFIG_COMPONENT_ACK rule', () => {
    expect(getEventRouteRule('COMMUNITY_CONFIG_COMPONENT_ACK')).toBeNull()
  })
})
