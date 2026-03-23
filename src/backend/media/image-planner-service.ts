import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { ImagePlanRepository } from '../repos/image-plan-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { MediaProjectionService } from './media-projection-service.js'
import type { MediaReuseGovernanceService } from './media-reuse-governance-service.js'
import type {
  AspectRatioHint,
  ImageDecision,
  ImagePlanSource,
  MediaAsset,
  MediaContextProjection,
  MediaReuseMode,
  MediaSemanticSnapshot,
  PersistedImagePlan,
  PersistedVisualDirective,
  PlannedDisplayAttachment,
  PlannerScoreBreakdown,
  PublicMediaContextCard,
  PublicReuseHandoffCard,
  PublicScope,
  SceneMediaBinding,
  VisualSourceKind,
} from '../repos/types.js'
import {
  buildCommunityCommonsPoolSceneId,
  buildPlatformCanonicalPoolSceneId,
  buildGeneratedPublicPoolSceneId,
  buildPrivateDerivedPublicPoolSceneId,
  buildSelfPublicArchivePoolSceneId,
} from './media-reuse-governance-service.js'
import { buildOwnerPrivatePoolSceneId } from './media-binding-service.js'
import {
  isPrivateOriginAsset,
  readForumPostIdFromThreadRootRef,
} from './media-contract-utils.js'

const MAX_SAME_THREAD_PUBLIC_BINDINGS = 48

interface CandidateSummary {
  theme: string
  scene: string
  mood: string
  public_safe_caption: string
  alt_text: string
  salient_entities: string[]
  discussion_points: string[]
}

interface PlannerCandidate {
  source_kind: VisualSourceKind
  asset: MediaAsset | null
  snapshot: MediaSemanticSnapshot | null
  binding: SceneMediaBinding | null
  projection: MediaContextProjection | null
  summary: CandidateSummary
  why_relevant_hint?: string
  continuity_ref?: {
    episode_id?: string | null
    thread_post_id?: string | null
    thread_root_ref?: string | null
  }
}

interface EvaluatedCandidate {
  candidate: PlannerCandidate
  score: PlannerScoreBreakdown
  allowed_reuse_modes: MediaReuseMode[]
  policy_ref: {
    policy_id: string
    subject_type: 'asset' | 'projection'
    subject_id: string
    status: 'active' | 'revoked' | 'blocked'
  }
  policy_reason: string
  rejection_reason: string | null
}

export interface ImagePlannerServiceDeps {
  imagePlanRepo: ImagePlanRepository
  mediaAssetRepo: MediaAssetRepository
  mediaSemanticSnapshotRepo: MediaSemanticSnapshotRepository
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  forumSceneMetadataRepo: ForumSceneMetadataRepository
  mediaProjectionService: MediaProjectionService
  mediaReuseGovernanceService: MediaReuseGovernanceService
}

export class ImagePlannerService {
  constructor(private readonly deps: ImagePlannerServiceDeps) {}

  planWithDirective(input: {
    agent_id: string
    directive: PersistedVisualDirective
  }): Promise<PersistedImagePlan> {
    return this.planScheduledPost(input)
  }

  async listAgentIdsWithOwnerPrivatePoolCandidates(limit = 100): Promise<string[]> {
    const stewardAgentIds = await this.deps.mediaAssetRepo.listStewardAgentIdsWithAssets({
      lifecycle_statuses: ['active'],
    })
    const eligible: string[] = []
    for (const agentId of stewardAgentIds) {
      const assets = await this.deps.mediaAssetRepo.listByStewardAgentId(agentId, {
        lifecycle_statuses: ['active'],
      })
      if (assets.length === 0) continue
      const bindings = await this.deps.sceneMediaBindingRepo.findByAssetIds(assets.map((item) => item.id))
      const ownerSceneId = buildOwnerPrivatePoolSceneId(agentId)
      const hasOwnerPoolCandidate = assets.some((asset) =>
        asset.visibility_policy === 'public_original_allowed'
        && bindings.some((binding) =>
          binding.asset_id === asset.id
          && binding.scene_type === 'memory_card'
          && binding.scene_id === ownerSceneId),
      )
      if (!hasOwnerPoolCandidate) continue
      eligible.push(agentId)
      if (eligible.length >= limit) break
    }
    return eligible
  }

