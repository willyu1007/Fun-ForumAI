import type { GuidanceEventLogEntity, GuidanceInboxItemEntity } from '../repos/types.js'
import type { GuidanceEventLogRepository } from '../repos/guidance-event-log-repository.js'
import type { GuidanceInboxRepository } from '../repos/guidance-inbox-repository.js'
import type { GuidanceActorRef, GuidanceBellView } from './guidance-types.js'
import {
  GUIDANCE_EVENT_TYPES,
  isGuidanceBellReason,
  isGuidanceRecallDeliveryEvent,
  isGuidanceRecallReason,
  readGuidanceEventItemId,
} from './guidance-events.js'
import { toGuidanceItemCardView } from './guidance-types.js'

function byUpdatedDesc<T extends { updated_at: string }>(left: T, right: T): number {
  return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
}

function getLatestDeliveryByItemId(events: GuidanceEventLogEntity[]): Map<string, GuidanceEventLogEntity> {
  const map = new Map<string, GuidanceEventLogEntity>()
  for (const event of events) {
    const itemId = readGuidanceEventItemId(event.payload_json)
    if (!itemId || map.has(itemId)) {
      continue
    }
    map.set(itemId, event)
  }
  return map
}

export function buildGuidanceBellView(input: {
  activeItems: GuidanceInboxItemEntity[]
  events: GuidanceEventLogEntity[]
}): GuidanceBellView {
  const bellItems = input.activeItems.filter((item) => isGuidanceBellReason(item.reason_code))
  if (bellItems.length === 0) {
    return { items: [], unread_count: 0 }
  }

  const deliveryEvents = input.events.filter((event) => event.event_type === GUIDANCE_EVENT_TYPES.BELL_DELIVERED)
  const recallDeliveries = deliveryEvents.filter(isGuidanceRecallDeliveryEvent)
  const latestDeliveryByItemId = getLatestDeliveryByItemId(deliveryEvents)
  const totalRecallDeliveries = recallDeliveries.length

  const eventTimeItems = bellItems
    .filter((item) => !isGuidanceRecallReason(item.reason_code))
    .map(toGuidanceItemCardView)

  let recallItems = bellItems
    .filter((item) => isGuidanceRecallReason(item.reason_code) && latestDeliveryByItemId.has(item.id))
    .map(toGuidanceItemCardView)
    .sort((left, right) => {
      const leftEvent = latestDeliveryByItemId.get(left.id)
      const rightEvent = latestDeliveryByItemId.get(right.id)
      if (leftEvent && rightEvent) {
        return rightEvent.created_at.getTime() - leftEvent.created_at.getTime()
      }
      return byUpdatedDesc(left, right)
    })

  if (totalRecallDeliveries < 3) {
    recallItems = recallItems.slice(0, 1)
  }

  const items = [...eventTimeItems, ...recallItems].sort((left, right) => {
    if (left.unread !== right.unread) {
      return left.unread ? -1 : 1
    }
    return byUpdatedDesc(left, right)
  })

  return {
    items,
    unread_count: items.filter((item) => item.unread).length,
  }
}

export class GuidanceBellService {
  constructor(private readonly deps: {
    inboxRepo: GuidanceInboxRepository
    eventLogRepo: GuidanceEventLogRepository
  }) {}

  async listBell(actor: GuidanceActorRef): Promise<GuidanceBellView> {
    const activeItems = await this.deps.inboxRepo.listByActor(actor.actor_type, actor.actor_id, {
      statuses: ['ACTIVE'],
    })
    const events = await this.deps.eventLogRepo.listByActor(actor.actor_type, actor.actor_id, {
      eventTypes: [GUIDANCE_EVENT_TYPES.BELL_DELIVERED],
    })
    return buildGuidanceBellView({
      activeItems,
      events,
    })
  }
}
