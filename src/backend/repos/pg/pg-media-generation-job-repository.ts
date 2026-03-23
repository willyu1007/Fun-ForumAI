import { Prisma, type MediaGenerationJobRecord as PrismaMediaGenerationJobRecord, type PrismaClient } from '@prisma/client'
import type {
  CreateMediaGenerationJobInput,
  MediaGenerationJob,
} from '../types.js'
import type {
  ClaimMediaGenerationJobInput,
  MediaGenerationJobRepository,
  UpdateMediaGenerationJobPatch,
} from '../media-generation-job-repository.js'
import {
  buildLegacyGenerationSpec,
  compileMediaGenerationSpec,
} from '../../media/media-generation-compiler.js'

function includesAnyProjection(
  value: unknown,
  projectionIds: Set<string>,
): boolean {
  if (!Array.isArray(value)) return false
  return value.some((item) => typeof item === 'string' && projectionIds.has(item))
}

function isStoredGenerationSpec(value: unknown): value is MediaGenerationJob['generation_spec'] {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { intent?: unknown }).intent === 'string'
}

function isStoredCompiledPrompt(value: unknown): value is MediaGenerationJob['compiled_prompt'] {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { rendered_prompt?: unknown }).rendered_prompt === 'string'
}

export class PgMediaGenerationJobRepository implements MediaGenerationJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMediaGenerationJobInput): Promise<MediaGenerationJob> {
    const generationSpec = input.generation_spec ?? buildLegacyGenerationSpec({
      prompt_brief: input.prompt_brief ?? null,
      input_mode: input.input_mode,
      aspect_ratio_hint: input.aspect_ratio_hint ?? null,
      based_on_projection_ids: input.based_on_projection_ids,
    })
    const compiledPrompt = input.compiled_prompt ?? compileMediaGenerationSpec({
      spec: generationSpec,
      style_hint: input.style_hint ?? null,
    })
    const row = await this.prisma.mediaGenerationJobRecord.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        agentId: input.agent_id,
        planId: input.plan_id ?? null,
        status: input.status ?? 'queued',
        provider: input.provider,
        modelName: input.model_name,
        requestFingerprint: input.request_fingerprint,
        promptBrief: input.prompt_brief ?? compiledPrompt.rendered_prompt,
        generationSpec: generationSpec as unknown as Prisma.InputJsonValue,
        compiledPrompt: compiledPrompt as unknown as Prisma.InputJsonValue,
        auditDecision: (input.audit_decision ?? null) as unknown as Prisma.InputJsonValue,
        providerRequestSummary: (input.provider_request_summary ?? null) as unknown as Prisma.InputJsonValue,
        styleHint: input.style_hint ?? null,
        inputMode: input.input_mode ?? 'reference',
        aspectRatioHint: input.aspect_ratio_hint ?? null,
        basedOnProjectionIds: input.based_on_projection_ids as unknown as Prisma.InputJsonValue,
        attemptCount: input.attempt_count ?? 0,
        outputAssetId: input.output_asset_id ?? null,
        errorCode: input.error_code ?? null,
        errorMessage: input.error_message ?? null,
        startedAt: input.started_at ?? null,
        finishedAt: input.finished_at ?? null,
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<MediaGenerationJob | null> {
    const row = await this.prisma.mediaGenerationJobRecord.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findByFingerprint(requestFingerprint: string): Promise<MediaGenerationJob | null> {
    const row = await this.prisma.mediaGenerationJobRecord.findUnique({
      where: { requestFingerprint },
    })
    return row ? this.toDomain(row) : null
  }

  async findByOutputAssetId(assetId: string): Promise<MediaGenerationJob[]> {
    const rows = await this.prisma.mediaGenerationJobRecord.findMany({
      where: { outputAssetId: assetId },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async markTimedOutRunningJobs(now: Date, timeoutMs: number): Promise<MediaGenerationJob[]> {
    const timeoutThreshold = new Date(now.getTime() - timeoutMs)
    return this.prisma.$transaction(async (tx) => {
      const stale = await tx.mediaGenerationJobRecord.findMany({
        where: {
          status: 'running',
          startedAt: { lte: timeoutThreshold },
        },
        orderBy: [{ createdAt: 'asc' }],
      })
      if (stale.length === 0) return []

      await tx.mediaGenerationJobRecord.updateMany({
        where: {
          id: { in: stale.map((row) => row.id) },
          status: 'running',
        },
        data: {
          status: 'timed_out',
          finishedAt: now,
          errorCode: 'running_timeout',
          errorMessage: 'generation job exceeded running timeout',
        },
      })

      const refreshed = await tx.mediaGenerationJobRecord.findMany({
        where: {
          id: { in: stale.map((row) => row.id) },
        },
        orderBy: [{ createdAt: 'asc' }],
      })
      return refreshed.map((row) => this.toDomain(row))
    })
  }

  async update(id: string, patch: UpdateMediaGenerationJobPatch): Promise<MediaGenerationJob | null> {
    const row = await this.prisma.mediaGenerationJobRecord.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.attempt_count !== undefined ? { attemptCount: patch.attempt_count } : {}),
        ...(patch.output_asset_id !== undefined ? { outputAssetId: patch.output_asset_id } : {}),
        ...(patch.error_code !== undefined ? { errorCode: patch.error_code } : {}),
        ...(patch.error_message !== undefined ? { errorMessage: patch.error_message } : {}),
        ...(patch.audit_decision !== undefined
          ? { auditDecision: patch.audit_decision as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.provider_request_summary !== undefined
          ? { providerRequestSummary: patch.provider_request_summary as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.started_at !== undefined ? { startedAt: patch.started_at } : {}),
        ...(patch.finished_at !== undefined ? { finishedAt: patch.finished_at } : {}),
      },
    }).catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return null
      }
      throw err
    })
    return row ? this.toDomain(row) : null
  }

  async claimNextQueued(input: ClaimMediaGenerationJobInput): Promise<MediaGenerationJob | null> {
    return this.prisma.$transaction(async (tx) => {
      const runningCount = await tx.mediaGenerationJobRecord.count({
        where: { status: 'running' },
      })
      if (runningCount >= input.global_concurrency) return null

      if (input.provider) {
        const providerRunningCount = await tx.mediaGenerationJobRecord.count({
          where: {
            status: 'running',
            provider: input.provider,
          },
        })
        if (providerRunningCount >= input.provider_concurrency) return null
      }

      const next = await tx.mediaGenerationJobRecord.findFirst({
        where: {
          status: 'queued',
          ...(input.provider ? { provider: input.provider } : {}),
          attemptCount: { lt: input.max_attempts },
        },
        orderBy: [{ createdAt: 'asc' }],
      })
      if (!next) return null

      const claimed = await tx.mediaGenerationJobRecord.updateMany({
        where: {
          id: next.id,
          status: 'queued',
        },
        data: {
          status: 'running',
          startedAt: input.now,
          finishedAt: null,
          errorCode: null,
          errorMessage: null,
          attemptCount: { increment: 1 },
        },
      })
      if (claimed.count === 0) return null

      const row = await tx.mediaGenerationJobRecord.findUnique({ where: { id: next.id } })
      return row ? this.toDomain(row) : null
    })
  }

  async cancelQueuedByProjectionIds(
    projectionIds: string[],
    reason: string,
    now: Date,
  ): Promise<MediaGenerationJob[]> {
    const lookup = new Set(projectionIds)
    if (lookup.size === 0) return []

    const rows = await this.prisma.mediaGenerationJobRecord.findMany({
      where: {
        status: 'queued',
      },
    })
    const matchedIds = rows
      .filter((row) => includesAnyProjection(row.basedOnProjectionIds, lookup))
      .map((row) => row.id)
    if (matchedIds.length === 0) return []

    await this.prisma.mediaGenerationJobRecord.updateMany({
      where: {
        id: { in: matchedIds },
        status: 'queued',
      },
      data: {
        status: 'cancelled',
        errorCode: 'policy_revoked',
        errorMessage: reason,
        finishedAt: now,
      },
    })
    const cancelled = await this.prisma.mediaGenerationJobRecord.findMany({
      where: {
        id: { in: matchedIds },
        status: 'cancelled',
        errorCode: 'policy_revoked',
      },
      orderBy: [{ createdAt: 'asc' }],
    })
    return cancelled.map((row) => this.toDomain(row))
  }

  private toDomain(row: PrismaMediaGenerationJobRecord): MediaGenerationJob {
    const fallbackSpec = buildLegacyGenerationSpec({
      prompt_brief: row.promptBrief,
      input_mode: row.inputMode as MediaGenerationJob['input_mode'],
      aspect_ratio_hint: row.aspectRatioHint as MediaGenerationJob['aspect_ratio_hint'],
      based_on_projection_ids: row.basedOnProjectionIds as MediaGenerationJob['based_on_projection_ids'],
    })
    return {
      id: row.id,
      agent_id: row.agentId,
      plan_id: row.planId,
      status: row.status as MediaGenerationJob['status'],
      provider: row.provider,
      model_name: row.modelName,
      request_fingerprint: row.requestFingerprint,
      prompt_brief: row.promptBrief,
      generation_spec: isStoredGenerationSpec(row.generationSpec)
        ? row.generationSpec
        : fallbackSpec,
      compiled_prompt: isStoredCompiledPrompt(row.compiledPrompt)
        ? row.compiledPrompt
        : compileMediaGenerationSpec({
          spec: fallbackSpec,
          style_hint: row.styleHint,
        }),
      audit_decision: row.auditDecision as MediaGenerationJob['audit_decision'],
      provider_request_summary: row.providerRequestSummary as MediaGenerationJob['provider_request_summary'],
      style_hint: row.styleHint,
      input_mode: row.inputMode as MediaGenerationJob['input_mode'],
      aspect_ratio_hint: row.aspectRatioHint as MediaGenerationJob['aspect_ratio_hint'],
      based_on_projection_ids: row.basedOnProjectionIds as MediaGenerationJob['based_on_projection_ids'],
      attempt_count: row.attemptCount,
      output_asset_id: row.outputAssetId,
      error_code: row.errorCode,
      error_message: row.errorMessage,
      started_at: row.startedAt,
      finished_at: row.finishedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
