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
        sceneRef: input.scene_ref as unknown as Prisma.InputJsonValue,
        goal: input.goal as unknown as Prisma.InputJsonValue,
        narrativeContext: input.narrative_context as unknown as Prisma.InputJsonValue,
        sourcingPolicy: input.sourcing_policy as unknown as Prisma.InputJsonValue,
        guardrails: input.guardrails as unknown as Prisma.InputJsonValue,
        budget: input.budget as unknown as Prisma.InputJsonValue,
        audit: input.audit as unknown as Prisma.InputJsonValue,
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
      scene_ref: row.sceneRef as unknown as PersistedVisualDirective['scene_ref'],
      goal: row.goal as unknown as PersistedVisualDirective['goal'],
      narrative_context: row.narrativeContext as unknown as PersistedVisualDirective['narrative_context'],
      sourcing_policy: row.sourcingPolicy as unknown as PersistedVisualDirective['sourcing_policy'],
      guardrails: row.guardrails as unknown as PersistedVisualDirective['guardrails'],
      budget: row.budget as unknown as PersistedVisualDirective['budget'],
      audit: row.audit as unknown as PersistedVisualDirective['audit'],
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
