import type { GuidanceEventLogRepository } from '../repos/guidance-event-log-repository.js'
import type { GuidanceInboxRepository } from '../repos/guidance-inbox-repository.js'
import {
  GUIDANCE_BELL_REASON_CODES,
  GUIDANCE_EVENT_TYPES,
  isGuidanceRecallDeliveryEvent,
  isGuidanceRecallReason,
  readGuidanceEventDelayMs,
  readGuidanceEventReasonCode,
} from './guidance-events.js'
import { buildGuidanceBellView } from './guidance-bell-service.js'

export interface GuidanceRuntimeReasonMetric {
  delivered: number
  opened: number
  dismissed: number
  completed: number
}

export interface GuidanceObservabilitySnapshot {
  bell: {
    unread_count: number
    active_count: number
  }
  per_reason: Record<string, GuidanceRuntimeReasonMetric>
  avg_delivery_delay_ms: number | null
  suppression: {
    same_reason_count: number
    daily_cap_count: number
  }
  teaching_first_violation_count: number
}

function createReasonMetric(): GuidanceRuntimeReasonMetric {
  return {
    delivered: 0,
    opened: 0,
    dismissed: 0,
    completed: 0,
  }
}

export class GuidanceObservabilityService {
  constructor(private readonly deps: {
    inboxRepo: GuidanceInboxRepository
    eventLogRepo: GuidanceEventLogRepository
  }) {}

  async snapshot(): Promise<GuidanceObservabilitySnapshot> {
    const [activeItems, events] = await Promise.all([
      this.deps.inboxRepo.listAll({
        actorType: 'USER',
        statuses: ['ACTIVE'],
      }),
      this.deps.eventLogRepo.listAll({ actorType: 'USER' }),
    ])

    const perReason = Object.fromEntries(
      GUIDANCE_BELL_REASON_CODES.map((reasonCode) => [reasonCode, createReasonMetric()]),
    ) as Record<string, GuidanceRuntimeReasonMetric>

    const deliveryDelays: number[] = []
    let sameReasonCount = 0
    let dailyCapCount = 0

    for (const event of events) {
      const reasonCode = readGuidanceEventReasonCode(event.payload_json)
      if (reasonCode && !perReason[reasonCode]) {
        perReason[reasonCode] = createReasonMetric()
      }
      switch (event.event_type) {
        case GUIDANCE_EVENT_TYPES.BELL_DELIVERED: {
          if (reasonCode) {
            perReason[reasonCode].delivered += 1
          }
          if (isGuidanceRecallDeliveryEvent(event)) {
            const delayMs = readGuidanceEventDelayMs(event.payload_json)
            if (typeof delayMs === 'number') {
              deliveryDelays.push(delayMs)
            }
          }
          break
        }
        case GUIDANCE_EVENT_TYPES.BELL_OPENED: {
          if (reasonCode) {
            perReason[reasonCode].opened += 1
          }
          break
        }
        case GUIDANCE_EVENT_TYPES.ITEM_DISMISSED: {
          if (reasonCode) {
            perReason[reasonCode].dismissed += 1
          }
          break
        }
        case GUIDANCE_EVENT_TYPES.ITEM_COMPLETED: {
          if (reasonCode) {
            perReason[reasonCode].completed += 1
          }
          break
        }
        case GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_SAME_REASON:
          sameReasonCount += 1
          break
        case GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_24H_CAP:
          dailyCapCount += 1
          break
        default:
          break
      }
    }

    const itemsByActor = groupByActor(activeItems)
    const eventsByActor = groupByActor(events)
    const actorIds = new Set([
      ...itemsByActor.keys(),
      ...eventsByActor.keys(),
    ])

    let unreadCount = 0
    let activeCount = 0
    let teachingFirstViolationCount = 0

    for (const actorId of actorIds) {
      const actorEvents = eventsByActor.get(actorId) ?? []
      const bell = buildGuidanceBellView({
        activeItems: itemsByActor.get(actorId) ?? [],
        events: actorEvents,
      })

      unreadCount += bell.unread_count
      activeCount += bell.items.length

      const actorRecallDeliveries = actorEvents.filter(isGuidanceRecallDeliveryEvent)
      const visibleRecallCount = bell.items.filter((item) => isGuidanceRecallReason(item.reason_code)).length
      if (actorRecallDeliveries.length < 3 && visibleRecallCount > 1) {
        teachingFirstViolationCount += visibleRecallCount - 1
      }
    }

    return {
      bell: {
        unread_count: unreadCount,
        active_count: activeCount,
      },
      per_reason: perReason,
      avg_delivery_delay_ms: deliveryDelays.length > 0
        ? Math.round(deliveryDelays.reduce((sum, value) => sum + value, 0) / deliveryDelays.length)
        : null,
      suppression: {
        same_reason_count: sameReasonCount,
        daily_cap_count: dailyCapCount,
      },
      teaching_first_violation_count: teachingFirstViolationCount,
    }
  }
}

function groupByActor<T extends { actor_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    const existing = grouped.get(row.actor_id)
    if (existing) {
      existing.push(row)
    } else {
      grouped.set(row.actor_id, [row])
    }
  }
  return grouped
}
