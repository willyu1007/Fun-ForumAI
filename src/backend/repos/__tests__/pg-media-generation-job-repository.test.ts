import { describe, expect, it, vi } from 'vitest'
import { PgMediaGenerationJobRepository } from '../pg/pg-media-generation-job-repository.js'

function makeMediaGenerationJobRow() {
  const now = new Date('2026-04-10T14:24:00.000Z')
  return {
    id: 'job-1',
    agentId: 'agent-1',
    planId: 'plan-1',
    status: 'running',
    provider: 'ark-seedream',
    modelName: 'doubao-seedream-5-0-lite-260128',
    requestFingerprint: 'fp-1',
    promptBrief: 'rendered prompt',
    generationSpec: {
      intent: 'public_safe_derivative',
      schema_version: 'media-generation-spec.v1',
    },
    compiledPrompt: {
      schema_version: 'media-generation-compiled.v1',
      template_id: 'derived-public-safe-image',
      rendered_prompt: 'rendered prompt',
    },
    auditDecision: {
      decision: 'allow',
      reason_codes: ['planner_public_safe_generation_spec'],
      reviewer: 'image-planner',
      decided_at: now.toISOString(),
    },
    providerRequestSummary: {
      compiled_prompt_schema: 'media-generation-compiled.v1',
    },
    styleHint: null,
    inputMode: 'reference',
    aspectRatioHint: '4:5',
    basedOnProjectionIds: ['projection-1'],
    attemptCount: 1,
    outputAssetId: null,
    errorCode: null,
    errorMessage: null,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

describe('PgMediaGenerationJobRepository', () => {
  it('re-reads the claimed row so raw SQL casing drift cannot drop audit decision', async () => {
    const findUnique = vi.fn(async () => makeMediaGenerationJobRow())
    const repo = new PgMediaGenerationJobRepository({
      $queryRaw: vi.fn(async () => [{ id: 'job-1' }]),
      mediaGenerationJobRecord: {
        findUnique,
      },
    } as never)

    const job = await repo.claimNextQueued({
      now: new Date('2026-04-10T14:25:00.000Z'),
      running_timeout_ms: 60_000,
      max_attempts: 3,
      global_concurrency: 2,
      provider_concurrency: 1,
      provider: 'ark-seedream',
    })

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'job-1' },
    })
    expect(job?.id).toBe('job-1')
    expect(job?.audit_decision).toEqual({
      decision: 'allow',
      reason_codes: ['planner_public_safe_generation_spec'],
      reviewer: 'image-planner',
      decided_at: '2026-04-10T14:24:00.000Z',
    })
  })
})