  async planScheduledPost(input: {
    agent_id: string
    directive: PersistedVisualDirective
  }): Promise<PersistedImagePlan> {
    const recentCommunityCount = input.directive.scene_ref.community_id
      ? (await this.deps.forumSceneMetadataRepo.listByCommunityIdSince(
          input.directive.scene_ref.community_id,
          new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        )).length
      : 0
    const recentEpisodeCount = input.directive.scene_ref.episode_id
      ? (await this.deps.forumSceneMetadataRepo.listByEpisodeId(input.directive.scene_ref.episode_id)).length
      : 0

    const candidates = await this.collectCandidates(input.agent_id, input.directive)
    const evaluated = await Promise.all(
      candidates.map(async (candidate) => {
        const governance = await this.deps.mediaReuseGovernanceService.evaluateCandidate({
          agent_id: input.agent_id,
          directive: input.directive,
          source_kind: candidate.source_kind,
          asset: candidate.asset,
          binding: candidate.binding,
          projection: candidate.projection,
          community_id: input.directive.scene_ref.community_id ?? null,
        })
        return {
          candidate,
          score: scoreCandidate(candidate, input.directive, {
            recentCommunityCount,
            recentEpisodeCount,
            allowedReuseModes: governance.allowed_reuse_modes,
          }),
          allowed_reuse_modes: governance.allowed_reuse_modes,
          policy_ref: {
            policy_id: governance.policy.id,
            subject_type: governance.policy.subject_type,
            subject_id: governance.policy.subject_id,
            status: governance.policy.status,
          },
          policy_reason: governance.policy_reason,
          rejection_reason: governance.rejection_reason,
        } satisfies EvaluatedCandidate
      }),
    )

    const ranked = evaluated
      .sort((left, right) => {
        const byScore = right.score.total - left.score.total
        if (byScore !== 0) return byScore
        return sourcePriority(input.directive, left.candidate.source_kind) - sourcePriority(input.directive, right.candidate.source_kind)
      })
    const thresholds = resolveSelectionThresholds(input.directive)

    const quoteCandidate = ranked.find((item) =>
      !item.rejection_reason
      && item.allowed_reuse_modes.includes('quote_original')
      && item.score.total >= thresholds.quote_original) ?? null
    const deriveCandidate = ranked.find((item) =>
      !item.rejection_reason
      && item.allowed_reuse_modes.includes('derive_new')
      && item.score.total >= thresholds.derive_new) ?? null
    const referenceCandidate = ranked.find((item) =>
      !item.rejection_reason
      && item.allowed_reuse_modes.includes('reference_only')
      && item.score.total >= thresholds.reference_only) ?? null

    if (quoteCandidate) {
      const cardResult = await this.buildRuntimeCard({
        candidate: quoteCandidate.candidate,
        directive: input.directive,
        reuse_mode: 'quote_original',
        original_display_allowed: true,
        cross_agent_quote_allowed: quoteCandidate.policy_ref.status === 'active'
          && quoteCandidate.allowed_reuse_modes.includes('quote_original'),
        disclose_origin_policy: quoteCandidate.policy_reason.includes('asset_policy')
          ? defaultDisclosePolicy(quoteCandidate.candidate.source_kind)
          : 'public_only',
        score: quoteCandidate.score,
      })
      const attachment = buildDisplayAttachment(
        quoteCandidate.candidate,
        input.directive.narrative_context.aspect_ratio_hint,
        cardResult.card,
        'original',
      )
      return this.deps.imagePlanRepo.create({
        directive_id: input.directive.id,
        scene_ref: input.directive.scene_ref,
        status: 'ready',
        decision: 'reuse_public_original',
        reason: `selected_${quoteCandidate.candidate.source_kind}_for_public_original_display`,
        runtime: {
          enabled: true,
          influence_level: input.directive.goal.runtime_influence,
          cards: [cardResult.card],
        },
        display: {
          enabled: true,
          attachments: [attachment],
        },
        generation: {
          mode: 'none',
          status: 'not_requested',
        },
        selected_sources: ranked.map((item) =>
          item.candidate === quoteCandidate.candidate
            ? toSelectedSource(item, {
                selected: true,
                reuse_mode: 'quote_original',
                projection_id: cardResult.projection.id,
                card_id: cardResult.card.card_id,
                rejection_reason: null,
              })
            : toSelectedSource(item, {
                selected: false,
                reuse_mode: item.allowed_reuse_modes[0] ?? null,
                rejection_reason: item.rejection_reason ?? 'ranked_below_best_candidate',
              })),
        planner_audit: {
          evaluated_candidates: ranked.length,
          score_breakdown: quoteCandidate.score,
          fallback_action: null,
        },
      })
    }

    const allowGeneration = input.directive.sourcing_policy.allow_generation
      && input.directive.budget.generation_tier !== 'none'
      && input.directive.budget.max_generation_attempts > 0
      && (input.directive.budget.sync_generation_ms_budget > 0 || input.directive.budget.async_generation_allowed)
      && input.directive.guardrails.safe_mode !== true
    if (deriveCandidate && allowGeneration) {
      const deriveFromPrivate = isPrivateGenerationSource(deriveCandidate.candidate.source_kind)
      if (deriveFromPrivate && !input.directive.sourcing_policy.allow_private_inspired_generation) {
        return this.planReferenceOrFallback({
          ranked,
          referenceCandidate,
          directive: input.directive,
        })
      }
      const cardResult = await this.buildRuntimeCard({
        candidate: deriveCandidate.candidate,
        directive: input.directive,
        reuse_mode: 'derive_new',
        original_display_allowed: false,
        cross_agent_quote_allowed: false,
        disclose_origin_policy: defaultDisclosePolicy(deriveCandidate.candidate.source_kind),
        score: deriveCandidate.score,
      })
      const promptBrief = buildGenerationPromptBrief({
        directive: input.directive,
        candidate: deriveCandidate.candidate,
        card: cardResult.card,
      })
      const requestFingerprint = buildGenerationFingerprint({
        agent_id: input.agent_id,
        prompt_brief: promptBrief,
        aspect_ratio_hint: input.directive.narrative_context.aspect_ratio_hint ?? null,
        input_mode: 'reference',
        projection_id: cardResult.projection.id,
      })
      const decision: ImageDecision = deriveCandidate.candidate.source_kind === 'owner_private_pool'
        || deriveCandidate.candidate.source_kind === 'private_runtime_projection'
        ? 'generate_from_private_projection'
        : 'generate_from_public_reference'

      return this.deps.imagePlanRepo.create({
        directive_id: input.directive.id,
        scene_ref: input.directive.scene_ref,
        status: 'pending_generation',
        decision,
        reason: `selected_${deriveCandidate.candidate.source_kind}_for_generation`,
        runtime: {
          enabled: true,
          influence_level: input.directive.goal.runtime_influence,
          cards: [cardResult.card],
        },
        display: {
          enabled: false,
          attachments: [],
        },
        generation: {
          mode: input.directive.budget.sync_generation_ms_budget > 0 ? 'sync' : 'async',
          input_mode: 'reference',
          status: 'not_requested',
          provider: undefined,
          model_ref: undefined,
          request_fingerprint: requestFingerprint,
          aspect_ratio_hint: input.directive.narrative_context.aspect_ratio_hint ?? null,
          based_on_projection_ids: [cardResult.projection.id],
          prompt_brief: promptBrief,
          attempt_count: 0,
        },
        selected_sources: ranked.map((item) =>
          item.candidate === deriveCandidate.candidate
            ? toSelectedSource(item, {
                selected: true,
                reuse_mode: 'derive_new',
                projection_id: cardResult.projection.id,
                card_id: cardResult.card.card_id,
                rejection_reason: null,
              })
            : toSelectedSource(item, {
                selected: false,
                reuse_mode: item.allowed_reuse_modes[0] ?? null,
                rejection_reason: item.rejection_reason ?? 'ranked_below_best_candidate',
              })),
        planner_audit: {
          evaluated_candidates: ranked.length,
          score_breakdown: deriveCandidate.score,
          fallback_action: 'runtime_only_no_display',
        },
      })
    }

    if (allowGeneration && shouldUseScratchGeneration(input.directive, ranked, thresholds)) {
      return this.planScratchGeneration({
        agent_id: input.agent_id,
        ranked,
        directive: input.directive,
      })
    }

    return this.planReferenceOrFallback({
      ranked,
      referenceCandidate,
      directive: input.directive,
    })
  }

