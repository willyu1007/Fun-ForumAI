import type {
  CreateMediaContextProjectionInput,
  MediaContextProjection,
} from './types.js'

export interface MediaContextProjectionRepository {
  create(input: CreateMediaContextProjectionInput): Promise<MediaContextProjection>
  findByBindingId(bindingId: string): Promise<MediaContextProjection[]>
  findByBindingIds(bindingIds: string[]): Promise<MediaContextProjection[]>
}

let counter = 0
function cuid(): string {
  return `media_projection_${Date.now()}_${++counter}`
}

export class InMemoryMediaContextProjectionRepository implements MediaContextProjectionRepository {
  private store = new Map<string, MediaContextProjection>()

  async create(input: CreateMediaContextProjectionInput): Promise<MediaContextProjection> {
    const projection: MediaContextProjection = {
      id: input.id ?? cuid(),
      binding_id: input.binding_id,
      projection_surface: input.projection_surface,
      projection_kind: input.projection_kind,
      schema_version: input.schema_version,
      payload_json: input.payload_json,
      token_estimate: input.token_estimate ?? null,
      prompt_weight: input.prompt_weight ?? null,
      mention_policy: input.mention_policy ?? null,
      preferred_display_variant: input.preferred_display_variant ?? null,
      expires_at: input.expires_at ?? null,
      created_at: new Date(),
    }
    this.store.set(projection.id, projection)
    return projection
  }

  async findByBindingId(bindingId: string): Promise<MediaContextProjection[]> {
    return Array.from(this.store.values())
      .filter((item) => item.binding_id === bindingId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async findByBindingIds(bindingIds: string[]): Promise<MediaContextProjection[]> {
    const lookup = new Set(bindingIds)
    return Array.from(this.store.values())
      .filter((item) => lookup.has(item.binding_id))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }
}
