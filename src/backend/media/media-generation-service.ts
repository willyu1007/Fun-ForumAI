import { config } from '../lib/config.js'
import type { ImagePlanRepository } from '../repos/image-plan-repository.js'
import type { MediaGenerationJobRepository } from '../repos/media-generation-job-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { MediaProjectionService } from './media-projection-service.js'
import type { MediaAssetService } from './media-asset-service.js'
import type { MediaReuseGovernanceService } from './media-reuse-governance-service.js'
import type {
  MediaAsset,
  MediaGenerationJob,
  MediaSemanticSnapshot,
  PersistedImagePlan,
  PublicMediaContextCard,
} from '../repos/types.js'
import type { MediaGenerationGateway } from './media-generation-gateway.js'
import type { MediaObservabilityService } from './media-observability-service.js'
import { resolveMediaObservabilitySurface } from './media-observability-service.js'

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

export interface MediaGenerationServiceDeps {
  imagePlanRepo: ImagePlanRepository
  mediaGenerationJobRepo: MediaGenerationJobRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  mediaSemanticSnapshotRepo: Pick<MediaSemanticSnapshotRepository, 'findCurrentByAssetId'>
  mediaAssetService: MediaAssetService
  mediaReuseGovernanceService: MediaReuseGovernanceService
  mediaProjectionService: MediaProjectionService
  gateway: MediaGenerationGateway
  mediaObservabilityService?: Pick<MediaObservabilityService, 'record' | 'getEstimatedGenerationCostCny'> | null
}

export class MediaGenerationService {
  private processKickScheduled = false

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
    const promptBrief = input.plan.generation.prompt_brief?.trim()
    const basedOnProjectionIds = input.plan.generation.based_on_projection_ids ?? []
    const inputMode = input.plan.generation.input_mode ?? 'reference'
    if (!fingerprint || !promptBrief || (inputMode === 'reference' && basedOnProjectionIds.length === 0)) {
      return { plan: input.plan, job: null }
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
      style_hint: null,
      input_mode: inputMode,
      aspect_ratio_hint: input.plan.generation.aspect_ratio_hint ?? input.plan.display.attachments[0]?.aspect_ratio_hint ?? null,
      based_on_projection_ids: basedOnProjectionIds,
      attempt_count: 0,
    })

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
    if (!config.features.mediaGenerationV1 || !this.deps.gateway.isConfigured) {
      return null
    }

    const timedOutJobs = await this.deps.mediaGenerationJobRepo.markTimedOutRunningJobs(
      new Date(),
      config.mediaGeneration.runningTimeoutMs,
    )
    for (const timedOutJob of timedOutJobs) {
      await this.syncLinkedPlansWithJob(timedOutJob)
      await this.recordJobEvent(timedOutJob, 'generation_timed_out')
    }

    const job = await this.deps.mediaGenerationJobRepo.claimNextQueued({
      now: new Date(),
      running_timeout_ms: config.mediaGeneration.runningTimeoutMs,
      max_attempts: 2,
      global_concurrency: config.mediaGeneration.globalConcurrency,
      provider_concurrency: config.mediaGeneration.providerConcurrency,
      provider: this.deps.gateway.providerId,
    })
    if (!job) return null
    await this.syncLinkedPlansWithJob(job)

    const projections = job.input_mode === 'reference'
      ? await this.deps.mediaContextProjectionRepo.findByIds(job.based_on_projection_ids)
      : []
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

    try {
      const primaryPlan = job.plan_id
        ? await this.deps.imagePlanRepo.findById(job.plan_id)
        : null
      const result = await this.deps.gateway.generate({
        prompt_brief: job.prompt_brief,
        style_hint: job.style_hint,
        aspect_ratio_hint: job.aspect_ratio_hint,
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
        })
      }

      const finished = await this.deps.mediaGenerationJobRepo.update(job.id, {
        status: shouldBlock ? 'cancelled' : 'succeeded',
        output_asset_id: generated.asset.id,
        error_code: shouldBlock ? 'policy_revoked' : null,
        error_message: shouldBlock ? 'source projection expired after provider execution' : null,
        finished_at: new Date(),
      })
      await this.syncLinkedPlansWithJob(finished ?? job)
      await this.recordJobEvent(
        finished ?? job,
        shouldBlock ? 'generation_cancelled' : 'generation_succeeded',
      )
      return finished ?? job
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'media_generation_failed'
      const nextStatus = job.attempt_count >= 2 ? 'failed' : 'queued'
      const updated = await this.deps.mediaGenerationJobRepo.update(job.id, {
        status: nextStatus,
        error_code: nextStatus === 'queued' ? 'provider_retryable' : 'provider_failed',
        error_message: errorMessage,
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

  private kickProcessing(): void {
    if (this.processKickScheduled || !config.features.mediaGenerationV1 || !this.deps.gateway.isConfigured) {
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
