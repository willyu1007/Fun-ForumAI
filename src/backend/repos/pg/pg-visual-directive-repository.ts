import { Prisma, type PrismaClient, type VisualDirectiveRecord as PrismaVisualDirectiveRecord } from '@prisma/client'
import type {
  CreateVisualDirectiveInput,
  PersistedVisualDirective,
} from '../types.js'
import type { VisualDirectiveRepository } from '../visual-directive-repository.js'

export class PgVisualDirectiveRepository implements VisualDirectiveRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateVisualDirectiveInput): Promise<PersistedVisualDirective> {
    const row = await this.prisma.visualDirectiveRecord.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        schemaVersion: input.schema_version ?? 'visual-directive.v1',
        sceneRef: input.scene_ref as Prisma.InputJsonValue,
        goal: input.goal as Prisma.InputJsonValue,
        narrativeContext: input.narrative_context as Prisma.InputJsonValue,
        sourcingPolicy: input.sourcing_policy as Prisma.InputJsonValue,
        guardrails: input.guardrails as Prisma.InputJsonValue,
        budget: input.budget as Prisma.InputJsonValue,
        audit: input.audit as Prisma.InputJsonValue,
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<PersistedVisualDirective | null> {
    const row = await this.prisma.visualDirectiveRecord.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  private toDomain(row: PrismaVisualDirectiveRecord): PersistedVisualDirective {
    return {
      id: row.id,
      schema_version: row.schemaVersion as PersistedVisualDirective['schema_version'],
      scene_ref: row.sceneRef as PersistedVisualDirective['scene_ref'],
      goal: row.goal as PersistedVisualDirective['goal'],
      narrative_context: row.narrativeContext as PersistedVisualDirective['narrative_context'],
      sourcing_policy: row.sourcingPolicy as PersistedVisualDirective['sourcing_policy'],
      guardrails: row.guardrails as PersistedVisualDirective['guardrails'],
      budget: row.budget as PersistedVisualDirective['budget'],
      audit: row.audit as PersistedVisualDirective['audit'],
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
