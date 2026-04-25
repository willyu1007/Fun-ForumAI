import { config } from '../lib/config.js'
import type { ImagePlanRepository } from '../repos/image-plan-repository.js'
import type { MediaGenerationJobRepository } from '../repos/media-generation-job-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { MediaProjectionService } from './media-projection-service.js'
import type { MediaAssetService } from './media-asset-service.js'
import type { MediaReuseGovernanceService } from './media-reuse-governance-service.js'
import type { MediaLineageService } from './media-lineage-service.js'
import type { MediaRolloutControllerService } from './media-rollout-controller-service.js'
import type { MediaWriteBridge } from './media-write-bridge.js'
import type { MediaRetrievalService } from './media-retrieval-service.js'
import type { MediaScenePackService } from './media-scene-pack-service.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type {
  CompiledMediaPrompt,
  MediaAsset,
  MediaAuditDecision,
  MediaContextProjection,
  MediaGenerationJob,
  MediaGenerationSpec,
  MediaSemanticSnapshot,
  PersistedImagePlan,
  PublicMediaContextCard,
} from '../repos/types.js'
import type { MediaGenerationGateway } from './media-generation-gateway.js'
import { isMediaGenerationGatewayError } from './media-generation-gateway.js'
import type { MediaObservabilityService } from './media-observability-service.js'
import { resolveMediaObservabilitySurface } from './media-observability-service.js'
import { MEDIA_SEMANTIC_SCHEMA_VERSION } from './media-contract-utils.js'
import {
  buildLegacyGenerationSpec,
  compileMediaGenerationSpec,
} from './media-generation-compiler.js'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isProjectionActive(projection: Awaited<ReturnType<MediaContextProjectionRepository['findById']>>): boolean {
  if (!projection) return false
  if (!projection.expires_at) return true
  return projection.expires_at.getTime() > Date.now()
}

function guessMimeTypeFromUrl(url: string): string {
  const lower = url.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}

