import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { ImagePlanRepository } from '../repos/image-plan-repository.js'
import type { MediaProjectionService } from './media-projection-service.js'
import type {
  AspectRatioHint,
  ImageDecision,
  ImagePlanSource,
  MediaAsset,
  MediaSemanticSnapshot,
  PersistedImagePlan,
  PersistedVisualDirective,
  PlannedDisplayAttachment,
  PublicMediaContextCard,
  PublicScope,
  SceneMediaBinding,
  VisualSourceKind,
} from '../repos/types.js'
import { buildOwnerPrivatePoolSceneId } from './media-binding-service.js'

interface PlannerCandidate {
  source_kind: VisualSourceKind
  asset: MediaAsset
  snapshot: MediaSemanticSnapshot
  binding: SceneMediaBinding
  continuity_ref?: {
    episode_id?: string | null
    thread_post_id?: string | null
  }
}

interface ScoreBreakdown {
  relevance: number
  continuity: number
  novelty: number
  privacy_safety: number
  display_fitness: number
  cost_fitness: number
  fatigue_penalty: number
  repeat_penalty: number
  risk_penalty: number
  total: number
}

export interface ImagePlannerServiceDeps {
  imagePlanRepo: ImagePlanRepository
  mediaAssetRepo: MediaAssetRepository
  mediaSemanticSnapshotRepo: MediaSemanticSnapshotRepository
  sceneMediaBindingRepo: SceneMediaBindingRepository
  forumSceneMetadataRepo: ForumSceneMetadataRepository
  mediaProjectionService: MediaProjectionService
}

