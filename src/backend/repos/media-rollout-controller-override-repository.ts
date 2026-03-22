import type {
  CreateMediaRolloutControllerOverrideInput,
  MediaRolloutControllerOverride,
} from './types.js'

export interface ReleaseMediaRolloutControllerOverrideInput {
  released_by_user_id: string
  released_reason?: string | null
  released_at?: Date
}

export interface ReplaceActiveMediaRolloutControllerOverrideInput {
  next_override: CreateMediaRolloutControllerOverrideInput
  release: ReleaseMediaRolloutControllerOverrideInput
}

export interface MediaRolloutControllerOverrideRepository {
  create(input: CreateMediaRolloutControllerOverrideInput): Promise<MediaRolloutControllerOverride>
  findById(id: string): Promise<MediaRolloutControllerOverride | null>
  findActive(): Promise<MediaRolloutControllerOverride | null>
  replaceActive(
    input: ReplaceActiveMediaRolloutControllerOverrideInput,
  ): Promise<MediaRolloutControllerOverride>
  release(
    id: string,
    input: ReleaseMediaRolloutControllerOverrideInput,
  ): Promise<MediaRolloutControllerOverride | null>
}

let counter = 0
function cuid(): string {
  return `media_rollout_override_${Date.now()}_${++counter}`
}

export class InMemoryMediaRolloutControllerOverrideRepository
implements MediaRolloutControllerOverrideRepository {
  private readonly store = new Map<string, MediaRolloutControllerOverride>()

  async create(
    input: CreateMediaRolloutControllerOverrideInput,
  ): Promise<MediaRolloutControllerOverride> {
    const now = new Date()
    const entity: MediaRolloutControllerOverride = {
      id: input.id ?? cuid(),
      status: input.status ?? 'active',
      mode: input.mode,
      target_min_rate: input.target_min_rate ?? null,
      target_max_rate: input.target_max_rate ?? null,
      threshold_delta: input.threshold_delta ?? null,
      allow_generation: input.allow_generation ?? null,
      generation_tier: input.generation_tier ?? null,
      sync_generation_ms_budget: input.sync_generation_ms_budget ?? null,
      allow_private_runtime_projection: input.allow_private_runtime_projection ?? null,
      allow_private_inspired_generation: input.allow_private_inspired_generation ?? null,
      force_safe_mode: input.force_safe_mode ?? false,
      reason: input.reason ?? null,
      created_by_user_id: input.created_by_user_id,
      released_by_user_id: input.released_by_user_id ?? null,
      released_reason: input.released_reason ?? null,
      released_at: input.released_at ?? null,
      created_at: now,
      updated_at: now,
    }
    this.store.set(entity.id, entity)
    return entity
  }

  async findById(id: string): Promise<MediaRolloutControllerOverride | null> {
    return this.store.get(id) ?? null
  }

  async findActive(): Promise<MediaRolloutControllerOverride | null> {
    return Array.from(this.store.values())
      .filter((item) => item.status === 'active')
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())[0] ?? null
  }

  async replaceActive(
    input: ReplaceActiveMediaRolloutControllerOverrideInput,
  ): Promise<MediaRolloutControllerOverride> {
    const active = await this.findActive()
    if (active) {
      await this.release(active.id, input.release)
    }
    return this.create(input.next_override)
  }

  async release(
    id: string,
    input: ReleaseMediaRolloutControllerOverrideInput,
  ): Promise<MediaRolloutControllerOverride | null> {
    const current = this.store.get(id)
    if (!current) return null
    current.status = 'released'
    current.released_by_user_id = input.released_by_user_id
    current.released_reason = input.released_reason ?? null
    current.released_at = input.released_at ?? new Date()
    current.updated_at = new Date()
    return current
  }
}