function terminalGenerationStatus(status: PersistedImagePlan['generation']['status']): boolean {
  return status === 'succeeded'
    || status === 'failed'
    || status === 'timed_out'
    || status === 'cancelled'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeProviderRequestSummary(
  current: MediaGenerationJob['provider_request_summary'],
  next: Record<string, unknown> | null | undefined,
): MediaGenerationJob['provider_request_summary'] {
  if (!next) return current ?? null
  if (!isRecord(current)) return next
  return {
    ...current,
    ...next,
  }
}

export interface MediaGenerationServiceDeps {
  imagePlanRepo: ImagePlanRepository
  mediaGenerationJobRepo: MediaGenerationJobRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  mediaSemanticSnapshotRepo: Pick<MediaSemanticSnapshotRepository, 'findCurrentByAssetId'>
  forumSceneMetadataRepo?: Pick<ForumSceneMetadataRepository, 'listByEpisodeId'> | null
  mediaAssetService: MediaAssetService
  mediaReuseGovernanceService: MediaReuseGovernanceService
  mediaProjectionService: MediaProjectionService
  mediaWriteBridge?: Pick<MediaWriteBridge, 'applyImagePlanAfterPersist'> | null
  gateway: MediaGenerationGateway
  mediaObservabilityService?: Pick<MediaObservabilityService, 'record' | 'getEstimatedGenerationCostCny'> | null
  mediaLineageService?: MediaLineageService | null
  mediaRolloutControllerService?: Pick<MediaRolloutControllerService, 'getEffectiveProfile'> | null
  mediaRetrievalService?: Pick<MediaRetrievalService, 'ensureAssetIndexed'> | null
  mediaScenePackService?: Pick<MediaScenePackService, 'auditGeneratedSnapshot'> | null
}

interface MediaGenerationHardeningSettings {
  semantic_v3_enforced: boolean
  strict_audit_enforced: boolean
  lineage_required: boolean
}

const DEFAULT_MEDIA_GENERATION_HARDENING_SETTINGS: MediaGenerationHardeningSettings = {
  semantic_v3_enforced: false,
  strict_audit_enforced: false,
  lineage_required: false,
}

const MEDIA_GENERATION_MAX_ATTEMPTS = 2
const MEDIA_GENERATION_TIMEOUT_SWEEP_INTERVAL_MS = 15_000

export class MediaGenerationService {
  private processKickScheduled = false
  private activeProcessPromise: Promise<MediaGenerationJob | null> | null = null
  private activeTimeoutSweepPromise: Promise<MediaGenerationJob[]> | null = null
  private followupProcessRequested = false
  private lastTimeoutSweepAt = 0

  constructor(private readonly deps: MediaGenerationServiceDeps) {}

  async ensurePlanReadyWithinBudget(input: {
    agent_id: string
    plan: PersistedImagePlan
    wait_budget_ms: number
  }): Promise<PersistedImagePlan> {
    const scheduled = await this.ensureJobForPlan({
      agent_id: input.agent_id,
      plan: input.plan,
    })
    if (!scheduled.job || input.wait_budget_ms <= 0 || !this.deps.gateway.isConfigured) {
      return scheduled.plan
    }

    const deadline = Date.now() + input.wait_budget_ms
    while (Date.now() < deadline) {
      const currentPlan = await this.deps.imagePlanRepo.findById(scheduled.plan.id)
      if (currentPlan && terminalGenerationStatus(currentPlan.generation.status)) {
        return currentPlan
      }
      await delay(Math.min(config.mediaGeneration.pollIntervalMs, Math.max(25, deadline - Date.now())))
    }
    const finalPlan = (await this.deps.imagePlanRepo.findById(scheduled.plan.id)) ?? scheduled.plan
    if (!terminalGenerationStatus(finalPlan.generation.status)) {
      await this.deps.mediaObservabilityService?.record({
        event_type: 'generation_sync_degraded',
        surface: resolveMediaObservabilitySurface(finalPlan.scene_ref),
        agent_id: input.agent_id,
        image_plan_id: finalPlan.id,
        generation_job_id: scheduled.job.id,
        payload_json: {
          wait_budget_ms: input.wait_budget_ms,
          generation_status: finalPlan.generation.status,
        },
      })
    }
    return finalPlan
  }

  async ensureJobForPlan(input: {
    agent_id: string
    plan: PersistedImagePlan
  }): Promise<{ plan: PersistedImagePlan; job: MediaGenerationJob | null }> {
    if (input.plan.status !== 'pending_generation') {
      return { plan: input.plan, job: null }
    }
    const fingerprint = input.plan.generation.request_fingerprint?.trim()
    const basedOnProjectionIds = input.plan.generation.based_on_projection_ids ?? []
    const inputMode = input.plan.generation.input_mode ?? 'reference'
    const generationSpec = resolveGenerationSpec(input.plan)
    const compiledPrompt = resolveCompiledPrompt(input.plan, generationSpec)
    const promptBrief = compiledPrompt.rendered_prompt.trim()
    let auditDecision = input.plan.generation.audit_decision ?? buildDefaultAllowAuditDecision()
    const hardening = await this.resolveHardeningSettings()
    const hardeningBlockReasons = await this.collectHardeningBlockReasonCodes({
      plan: input.plan,
      input_mode: inputMode,
      based_on_projection_ids: basedOnProjectionIds,
      hardening,
    })
    if (hardeningBlockReasons.length > 0) {
      auditDecision = buildBlockedAuditDecision(auditDecision, hardeningBlockReasons)
    }
    if (
      !fingerprint
      || !promptBrief
      || auditDecision.decision === 'block'
      || (inputMode === 'reference' && basedOnProjectionIds.length === 0)
    ) {
      if (auditDecision.decision !== 'block') {
        return { plan: input.plan, job: null }
      }
      const cancelledPlan = await this.cancelPlanGeneration({
        plan: input.plan,
        audit_decision: auditDecision,
        generation_spec: generationSpec,
        compiled_prompt: compiledPrompt,
      })
      return { plan: cancelledPlan, job: null }
    }

    const existing = await this.deps.mediaGenerationJobRepo.findByFingerprint(fingerprint)
    const job = existing ?? await this.deps.mediaGenerationJobRepo.create({
      agent_id: input.agent_id,
      plan_id: input.plan.id,
      status: 'queued',
      provider: this.deps.gateway.providerId,
      model_name: this.deps.gateway.modelName,
      request_fingerprint: fingerprint,
      prompt_brief: promptBrief,
      generation_spec: generationSpec,
      compiled_prompt: compiledPrompt,
      audit_decision: auditDecision,
      provider_request_summary: {
        compiled_prompt_schema: compiledPrompt.schema_version,
        template_id: compiledPrompt.template_id,
        rendered_length: compiledPrompt.rendered_prompt.length,
      },
      style_hint: null,
      input_mode: inputMode,
      aspect_ratio_hint: input.plan.generation.aspect_ratio_hint ?? input.plan.display.attachments[0]?.aspect_ratio_hint ?? null,
      based_on_projection_ids: basedOnProjectionIds,
      attempt_count: 0,
    })
    if (!existing) {
      await this.deps.mediaLineageService?.recordEdges([
        {
          from_node_type: 'image_plan',
          from_node_id: input.plan.id,
          to_node_type: 'generation_job',
          to_node_id: job.id,
          edge_kind: 'plan_scheduled_generation_job',
          input_mode: inputMode,
          provider: job.provider,
        },
        ...basedOnProjectionIds.map((projectionId) => ({
          from_node_type: 'projection' as const,
          from_node_id: projectionId,
          to_node_type: 'generation_job' as const,
          to_node_id: job.id,
          edge_kind: 'generation_job_based_on_projection',
          input_mode: inputMode,
        })),
      ])
    }

    const updated = await this.deps.imagePlanRepo.update(input.plan.id, {
      generation: {
        ...input.plan.generation,
        job_id: job.id,
        status: job.status,
        provider: job.provider,
        model_ref: job.model_name,
        input_mode: job.input_mode,
        aspect_ratio_hint: job.aspect_ratio_hint,
        attempt_count: job.attempt_count,
        output_asset_id: job.output_asset_id ?? undefined,
        error_code: job.error_code,
        audit_decision: job.audit_decision,
        spec: job.generation_spec,
        compiled_prompt: job.compiled_prompt,
      },
    })
    if (job.status === 'queued') {
      this.kickProcessing()
    } else {
      await this.syncLinkedPlansWithJob(job)
    }
    if (!existing) {
      await this.deps.mediaObservabilityService?.record({
        event_type: 'generation_requested',
        surface: resolveMediaObservabilitySurface(input.plan.scene_ref),
        agent_id: input.agent_id,
        image_plan_id: input.plan.id,
        generation_job_id: job.id,
        source_kind: input.plan.selected_sources.find((item) => !item.rejection_reason)?.source_kind ?? null,
        metric_value: this.deps.mediaObservabilityService?.getEstimatedGenerationCostCny() ?? null,
        payload_json: {
          provider: job.provider,
          model_name: job.model_name,
          mode: input.plan.generation.mode,
          input_mode: job.input_mode,
        },
      })
    }
    return {
      plan: updated ?? input.plan,
      job,
    }
  }

  async processNextQueuedJob(): Promise<MediaGenerationJob | null> {
    if (this.activeProcessPromise) {
      this.followupProcessRequested = true
      return this.activeProcessPromise
    }

    const activeRun = this.processNextQueuedJobInternal()
    this.activeProcessPromise = activeRun
    try {
      return await activeRun
    } finally {
      this.activeProcessPromise = null
      if (this.followupProcessRequested) {
        this.followupProcessRequested = false
        queueMicrotask(() => {
          void this.processNextQueuedJob().catch(() => {})
        })
      }
    }
  }

  async sweepTimedOutRunningJobs(force = false): Promise<MediaGenerationJob[]> {
    if (!config.launch.capabilities.mediaGenerationV1 || !this.deps.gateway.isConfigured) {
      return []
    }
    const nowMs = Date.now()
    if (
      !force
      && this.lastTimeoutSweepAt > 0
      && nowMs - this.lastTimeoutSweepAt < MEDIA_GENERATION_TIMEOUT_SWEEP_INTERVAL_MS
    ) {
      return []
    }
    if (this.activeTimeoutSweepPromise) {
      return this.activeTimeoutSweepPromise
    }

    const activeSweep = this.sweepTimedOutRunningJobsInternal(new Date(nowMs))
    this.activeTimeoutSweepPromise = activeSweep
    this.lastTimeoutSweepAt = nowMs
    try {
      return await activeSweep
    } finally {
      this.activeTimeoutSweepPromise = null
    }
  }

  private async processNextQueuedJobInternal(): Promise<MediaGenerationJob | null> {
    if (!config.launch.capabilities.mediaGenerationV1 || !this.deps.gateway.isConfigured) {
      return null
    }

    const job = await this.deps.mediaGenerationJobRepo.claimNextQueued({
      now: new Date(),
      running_timeout_ms: config.mediaGeneration.runningTimeoutMs,
      max_attempts: MEDIA_GENERATION_MAX_ATTEMPTS,
      global_concurrency: config.mediaGeneration.globalConcurrency,
      provider_concurrency: config.mediaGeneration.providerConcurrency,
      provider: this.deps.gateway.providerId,
    })
    if (!job) return null
    await this.syncLinkedPlansWithJob(job)

    const projections = job.input_mode === 'reference'
      ? await this.deps.mediaContextProjectionRepo.findByIds(job.based_on_projection_ids)
      : []
    const hardening = await this.resolveHardeningSettings()
    const hardeningBlockReasons = await this.collectJobHardeningBlockReasonCodes({
      job,
      projections,
      hardening,
    })
    if (hardeningBlockReasons.length > 0) {
      const blockedAuditDecision = buildBlockedAuditDecision(job.audit_decision, hardeningBlockReasons)
      const blocked = await this.deps.mediaGenerationJobRepo.update(job.id, {
        status: 'cancelled',
        audit_decision: blockedAuditDecision,
        error_code: 'audit_blocked',
        error_message: blockedAuditDecision.reason_codes.join(', ') || 'generation audit blocked',
        finished_at: new Date(),
      })
      await this.syncLinkedPlansWithJob(blocked ?? job)
      await this.recordJobEvent(blocked ?? job, 'generation_cancelled')
      return blocked ?? job
    }
    if (
      job.input_mode === 'reference'
      && (projections.length !== job.based_on_projection_ids.length
        || projections.some((projection) => !isProjectionActive(projection)))
    ) {
      const cancelled = await this.deps.mediaGenerationJobRepo.update(job.id, {
        status: 'cancelled',
        error_code: 'policy_revoked',
        error_message: 'source projection is no longer active',
        finished_at: new Date(),
      })
      await this.syncLinkedPlansWithJob(cancelled ?? job)
      await this.recordJobEvent(cancelled ?? job, 'generation_cancelled')
      return cancelled ?? job
    }
    if (job.audit_decision?.decision === 'block') {
      const blocked = await this.deps.mediaGenerationJobRepo.update(job.id, {
        status: 'cancelled',
        error_code: 'audit_blocked',
        error_message: job.audit_decision.reason_codes.join(', ') || 'generation audit blocked',
        finished_at: new Date(),
      })
      await this.syncLinkedPlansWithJob(blocked ?? job)
      await this.recordJobEvent(blocked ?? job, 'generation_cancelled')
      return blocked ?? job
    }

    try {
      const primaryPlan = job.plan_id
        ? await this.deps.imagePlanRepo.findById(job.plan_id)
        : null
      const result = await this.deps.gateway.generate({
        compiled_prompt: job.compiled_prompt,
        trace_id: `media-generation:${job.id}`,
      })
      const downloaded = await this.downloadProviderImage(result.image_url)
      const projectionsAfterRun = job.input_mode === 'reference'
        ? await this.deps.mediaContextProjectionRepo.findByIds(job.based_on_projection_ids)
        : []
      const shouldBlock = job.input_mode === 'reference'
        && projectionsAfterRun.some((projection) => !isProjectionActive(projection))
      const generated = await this.deps.mediaAssetService.ingestGeneratedDerivative({
        agent_id: job.agent_id,
        plan_id: job.plan_id,
        mime_type: result.mime_type ?? downloaded.mime_type,
        bytes: downloaded.bytes,
        visibility_policy: shouldBlock ? 'blocked' : 'public_original_allowed',
        lifecycle_status: shouldBlock ? 'blocked' : 'active',
      })

      if (!shouldBlock) {
        const outputSourceKind = resolveGeneratedOutputSourceKind(primaryPlan)
        const registered = outputSourceKind === 'private_derived_public'
          ? await this.deps.mediaReuseGovernanceService.registerPrivateDerivedPublicAsset({
              asset_id: generated.asset.id,
              agent_id: job.agent_id,
              actor_user_id: 'media-generation-service',
            })
          : await this.deps.mediaReuseGovernanceService.registerGeneratedPublicAsset({
              asset_id: generated.asset.id,
              agent_id: job.agent_id,
              actor_user_id: 'media-generation-service',
            })
        await this.deps.mediaProjectionService.createDisplayAttachmentProjection({
          binding: registered.binding,
          asset: generated.asset,
          snapshot: generated.snapshot,
          mediaUrl: generated.media_url,
          altText: generated.snapshot.summary.public_safe_summary,
          publicCaption: generated.snapshot.summary.public_safe_summary,
        })
        await this.deps.mediaProjectionService.ensurePublicMediaCard({
          binding: registered.binding,
          asset: generated.asset,
          snapshot: generated.snapshot,
          source_kind: outputSourceKind,
          derived_from_private: outputSourceKind === 'private_derived_public',
          visual_role: 'illustration',
          prompt_weight: 'secondary',
          mention_policy: 'allude',
          why_now: '由生成链路回流到公共媒体池，供后续 surface 复用。',
          public_scope: 'global_public',
          disclose_origin_policy: outputSourceKind === 'private_derived_public' ? 'never' : 'public_only',
          cross_agent_quote_allowed: false,
          original_display_allowed: true,
          derivative_display_allowed: true,
          preferred_variant: 'original',
          prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
          confidence: 0.8,
          relevance_score: 0.8,
          audit_context: {
            surface: 'public_runtime',
            sensitive_terms: [],
            policy_mode: 'strict',
            visibility_scope: 'public',
            actor_role: 'system',
          },
        })
        if (config.launch.capabilities.mediaRetrievalV1 && this.deps.mediaRetrievalService) {
          await this.deps.mediaRetrievalService.ensureAssetIndexed({
            asset: generated.asset,
            snapshot: generated.snapshot,
            source_kind: outputSourceKind,
            target_scope: {
              owner_user_id: null,
              steward_agent_id: job.agent_id,
              community_id: null,
            },
            requested_scopes: ['public_safe'],
            generated_from: 'generated_text_derived',
            reason: job.prompt_brief,
            annotations: {
              tags: [],
              internal_note: null,
              owner_note: null,
            },
          }).catch((error) => {
            console.warn('[MediaGenerationService] retrieval backfill failed:', error)
          })
        }
      }

      const finished = await this.deps.mediaGenerationJobRepo.update(job.id, {
        status: shouldBlock ? 'cancelled' : 'succeeded',
        provider: result.provider_id ?? job.provider,
        model_name: result.model_name ?? job.model_name,
        output_asset_id: generated.asset.id,
        error_code: shouldBlock ? 'policy_revoked' : null,
        error_message: shouldBlock ? 'source projection expired after provider execution' : null,
        provider_request_summary: mergeProviderRequestSummary(job.provider_request_summary, {
          provider_image_url: result.image_url,
          mime_type: result.mime_type ?? downloaded.mime_type,
          ...(result.provider_request_summary ?? {}),
        }),
        finished_at: new Date(),
      })
      if (!shouldBlock) {
        await this.deps.mediaLineageService?.recordEdges([
          {
            from_node_type: 'generation_job',
            from_node_id: job.id,
            to_node_type: 'asset',
            to_node_id: generated.asset.id,
            edge_kind: 'generation_job_produced_asset',
            visibility_policy: generated.asset.visibility_policy,
          },
          {
            from_node_type: 'asset',
            from_node_id: generated.asset.id,
            to_node_type: 'semantic_snapshot',
            to_node_id: generated.snapshot.id,
            edge_kind: 'generated_asset_described_by_snapshot',
            schema_version: generated.snapshot.schema_version,
          },
        ])
        await this.recordScenePackQualityAudit({
          job: finished ?? job,
          plan: primaryPlan,
          snapshot: generated.snapshot,
          output_asset_id: generated.asset.id,
        })
      }
      await this.syncLinkedPlansWithJob(finished ?? job)
      await this.recordJobEvent(
        finished ?? job,
        shouldBlock ? 'generation_cancelled' : 'generation_succeeded',
      )
      return finished ?? job
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'media_generation_failed'
      const nextStatus = job.attempt_count >= MEDIA_GENERATION_MAX_ATTEMPTS ? 'failed' : 'queued'
      const failedProviderId = isMediaGenerationGatewayError(err) ? err.provider_id : null
      const failedModelName = isMediaGenerationGatewayError(err) ? err.model_name : null
      const providerRequestSummary = isMediaGenerationGatewayError(err)
        ? mergeProviderRequestSummary(job.provider_request_summary, err.provider_request_summary)
        : job.provider_request_summary
      const updated = await this.deps.mediaGenerationJobRepo.update(job.id, {
        status: nextStatus,
        ...(nextStatus === 'failed' && failedProviderId ? { provider: failedProviderId } : {}),
        ...(nextStatus === 'failed' && failedModelName ? { model_name: failedModelName } : {}),
        error_code: nextStatus === 'queued' ? 'provider_retryable' : 'provider_failed',
        error_message: errorMessage,
        provider_request_summary: providerRequestSummary,
        finished_at: nextStatus === 'queued' ? null : new Date(),
      })
      if (updated) {
        await this.syncLinkedPlansWithJob(updated)
        if (nextStatus === 'failed') {
          await this.recordJobEvent(updated, 'generation_failed')
        }
      }
      return updated ?? job
    }
  }

  private async sweepTimedOutRunningJobsInternal(now: Date): Promise<MediaGenerationJob[]> {
    const timedOutJobs = await this.deps.mediaGenerationJobRepo.markTimedOutRunningJobs(
      now,
      config.mediaGeneration.runningTimeoutMs,
      MEDIA_GENERATION_MAX_ATTEMPTS,
    )
    for (const timedOutJob of timedOutJobs) {
      await this.syncLinkedPlansWithJob(timedOutJob)
      if (timedOutJob.status === 'timed_out') {
        await this.recordJobEvent(timedOutJob, 'generation_timed_out')
      }
    }
    return timedOutJobs
  }

  private kickProcessing(): void {
    if (this.processKickScheduled || !config.launch.capabilities.mediaGenerationV1 || !this.deps.gateway.isConfigured) {
      return
    }
    this.processKickScheduled = true
    queueMicrotask(() => {
      this.processKickScheduled = false
      void this.processNextQueuedJob().catch(() => {})
    })
  }

  private async syncLinkedPlansWithJob(job: MediaGenerationJob): Promise<void> {
    const linkedPlans = await this.deps.imagePlanRepo.listByGenerationJobId(job.id)
    if (job.plan_id) {
      const primary = await this.deps.imagePlanRepo.findById(job.plan_id)
      if (primary) {
        linkedPlans.push(primary)
      }
    }
    const plans = uniquePlans(linkedPlans)
    for (const plan of plans) {
      await this.syncPlanWithJob(plan, job)
    }
  }

  private async recordJobEvent(
    job: MediaGenerationJob,
    eventType:
      | 'generation_succeeded'
      | 'generation_failed'
      | 'generation_timed_out'
      | 'generation_cancelled',
  ): Promise<void> {
    const plan = job.plan_id ? await this.deps.imagePlanRepo.findById(job.plan_id) : null
    await this.deps.mediaObservabilityService?.record({
      event_type: eventType,
      surface: plan ? resolveMediaObservabilitySurface(plan.scene_ref) : 'generation',
      agent_id: job.agent_id,
      image_plan_id: plan?.id ?? null,
      generation_job_id: job.id,
      asset_id: job.output_asset_id ?? null,
      payload_json: {
        provider: job.provider,
        model_name: job.model_name,
        error_code: job.error_code,
        input_mode: job.input_mode,
      },
    })
  }

  private async recordScenePackQualityAudit(input: {
    job: MediaGenerationJob
    plan: PersistedImagePlan | null
    snapshot: MediaSemanticSnapshot
    output_asset_id: string
  }): Promise<void> {
    if (!this.deps.mediaScenePackService || !input.job.compiled_prompt.scene_pack_ref) {
      return
    }
    try {
      const audit = this.deps.mediaScenePackService.auditGeneratedSnapshot({
        compiled_prompt: input.job.compiled_prompt,
        snapshot: input.snapshot,
      })
      await this.deps.mediaObservabilityService?.record({
        event_type: 'scene_pack_quality_audited',
        surface: input.plan ? resolveMediaObservabilitySurface(input.plan.scene_ref) : 'generation',
        severity: audit.status === 'warn' ? 'warn' : 'info',
        agent_id: input.job.agent_id,
        image_plan_id: input.plan?.id ?? null,
        generation_job_id: input.job.id,
        asset_id: input.output_asset_id,
        payload_json: audit as unknown as Record<string, unknown>,
      })
    } catch (error) {
      console.warn(
        '[MediaGenerationService] scene pack quality audit failed:',
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  private async syncPlanWithJob(plan: PersistedImagePlan, job: MediaGenerationJob): Promise<void> {
    if (job.status === 'queued' || job.status === 'running') {
      await this.deps.imagePlanRepo.update(plan.id, {
        generation: {
          ...plan.generation,
          job_id: job.id,
          status: job.status,
          provider: job.provider,
          model_ref: job.model_name,
          input_mode: job.input_mode,
          aspect_ratio_hint: job.aspect_ratio_hint,
          attempt_count: job.attempt_count,
          output_asset_id: job.output_asset_id ?? undefined,
          error_code: job.error_code,
        },
      })
      return
    }

    if (job.status === 'succeeded' && job.output_asset_id) {
      const asset = await this.deps.mediaAssetService.getAssetById(job.output_asset_id)
      const snapshot = asset
        ? await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(job.output_asset_id)
        : null
      const rewrittenCard = asset && snapshot
        ? buildGeneratedOutputRuntimeCard(plan, asset, snapshot)
        : plan.runtime.cards[0] ?? null
      const attachment = rewrittenCard
        ? {
            slot: 0,
            binding_role: 'primary' as const,
            asset_id: job.output_asset_id,
            mime_type: asset?.mime_type ?? 'image/png',
            display_variant: 'generated_derivative' as const,
            derived_from_asset_id: plan.selected_sources[0]?.asset_id ?? null,
            aspect_ratio_hint: plan.generation.aspect_ratio_hint ?? plan.display.attachments[0]?.aspect_ratio_hint ?? undefined,
            public_caption: rewrittenCard.public_summary.public_safe_caption,
            alt_text: rewrittenCard.public_summary.alt_text,
            attach_after_persist: true,
          }
        : null
      await this.deps.imagePlanRepo.update(plan.id, {
        status: 'ready',
        reason: 'generation_succeeded',
        runtime: {
          enabled: rewrittenCard !== null,
          influence_level: plan.runtime.influence_level,
          cards: rewrittenCard ? [rewrittenCard] : [],
        },
        display: {
          enabled: attachment !== null,
          attachments: attachment ? [attachment] : [],
        },
        generation: {
          ...plan.generation,
          job_id: job.id,
          status: 'succeeded',
          provider: job.provider,
          model_ref: job.model_name,
          input_mode: job.input_mode,
          aspect_ratio_hint: job.aspect_ratio_hint,
          attempt_count: job.attempt_count,
          output_asset_id: job.output_asset_id,
          error_code: null,
        },
      })
      await this.applyReadyPlanAfterPersist(plan)
      if (rewrittenCard && snapshot) {
        await this.deps.mediaObservabilityService?.record({
          event_type: 'generation_output_rewritten',
          surface: resolveMediaObservabilitySurface(plan.scene_ref),
          agent_id: job.agent_id,
          image_plan_id: plan.id,
          generation_job_id: job.id,
          asset_id: job.output_asset_id,
          payload_json: {
            card_source_kind: rewrittenCard.source.kind,
            summary_source: snapshot.schema_version,
          },
        })
      }
      return
    }

    if (job.status === 'failed' || job.status === 'timed_out' || job.status === 'cancelled') {
      await this.deps.imagePlanRepo.update(plan.id, {
        status: 'degraded',
        reason: `generation_${job.status}`,
        generation: {
          ...plan.generation,
          job_id: job.id,
          status: job.status,
          provider: job.provider,
          model_ref: job.model_name,
          input_mode: job.input_mode,
          aspect_ratio_hint: job.aspect_ratio_hint,
          attempt_count: job.attempt_count,
          output_asset_id: job.output_asset_id ?? undefined,
          error_code: job.error_code,
        },
      })
    }
  }

  private async downloadProviderImage(imageUrl: string): Promise<{ bytes: Buffer; mime_type: string }> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.mediaGeneration.downloadTimeoutMs)
    try {
      const response = await fetch(imageUrl, {
        method: 'GET',
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`generated_image_download_failed status=${response.status}`)
      }
      const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim() || guessMimeTypeFromUrl(imageUrl)
      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        mime_type: mimeType,
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('generated_image_download_timeout', { cause: err })
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  private async resolveHardeningSettings(): Promise<MediaGenerationHardeningSettings> {
    if (!this.deps.mediaRolloutControllerService) {
      return DEFAULT_MEDIA_GENERATION_HARDENING_SETTINGS
    }
    try {
      const profile = await this.deps.mediaRolloutControllerService.getEffectiveProfile()
      return {
        semantic_v3_enforced: profile.effective.semantic_v3_enforced,
        strict_audit_enforced: profile.effective.strict_audit_enforced,
        lineage_required: profile.effective.lineage_required,
      }
    } catch {
      return DEFAULT_MEDIA_GENERATION_HARDENING_SETTINGS
    }
  }

  private async collectHardeningBlockReasonCodes(input: {
    plan: PersistedImagePlan
    input_mode: 'reference' | 'scratch'
    based_on_projection_ids: string[]
    hardening: MediaGenerationHardeningSettings
  }): Promise<string[]> {
    const reasons: string[] = []
    if (input.hardening.strict_audit_enforced && !input.plan.generation.audit_context) {
      reasons.push('missing_audit_context')
    }
    if (input.input_mode !== 'reference') {
      return uniqueReasonCodes(reasons)
    }

    const projections = input.based_on_projection_ids.length > 0
      ? await this.deps.mediaContextProjectionRepo.findByIds(input.based_on_projection_ids)
      : []
    return uniqueReasonCodes([
      ...reasons,
      ...(await this.collectProjectionHardeningBlockReasonCodes({
        input_mode: input.input_mode,
        based_on_projection_ids: input.based_on_projection_ids,
        projections,
        hardening: input.hardening,
      })),
    ])
  }

  private async collectJobHardeningBlockReasonCodes(input: {
    job: MediaGenerationJob
    projections: MediaContextProjection[]
    hardening: MediaGenerationHardeningSettings
  }): Promise<string[]> {
    const reasons: string[] = []
    if (input.hardening.strict_audit_enforced && !input.job.audit_decision) {
      reasons.push('missing_audit_decision')
    }
    if (input.hardening.strict_audit_enforced && input.job.input_mode === 'reference' && input.projections.length === 0) {
      reasons.push('missing_source_projections')
    }
    return uniqueReasonCodes([
      ...reasons,
      ...(await this.collectProjectionHardeningBlockReasonCodes({
        input_mode: input.job.input_mode,
        based_on_projection_ids: input.job.based_on_projection_ids,
        projections: input.projections,
        hardening: input.hardening,
      })),
    ])
  }

  private async collectProjectionHardeningBlockReasonCodes(input: {
    input_mode: 'reference' | 'scratch'
    based_on_projection_ids: string[]
    projections: MediaContextProjection[]
    hardening: MediaGenerationHardeningSettings
  }): Promise<string[]> {
    if (input.input_mode !== 'reference') return []

    const reasons: string[] = []
    if (input.hardening.lineage_required) {
      if (input.based_on_projection_ids.length === 0) {
        reasons.push('missing_source_projections')
      }
      if (input.projections.length !== input.based_on_projection_ids.length) {
        reasons.push('source_projection_missing')
      }
      if (this.deps.mediaLineageService && input.projections.length > 0) {
        const lineageChecks = await Promise.all(
          input.projections.map((projection) =>
            this.deps.mediaLineageService!.hasLineage('projection', projection.id)),
        )
        if (lineageChecks.some((hasLineage) => !hasLineage)) {
          reasons.push('lineage_incomplete')
        }
      }
    }

    if (!input.hardening.semantic_v3_enforced) {
      return uniqueReasonCodes(reasons)
    }
    const assetIds = uniqueAssetIdsFromProjections(input.projections)
    if (input.projections.length > 0 && assetIds.length === 0) {
      reasons.push('semantic_source_unresolved')
      return uniqueReasonCodes(reasons)
    }
    if (assetIds.length === 0) {
      return uniqueReasonCodes(reasons)
    }
    const snapshots = await Promise.all(
      assetIds.map((assetId) => this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(assetId)),
    )
    if (snapshots.some((snapshot) => !snapshot || snapshot.schema_version !== MEDIA_SEMANTIC_SCHEMA_VERSION)) {
      reasons.push('semantic_schema_not_v3')
    }
    return uniqueReasonCodes(reasons)
  }

  private async cancelPlanGeneration(input: {
    plan: PersistedImagePlan
    audit_decision: MediaAuditDecision
    generation_spec: MediaGenerationSpec
    compiled_prompt: CompiledMediaPrompt
  }): Promise<PersistedImagePlan> {
    const updated = await this.deps.imagePlanRepo.update(input.plan.id, {
      generation: {
        ...input.plan.generation,
        status: 'cancelled',
        audit_decision: input.audit_decision,
        spec: input.generation_spec,
        compiled_prompt: input.compiled_prompt,
        error_code: 'audit_blocked',
      },
    })
    return updated ?? {
      ...input.plan,
      generation: {
        ...input.plan.generation,
        status: 'cancelled',
        audit_decision: input.audit_decision,
        spec: input.generation_spec,
        compiled_prompt: input.compiled_prompt,
        error_code: 'audit_blocked',
      },
    }
  }

  private async applyReadyPlanAfterPersist(plan: PersistedImagePlan): Promise<void> {
    if (!this.deps.mediaWriteBridge) return
    const sceneTarget = await this.resolvePersistedSceneTarget(plan)
    if (!sceneTarget) return
    try {
      await this.deps.mediaWriteBridge.applyImagePlanAfterPersist({
        image_plan_id: plan.id,
        scene_type: sceneTarget.scene_type,
        scene_id: sceneTarget.scene_id,
        created_by_id: 'media-generation-service',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'apply_image_plan_after_generation_failed'
      console.error(
        `[MediaGenerationService] applyImagePlanAfterPersist failed for image_plan=${plan.id}: ${message}`,
      )
    }
  }

  private async resolvePersistedSceneTarget(plan: PersistedImagePlan): Promise<{
    scene_type: 'forum_post' | 'forum_thread' | 'forum_turn' | 'chat_room_message'
    scene_id: string
  } | null> {
    if (plan.scene_ref.post_id?.trim()) {
      return { scene_type: 'forum_post', scene_id: plan.scene_ref.post_id }
    }
    if (plan.scene_ref.thread_id?.trim()) {
      return { scene_type: 'forum_thread', scene_id: plan.scene_ref.thread_id }
    }
    if (plan.scene_ref.turn_id?.trim()) {
      return { scene_type: 'forum_turn', scene_id: plan.scene_ref.turn_id }
    }
    if (plan.scene_ref.message_id?.trim()) {
      return { scene_type: 'chat_room_message', scene_id: plan.scene_ref.message_id }
    }
    if (!this.deps.forumSceneMetadataRepo || !plan.scene_ref.episode_id?.trim()) {
      return null
    }

    const candidates = await this.deps.forumSceneMetadataRepo.listByEpisodeId(plan.scene_ref.episode_id)
    const matched = candidates.find((item) => {
      if (item.actor_surface !== plan.scene_ref.actor_surface) return false
      if (item.director_surface !== plan.scene_ref.director_surface) return false
      if (plan.scene_ref.community_id && item.community_id !== plan.scene_ref.community_id) return false
      if (plan.scene_ref.selection_id && item.selection_id !== plan.scene_ref.selection_id) return false
      if (plan.scene_ref.local_intent_id && item.local_intent_id !== plan.scene_ref.local_intent_id) return false
      return true
    })
    if (!matched) return null

    if (matched.target_type === 'POST' && matched.post_id) {
      return { scene_type: 'forum_post', scene_id: matched.post_id }
    }
    if (matched.target_type === 'THREAD' && matched.thread_id) {
      return { scene_type: 'forum_thread', scene_id: matched.thread_id }
    }
    if (matched.target_type === 'TURN' && matched.turn_id) {
      return { scene_type: 'forum_turn', scene_id: matched.turn_id }
    }
    return null
  }
}

function resolveGeneratedOutputSourceKind(
  plan: PersistedImagePlan | null,
): 'generated_public' | 'private_derived_public' {
  const runtimeDerivedFromPrivate = plan?.runtime.cards.some((card) => card.source.derived_from_private) ?? false
  const runtimeSourceKinds = plan?.runtime.cards.map((card) => card.source.kind) ?? []
  const selectedSourceKinds = plan?.selected_sources.map((source) => source.source_kind) ?? []
  const hasPrivateOrigin = runtimeDerivedFromPrivate || [...runtimeSourceKinds, ...selectedSourceKinds].some((sourceKind) =>
    sourceKind === 'owner_private_pool'
    || sourceKind === 'private_runtime_projection'
    || sourceKind === 'private_derived_public',
  )
  return hasPrivateOrigin ? 'private_derived_public' : 'generated_public'
}

function buildGeneratedOutputRuntimeCard(
  plan: PersistedImagePlan,
  asset: MediaAsset,
  snapshot: MediaSemanticSnapshot,
): PublicMediaContextCard {
  const previousCard = plan.runtime.cards[0] ?? null
  const sourceKind = resolveGeneratedOutputSourceKind(plan)
  const derivedFromPrivate = sourceKind === 'private_derived_public'
  return {
    schema_version: 'public-media-context-card.v1',
    card_id: previousCard?.card_id ?? `generated-output:${asset.id}`,
    modality: 'image',
    asset_ref: {
      asset_id: asset.id,
      semantic_snapshot_id: snapshot.id,
      projection_id: previousCard?.asset_ref.projection_id ?? `generated-output:${asset.id}`,
    },
    source: {
      kind: sourceKind,
      derived_from_private: derivedFromPrivate,
      continuity_ref: previousCard?.source.continuity_ref ?? (
        plan.scene_ref.thread_root_ref
          ? { thread_root_ref: plan.scene_ref.thread_root_ref }
          : undefined
      ),
    },
    relation: {
      visual_role: previousCard?.relation.visual_role ?? 'illustration',
      prompt_weight: previousCard?.relation.prompt_weight ?? 'secondary',
      mention_policy: previousCard?.relation.mention_policy ?? 'allude',
      why_now: previousCard?.relation.why_now ?? '由生成结果为当前场景补足视觉锚点。',
    },
    public_summary: {
      theme: snapshot.summary.theme,
      scene: snapshot.summary.scene,
      mood: snapshot.summary.mood,
      salient_entities: snapshot.summary.salient_entities.slice(0, 5),
      discussion_points: snapshot.summary.discussion_points.slice(0, 5),
      public_safe_caption: snapshot.summary.public_safe_summary,
      alt_text: snapshot.summary.public_safe_summary,
      ...(snapshot.summary.ocr_snippets.length > 0
        ? { ocr_snippets: snapshot.summary.ocr_snippets.slice(0, 3) }
        : {}),
    },
    display: {
      original_display_allowed: false,
      derivative_display_allowed: true,
      preferred_variant: 'derivative',
    },
    governance: {
      public_scope: previousCard?.governance.public_scope ?? 'community_public',
      disclose_origin_policy: derivedFromPrivate ? 'never' : 'public_only',
      cross_agent_quote_allowed: false,
      prohibited_reference_types: previousCard?.governance.prohibited_reference_types
        ?? ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      expires_at: previousCard?.governance.expires_at ?? null,
    },
    audit: {
      confidence: snapshot.summary.confidence,
      relevance_score: previousCard?.audit.relevance_score ?? 0.8,
      model_version: snapshot.model_version,
    },
  }
}

function uniquePlans(plans: PersistedImagePlan[]): PersistedImagePlan[] {
  return Array.from(new Map(plans.map((plan) => [plan.id, plan])).values())
}

function resolveGenerationSpec(plan: PersistedImagePlan): MediaGenerationSpec {
  return plan.generation.spec ?? buildLegacyGenerationSpec({
    prompt_brief: plan.generation.prompt_brief ?? null,
    input_mode: plan.generation.input_mode ?? 'reference',
    aspect_ratio_hint: plan.generation.aspect_ratio_hint ?? null,
    based_on_projection_ids: plan.generation.based_on_projection_ids ?? [],
  })
}

function resolveCompiledPrompt(
  plan: PersistedImagePlan,
  spec: MediaGenerationSpec,
): CompiledMediaPrompt {
  return plan.generation.compiled_prompt ?? compileMediaGenerationSpec({
    spec,
    style_hint: null,
  })
}

function buildDefaultAllowAuditDecision(): MediaAuditDecision {
  return {
    decision: 'allow',
    reason_codes: ['legacy_generation_job_default_allow'],
    redacted_terms: [],
  }
}

function buildBlockedAuditDecision(
  existing: MediaAuditDecision | null | undefined,
  reasonCodes: string[],
): MediaAuditDecision {
  return {
    decision: 'block',
    reason_codes: uniqueReasonCodes([
      ...(existing?.reason_codes ?? []),
      ...reasonCodes,
    ]),
    redacted_terms: [...(existing?.redacted_terms ?? [])],
  }
}

function uniqueReasonCodes(reasonCodes: string[]): string[] {
  return [...new Set(reasonCodes.filter((reason) => reason.trim().length > 0))]
}

function uniqueAssetIdsFromProjections(projections: MediaContextProjection[]): string[] {
  const assetIds = new Set<string>()
  for (const projection of projections) {
    const payload = projection.payload_json as Record<string, unknown> | null
    if (!payload || typeof payload !== 'object') continue
    const directAssetId = typeof payload.asset_id === 'string' ? payload.asset_id : null
    if (directAssetId) {
      assetIds.add(directAssetId)
    }
    const assetRef = payload.asset_ref
    if (assetRef && typeof assetRef === 'object' && !Array.isArray(assetRef)) {
      const assetRefId = typeof (assetRef as Record<string, unknown>).asset_id === 'string'
        ? (assetRef as Record<string, unknown>).asset_id as string
        : null
      if (assetRefId) {
        assetIds.add(assetRefId)
      }
    }
  }
  return [...assetIds]
}
