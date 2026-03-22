import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { MediaReusePolicyRepository, UpdateMediaReusePolicyPatch } from '../repos/media-reuse-policy-repository.js'
import type { MediaGenerationJobRepository } from '../repos/media-generation-job-repository.js'
import type { ImagePlanRepository } from '../repos/image-plan-repository.js'
import type {
  MediaAsset,
  MediaContextProjection,
  MediaCopyrightState,
  MediaReuseMode,
  MediaReusePolicy,
  MediaReusePolicySubjectType,
  PersistedVisualDirective,
  SceneMediaBinding,
  VisualSourceKind,
} from '../repos/types.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import { MediaBindingService } from './media-binding-service.js'
import type { MediaObservabilityService } from './media-observability-service.js'

export interface MediaReuseGovernanceServiceDeps {
  mediaAssetRepo: MediaAssetRepository
  mediaSemanticSnapshotRepo: MediaSemanticSnapshotRepository
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  mediaReusePolicyRepo: MediaReusePolicyRepository
  mediaGenerationJobRepo: MediaGenerationJobRepository
  imagePlanRepo: ImagePlanRepository
  mediaBindingService: MediaBindingService
  mediaObservabilityService?: Pick<MediaObservabilityService, 'record'> | null
}

export interface MediaReuseEvaluation {
  policy: MediaReusePolicy
  allowed_reuse_modes: MediaReuseMode[]
  policy_reason: string
  rejection_reason: string | null
}

export function buildPlatformCanonicalPoolSceneId(): string {
  return 'platform_canonical:global'
}

export function buildCommunityCommonsPoolSceneId(communityId: string): string {
  return `community_commons:${communityId}`
}

export function buildGeneratedPublicPoolSceneId(agentId: string): string {
  return `generated_public:${agentId}`
}