  private async planReferenceOrFallback(input: {
    ranked: EvaluatedCandidate[]
    referenceCandidate: EvaluatedCandidate | null
    directive: PersistedVisualDirective
  }): Promise<PersistedImagePlan> {
    if (input.referenceCandidate) {
      const cardResult = await this.buildRuntimeCard({
        candidate: input.referenceCandidate.candidate,
        directive: input.directive,
        reuse_mode: 'reference_only',
        original_display_allowed: false,
        cross_agent_quote_allowed: false,
        disclose_origin_policy: defaultDisclosePolicy(input.referenceCandidate.candidate.source_kind),
        score: input.referenceCandidate.score,
      })
      const decision: ImageDecision = input.referenceCandidate.candidate.source_kind === 'private_runtime_projection'
        ? 'reuse_private_projection_runtime_only'
        : 'reuse_public_projection'
      return this.deps.imagePlanRepo.create({
        directive_id: input.directive.id,
        scene_ref: input.directive.scene_ref,
        status: 'degraded',
        decision,
        reason: `selected_${input.referenceCandidate.candidate.source_kind}_for_runtime_only_projection`,
        runtime: {
          enabled: true,
          influence_level: input.directive.goal.runtime_influence,
          cards: [cardResult.card],
        },
        display: {
          enabled: false,
          attachments: [],
        },
        generation: {
          mode: 'none',
          status: 'not_requested',
        },
        selected_sources: input.ranked.map((item) =>
          item.candidate === input.referenceCandidate?.candidate
            ? toSelectedSource(item, {
                selected: true,
                reuse_mode: 'reference_only',
                projection_id: cardResult.projection.id,
                card_id: cardResult.card.card_id,
                rejection_reason: null,
              })
            : toSelectedSource(item, {
                selected: false,
                reuse_mode: item.allowed_reuse_modes[0] ?? null,
                rejection_reason: item.rejection_reason ?? 'ranked_below_best_candidate',
              })),
        planner_audit: {
          evaluated_candidates: input.ranked.length,
          score_breakdown: input.referenceCandidate.score,
          fallback_action: 'runtime_only_no_display',
        },
      })
    }

    const best = input.ranked[0] ?? null
    return this.deps.imagePlanRepo.create({
      directive_id: input.directive.id,
      scene_ref: input.directive.scene_ref,
      status: 'degraded',
      decision: 'none',
      reason: best ? 'candidate_score_below_threshold' : 'no_candidate_available',
      runtime: {
        enabled: false,
        influence_level: 'none',
        cards: [],
      },
      display: {
        enabled: false,
        attachments: [],
      },
      generation: {
        mode: 'none',
        status: 'not_requested',
      },
      selected_sources: input.ranked.map((item) =>
        toSelectedSource(item, {
          selected: false,
          reuse_mode: item.allowed_reuse_modes[0] ?? null,
          rejection_reason: item.rejection_reason ?? 'ranked_below_threshold',
        })),
      planner_audit: {
        evaluated_candidates: input.ranked.length,
        score_breakdown: best?.score ?? zeroScoreBreakdown(),
        fallback_action: 'text_only',
      },
    })
  }

