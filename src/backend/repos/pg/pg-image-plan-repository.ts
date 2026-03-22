import { Prisma, type ImagePlanRecord as PrismaImagePlanRecord, type PrismaClient } from '@prisma/client'
import type {
  CreateImagePlanInput,
  PersistedImagePlan,
} from '../types.js'
import type { ImagePlanRepository } from '../image-plan-repository.js'

function defaultGeneration(): PersistedImagePlan['generation'] {
  return {
    mode: 'none',
    status: 'not_requested',
  }
}

export class PgImagePlanRepository implements ImagePlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateImagePlanInput): Promise<PersistedImagePlan> {
    const row = await this.prisma.imagePlanRecord.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        directiveId: input.directive_id,
        schemaVersion: input.schema_version ?? 'image-plan.v1',
        sceneRef: input.scene_ref as Prisma.InputJsonValue,
        status: input.status,
        decision: input.decision,
        reason: input.reason,
        runtime: input.runtime as Prisma.InputJsonValue,
        display: input.display as Prisma.InputJsonValue,
        generation: (input.generation ?? defaultGeneration()) as Prisma.InputJsonValue,
        selectedSources: input.selected_sources as Prisma.InputJsonValue,
        plannerAudit: input.planner_audit as Prisma.InputJsonValue,
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<PersistedImagePlan | null> {
    const row = await this.prisma.imagePlanRecord.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  private toDomain(row: PrismaImagePlanRecord): PersistedImagePlan {
    return {
      id: row.id,
      directive_id: row.directiveId,
      schema_version: row.schemaVersion as PersistedImagePlan['schema_version'],
      scene_ref: row.sceneRef as PersistedImagePlan['scene_ref'],
      status: row.status as PersistedImagePlan['status'],
      decision: row.decision as PersistedImagePlan['decision'],
      reason: row.reason,
      runtime: row.runtime as PersistedImagePlan['runtime'],
      display: row.display as PersistedImagePlan['display'],
      generation: row.generation as PersistedImagePlan['generation'],
      selected_sources: row.selectedSources as PersistedImagePlan['selected_sources'],
      planner_audit: row.plannerAudit as PersistedImagePlan['planner_audit'],
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