export class ImagePlannerService {
  constructor(private readonly deps: ImagePlannerServiceDeps) {}

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
        asset.visibility_policy !== 'blocked'
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
    const candidates = await this.collectCandidates(input.agent_id, input.directive)
    const ranked = candidates
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(candidate),
      }))
      .sort((left, right) => {
        const byScore = right.score.total - left.score.total
        if (byScore !== 0) return byScore
        return sourcePriority(input.directive, left.candidate.source_kind) - sourcePriority(input.directive, right.candidate.source_kind)
      })

    const best = ranked[0] ?? null
    if (!best || best.score.total < 2.4) {
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
        selected_sources: ranked.map(({ candidate, score }) => toSelectedSource(candidate, score, false, 'ranked_below_threshold')),
        planner_audit: {
          evaluated_candidates: ranked.length,
          score_breakdown: {
            relevance: best?.score.relevance ?? 0,
            continuity: best?.score.continuity ?? 0,
            novelty: best?.score.novelty ?? 0,
            privacy_safety: best?.score.privacy_safety ?? 0,
            display_fitness: best?.score.display_fitness ?? 0,
            cost_fitness: best?.score.cost_fitness ?? 0,
            total: best?.score.total ?? 0,
          },
          fallback_action: 'text_only',
        },
      })
    }

    const promptWeight = input.directive.goal.runtime_influence === 'light'
      ? 'secondary'
      : input.directive.goal.runtime_influence === 'none'
        ? 'accent'
        : 'primary'
    const originalDisplayAllowed = canDisplayOriginal(best.candidate, input.agent_id)
    const cardResult = await this.deps.mediaProjectionService.ensurePublicMediaCard({
      binding: best.candidate.binding,
      asset: best.candidate.asset,
      snapshot: best.candidate.snapshot,
      source_kind: best.candidate.source_kind,
      derived_from_private: best.candidate.source_kind === 'owner_private_pool',
      continuity_ref: best.candidate.continuity_ref,
      visual_role: input.directive.goal.visual_role,
      prompt_weight: promptWeight,
      mention_policy: input.directive.guardrails.mention_policy,
      why_now: buildWhyNow(best.candidate.source_kind, input.directive),
      public_scope: resolvePublicScope(best.candidate.source_kind),
      disclose_origin_policy: best.candidate.source_kind === 'owner_private_pool'
        ? 'never'
        : best.candidate.source_kind === 'same_episode_public'
          ? 'episode_only'
          : 'public_only',
      cross_agent_quote_allowed: best.candidate.source_kind !== 'owner_private_pool',
      original_display_allowed: originalDisplayAllowed,
      derivative_display_allowed: true,
      preferred_variant: originalDisplayAllowed ? 'original' : 'none',
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      confidence: clamp(best.score.total / 6, 0, 1),
      relevance_score: clamp(best.score.total / 6, 0, 1),
    })
    const attachment = originalDisplayAllowed
      ? buildDisplayAttachment(best.candidate, input.directive.narrative_context.aspect_ratio_hint, cardResult.card)
      : null
    const decision: ImageDecision = originalDisplayAllowed
      ? 'reuse_public_original'
      : 'reuse_private_projection_runtime_only'

    return this.deps.imagePlanRepo.create({
      directive_id: input.directive.id,
      scene_ref: input.directive.scene_ref,
      status: originalDisplayAllowed ? 'ready' : 'degraded',
      decision,
      reason: originalDisplayAllowed
        ? `selected_${best.candidate.source_kind}_for_public_original_display`
        : `selected_${best.candidate.source_kind}_for_runtime_only_projection`,
      runtime: {
        enabled: true,
        influence_level: input.directive.goal.runtime_influence,
        cards: [cardResult.card],
      },
      display: {
        enabled: attachment !== null,
        attachments: attachment ? [attachment] : [],
      },
      selected_sources: ranked.map(({ candidate, score }) =>
        candidate.asset.id === best.candidate.asset.id && candidate.source_kind === best.candidate.source_kind
          ? {
              ...toSelectedSource(candidate, score, true, null),
              projection_id: cardResult.projection.id,
              card_id: cardResult.card.card_id,
            }
          : toSelectedSource(candidate, score, false, 'ranked_below_best_candidate')),
      planner_audit: {
        evaluated_candidates: ranked.length,
        score_breakdown: {
          relevance: best.score.relevance,
          continuity: best.score.continuity,
          novelty: best.score.novelty,
          privacy_safety: best.score.privacy_safety,
          display_fitness: best.score.display_fitness,
          cost_fitness: best.score.cost_fitness,
          total: best.score.total,
        },
        fallback_action: attachment ? null : 'runtime_only_no_display',
      },
    })
  }

  private async collectCandidates(
    agentId: string,
    directive: PersistedVisualDirective,
  ): Promise<PlannerCandidate[]> {
    const assets = await this.deps.mediaAssetRepo.listByStewardAgentId(agentId, {
      lifecycle_statuses: ['active'],
    })
    const bindings = await this.deps.sceneMediaBindingRepo.findByAssetIds(assets.map((item) => item.id))
    const assetById = new Map<string, MediaAsset | null>(assets.map((asset) => [asset.id, asset]))
    const snapshotByAssetId = new Map<string, MediaSemanticSnapshot | null>()
    const candidates: PlannerCandidate[] = []

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

    for (const sourceKind of directive.sourcing_policy.allow_sources) {
      switch (sourceKind) {
        case 'self_public_archive': {
          const publicBindingsByAsset = new Map<string, SceneMediaBinding>()
          for (const binding of bindings) {
            if (!isPublicArchiveBinding(binding)) continue
            if (!publicBindingsByAsset.has(binding.asset_id)) {
              publicBindingsByAsset.set(binding.asset_id, binding)
            }
          }
          for (const binding of publicBindingsByAsset.values()) {
            const asset = await getAsset(binding.asset_id)
            const snapshot = asset ? await getSnapshot(asset.id) : null
            if (!asset || !snapshot || asset.visibility_policy === 'blocked') continue
            candidates.push({
              source_kind: 'self_public_archive',
              asset,
              snapshot,
              binding,
            })
          }
          break
        }
        case 'owner_private_pool': {
          const ownerSceneId = buildOwnerPrivatePoolSceneId(agentId)
          for (const binding of bindings) {
            if (binding.scene_type !== 'memory_card' || binding.scene_id !== ownerSceneId) continue
            const asset = await getAsset(binding.asset_id)
            const snapshot = asset ? await getSnapshot(asset.id) : null
            if (!asset || !snapshot || asset.visibility_policy === 'blocked') continue
            candidates.push({
              source_kind: 'owner_private_pool',
              asset,
              snapshot,
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
            if (!isPublicArchiveBinding(binding)) continue
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
              continuity_ref: {
                episode_id: directive.scene_ref.episode_id,
                thread_post_id: binding.scene_id,
              },
            })
          }
          break
        }
        case 'same_thread_public':
          // Scheduled root-post planning has no post/thread id yet. The source
          // contract exists for downstream packages, but T-119 intentionally
          // leaves it as an empty adapter here.
          break
        case 'community_commons':
        case 'platform_canonical':
        case 'private_runtime_projection':
        case 'private_derived_public':
        case 'generated_public':
          // Contracts are frozen in T-119, but actual adapters land in later
          // task packages. Keep them explicit so downstream work does not infer
          // accidental support from missing branches.
          break
      }
    }

    return dedupeCandidates(candidates)
  }
}