  private async collectCandidates(
    agentId: string,
    directive: PersistedVisualDirective,
  ): Promise<PlannerCandidate[]> {
    const ownAssets = await this.deps.mediaAssetRepo.listByStewardAgentId(agentId, {
      lifecycle_statuses: ['active'],
    })
    const ownBindings = await this.deps.sceneMediaBindingRepo.findByAssetIds(ownAssets.map((item) => item.id))
    const assetById = new Map<string, MediaAsset | null>(ownAssets.map((asset) => [asset.id, asset]))
    const snapshotByAssetId = new Map<string, MediaSemanticSnapshot | null>()
    const candidates: PlannerCandidate[] = []
    const safeMode = directive.guardrails.safe_mode === true

    const getAsset = async (assetId: string): Promise<MediaAsset | null> => {
      if (assetById.has(assetId)) {
        return assetById.get(assetId) ?? null
      }
      const asset = await this.deps.mediaAssetRepo.findById(assetId)
      assetById.set(assetId, asset)
      return asset
    }

    const getSnapshot = async (assetId: string): Promise<MediaSemanticSnapshot | null> => {
      if (snapshotByAssetId.has(assetId)) {
        return snapshotByAssetId.get(assetId) ?? null
      }
      const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(assetId)
      snapshotByAssetId.set(assetId, snapshot)
      return snapshot
    }

    const addAssetCandidate = async (input: {
      source_kind: VisualSourceKind
      binding: SceneMediaBinding
      continuity_ref?: PlannerCandidate['continuity_ref']
    }): Promise<void> => {
      const asset = await getAsset(input.binding.asset_id)
      const snapshot = asset ? await getSnapshot(asset.id) : null
      if (!asset || !snapshot || asset.visibility_policy === 'blocked') return
      if (shouldBlockCandidateForDirective({
        directive,
        source_kind: input.source_kind,
        asset,
      })) return
      candidates.push({
        source_kind: input.source_kind,
        asset,
        snapshot,
        binding: input.binding,
        projection: null,
        continuity_ref: input.continuity_ref ?? buildContinuityRef(input.binding),
        summary: {
          theme: snapshot.summary.theme,
          scene: snapshot.summary.scene,
          mood: snapshot.summary.mood,
          public_safe_caption: snapshot.summary.public_safe_summary,
          alt_text: snapshot.summary.public_safe_summary,
          salient_entities: snapshot.summary.salient_entities.slice(0, 5),
          discussion_points: snapshot.summary.discussion_points.slice(0, 5),
        },
      })
    }

    const addPoolCandidates = async (
      poolSceneIds: string[],
      sourceKind: VisualSourceKind,
    ): Promise<void> => {
      if (poolSceneIds.length === 0) return
      const bindings = await this.deps.sceneMediaBindingRepo.findByScenes('media_pool', poolSceneIds)
      for (const binding of bindings) {
        await addAssetCandidate({
          source_kind: sourceKind,
          binding,
        })
      }
    }

    for (const sourceKind of directive.sourcing_policy.allow_sources) {
      switch (sourceKind) {
        case 'self_public_archive': {
          const publicBindingsByAsset = new Map<string, SceneMediaBinding>()
          const archivePoolBindings = await this.deps.sceneMediaBindingRepo.findByScene(
            'media_pool',
            buildSelfPublicArchivePoolSceneId(agentId),
          )
          for (const binding of archivePoolBindings) {
            if (!publicBindingsByAsset.has(binding.asset_id)) {
              publicBindingsByAsset.set(binding.asset_id, binding)
            }
          }
          for (const binding of ownBindings) {
            if (!isLegacySelfPublicArchiveBinding(binding)) continue
            if (!publicBindingsByAsset.has(binding.asset_id)) {
              publicBindingsByAsset.set(binding.asset_id, binding)
            }
          }
          for (const binding of publicBindingsByAsset.values()) {
            await addAssetCandidate({
              source_kind: 'self_public_archive',
              binding,
            })
          }
          break
        }
        case 'owner_private_pool': {
          if (safeMode) break
          const ownerSceneId = buildOwnerPrivatePoolSceneId(agentId)
          for (const binding of ownBindings) {
            if (binding.scene_type !== 'memory_card' || binding.scene_id !== ownerSceneId) continue
            await addAssetCandidate({
              source_kind: 'owner_private_pool',
              binding,
            })
          }
          break
        }
        case 'same_episode_public': {
          if (!directive.scene_ref.episode_id) break
          const episodeMetadata = await this.deps.forumSceneMetadataRepo.listByEpisodeId(directive.scene_ref.episode_id)
          const episodePostIds = Array.from(new Set(
            episodeMetadata
              .filter((item) => item.target_type === 'POST' && item.post_id)
              .map((item) => item.post_id as string),
          ))
          const episodeBindings = await this.deps.sceneMediaBindingRepo.findByScenes('forum_post', episodePostIds)
          for (const binding of episodeBindings) {
            if (!isLegacySelfPublicArchiveBinding(binding)) continue
            const asset = await getAsset(binding.asset_id)
            if (!asset || asset.visibility_policy === 'blocked') continue
            if (!directive.sourcing_policy.allow_cross_agent_public && asset.steward_agent_id !== agentId) continue
            const snapshot = await getSnapshot(asset.id)
            if (!snapshot) continue
            candidates.push({
              source_kind: 'same_episode_public',
              asset,
              snapshot,
              binding,
              projection: null,
              continuity_ref: {
                episode_id: directive.scene_ref.episode_id,
                thread_post_id: readForumPostIdFromThreadRootRef(binding.thread_root_ref) ?? binding.scene_id,
                thread_root_ref: binding.thread_root_ref,
              },
              summary: {
                theme: snapshot.summary.theme,
                scene: snapshot.summary.scene,
                mood: snapshot.summary.mood,
                public_safe_caption: snapshot.summary.public_safe_summary,
                alt_text: snapshot.summary.public_safe_summary,
                salient_entities: snapshot.summary.salient_entities.slice(0, 5),
                discussion_points: snapshot.summary.discussion_points.slice(0, 5),
              },
            })
          }
          break
        }
        case 'community_commons':
          await addPoolCandidates(
            directive.scene_ref.community_id
              ? [buildCommunityCommonsPoolSceneId(directive.scene_ref.community_id)]
              : [],
            'community_commons',
          )
          break
        case 'platform_canonical':
          await addPoolCandidates([buildPlatformCanonicalPoolSceneId()], 'platform_canonical')
          break
        case 'generated_public':
          await addPoolCandidates([buildGeneratedPublicPoolSceneId(agentId)], 'generated_public')
          break
        case 'private_runtime_projection': {
          if (!directive.sourcing_policy.allow_private_runtime_projection || safeMode) break
          const privateBindings = ownBindings.filter((binding) => binding.scene_type === 'private_message')
          const projections = await this.deps.mediaContextProjectionRepo.findByBindingIds(
            privateBindings.map((binding) => binding.id),
          )
          for (const projection of projections) {
            if (
              projection.projection_surface !== 'planner'
              || projection.projection_kind !== 'public_reuse_handoff'
            ) {
              continue
            }
            const payload = projection.payload_json as unknown as PublicReuseHandoffCard
            const binding = privateBindings.find((item) => item.id === projection.binding_id) ?? null
            const asset = payload.asset_ref.asset_id
              ? await getAsset(payload.asset_ref.asset_id)
              : null
            if (asset && shouldBlockCandidateForDirective({
              directive,
              source_kind: 'private_runtime_projection',
              asset,
            })) {
              continue
            }
            candidates.push({
              source_kind: 'private_runtime_projection',
              asset,
              snapshot: null,
              binding,
              projection,
              why_relevant_hint: payload.relation.why_relevant_hint,
              continuity_ref: binding ? buildContinuityRef(binding) : undefined,
              summary: {
                theme: payload.public_summary.theme,
                scene: payload.public_summary.scene,
                mood: payload.public_summary.mood,
                public_safe_caption: payload.public_summary.public_safe_caption,
                alt_text: payload.public_summary.alt_text,
                salient_entities: payload.public_summary.salient_entities.slice(0, 5),
                discussion_points: payload.public_summary.discussion_points.slice(0, 5),
              },
            })
          }
          break
        }
        case 'same_thread_public': {
          if (!directive.scene_ref.thread_root_ref) break
          const threadBindings = await this.deps.sceneMediaBindingRepo.findByThreadRootRef(
            directive.scene_ref.thread_root_ref,
            {
              limit: MAX_SAME_THREAD_PUBLIC_BINDINGS,
            },
          )
          for (const binding of threadBindings) {
            if (!isSameThreadPublicBinding(binding, directive)) continue
            await addAssetCandidate({
              source_kind: 'same_thread_public',
              binding,
            })
          }
          break
        }
        case 'private_derived_public':
          if (safeMode) break
          await addPoolCandidates([buildPrivateDerivedPublicPoolSceneId(agentId)], 'private_derived_public')
          break
      }
    }

    return dedupeCandidates(candidates)
  }

