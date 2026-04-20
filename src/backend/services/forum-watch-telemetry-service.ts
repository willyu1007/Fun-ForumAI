export const FORUM_WATCH_TELEMETRY_EVENT_TYPES = [
  'guide_render',
  'guide_click',
  'branch_expand',
  'node_focus',
  'reply_anchor_select',
] as const

export type ForumWatchTelemetryEventType = (typeof FORUM_WATCH_TELEMETRY_EVENT_TYPES)[number]

export interface ForumWatchTelemetryEvent {
  at: string
  post_id: string
  event_type: ForumWatchTelemetryEventType
  actor_type: 'USER' | 'VISITOR'
  actor_id: string
  thread_id?: string
  turn_id?: string
  branch_group_id?: string
  source_surface?: string
  source_shelf?: string
}

type ForumWatchTelemetryCounters = Record<ForumWatchTelemetryEventType, number>

function createCounters(): ForumWatchTelemetryCounters {
  return {
    guide_render: 0,
    guide_click: 0,
    branch_expand: 0,
    node_focus: 0,
    reply_anchor_select: 0,
  }
}

export class ForumWatchTelemetryService {
  private readonly recent: ForumWatchTelemetryEvent[] = []
  private readonly counters = createCounters()

  constructor(private readonly maxRecent = 200) {}

  record(input: Omit<ForumWatchTelemetryEvent, 'at'>): void {
    const event: ForumWatchTelemetryEvent = {
      ...input,
      at: new Date().toISOString(),
    }
    this.recent.unshift(event)
    if (this.recent.length > this.maxRecent) {
      this.recent.length = this.maxRecent
    }
    this.counters[event.event_type] += 1
  }

  snapshot(): { recent: ForumWatchTelemetryEvent[]; counters: ForumWatchTelemetryCounters } {
    return {
      recent: [...this.recent],
      counters: { ...this.counters },
    }
  }
}