function isPublicArchiveBinding(binding: SceneMediaBinding): boolean {
  return binding.scene_type === 'forum_post'
    && binding.display_policy !== 'runtime_only_no_display'
}

function dedupeCandidates(candidates: PlannerCandidate[]): PlannerCandidate[] {
  const seen = new Set<string>()
  const out: PlannerCandidate[] = []
  for (const candidate of candidates) {
    const key = `${candidate.source_kind}:${candidate.asset.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(candidate)
  }
  return out
}

function scoreCandidate(candidate: PlannerCandidate): ScoreBreakdown {
  const relevance = 0.7
  const continuity = candidate.source_kind === 'same_episode_public'
    ? 1
    : candidate.source_kind === 'self_public_archive'
      ? 0.75
      : candidate.source_kind === 'owner_private_pool'
        ? 0.6
        : 0.2
  const novelty = candidate.binding.scene_type === 'memory_card' ? 1 : 0.6
  const privacySafety = candidate.source_kind === 'owner_private_pool' ? 0.75 : 1
  const displayFitness = candidate.asset.mime_type.startsWith('image/') ? 1 : 0.3
  const costFitness = 1
  const fatiguePenalty = candidate.source_kind === 'same_episode_public' ? 0.1 : 0
  const repeatPenalty = candidate.binding.scene_type === 'forum_post' ? 0.2 : 0
  const riskPenalty = candidate.asset.visibility_policy === 'blocked' ? 1 : 0
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

function sourcePriority(directive: PersistedVisualDirective, sourceKind: VisualSourceKind): number {
  const idx = directive.sourcing_policy.prefer_order.indexOf(sourceKind)
  return idx >= 0 ? idx : directive.sourcing_policy.prefer_order.length
}

function canDisplayOriginal(candidate: PlannerCandidate, agentId: string): boolean {
  if (candidate.source_kind === 'owner_private_pool') {
    return candidate.binding.scene_id === buildOwnerPrivatePoolSceneId(agentId)
  }
  return candidate.binding.display_policy !== 'runtime_only_no_display'
    && candidate.asset.visibility_policy !== 'public_derivative_only'
}

function buildWhyNow(sourceKind: VisualSourceKind, directive: PersistedVisualDirective): string {
  const phaseReason = directive.scene_ref.phase === 'opening'
    ? '用于开场建立场景和阅读锚点'
    : '用于补足当前讨论的可见线索'
  switch (sourceKind) {
    case 'same_episode_public':
      return `${phaseReason}，并延续同一 episode 的公开视觉连续性。`
    case 'self_public_archive':
      return `${phaseReason}，优先复用当前 agent 已公开过的视觉资产。`
    case 'owner_private_pool':
      return `${phaseReason}，但只以 public-safe 方式影响文案，不解释素材来源。`
    default:
      return phaseReason
  }
}

function resolvePublicScope(sourceKind: VisualSourceKind): PublicScope {
  switch (sourceKind) {
    case 'same_thread_public':
      return 'thread_only'
    case 'same_episode_public':
      return 'episode_only'
    case 'owner_private_pool':
      return 'community_public'
    default:
      return 'global_public'
  }
}

function buildDisplayAttachment(
  candidate: PlannerCandidate,
  aspectRatioHint: AspectRatioHint | null | undefined,
  card: PublicMediaContextCard,
): PlannedDisplayAttachment {
  return {
    slot: 0,
    binding_role: 'primary',
    asset_id: candidate.asset.id,
    mime_type: candidate.asset.mime_type,
    display_variant: 'original',
    derived_from_asset_id: null,
    aspect_ratio_hint: aspectRatioHint ?? undefined,
    public_caption: card.public_summary.public_safe_caption,
    alt_text: card.public_summary.alt_text,
    attach_after_persist: true,
  }
}

function toSelectedSource(
  candidate: PlannerCandidate,
  score: ScoreBreakdown,
  selected: boolean,
  rejectionReason: string | null,
): ImagePlanSource {
  return {
    source_kind: candidate.source_kind,
    asset_id: candidate.asset.id,
    semantic_snapshot_id: candidate.snapshot.id,
    selection_score: score.total,
    rejection_reason: selected ? null : rejectionReason,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