  private async planScratchGeneration(input: {
    agent_id: string
    ranked: EvaluatedCandidate[]
    directive: PersistedVisualDirective
  }): Promise<PersistedImagePlan> {
    const promptBrief = buildScratchGenerationPromptBrief({
      directive: input.directive,
    })
    const requestFingerprint = buildGenerationFingerprint({
      agent_id: input.agent_id,
      prompt_brief: promptBrief,
      aspect_ratio_hint: input.directive.narrative_context.aspect_ratio_hint ?? null,
      input_mode: 'scratch',
    })

    return this.deps.imagePlanRepo.create({
      directive_id: input.directive.id,
      scene_ref: input.directive.scene_ref,
      status: 'pending_generation',
      decision: 'generate_from_scratch',
      reason: 'no_candidate_meets_generation_threshold',
      runtime: {
        enabled: false,
        influence_level: input.directive.goal.runtime_influence,
        cards: [],
      },
      display: {
        enabled: false,
        attachments: [],
      },
      generation: {
        mode: input.directive.budget.sync_generation_ms_budget > 0 ? 'sync' : 'async',
        input_mode: 'scratch',
        status: 'not_requested',
        provider: undefined,
        model_ref: undefined,
        request_fingerprint: requestFingerprint,
        aspect_ratio_hint: input.directive.narrative_context.aspect_ratio_hint ?? null,
        based_on_projection_ids: [],
        prompt_brief: promptBrief,
        attempt_count: 0,
      },
      selected_sources: input.ranked.map((item) =>
        toSelectedSource(item, {
          selected: false,
          reuse_mode: item.allowed_reuse_modes[0] ?? null,
          rejection_reason: item.rejection_reason ?? 'ranked_below_generation_threshold',
        })),
      planner_audit: {
        evaluated_candidates: input.ranked.length,
        score_breakdown: input.ranked[0]?.score ?? zeroScoreBreakdown(),
        fallback_action: 'runtime_only_no_display',
      },
    })
  }