export function buildPrivateDerivedPublicPoolSceneId(agentId: string): string {
  return `private_derived_public:${agentId}`
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

function isProjectionActive(projection: MediaContextProjection, now = new Date()): boolean {
  return !projection.expires_at || projection.expires_at.getTime() > now.getTime()
}

function dedupeModes(modes: MediaReuseMode[]): MediaReuseMode[] {
  return Array.from(new Set(modes))
}

function defaultCopyrightStateForAsset(asset: MediaAsset): MediaCopyrightState {
  switch (asset.source_kind) {
    case 'platform_canonical':
      return 'platform_owned'
    case 'community_commons':
      return 'community_licensed'
    case 'generated':
      return 'generated_owned'
    case 'url_import':
      return 'external_unknown'
    default:
      return 'internal_owned'
  }
}

function defaultDiscloseOriginPolicy(sourceKind: VisualSourceKind): MediaReusePolicy['disclose_origin_policy'] {
  if (
    sourceKind === 'owner_private_pool'
    || sourceKind === 'private_runtime_projection'
    || sourceKind === 'private_derived_public'
  ) {
    return 'never'
  }
  if (sourceKind === 'same_episode_public') {
    return 'episode_only'
  }
  return 'public_only'
}

function defaultModesForSource(input: {
  source_kind: VisualSourceKind
  asset?: MediaAsset | null
  allow_quote_original?: boolean
}): MediaReuseMode[] {
  switch (input.source_kind) {
    case 'owner_private_pool':
    case 'self_public_archive':
    case 'same_episode_public':
    case 'platform_canonical':
    case 'generated_public':
    case 'private_derived_public':
      return ['quote_original', 'derive_new', 'reference_only']
    case 'community_commons':
      return input.allow_quote_original
        ? ['quote_original', 'derive_new', 'reference_only']
        : ['derive_new', 'reference_only']
    case 'private_runtime_projection':
      return ['derive_new', 'reference_only']
    case 'same_thread_public':
      return ['quote_original', 'derive_new', 'reference_only']
    default:
      return input.asset?.source_kind === 'url_import'
        ? ['derive_new', 'reference_only']
        : ['quote_original', 'derive_new', 'reference_only']
  }
}

function defaultCrossAgentQuoteAllowed(sourceKind: VisualSourceKind, allowQuoteOriginal?: boolean): boolean {
  if (sourceKind === 'platform_canonical') return true
  if (sourceKind === 'community_commons') return Boolean(allowQuoteOriginal)
  return false
}

export class MediaReuseGovernanceService {
  constructor(private readonly deps: MediaReuseGovernanceServiceDeps) {}

  async ensureAssetPolicy(input: {
    source_kind: VisualSourceKind
    asset: MediaAsset
    community_id?: string | null
    allow_quote_original?: boolean
  }): Promise<MediaReusePolicy> {
    const existing = await this.deps.mediaReusePolicyRepo.findBySubject(
      'asset',
      input.asset.id,
      input.source_kind,
    )
    const policy = existing ?? await this.deps.mediaReusePolicyRepo.create({
      subject_type: 'asset',
      subject_id: input.asset.id,
      source_kind: input.source_kind,
      community_id: input.community_id ?? null,
      steward_agent_id: input.asset.steward_agent_id ?? null,
      allowed_reuse_modes: defaultModesForSource(input),
      cross_agent_quote_allowed: defaultCrossAgentQuoteAllowed(
        input.source_kind,
        input.allow_quote_original,
      ),
      disclose_origin_policy: defaultDiscloseOriginPolicy(input.source_kind),
      copyright_state: defaultCopyrightStateForAsset(input.asset),
      status: input.asset.lifecycle_status === 'blocked' ? 'blocked' : 'active',
    })
    if (existing) {
      return existing
    }
    if (
      input.asset.source_kind === 'url_import'
      && policy.allowed_reuse_modes.includes('quote_original')
    ) {
      return (await this.deps.mediaReusePolicyRepo.update(policy.id, {
        allowed_reuse_modes: policy.allowed_reuse_modes.filter((mode) => mode !== 'quote_original'),
      })) ?? policy
    }
    return policy
  }

  async ensureProjectionPolicy(input: {
    source_kind: VisualSourceKind
    projection: MediaContextProjection
    steward_agent_id?: string | null
    community_id?: string | null
  }): Promise<MediaReusePolicy> {
    const existing = await this.deps.mediaReusePolicyRepo.findBySubject(
      'projection',
      input.projection.id,
      input.source_kind,
    )
    if (existing) {
      return existing
    }
    return this.deps.mediaReusePolicyRepo.create({
      subject_type: 'projection',
      subject_id: input.projection.id,
      source_kind: input.source_kind,
      community_id: input.community_id ?? null,
      steward_agent_id: input.steward_agent_id ?? null,
      allowed_reuse_modes: defaultModesForSource({ source_kind: input.source_kind }).filter(
        (mode): mode is 'derive_new' | 'reference_only' =>
          mode === 'derive_new' || mode === 'reference_only',
      ),
      cross_agent_quote_allowed: false,
      disclose_origin_policy: defaultDiscloseOriginPolicy(input.source_kind),
      copyright_state: 'internal_owned',
      status: isProjectionActive(input.projection) ? 'active' : 'blocked',
    })
  }

  async evaluateCandidate(input: {
    agent_id: string
    directive: PersistedVisualDirective
    source_kind: VisualSourceKind
    asset?: MediaAsset | null
    binding?: SceneMediaBinding | null
    projection?: MediaContextProjection | null
    community_id?: string | null
  }): Promise<MediaReuseEvaluation> {
    const subject_type: MediaReusePolicySubjectType = input.projection ? 'projection' : 'asset'
    const subject_id = input.projection?.id ?? input.asset?.id
    if (!subject_id) {
      throw new ValidationError('candidate must include an asset or projection subject')
    }

    const policy = input.projection
      ? await this.ensureProjectionPolicy({
          source_kind: input.source_kind,
          projection: input.projection,
          steward_agent_id: input.asset?.steward_agent_id ?? null,
          community_id: input.community_id ?? null,
        })
      : await this.ensureAssetPolicy({
          source_kind: input.source_kind,
          asset: input.asset!,
          community_id: input.community_id ?? null,
        })

    if (policy.status !== 'active') {
      await this.deps.mediaObservabilityService?.record({
        event_type: 'policy_candidate_blocked',
        surface: 'governance',
        severity: 'warn',
        agent_id: input.agent_id,
        asset_id: input.asset?.id ?? null,
        source_kind: input.source_kind,
        payload_json: {
          subject_type,
          subject_id,
          policy_id: policy.id,
          reason: `policy_${policy.status}`,
        },
      })
      return {
        policy,
        allowed_reuse_modes: [],
        policy_reason: `policy_${policy.status}`,
        rejection_reason: `policy_${policy.status}`,
      }
    }
    if (input.projection && !isProjectionActive(input.projection)) {
      await this.deps.mediaObservabilityService?.record({
        event_type: 'policy_candidate_blocked',
        surface: 'governance',
        severity: 'warn',
        agent_id: input.agent_id,
        asset_id: input.asset?.id ?? null,
        source_kind: input.source_kind,
        payload_json: {
          subject_type,
          subject_id,
          policy_id: policy.id,
          reason: 'projection_expired',
        },
      })
      return {
        policy,
        allowed_reuse_modes: [],
        policy_reason: 'projection_expired',
        rejection_reason: 'projection_expired',
      }
    }

    let allowedModes = [...policy.allowed_reuse_modes]
    const currentAgentId = input.agent_id
    const asset = input.asset ?? null
    const binding = input.binding ?? null

    if (!asset && allowedModes.includes('quote_original')) {
      allowedModes = allowedModes.filter((mode) => mode !== 'quote_original')
    }
    if (asset) {
      if (asset.lifecycle_status !== 'active' || asset.visibility_policy === 'blocked') {
        await this.deps.mediaObservabilityService?.record({
          event_type: 'policy_candidate_blocked',
          surface: 'governance',
          severity: 'warn',
          agent_id: input.agent_id,
          asset_id: asset.id,
          source_kind: input.source_kind,
          payload_json: {
            subject_type,
            subject_id,
            policy_id: policy.id,
            reason: 'asset_blocked',
          },
        })
        return {
          policy,
          allowed_reuse_modes: [],
          policy_reason: 'asset_blocked',
          rejection_reason: 'asset_blocked',
        }
      }
      if (
        policy.copyright_state === 'external_unknown'
        || policy.copyright_state === 'external_restricted'
        || asset.source_kind === 'url_import'
      ) {
        allowedModes = allowedModes.filter((mode) => mode !== 'quote_original')
      }
      if (
        asset.steward_agent_id
        && asset.steward_agent_id !== currentAgentId
        && !policy.cross_agent_quote_allowed
      ) {
        allowedModes = allowedModes.filter((mode) => mode !== 'quote_original')
      }
      if (input.source_kind === 'owner_private_pool' && asset.steward_agent_id !== currentAgentId) {
        allowedModes = allowedModes.filter((mode) => mode !== 'quote_original')
      }
      if (
        binding?.display_policy === 'runtime_only_no_display'
        && input.source_kind !== 'owner_private_pool'
      ) {
        allowedModes = allowedModes.filter((mode) => mode !== 'quote_original')
      }
    }
    if (input.source_kind === 'private_runtime_projection') {
      allowedModes = allowedModes.filter((mode) => mode !== 'quote_original')
    }
    if (input.source_kind === 'community_commons' && !policy.allowed_reuse_modes.includes('quote_original')) {
      allowedModes = allowedModes.filter((mode) => mode !== 'quote_original')
    }

    allowedModes = dedupeModes(allowedModes)
    if (allowedModes.length === 0) {
      await this.deps.mediaObservabilityService?.record({
        event_type: 'policy_candidate_blocked',
        surface: 'governance',
        severity: 'warn',
        agent_id: input.agent_id,
        asset_id: input.asset?.id ?? null,
        source_kind: input.source_kind,
        payload_json: {
          subject_type,
          subject_id,
          policy_id: policy.id,
          reason: 'policy_blocked_all_modes',
        },
      })
      return {
        policy,
        allowed_reuse_modes: [],
        policy_reason: 'policy_blocked_all_modes',
        rejection_reason: 'policy_blocked_all_modes',
      }
    }

    return {
      policy,
      allowed_reuse_modes: allowedModes,
      policy_reason: `${subject_type}_policy_active`,
      rejection_reason: null,
    }
  }

  async registerPlatformCanonicalAsset(input: {
    asset_id: string
    actor_user_id: string
  }): Promise<{ binding: SceneMediaBinding; policy: MediaReusePolicy }> {
    return this.registerPoolAsset({
      asset_id: input.asset_id,
      pool_id: buildPlatformCanonicalPoolSceneId(),
      source_kind: 'platform_canonical',
      actor_user_id: input.actor_user_id,
      allow_quote_original: true,
    })
  }

  async registerCommunityCommonsAsset(input: {
    community_id: string
    asset_id: string
    actor_user_id: string
    allow_quote_original?: boolean
  }): Promise<{ binding: SceneMediaBinding; policy: MediaReusePolicy }> {
    return this.registerPoolAsset({
      asset_id: input.asset_id,
      pool_id: buildCommunityCommonsPoolSceneId(input.community_id),
      source_kind: 'community_commons',
      community_id: input.community_id,
      actor_user_id: input.actor_user_id,
      allow_quote_original: input.allow_quote_original,
    })
  }

  async registerGeneratedPublicAsset(input: {
    asset_id: string
    agent_id: string
    actor_user_id: string
  }): Promise<{ binding: SceneMediaBinding; policy: MediaReusePolicy }> {
    return this.registerPoolAsset({
      asset_id: input.asset_id,
      pool_id: buildGeneratedPublicPoolSceneId(input.agent_id),
      source_kind: 'generated_public',
      actor_user_id: input.actor_user_id,
    })
  }

  async registerPrivateDerivedPublicAsset(input: {
    asset_id: string
    agent_id: string
    actor_user_id: string
  }): Promise<{ binding: SceneMediaBinding; policy: MediaReusePolicy }> {
    return this.registerPoolAsset({
      asset_id: input.asset_id,
      pool_id: buildPrivateDerivedPublicPoolSceneId(input.agent_id),
      source_kind: 'private_derived_public',
      actor_user_id: input.actor_user_id,
    })
  }

  async updatePolicy(
    policyId: string,
    patch: UpdateMediaReusePolicyPatch,
  ): Promise<MediaReusePolicy> {
    const updated = await this.deps.mediaReusePolicyRepo.update(policyId, patch)
    if (!updated) throw new NotFoundError('MediaReusePolicy', policyId)
    return updated
  }

  async revokePolicy(input: {
    policy_id: string
    reason: string
    revoked_at?: Date
  }): Promise<{ policy: MediaReusePolicy; cancelled_jobs: number; expired_projection_ids: string[] }> {
    const existing = await this.deps.mediaReusePolicyRepo.findById(input.policy_id)
    if (!existing) throw new NotFoundError('MediaReusePolicy', input.policy_id)

    const revokedAt = input.revoked_at ?? new Date()
    const policy = await this.updatePolicy(existing.id, {
      status: 'revoked',
      revoked_at: revokedAt,
      revoked_reason: input.reason,
    })

    const projectionIds = await this.resolveProjectionIdsForPolicy(policy)
    if (projectionIds.length > 0) {
      await this.deps.mediaContextProjectionRepo.expireByIds(projectionIds, revokedAt)
    }
    const cancelledJobs = await this.deps.mediaGenerationJobRepo.cancelQueuedByProjectionIds(
      projectionIds,
      input.reason,
      revokedAt,
    )
    for (const job of cancelledJobs) {
      await this.syncPlansWithCancelledJob(job)
    }

    await this.deps.mediaObservabilityService?.record({
      event_type: 'policy_revoked',
      surface: 'governance',
      severity: 'warn',
      asset_id: policy.subject_type === 'asset' ? policy.subject_id : null,
      payload_json: {
        policy_id: policy.id,
        subject_type: policy.subject_type,
        subject_id: policy.subject_id,
        cancelled_jobs: cancelledJobs.length,
        expired_projection_ids: projectionIds,
        reason: input.reason,
      },
    })

    return {
      policy,
      cancelled_jobs: cancelledJobs.length,
      expired_projection_ids: projectionIds,
    }
  }

  private async registerPoolAsset(input: {
    asset_id: string
    pool_id: string
    source_kind: VisualSourceKind
    actor_user_id: string
    community_id?: string | null
    allow_quote_original?: boolean
  }): Promise<{ binding: SceneMediaBinding; policy: MediaReusePolicy }> {
    const asset = await this.deps.mediaAssetRepo.findById(input.asset_id)
    if (!asset) throw new NotFoundError('MediaAsset', input.asset_id)
    if (asset.source_kind === 'private_message_upload') {
      throw new ValidationError('private_message_upload assets cannot be registered into public pools')
    }
    if (asset.lifecycle_status !== 'active' || asset.visibility_policy === 'blocked') {
      throw new ValidationError('asset is not eligible for public pool registration')
    }
    const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
    if (!snapshot) throw new ValidationError('asset semantic snapshot is not ready')

    const existingBinding = (await this.deps.sceneMediaBindingRepo.findByScene('media_pool', input.pool_id))
      .find((binding) => binding.asset_id === asset.id) ?? null
    const sourceBinding = existingBinding
      ? null
      : (await this.deps.sceneMediaBindingRepo.findByAssetId(asset.id))[0] ?? null
    const binding = existingBinding ?? await this.deps.mediaBindingService.createMediaPoolBinding({
      asset,
      snapshot,
      poolId: input.pool_id,
      sourceBinding,
      createdById: input.actor_user_id,
      relationToScene: input.source_kind === 'generated_public' || input.source_kind === 'private_derived_public'
        ? 'generated_for_scene'
        : 'quoted_public',
      displayPolicy: asset.visibility_policy === 'public_derivative_only'
        ? 'derivative_only'
        : 'original_allowed',
    })
    const policy = await this.ensureAssetPolicy({
      source_kind: input.source_kind,
      asset,
      community_id: input.community_id ?? null,
      allow_quote_original: input.allow_quote_original,
    })
    return { binding, policy }
  }

  private async resolveProjectionIdsForPolicy(policy: MediaReusePolicy): Promise<string[]> {
    if (policy.subject_type === 'projection') {
      return [policy.subject_id]
    }
    const bindings = await this.deps.sceneMediaBindingRepo.findByAssetId(policy.subject_id)
    if (bindings.length === 0) return []
    const projections = await this.deps.mediaContextProjectionRepo.findByBindingIds(
      bindings.map((binding) => binding.id),
    )
    const bindingById = new Map(bindings.map((binding) => [binding.id, binding]))
    return projections
      .filter((projection) => {
        const binding = bindingById.get(projection.binding_id)
        if (!binding) return false
        if (binding.scene_type === 'media_pool') return true
        if (projection.projection_surface === 'planner' || projection.projection_kind === 'public_reuse_handoff') {
          return true
        }
        if (
          projection.projection_surface === 'public_runtime'
          && projection.projection_kind === 'public_media_context_card'
        ) {
          return true
        }
        return false
      })
      .map((projection) => projection.id)
  }

  private async syncPlansWithCancelledJob(job: {
    id: string
    plan_id: string | null
    provider: string
    model_name: string
    attempt_count: number
    output_asset_id: string | null
    error_code: string | null
  }): Promise<void> {
    const linkedPlans = await this.deps.imagePlanRepo.listByGenerationJobId(job.id)
    if (job.plan_id) {
      const primary = await this.deps.imagePlanRepo.findById(job.plan_id)
      if (primary) {
        linkedPlans.push(primary)
      }
    }
    for (const plan of uniqueById(linkedPlans)) {
      await this.deps.imagePlanRepo.update(plan.id, {
        status: 'degraded',
        reason: 'generation_cancelled',
        generation: {
          ...plan.generation,
          job_id: job.id,
          status: 'cancelled',
          provider: job.provider,
          model_ref: job.model_name,
          attempt_count: job.attempt_count,
          output_asset_id: job.output_asset_id ?? undefined,
          error_code: job.error_code,
        },
      })
    }
  }
}
