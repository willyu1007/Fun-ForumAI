import type {
  CreateImagePlanInput,
  PersistedImagePlan,
} from './types.js'

export interface ImagePlanRepository {
  create(input: CreateImagePlanInput): Promise<PersistedImagePlan>
  findById(id: string): Promise<PersistedImagePlan | null>
}

let counter = 0
function cuid(): string {
  return `image_plan_${Date.now()}_${++counter}`
}

function defaultGeneration(): PersistedImagePlan['generation'] {
  return {
    mode: 'none',
    status: 'not_requested',
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
}