  private async buildRuntimeCard(input: {
    candidate: PlannerCandidate
    directive: PersistedVisualDirective
    reuse_mode: MediaReuseMode
    original_display_allowed: boolean
    cross_agent_quote_allowed: boolean
    disclose_origin_policy: PublicMediaContextCard['governance']['disclose_origin_policy']
    score: PlannerScoreBreakdown
  }): Promise<{ projection: MediaContextProjection; card: PublicMediaContextCard }> {
    const promptWeight = input.directive.goal.runtime_influence === 'light'
      ? 'secondary'
      : input.directive.goal.runtime_influence === 'none'
        ? 'accent'
        : 'primary'

    if (
      input.candidate.source_kind === 'private_runtime_projection'
      && input.candidate.projection?.projection_kind === 'public_reuse_handoff'
    ) {
      const payload = input.candidate.projection.payload_json as unknown as PublicReuseHandoffCard
      return {
        projection: input.candidate.projection,
        card: {
          schema_version: 'public-media-context-card.v1',
          card_id: payload.handoff_id,
          modality: 'image',
          asset_ref: payload.asset_ref,
          source: {
            kind: input.candidate.source_kind,
            derived_from_private: true,
            ...(input.candidate.continuity_ref ? { continuity_ref: input.candidate.continuity_ref } : {}),
          },
          relation: {
            visual_role: input.directive.goal.visual_role,
            prompt_weight: promptWeight,
            mention_policy: input.directive.guardrails.mention_policy,
            why_now: payload.relation.why_relevant_hint,
          },
          public_summary: {
            theme: payload.public_summary.theme,
            scene: payload.public_summary.scene,
            mood: payload.public_summary.mood,
            salient_entities: payload.public_summary.salient_entities.slice(0, 5),
            discussion_points: payload.public_summary.discussion_points.slice(0, 5),
            public_safe_caption: payload.public_summary.public_safe_caption,
            alt_text: payload.public_summary.alt_text,
            ...(payload.public_summary.ocr_snippets?.length
              ? { ocr_snippets: payload.public_summary.ocr_snippets.slice(0, 3) }
              : {}),
          },
          display: {
            original_display_allowed: false,
            derivative_display_allowed: true,
            preferred_variant: input.reuse_mode === 'derive_new' ? 'derivative' : 'none',
          },
          governance: {
            public_scope: resolvePublicScope(input.candidate.source_kind),
            disclose_origin_policy: payload.governance.disclose_origin_policy,
            cross_agent_quote_allowed: false,
            prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
            expires_at: input.candidate.projection.expires_at?.toISOString() ?? null,
          },
          audit: {
            confidence: clamp(input.score.total / 6, 0, 1),
            relevance_score: clamp(input.score.relevance, 0, 1),
            model_version: 't121-private-runtime-handoff-card.v1',
          },
        },
      }
    }

    const asset = input.candidate.asset
    const snapshot = input.candidate.snapshot
    const binding = input.candidate.binding
    if (!asset || !snapshot || !binding) {
      throw new Error('selected asset candidate is missing binding or snapshot')
    }
    return this.deps.mediaProjectionService.ensurePublicMediaCard({
      binding,
      asset,
      snapshot,
      source_kind: input.candidate.source_kind,
      derived_from_private: isPrivateOriginCandidate(input.candidate),
      continuity_ref: input.candidate.continuity_ref,
      visual_role: input.directive.goal.visual_role,
      prompt_weight: promptWeight,
      mention_policy: input.directive.guardrails.mention_policy,
      why_now: buildWhyNow(input.candidate, input.directive, input.reuse_mode),
      public_scope: resolvePublicScope(input.candidate.source_kind),
      disclose_origin_policy: input.disclose_origin_policy,
      cross_agent_quote_allowed: input.cross_agent_quote_allowed,
      original_display_allowed: input.original_display_allowed,
      derivative_display_allowed: true,
      preferred_variant: input.original_display_allowed
        ? 'original'
        : input.reuse_mode === 'derive_new'
          ? 'derivative'
          : 'none',
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      confidence: clamp(input.score.total / 6, 0, 1),
      relevance_score: clamp(input.score.relevance, 0, 1),
    })
  }
}

function resolveSelectionThresholds(
  directive: PersistedVisualDirective,
): {
  quote_original: number
  derive_new: number
  reference_only: number
} {
  if (directive.goal.need_image === 'avoid') {
    return {
      quote_original: 2.95,
      derive_new: 2.7,
      reference_only: 2.55,
    }
  }

  if (directive.goal.need_image === 'required') {
    return {
      quote_original: 2.45,
      derive_new: 2.1,
      reference_only: 1.95,
    }
  }

  return {
    quote_original: 2.6,
    derive_new: 2.25,
    reference_only: 2.1,
  }
}

function isLegacySelfPublicArchiveBinding(binding: SceneMediaBinding): boolean {
  return binding.scene_type === 'forum_post'
    && binding.display_policy !== 'runtime_only_no_display'
}

function isSameThreadPublicBinding(
  binding: SceneMediaBinding,
  directive: PersistedVisualDirective,
): boolean {
  if (!binding.thread_root_ref || binding.thread_root_ref !== directive.scene_ref.thread_root_ref) {
    return false
  }
  if (binding.display_policy === 'runtime_only_no_display') return false
  if (binding.scene_type === 'private_message' || binding.scene_type === 'memory_card' || binding.scene_type === 'media_pool') {
    return false
  }
  const currentSceneId = directive.scene_ref.post_id
    ?? directive.scene_ref.comment_id
    ?? directive.scene_ref.message_id
    ?? null
  return !(binding.scene_type === directive.scene_ref.actor_surface && currentSceneId && binding.scene_id === currentSceneId)
}

function buildContinuityRef(binding: SceneMediaBinding): PlannerCandidate['continuity_ref'] {
  return {
    thread_post_id: readForumPostIdFromThreadRootRef(binding.thread_root_ref),
    thread_root_ref: binding.thread_root_ref,
  }
}

function shouldBlockCandidateForDirective(input: {
  directive: PersistedVisualDirective
  source_kind: VisualSourceKind
  asset: MediaAsset
}): boolean {
  if (input.directive.guardrails.safe_mode === true) {
    if (
      input.source_kind === 'owner_private_pool'
      || input.source_kind === 'private_runtime_projection'
      || input.source_kind === 'private_derived_public'
    ) {
      return true
    }
    if (isPrivateOriginAsset(input.asset)) {
      return true
    }
  }
  if (
    input.source_kind === 'private_runtime_projection'
    && !input.directive.sourcing_policy.allow_private_runtime_projection
  ) {
    return true
  }
  return false
}

function isPrivateOriginCandidate(candidate: PlannerCandidate): boolean {
  return candidate.source_kind === 'owner_private_pool'
    || candidate.source_kind === 'private_runtime_projection'
    || candidate.source_kind === 'private_derived_public'
    || (candidate.asset ? isPrivateOriginAsset(candidate.asset) : false)
}

function isPrivateGenerationSource(sourceKind: VisualSourceKind): boolean {
  return sourceKind === 'owner_private_pool' || sourceKind === 'private_runtime_projection'
}

