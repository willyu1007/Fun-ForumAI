import type { DomainEvent, EventRepository } from '../repos/index.js'
import {
  readCardMode,
  readContentKind,
  readLaunchSurfaceKindId,
  readStorylineId,
  readThumbnailPolicy,
} from '../../shared/semantic-taxonomy.js'
import type {
  HomeProgrammingPayload,
  HomeProgrammingPostItem,
  HomeProgrammingService,
} from './home-programming-service.js'

const TARGET_SHELF_IDS = ['must_watch_today', 'continue_storyline'] as const

export interface HomeProgrammingSnapshotServiceDeps {
  homeProgrammingService: Pick<HomeProgrammingService, 'getHome'>
  eventRepo: EventRepository
  onEventCreated?: (event: DomainEvent) => Promise<void> | void
}

export interface HomeProgrammingSnapshotResult {
  snapshot_date: string
  generated_at: string
  scanned_count: number
  created_count: number
  deduped_count: number
  published_events: DomainEvent[]
}

function isSnapshotEligibleItem(item: HomeProgrammingPayload['shelves'][number]['items'][number]): item is HomeProgrammingPostItem {
  return item.item_kind === 'post' || item.item_kind === 'aftershow_recap'
}

function readSnapshotDate(generatedAt: string): string {
  return generatedAt.slice(0, 10)
}

export class HomeProgrammingSnapshotService {
  constructor(private readonly deps: HomeProgrammingSnapshotServiceDeps) {}

  setEventHook(hook: (event: DomainEvent) => Promise<void> | void): void {
    this.deps.onEventCreated = hook
  }

  async captureSnapshot(input: { now?: Date } = {}): Promise<HomeProgrammingSnapshotResult> {
    const payload = await this.deps.homeProgrammingService.getHome({ viewer: null })
    const generatedAt = payload.meta.generated_at ?? (input.now ?? new Date()).toISOString()
    const sourceMode = payload.meta.personalization_mode ?? 'editorial_baseline'
    const snapshotDate = readSnapshotDate(generatedAt)
    const publishedEvents: DomainEvent[] = []
    let scannedCount = 0
    let createdCount = 0
    let dedupedCount = 0

    if (sourceMode !== 'editorial_baseline') {
      console.warn(
        `[HomeProgrammingSnapshotService] skipped snapshot because personalization_mode=${sourceMode}`,
      )
      return {
        snapshot_date: snapshotDate,
        generated_at: generatedAt,
        scanned_count: 0,
        created_count: 0,
        deduped_count: 0,
        published_events: [],
      }
    }

    for (const shelfId of TARGET_SHELF_IDS) {
      const shelf = payload.shelves.find((item) => item.id === shelfId)
      if (!shelf) continue

      for (const item of shelf.items) {
        if (!isSnapshotEligibleItem(item) || !item.author_agent_id) continue
        scannedCount += 1

        const idempotencyKey = `home-shelf:${snapshotDate}:${shelfId}:${item.id}`
        const created = await this.createSnapshotEvent({
          idempotency_key: idempotencyKey,
          event_type: 'HOME_EDITORIAL_SHELF_PUBLISHED',
          plane: 'RUNTIME',
          schema_version: 'v1',
          community_id: item.community_id,
          post_id: item.id,
          actor_type: 'system',
          actor_id: 'home-programming-snapshot',
          correlation_id: `home-snapshot:${snapshotDate}`,
          payload_json: {
            snapshot_date: snapshotDate,
            generated_at: generatedAt,
            source_mode: sourceMode,
            shelf_id: shelfId,
            post_id: item.id,
            author_agent_id: item.author_agent_id,
            community_id: item.community_id,
            storyline_id: readStorylineId(item),
            content_kind: readContentKind(item),
            surface_kind: readLaunchSurfaceKindId(item),
            card_mode: readCardMode(item),
            thumbnail_policy: readThumbnailPolicy(item),
            hero_reason: item.hero_reason ?? null,
            next_jump_target: item.next_jump_target ?? null,
          },
        })

        if (created.created) {
          createdCount += 1
          publishedEvents.push(created.event)
        } else {
          dedupedCount += 1
        }
      }
    }

    return {
      snapshot_date: snapshotDate,
      generated_at: generatedAt,
      scanned_count: scannedCount,
      created_count: createdCount,
      deduped_count: dedupedCount,
      published_events: publishedEvents,
    }
  }

  private async createSnapshotEvent(input: Parameters<EventRepository['create']>[0]): Promise<{
    event: DomainEvent
    created: boolean
  }> {
    const existing = input.idempotency_key
      ? this.deps.eventRepo.findByIdempotencyKey(input.idempotency_key)
      : null
    if (existing) {
      return { event: existing, created: false }
    }

    const event = this.deps.eventRepo.create(input)
    try {
      await this.deps.onEventCreated?.(event)
    } catch (error) {
      console.error('[HomeProgrammingSnapshotService] Event hook error:', error)
    }
    return { event, created: true }
  }
}
