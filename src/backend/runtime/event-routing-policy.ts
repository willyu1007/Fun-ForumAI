import type { DomainEventType } from '../allocator/types.js'
import type { EventPlane } from '../repos/types.js'

export interface EventRouteRule {
  plane: EventPlane
  enqueue_allocator: boolean
  allocator_event_type?: DomainEventType
}

const RULES: Record<string, EventRouteRule> = {
  POST_CREATED: { plane: 'DATA', enqueue_allocator: true, allocator_event_type: 'NewPostCreated' },
  COMMENT_CREATED: { plane: 'DATA', enqueue_allocator: true, allocator_event_type: 'NewCommentCreated' },
  VOTE_CAST: { plane: 'DATA', enqueue_allocator: true, allocator_event_type: 'VoteCast' },
  MESSAGE_CREATED: { plane: 'DATA', enqueue_allocator: false },
  ASIDE_COMMENT_CREATED: { plane: 'DATA', enqueue_allocator: false },
  AGENT_VOTE_CAST: { plane: 'DATA', enqueue_allocator: false },
  HUMAN_VOTE_CAST: { plane: 'DATA', enqueue_allocator: false },
  AFTERSHOW_COMMENT_CREATED: { plane: 'DATA', enqueue_allocator: false },

  COMMUNITY_CONFIG_PROPOSED: { plane: 'CONTROL', enqueue_allocator: false },
  COMMUNITY_CONFIG_VALIDATED: { plane: 'CONTROL', enqueue_allocator: false },
  COMMUNITY_CONFIG_VALIDATION_FAILED: { plane: 'CONTROL', enqueue_allocator: false },
  COMMUNITY_CONFIG_APPROVED: { plane: 'CONTROL', enqueue_allocator: false },
  COMMUNITY_CONFIG_REJECTED: { plane: 'CONTROL', enqueue_allocator: false },
  COMMUNITY_CONFIG_APPLIED: { plane: 'CONTROL', enqueue_allocator: false },
  COMMUNITY_CONFIG_APPLY_FAILED: { plane: 'CONTROL', enqueue_allocator: false },
  COMMUNITY_CONFIG_ROLLED_BACK: { plane: 'CONTROL', enqueue_allocator: false },
  COMMUNITY_CONFIG_ACTIVATED: { plane: 'CONTROL', enqueue_allocator: false },
  ROLE_ASSIGNED: { plane: 'CONTROL', enqueue_allocator: false },
  ROLE_EXPIRED: { plane: 'CONTROL', enqueue_allocator: false },
  ROLE_REVOKED: { plane: 'CONTROL', enqueue_allocator: false },
  HUMAN_NOTIFICATION_CREATED: { plane: 'CONTROL', enqueue_allocator: false },
  HUMAN_NOTIFICATION_INVALIDATED: { plane: 'CONTROL', enqueue_allocator: false },

  AFTERSHOW_DUE: { plane: 'RUNTIME', enqueue_allocator: false },
  AFTERSHOW_SNAPSHOT_CREATED: { plane: 'RUNTIME', enqueue_allocator: false },
  AFTERSHOW_COMPOSED: { plane: 'RUNTIME', enqueue_allocator: false },
  AFTERSHOW_PUBLISHED: { plane: 'RUNTIME', enqueue_allocator: false },
  AFTERSHOW_ABORTED: { plane: 'RUNTIME', enqueue_allocator: false },
}

export function getEventRouteRule(eventType: string): EventRouteRule | null {
  return RULES[eventType] ?? null
}
