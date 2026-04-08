import { Prisma, type ImagePlanRecord as PrismaImagePlanRecord, type PrismaClient } from '@prisma/client'
import type {
  CreateImagePlanInput,
  PersistedImagePlan,
} from '../types.js'
import type { ImagePlanRepository, UpdateImagePlanPatch } from '../image-plan-repository.js'

function defaultGeneration(): PersistedImagePlan['generation'] {
  return {
    mode: 'none',
    input_mode: 'reference',
    status: 'not_requested',
    aspect_ratio_hint: null,
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
        sceneRef: input.scene_ref as unknown as Prisma.InputJsonValue,
        status: input.status,
        decision: input.decision,
        reason: input.reason,
        runtime: input.runtime as unknown as Prisma.InputJsonValue,
        display: input.display as unknown as Prisma.InputJsonValue,
        generation: (input.generation ?? defaultGeneration()) as unknown as Prisma.InputJsonValue,
        selectedSources: input.selected_sources as unknown as Prisma.InputJsonValue,
        plannerAudit: input.planner_audit as unknown as Prisma.InputJsonValue,
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<PersistedImagePlan | null> {
    const row = await this.prisma.imagePlanRecord.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async listByGenerationJobId(jobId: string): Promise<PersistedImagePlan[]> {
    const ids = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM image_plans
      WHERE generation ->> 'job_id' = ${jobId}
      ORDER BY created_at DESC
    `)
    if (ids.length === 0) return []
    const rows = await this.prisma.imagePlanRecord.findMany({
      where: {
        id: { in: ids.map((row) => row.id) },
      },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async listRecentBySelectedSourceAssetId(
    assetId: string,
    options?: {
      since?: Date
      limit?: number
    },
  ): Promise<PersistedImagePlan[]> {
    const clauses = [
      Prisma.sql`
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements(selected_sources) AS source
          WHERE source ->> 'asset_id' = ${assetId}
        )
      `,
    ]
    if (options?.since) {
      clauses.push(Prisma.sql`created_at >= ${options.since}`)
    }
    const whereClause = Prisma.sql`WHERE ${Prisma.join(clauses, Prisma.sql` AND `)}`
    const limitClause = typeof options?.limit === 'number' && options.limit > 0
      ? Prisma.sql`LIMIT ${options.limit}`
      : Prisma.empty
    const ids = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM image_plans
      ${whereClause}
      ORDER BY created_at DESC
      ${limitClause}
    `)
    if (ids.length === 0) return []
    const rows = await this.prisma.imagePlanRecord.findMany({
      where: {
        id: { in: ids.map((row) => row.id) },
      },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async update(id: string, patch: UpdateImagePlanPatch): Promise<PersistedImagePlan | null> {
    const row = await this.prisma.imagePlanRecord.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.decision !== undefined ? { decision: patch.decision } : {}),
        ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
        ...(patch.runtime !== undefined ? { runtime: patch.runtime as unknown as Prisma.InputJsonValue } : {}),
        ...(patch.display !== undefined ? { display: patch.display as unknown as Prisma.InputJsonValue } : {}),
        ...(patch.generation !== undefined ? { generation: patch.generation as unknown as Prisma.InputJsonValue } : {}),
        ...(patch.selected_sources !== undefined ? { selectedSources: patch.selected_sources as unknown as Prisma.InputJsonValue } : {}),
        ...(patch.planner_audit !== undefined ? { plannerAudit: patch.planner_audit as unknown as Prisma.InputJsonValue } : {}),
      },
    }).catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return null
      }
      throw err
    })
    return row ? this.toDomain(row) : null
  }

  private toDomain(row: PrismaImagePlanRecord): PersistedImagePlan {
    return {
      id: row.id,
      directive_id: row.directiveId,
      schema_version: row.schemaVersion as PersistedImagePlan['schema_version'],
      scene_ref: row.sceneRef as unknown as PersistedImagePlan['scene_ref'],
      status: row.status as PersistedImagePlan['status'],
      decision: row.decision as PersistedImagePlan['decision'],
      reason: row.reason,
      runtime: row.runtime as unknown as PersistedImagePlan['runtime'],
      display: row.display as unknown as PersistedImagePlan['display'],
      generation: row.generation as unknown as PersistedImagePlan['generation'],
      selected_sources: row.selectedSources as unknown as PersistedImagePlan['selected_sources'],
      planner_audit: row.plannerAudit as unknown as PersistedImagePlan['planner_audit'],
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
