import { Prisma, type MediaObservabilityEvent as PrismaMediaObservabilityEvent, type PrismaClient } from '@prisma/client'
import type {
  CreateMediaObservabilityEventInput,
  MediaObservabilityEvent,
} from '../types.js'
import type {
  ListMediaObservabilityEventsOptions,
  MediaObservabilityEventRepository,
} from '../media-observability-event-repository.js'

export class PgMediaObservabilityEventRepository implements MediaObservabilityEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMediaObservabilityEventInput): Promise<MediaObservabilityEvent> {
    const row = await this.prisma.mediaObservabilityEvent.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        eventType: input.event_type,
        surface: input.surface,
        severity: input.severity ?? 'info',
        agentId: input.agent_id ?? null,
        communityId: input.community_id ?? null,
        imagePlanId: input.image_plan_id ?? null,
        generationJobId: input.generation_job_id ?? null,
        assetId: input.asset_id ?? null,
        sourceKind: input.source_kind ?? null,
        metricValue: input.metric_value ?? null,
        ...(input.payload_json !== undefined
          ? { payloadJson: input.payload_json as Prisma.InputJsonValue }
          : {}),
        ...(input.created_at ? { createdAt: input.created_at } : {}),
      },
    })
    return this.toDomain(row)
  }

  async list(options: ListMediaObservabilityEventsOptions = {}): Promise<MediaObservabilityEvent[]> {
    const rows = await this.prisma.mediaObservabilityEvent.findMany({
      where: {
        ...(options.since || options.until
          ? {
              createdAt: {
                ...(options.since ? { gte: options.since } : {}),
                ...(options.until ? { lte: options.until } : {}),
              },
            }
          : {}),
        ...(options.severity ? { severity: options.severity } : {}),
        ...(options.surface ? { surface: options.surface } : {}),
        ...(options.before
          ? {
              OR: [
                { createdAt: { lt: options.before.created_at } },
                {
                  createdAt: options.before.created_at,
                  id: { lt: options.before.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(options.limit ? { take: options.limit } : {}),
    })
    return rows.map((row) => this.toDomain(row))
  }

  private toDomain(row: PrismaMediaObservabilityEvent): MediaObservabilityEvent {
    return {
      id: row.id,
      event_type: row.eventType as MediaObservabilityEvent['event_type'],
      surface: row.surface as MediaObservabilityEvent['surface'],
      severity: row.severity as MediaObservabilityEvent['severity'],
      agent_id: row.agentId,
      community_id: row.communityId,
      image_plan_id: row.imagePlanId,
      generation_job_id: row.generationJobId,
      asset_id: row.assetId,
      source_kind: row.sourceKind as MediaObservabilityEvent['source_kind'],
      metric_value: row.metricValue,
      payload_json: row.payloadJson as Record<string, unknown> | null,
      created_at: row.createdAt,
    }
  }
}