function dedupeCandidates(candidates: PlannerCandidate[]): PlannerCandidate[] {
  const seen = new Set<string>()
  const out: PlannerCandidate[] = []
  for (const candidate of candidates) {
    const key = `${candidate.source_kind}:${candidate.projection?.id ?? candidate.asset?.id ?? candidate.binding?.id ?? 'unknown'}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(candidate)
  }
  return out
}

function scoreCandidate(
  candidate: PlannerCandidate,
  directive: PersistedVisualDirective,
  context: {
    recentCommunityCount: number
    recentEpisodeCount: number
    allowedReuseModes: MediaReuseMode[]
  },
): PlannerScoreBreakdown {
  const relevanceSignals = [
    directive.narrative_context.semantic_query,
    ...(directive.narrative_context.required_elements ?? []),
    candidate.summary.theme,
    candidate.summary.scene,
    candidate.summary.public_safe_caption,
  ].filter((item) => item.trim().length > 0)
  const relevance = clamp(0.45 + overlapRatio(relevanceSignals), 0, 1)
  const continuity = candidate.source_kind === 'same_episode_public'
    ? 1
    : candidate.source_kind === 'same_thread_public'
      ? 1
    : candidate.source_kind === 'self_public_archive'
      ? 0.8
      : candidate.source_kind === 'owner_private_pool'
        ? 0.65
        : candidate.source_kind === 'private_runtime_projection'
          ? 0.7
          : 0.55
  const novelty = candidate.binding?.scene_type === 'memory_card' || candidate.source_kind === 'private_runtime_projection'
    ? 0.95
    : 0.65
  const privacySafety = candidate.source_kind === 'private_runtime_projection'
    ? 1
    : candidate.source_kind === 'owner_private_pool'
      ? 0.8
      : 0.95
  const displayFitness = context.allowedReuseModes.includes('quote_original')
    ? 1
    : context.allowedReuseModes.includes('derive_new')
      ? 0.8
      : 0.4
  const costFitness = context.allowedReuseModes.includes('quote_original')
    ? 1
    : context.allowedReuseModes.includes('reference_only')
      ? 0.85
      : 0.65
  const fatiguePenalty = candidate.source_kind === 'same_episode_public' && context.recentEpisodeCount >= 3
    ? 0.18
    : candidate.source_kind === 'community_commons' && context.recentCommunityCount >= 6
      ? 0.12
      : 0
  const repeatPenalty = candidate.binding?.scene_type === 'forum_post' ? 0.18 : 0
  const riskPenalty = context.allowedReuseModes.length === 0 ? 1 : 0
  const total = relevance
    + continuity
    + novelty
    + privacySafety
    + displayFitness
    + costFitness
    - fatiguePenalty
    - repeatPenalty
    - riskPenalty

  return {
    relevance: round2(relevance),
    continuity: round2(continuity),
    novelty: round2(novelty),
    privacy_safety: round2(privacySafety),
    display_fitness: round2(displayFitness),
    cost_fitness: round2(costFitness),
    fatigue_penalty: round2(fatiguePenalty),
    repeat_penalty: round2(repeatPenalty),
    risk_penalty: round2(riskPenalty),
    total: round2(total),
  }
}

function overlapRatio(signals: string[]): number {
  if (signals.length < 2) return 0.25
  const normalized = signals.map((item) => item.toLowerCase())
  let hits = 0
  for (const source of normalized.slice(0, 3)) {
    if (normalized.slice(3).some((target) => target.includes(source) || source.includes(target))) {
      hits += 1
    }
  }
  return Math.min(0.5, hits * 0.12)
}

function sourcePriority(directive: PersistedVisualDirective, sourceKind: VisualSourceKind): number {
  const idx = directive.sourcing_policy.prefer_order.indexOf(sourceKind)
  return idx >= 0 ? idx : directive.sourcing_policy.prefer_order.length
}

function shouldUseScratchGeneration(
  directive: PersistedVisualDirective,
  ranked: EvaluatedCandidate[],
  thresholds: ReturnType<typeof resolveSelectionThresholds>,
): boolean {
  if (directive.guardrails.safe_mode === true) return false
  if (directive.goal.need_image === 'avoid') return false
  if (ranked.length === 0) return true
  return !ranked.some((item) =>
    !item.rejection_reason
    && (
      (item.allowed_reuse_modes.includes('quote_original') && item.score.total >= thresholds.quote_original)
      || (item.allowed_reuse_modes.includes('derive_new') && item.score.total >= thresholds.derive_new)
      || (item.allowed_reuse_modes.includes('reference_only') && item.score.total >= thresholds.reference_only)
    ))
}

function buildWhyNow(
  candidate: PlannerCandidate,
  directive: PersistedVisualDirective,
  reuseMode: MediaReuseMode,
): string {
  const phaseReason = directive.scene_ref.phase === 'opening'
    ? '用于开场建立场景和阅读锚点'
    : '用于补足当前讨论的可见线索'
  if (candidate.why_relevant_hint) {
    return candidate.why_relevant_hint
  }
  switch (candidate.source_kind) {
    case 'same_episode_public':
      return `${phaseReason}，并延续同一 episode 的公开视觉连续性。`
    case 'self_public_archive':
      return `${phaseReason}，优先复用当前 agent 已公开过的视觉资产。`
    case 'owner_private_pool':
      return reuseMode === 'quote_original'
        ? `${phaseReason}，保持同 agent 私域素材的公开兼容。`
        : `${phaseReason}，但只提炼 public-safe 视觉线索，不解释素材来源。`
    case 'private_runtime_projection':
      return `${phaseReason}，只消费 public-safe handoff，不暴露私聊原图。`
    case 'private_derived_public':
      return `${phaseReason}，优先复用已公开的私域衍生视觉，不回指原始私聊素材。`
    default:
      return phaseReason
  }
}

function defaultDisclosePolicy(sourceKind: VisualSourceKind): PublicMediaContextCard['governance']['disclose_origin_policy'] {
  switch (sourceKind) {
    case 'owner_private_pool':
    case 'private_runtime_projection':
    case 'private_derived_public':
      return 'never'
    case 'same_episode_public':
      return 'episode_only'
    default:
      return 'public_only'
  }
}

function resolvePublicScope(sourceKind: VisualSourceKind): PublicScope {
  switch (sourceKind) {
    case 'same_thread_public':
      return 'thread_only'
    case 'same_episode_public':
      return 'episode_only'
    case 'owner_private_pool':
    case 'private_runtime_projection':
    case 'private_derived_public':
      return 'community_public'
    default:
      return 'global_public'
  }
}

function buildDisplayAttachment(
  candidate: PlannerCandidate,
  aspectRatioHint: AspectRatioHint | null | undefined,
  card: PublicMediaContextCard,
  displayVariant: PlannedDisplayAttachment['display_variant'],
  generatedAssetId?: string | null,
): PlannedDisplayAttachment {
  const assetId = generatedAssetId ?? card.asset_ref.asset_id
  const mimeType = generatedAssetId ? 'image/png' : (candidate.asset?.mime_type ?? 'image/png')
  return {
    slot: 0,
    binding_role: 'primary',
    asset_id: assetId,
    mime_type: mimeType,
    display_variant: displayVariant,
    derived_from_asset_id: generatedAssetId ? candidate.asset?.id ?? null : null,
    aspect_ratio_hint: aspectRatioHint ?? undefined,
    public_caption: card.public_summary.public_safe_caption,
    alt_text: card.public_summary.alt_text,
    attach_after_persist: true,
  }
}

function toSelectedSource(
  evaluated: EvaluatedCandidate,
  input: {
    selected: boolean
    reuse_mode: MediaReuseMode | null
    projection_id?: string
    card_id?: string
    rejection_reason: string | null
  },
): ImagePlanSource {
  return {
    source_kind: evaluated.candidate.source_kind,
    asset_id: evaluated.candidate.asset?.id,
    semantic_snapshot_id: evaluated.candidate.snapshot?.id,
    projection_id: input.projection_id ?? evaluated.candidate.projection?.id,
    card_id: input.card_id,
    reuse_mode: input.reuse_mode,
    policy_ref: evaluated.policy_ref,
    policy_reason: evaluated.policy_reason,
    score_breakdown: evaluated.score,
    selection_score: evaluated.score.total,
    rejection_reason: input.selected ? null : input.rejection_reason,
  }
}

function buildGenerationPromptBrief(input: {
  directive: PersistedVisualDirective
  candidate: PlannerCandidate
  card: PublicMediaContextCard
}): string {
  const lines = [
    `visual_role=${input.directive.goal.visual_role}`,
    `human_goal=${input.directive.goal.human_goal}`,
    `hook=${input.directive.narrative_context.hook}`,
    `objective=${input.directive.narrative_context.objective}`,
    `tone=${input.directive.narrative_context.tone_hint}`,
    `theme=${input.card.public_summary.theme}`,
    `scene=${input.card.public_summary.scene}`,
    `mood=${input.card.public_summary.mood}`,
    `caption=${input.card.public_summary.public_safe_caption}`,
    input.card.public_summary.salient_entities.length > 0
      ? `salient_entities=${input.card.public_summary.salient_entities.join(', ')}`
      : null,
    input.card.public_summary.discussion_points.length > 0
      ? `discussion_points=${input.card.public_summary.discussion_points.join(' | ')}`
      : null,
    input.directive.narrative_context.style_hint
      ? `style_hint=${input.directive.narrative_context.style_hint}`
      : null,
    input.directive.narrative_context.aspect_ratio_hint
      ? `aspect_ratio=${input.directive.narrative_context.aspect_ratio_hint}`
      : null,
    input.candidate.source_kind === 'owner_private_pool' || input.candidate.source_kind === 'private_runtime_projection'
      ? 'privacy_guard=derive_public_safe_scene_only'
      : null,
  ]
  return lines.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join('\n')
}

function buildScratchGenerationPromptBrief(input: {
  directive: PersistedVisualDirective
}): string {
  const lines = [
    `visual_role=${input.directive.goal.visual_role}`,
    `human_goal=${input.directive.goal.human_goal}`,
    `hook=${input.directive.narrative_context.hook}`,
    `objective=${input.directive.narrative_context.objective}`,
    `tone=${input.directive.narrative_context.tone_hint}`,
    `semantic_query=${input.directive.narrative_context.semantic_query}`,
    input.directive.narrative_context.required_elements?.length
      ? `required_elements=${input.directive.narrative_context.required_elements.join(', ')}`
      : null,
    input.directive.narrative_context.forbidden_elements?.length
      ? `forbidden_elements=${input.directive.narrative_context.forbidden_elements.join(', ')}`
      : null,
    input.directive.narrative_context.style_hint
      ? `style_hint=${input.directive.narrative_context.style_hint}`
      : null,
    input.directive.narrative_context.aspect_ratio_hint
      ? `aspect_ratio=${input.directive.narrative_context.aspect_ratio_hint}`
      : null,
    'privacy_guard=public_only_no_private_origin_reference',
  ]
  return lines.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join('\n')
}

function buildGenerationFingerprint(input: {
  agent_id: string
  prompt_brief: string
  aspect_ratio_hint: AspectRatioHint | null
  input_mode: 'reference' | 'scratch'
  projection_id?: string
}): string {
  return [
    input.agent_id,
    input.input_mode,
    input.aspect_ratio_hint ?? '4:5',
    input.projection_id ?? 'scratch',
    input.prompt_brief.trim(),
  ].join('|')
}

function zeroScoreBreakdown(): PlannerScoreBreakdown {
  return {
    relevance: 0,
    continuity: 0,
    novelty: 0,
    privacy_safety: 0,
    display_fitness: 0,
    cost_fitness: 0,
    fatigue_penalty: 0,
    repeat_penalty: 0,
    risk_penalty: 0,
    total: 0,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
