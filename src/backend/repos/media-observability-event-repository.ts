import type {
  CreateMediaObservabilityEventInput,
  MediaObservabilityEvent,
  MediaObservabilitySeverity,
  MediaObservabilitySurface,
} from './types.js'

export interface ListMediaObservabilityEventsOptions {
  since?: Date
  until?: Date
  severity?: MediaObservabilitySeverity
  surface?: MediaObservabilitySurface
  limit?: number
  before?: {
    created_at: Date
    id: string
  }
}

export interface MediaObservabilityEventRepository {
  create(input: CreateMediaObservabilityEventInput): Promise<MediaObservabilityEvent>
  list(options?: ListMediaObservabilityEventsOptions): Promise<MediaObservabilityEvent[]>
}

let counter = 0
function cuid(): string {
  return `media_observability_event_${Date.now()}_${String(++counter).padStart(8, '0')}`
}

export class InMemoryMediaObservabilityEventRepository implements MediaObservabilityEventRepository {
  private readonly store = new Map<string, MediaObservabilityEvent>()

  async create(input: CreateMediaObservabilityEventInput): Promise<MediaObservabilityEvent> {
    const event: MediaObservabilityEvent = {
      id: input.id ?? cuid(),
      event_type: input.event_type,
      surface: input.surface,
      severity: input.severity ?? 'info',
      agent_id: input.agent_id ?? null,
      community_id: input.community_id ?? null,
      image_plan_id: input.image_plan_id ?? null,
      generation_job_id: input.generation_job_id ?? null,
      asset_id: input.asset_id ?? null,
      source_kind: input.source_kind ?? null,
      metric_value: input.metric_value ?? null,
      payload_json: input.payload_json ?? null,
      created_at: input.created_at ?? new Date(),
    }
    this.store.set(event.id, event)
    return event
  }

  async list(options: ListMediaObservabilityEventsOptions = {}): Promise<MediaObservabilityEvent[]> {
    return Array.from(this.store.values())
      .filter((item) => (options.since ? item.created_at.getTime() >= options.since.getTime() : true))
      .filter((item) => (options.until ? item.created_at.getTime() <= options.until.getTime() : true))
      .filter((item) => (options.severity ? item.severity === options.severity : true))
      .filter((item) => (options.surface ? item.surface === options.surface : true))
      .filter((item) => {
        if (!options.before) return true
        const itemTime = item.created_at.getTime()
        const beforeTime = options.before.created_at.getTime()
        return itemTime < beforeTime || (itemTime === beforeTime && item.id < options.before.id)
      })
      .sort((left, right) =>
        right.created_at.getTime() - left.created_at.getTime()
        || right.id.localeCompare(left.id))
      .slice(0, options.limit ?? Number.MAX_SAFE_INTEGER)
  }
}
