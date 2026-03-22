import type {
  CreateMediaContextProjectionInput,
  MediaContextProjection,
} from './types.js'

export interface UpdateMediaContextProjectionPatch {
  schema_version?: string
  expires_at?: Date | null
  payload_json?: Record<string, unknown>
  token_estimate?: number | null
  prompt_weight?: MediaContextProjection['prompt_weight']
  mention_policy?: MediaContextProjection['mention_policy']
  preferred_display_variant?: string | null
}

export interface MediaContextProjectionRepository {
  create(input: CreateMediaContextProjectionInput): Promise<MediaContextProjection>
  deleteByBindingIds(bindingIds: string[]): Promise<number>
  deleteByIds(ids: string[]): Promise<number>
  findById(id: string): Promise<MediaContextProjection | null>
  findByIds(ids: string[]): Promise<MediaContextProjection[]>
  findByBindingId(bindingId: string): Promise<MediaContextProjection[]>
  findByBindingIds(bindingIds: string[]): Promise<MediaContextProjection[]>
  listAll(): Promise<MediaContextProjection[]>
  update(id: string, patch: UpdateMediaContextProjectionPatch): Promise<MediaContextProjection | null>
  expireByIds(ids: string[], expiresAt: Date): Promise<number>
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

  async deleteByBindingIds(bindingIds: string[]): Promise<number> {
    const lookup = new Set(bindingIds)
    if (lookup.size === 0) return 0
    let deleted = 0
    for (const [id, projection] of this.store.entries()) {
      if (!lookup.has(projection.binding_id)) continue
      this.store.delete(id)
      deleted += 1
    }
    return deleted
  }

  async deleteByIds(ids: string[]): Promise<number> {
    const lookup = new Set(ids)
    if (lookup.size === 0) return 0
    let deleted = 0
    for (const id of lookup) {
      if (this.store.delete(id)) deleted += 1
    }
    return deleted
  }

  async findById(id: string): Promise<MediaContextProjection | null> {
    return this.store.get(id) ?? null
  }

  async findByIds(ids: string[]): Promise<MediaContextProjection[]> {
    const lookup = new Set(ids)
    return Array.from(this.store.values())
      .filter((item) => lookup.has(item.id))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
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

  async listAll(): Promise<MediaContextProjection[]> {
    return Array.from(this.store.values())
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async update(id: string, patch: UpdateMediaContextProjectionPatch): Promise<MediaContextProjection | null> {
    const current = this.store.get(id)
    if (!current) return null
    if (patch.schema_version !== undefined) current.schema_version = patch.schema_version
    if (patch.expires_at !== undefined) current.expires_at = patch.expires_at
    if (patch.payload_json !== undefined) current.payload_json = patch.payload_json
    if (patch.token_estimate !== undefined) current.token_estimate = patch.token_estimate
    if (patch.prompt_weight !== undefined) current.prompt_weight = patch.prompt_weight
    if (patch.mention_policy !== undefined) current.mention_policy = patch.mention_policy
    if (patch.preferred_display_variant !== undefined) {
      current.preferred_display_variant = patch.preferred_display_variant
    }
    return current
  }

  async expireByIds(ids: string[], expiresAt: Date): Promise<number> {
    const lookup = new Set(ids)
    if (lookup.size === 0) return 0
    let updated = 0
    for (const projection of this.store.values()) {
      if (!lookup.has(projection.id)) continue
      projection.expires_at = expiresAt
      updated += 1
    }
    return updated
  }
}
