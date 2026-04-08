import type {
  CreateImagePlanInput,
  PersistedImagePlan,
} from './types.js'

export interface UpdateImagePlanPatch {
  status?: PersistedImagePlan['status']
  decision?: PersistedImagePlan['decision']
  reason?: string
  runtime?: PersistedImagePlan['runtime']
  display?: PersistedImagePlan['display']
  generation?: PersistedImagePlan['generation']
  selected_sources?: PersistedImagePlan['selected_sources']
  planner_audit?: PersistedImagePlan['planner_audit']
}

export interface ImagePlanRepository {
  create(input: CreateImagePlanInput): Promise<PersistedImagePlan>
  findById(id: string): Promise<PersistedImagePlan | null>
  listByGenerationJobId(jobId: string): Promise<PersistedImagePlan[]>
  listRecentBySelectedSourceAssetId(
    assetId: string,
    options?: {
      since?: Date
      limit?: number
    },
  ): Promise<PersistedImagePlan[]>
  update(id: string, patch: UpdateImagePlanPatch): Promise<PersistedImagePlan | null>
}

let counter = 0
function cuid(): string {
  return `image_plan_${Date.now()}_${++counter}`
}

function defaultGeneration(): PersistedImagePlan['generation'] {
  return {
    mode: 'none',
    input_mode: 'reference',
    status: 'not_requested',
    aspect_ratio_hint: null,
  }
}

export class InMemoryImagePlanRepository implements ImagePlanRepository {
  private readonly store = new Map<string, PersistedImagePlan>()

  async create(input: CreateImagePlanInput): Promise<PersistedImagePlan> {
    const now = new Date()
    const entity: PersistedImagePlan = {
      id: input.id ?? cuid(),
      directive_id: input.directive_id,
      schema_version: input.schema_version ?? 'image-plan.v1',
      scene_ref: input.scene_ref,
      status: input.status,
      decision: input.decision,
      reason: input.reason,
      runtime: input.runtime,
      display: input.display,
      generation: input.generation ?? defaultGeneration(),
      selected_sources: input.selected_sources,
      planner_audit: input.planner_audit,
      created_at: now,
      updated_at: now,
    }
    this.store.set(entity.id, entity)
    return entity
  }

  async findById(id: string): Promise<PersistedImagePlan | null> {
    return this.store.get(id) ?? null
  }

  async listByGenerationJobId(jobId: string): Promise<PersistedImagePlan[]> {
    return Array.from(this.store.values())
      .filter((plan) => plan.generation.job_id === jobId)
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())
  }

  async listRecentBySelectedSourceAssetId(
    assetId: string,
    options?: {
      since?: Date
      limit?: number
    },
  ): Promise<PersistedImagePlan[]> {
    const sorted = Array.from(this.store.values())
      .filter((plan) =>
        plan.selected_sources.some((source) => source.asset_id === assetId))
      .filter((plan) =>
        options?.since ? plan.created_at.getTime() >= options.since.getTime() : true)
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())

    return typeof options?.limit === 'number' && options.limit > 0
      ? sorted.slice(0, options.limit)
      : sorted
  }

  async update(id: string, patch: UpdateImagePlanPatch): Promise<PersistedImagePlan | null> {
    const current = this.store.get(id)
    if (!current) return null
    if (patch.status !== undefined) current.status = patch.status
    if (patch.decision !== undefined) current.decision = patch.decision
    if (patch.reason !== undefined) current.reason = patch.reason
    if (patch.runtime !== undefined) current.runtime = patch.runtime
    if (patch.display !== undefined) current.display = patch.display
    if (patch.generation !== undefined) current.generation = patch.generation
    if (patch.selected_sources !== undefined) current.selected_sources = patch.selected_sources
    if (patch.planner_audit !== undefined) current.planner_audit = patch.planner_audit
    current.updated_at = new Date()
    return current
  }
}
