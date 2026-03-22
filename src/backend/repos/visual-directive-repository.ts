import type {
  CreateVisualDirectiveInput,
  PersistedVisualDirective,
} from './types.js'

export interface VisualDirectiveRepository {
  create(input: CreateVisualDirectiveInput): Promise<PersistedVisualDirective>
  findById(id: string): Promise<PersistedVisualDirective | null>
}

let counter = 0
function cuid(): string {
  return `visual_directive_${Date.now()}_${++counter}`
}

export class InMemoryVisualDirectiveRepository implements VisualDirectiveRepository {
  private readonly store = new Map<string, PersistedVisualDirective>()

  async create(input: CreateVisualDirectiveInput): Promise<PersistedVisualDirective> {
    const now = new Date()
    const entity: PersistedVisualDirective = {
      id: input.id ?? cuid(),
      schema_version: input.schema_version ?? 'visual-directive.v1',
      scene_ref: input.scene_ref,
      goal: input.goal,
      narrative_context: input.narrative_context,
      sourcing_policy: input.sourcing_policy,
      guardrails: input.guardrails,
      budget: input.budget,
      audit: input.audit,
      created_at: now,
      updated_at: now,
    }
    this.store.set(entity.id, entity)
    return entity
  }

  async findById(id: string): Promise<PersistedVisualDirective | null> {
    return this.store.get(id) ?? null
  }
}
