import { describe, expect, it } from 'vitest'
import { InMemoryGuidanceInboxRepository } from '../../repos/guidance-inbox-repository.js'
import { InMemoryGuidanceEventLogRepository } from '../../repos/guidance-event-log-repository.js'
import { GuidanceObservabilityService } from '../guidance-observability-service.js'
import { GUIDANCE_EVENT_TYPES } from '../guidance-events.js'

describe('GuidanceObservabilityService', () => {
  it('aggregates bell metrics in bulk and excludes event-time deliveries from recall delay averages', async () => {
    const inboxRepo = new InMemoryGuidanceInboxRepository()
    const eventLogRepo = new InMemoryGuidanceEventLogRepository()
    const service = new GuidanceObservabilityService({
      inboxRepo,
      eventLogRepo,
    })

    const recallItem = await inboxRepo.upsert({
      actor_type: 'USER',
      actor_id: 'user-1',
      module_type: 'CARD',
      reason_code: 'USE_FOLLOWING_FEED',
      dedup_key: 'use_following_feed',
      title: 'Open following feed',
      body: 'body',
      cta_label: '查看 Following',
      cta_target: '/?following_only=true',
      unread: true,
      status: 'ACTIVE',
    })
    await inboxRepo.upsert({
      actor_type: 'USER',
      actor_id: 'user-2',
      module_type: 'CARD',
      reason_code: 'WATCH_PUBLIC_EFFECT',
      dedup_key: 'watch_public_effect:post-1',
      title: 'Watch public effect',
      body: 'body',
      cta_label: '查看帖子',
      cta_target: '/posts/post-1',
      unread: true,
      status: 'ACTIVE',
      payload_json: {
        post_id: 'post-1',
      },
    })

    await eventLogRepo.create({
      actor_type: 'USER',
      actor_id: 'user-1',
      event_type: GUIDANCE_EVENT_TYPES.BELL_DELIVERED,
      payload_json: {
        item_id: recallItem.id,
        reason_code: 'USE_FOLLOWING_FEED',
        recall: true,
        delay_ms: 120_000,
      },
    })
    await eventLogRepo.create({
      actor_type: 'USER',
      actor_id: 'user-1',
      event_type: GUIDANCE_EVENT_TYPES.BELL_OPENED,
      payload_json: {
        item_id: recallItem.id,
        reason_code: 'USE_FOLLOWING_FEED',
      },
    })
    await eventLogRepo.create({
      actor_type: 'USER',
      actor_id: 'user-2',
      event_type: GUIDANCE_EVENT_TYPES.BELL_DELIVERED,
      payload_json: {
        item_id: 'event-time-item',
        reason_code: 'WATCH_PUBLIC_EFFECT',
        recall: false,
      },
    })
    await eventLogRepo.create({
      actor_type: 'USER',
      actor_id: 'user-1',
      event_type: GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_SAME_REASON,
      payload_json: {
        reason_code: 'USE_FOLLOWING_FEED',
      },
    })

    const snapshot = await service.snapshot()

    expect(snapshot.bell).toEqual({
      unread_count: 2,
      active_count: 2,
    })
    expect(snapshot.per_reason.USE_FOLLOWING_FEED).toEqual({
      delivered: 1,
      opened: 1,
      dismissed: 0,
      completed: 0,
    })
    expect(snapshot.per_reason.WATCH_PUBLIC_EFFECT).toEqual({
      delivered: 1,
      opened: 0,
      dismissed: 0,
      completed: 0,
    })
    expect(snapshot.avg_delivery_delay_ms).toBe(120_000)
    expect(snapshot.suppression.same_reason_count).toBe(1)
  })
})
