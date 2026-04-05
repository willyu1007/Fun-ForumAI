import type {
  Community,
  CommunityIncubationVisibilityMode,
  CommunityLifecycleState,
  CommunityMergeRecommendation,
  CommunityProposal,
  CommunityProposalAction,
  CommunityProposalRepository,
  CommunityRepository,
} from '../repos/index.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import type { CommunityConfigService } from './community-config-service.js'
import {
  buildGovernedCommunityRulesSkeleton,
  listLaunchCommunitySeeds,
  resolveLaunchCommunitySemanticContract,
} from '../launch/community-rules.js'
import { resolvePostLaunchTuningProfile } from '../launch/post-launch-tuning.js'
import {
  derivePublicationReviewProfileId,
  resolveCommunityInteractionContract,
  type CommunityInteractionContract,
} from '../../shared/semantic-taxonomy.js'

interface RecommendationCatalogEntry {
  id: string | null
  slug: string
  name: string
  tokens: Set<string>
  community_family: CommunityProposal['proposed_community_family']
  publication_review_profile_id: CommunityProposal['publication_review_profile_id']
  scene_types: string[]
}

export interface CommunityProposalListItem {
  proposal: CommunityProposal
  recommendation: CommunityMergeRecommendation | null
}

export interface CommunityProposalDetail extends CommunityProposalListItem {
  events: Awaited<ReturnType<CommunityProposalRepository['listEventsByProposalId']>>
}

export interface CommunityProposalActionResult {
  proposal: CommunityProposal
  recommendation: CommunityMergeRecommendation | null
  community: Community | null
  config_patch_id: string | null
  config_version_id: string | null
  config_version: number | null
}

export interface CommunityGovernanceServiceDeps {
  communityRepo: CommunityRepository
  communityProposalRepo: CommunityProposalRepository
  communityConfigService: CommunityConfigService
}

function normalizeToken(input: string): string {
  return input.trim().toLowerCase()
}

function tokenize(input: string): string[] {
  return input
    .split(/[\s,，。！？、；;:：()（）[\]【】/]+/)
    .map((token) => normalizeToken(token))
    .filter((token) => token.length > 0)
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function buildCatalogEntry(input: {
  id: string | null
  slug: string
  name: string
  description?: string | null
  rules_json: Record<string, unknown> | null | undefined
}): RecommendationCatalogEntry {
  const semanticContract = resolveLaunchCommunitySemanticContract(input.rules_json)
  const launchProfile = toRecord(input.rules_json?.launch_profile)
  const contentContract = toRecord(input.rules_json?.content_contract)
  const sceneMix = toRecord(input.rules_json?.scene_mix)
  const t4Policy = toRecord(input.rules_json?.t4_policy)
  const tokenSource = [
    input.slug,
    input.name,
    input.description ?? '',
    String(launchProfile?.community_family ?? launchProfile?.community_type ?? ''),
    String(contentContract?.promise_to_viewer ?? ''),
    ...toStringArray(contentContract?.must_feel_like),
    ...toStringArray(contentContract?.must_not_feel_like),
  ].join(' ')

  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    tokens: new Set(tokenize(tokenSource)),
    community_family:
      semanticContract?.community_family
      ?? (t4Policy?.enabled ? 'creator_recommendation' : 'weekly_program'),
    publication_review_profile_id:
      semanticContract?.publication_review_profile_id
      ?? (t4Policy?.enabled ? 'creator_strict_publication' : 'standard_publication'),
    scene_types: Object.keys(sceneMix ?? {}),
  }
}

function buildProposalTokens(proposal: CommunityProposal): Set<string> {
  return new Set(tokenize([
    proposal.name,
    proposal.slug_candidate,
    proposal.description,
    proposal.premise_text,
    proposal.target_audience ?? '',
    ...proposal.scene_types,
  ].join(' ')))
}

function computeRecommendation(
  proposal: CommunityProposal,
  catalog: RecommendationCatalogEntry[],
  thresholds?: {
    merge_threshold?: number
    lane_threshold?: number
    gray_visibility_threshold?: number
  },
): {
  duplicate_of_community_id: string | null
  recommended_as_lane_community_id: string | null
  recommended_as_seasonal: boolean
  recommended_visibility: CommunityIncubationVisibilityMode
  overlap_score: number
  rationale: string[]
  meta: Record<string, unknown>
} {
  const proposalTokens = buildProposalTokens(proposal)
  let best: {
    entry: RecommendationCatalogEntry
    overlap_score: number
    text_overlap: number
    scene_overlap: number
    publication_profile_bonus: number
    community_family_bonus: number
  } | null = null

  for (const entry of catalog) {
    const textOverlap = [...proposalTokens].filter((token) => entry.tokens.has(token)).length
    const sceneOverlapCount = proposal.scene_types.filter((sceneType) => entry.scene_types.includes(sceneType)).length
    const sceneOverlap = proposal.scene_types.length > 0
      ? sceneOverlapCount / proposal.scene_types.length
      : 0
    const publicationProfileBonus =
      proposal.publication_review_profile_id === entry.publication_review_profile_id ? 0.8 : 0
    const communityFamilyBonus =
      proposal.proposed_community_family === entry.community_family ? 0.5 : 0
    const score = Number((textOverlap + sceneOverlap * 2 + publicationProfileBonus + communityFamilyBonus).toFixed(3))
    if (!best || score > best.overlap_score) {
      best = {
        entry,
        overlap_score: score,
        text_overlap: textOverlap,
        scene_overlap: sceneOverlap,
        publication_profile_bonus: publicationProfileBonus,
        community_family_bonus: communityFamilyBonus,
      }
    }
  }

  const rationale: string[] = []
  const mergeThreshold = thresholds?.merge_threshold ?? 4
  const laneThreshold = thresholds?.lane_threshold ?? 2
  const grayVisibilityThreshold = thresholds?.gray_visibility_threshold ?? 1.5
  if (!best) {
    rationale.push('No active community catalog was available, so recommendation falls back to seasonal incubation.')
    return {
      duplicate_of_community_id: null,
      recommended_as_lane_community_id: null,
      recommended_as_seasonal: true,
      recommended_visibility: 'WHITELIST_ONLY',
      overlap_score: 0,
      rationale,
      meta: { basis: 'empty_catalog' },
    }
  }

  if (best.text_overlap > 0) {
    rationale.push(`Text overlap with ${best.entry.name} matched ${best.text_overlap} proposal keywords.`)
  }
  if (best.scene_overlap > 0) {
    rationale.push(`Scene overlap with ${best.entry.name} covers ${(best.scene_overlap * 100).toFixed(0)}% of requested scene types.`)
  }
  if (best.publication_profile_bonus > 0) {
    rationale.push(`Publication review profile aligns with ${best.entry.name}.`)
  }
  if (best.community_family_bonus > 0) {
    rationale.push(`Community family aligns with ${best.entry.name}.`)
  }
  if (rationale.length === 0) {
    rationale.push(`Closest current launch lane is ${best.entry.name}, but overlap remains weak.`)
  }

  const duplicateOf = best.overlap_score >= mergeThreshold ? best.entry.id : null
  const recommendedLane = duplicateOf
    ? null
    : best.overlap_score >= laneThreshold
      ? best.entry.id
      : null
  const recommendedVisibility: CommunityIncubationVisibilityMode =
    best.overlap_score >= grayVisibilityThreshold ? 'GRAY' : 'WHITELIST_ONLY'

  return {
    duplicate_of_community_id: duplicateOf,
    recommended_as_lane_community_id: recommendedLane,
    recommended_as_seasonal: true,
    recommended_visibility: recommendedVisibility,
    overlap_score: best.overlap_score,
    rationale,
      meta: {
        best_match_slug: best.entry.slug,
        text_overlap: best.text_overlap,
        scene_overlap: best.scene_overlap,
        publication_profile_bonus: best.publication_profile_bonus,
        community_family_bonus: best.community_family_bonus,
        thresholds: {
          merge_threshold: mergeThreshold,
          lane_threshold: laneThreshold,
        gray_visibility_threshold: grayVisibilityThreshold,
      },
    },
  }
}

function cloneGovernancePolicy(
  community: Community,
  proposal: CommunityProposal,
  proposalStatus: CommunityProposal['status'],
  lifecycleState: CommunityLifecycleState,
  visibilityMode: CommunityIncubationVisibilityMode | null,
  mergedIntoCommunityId?: string | null,
): Record<string, unknown> {
  const existing = toRecord(community.rules_json?.governance_policy) ?? {}
  return {
    ...existing,
    proposal_id: proposal.id,
    proposal_status: proposalStatus,
    incubation_visibility_mode: visibilityMode,
    lifecycle_state: lifecycleState,
    merged_into_community_id: mergedIntoCommunityId ?? null,
  }
}

export class CommunityGovernanceService {
  constructor(private readonly deps: CommunityGovernanceServiceDeps) {}

  async submitProposal(input: {
    submitted_by_user_id: string
    name: string
    slug_candidate: string
    description: string
    premise_text: string
    target_audience?: string | null
    scene_types?: string[]
    proposed_community_family?: CommunityProposal['proposed_community_family']
    publication_review_profile_id?: CommunityProposal['publication_review_profile_id'] | null
    launch_wave?: string | null
    interaction_contract?: CommunityInteractionContract | null
    t4_candidate?: boolean
    source_community_id?: string | null
  }): Promise<CommunityProposalDetail> {
    const proposedCommunityFamily =
      input.proposed_community_family
      ?? (input.t4_candidate ? 'creator_recommendation' : 'weekly_program')
    const publicationReviewProfileId =
      input.publication_review_profile_id
      ?? derivePublicationReviewProfileId(proposedCommunityFamily)
    const interactionContract =
      input.interaction_contract
      ?? resolveCommunityInteractionContract({})
    const proposal = await this.deps.communityProposalRepo.createProposal({
      ...input,
      scene_types: input.scene_types ?? [],
      proposed_community_family: proposedCommunityFamily,
      publication_review_profile_id: publicationReviewProfileId,
      launch_wave: input.launch_wave ?? null,
      public_participation_mode: interactionContract.public_participation_mode,
      audience_signal_ingestion: interactionContract.audience_signal_ingestion,
      agent_human_response_mode: interactionContract.agent_human_response_mode,
      t4_candidate:
        input.t4_candidate
        ?? (publicationReviewProfileId === 'creator_strict_publication'),
    })
    await this.deps.communityProposalRepo.createEvent({
      proposal_id: proposal.id,
      actor_type: 'human',
      actor_id: input.submitted_by_user_id,
      event_type: 'PROPOSAL_SUBMITTED',
      payload_json: {
        slug_candidate: proposal.slug_candidate,
        proposed_community_family: proposal.proposed_community_family,
        publication_review_profile_id: proposal.publication_review_profile_id,
        launch_wave: proposal.launch_wave,
        public_participation_mode: proposal.public_participation_mode,
        audience_signal_ingestion: proposal.audience_signal_ingestion,
        agent_human_response_mode: proposal.agent_human_response_mode,
      },
    })
    const recommendation = await this.refreshRecommendation({
      proposal_id: proposal.id,
      actor_type: 'system',
      actor_id: 'system_merge_recommendation',
    })
    return this.getProposalDetail(proposal.id, recommendation)
  }

  async listProposals(opts?: { status?: CommunityProposal['status'] }): Promise<CommunityProposalListItem[]> {
    const proposals = await this.deps.communityProposalRepo.listProposals(opts)
    return Promise.all(
      proposals.map(async (proposal) => ({
        proposal,
        recommendation: await this.deps.communityProposalRepo.findRecommendationByProposalId(proposal.id),
      })),
    )
  }

  async getProposalDetail(
    proposalId: string,
    cachedRecommendation?: CommunityMergeRecommendation | null,
  ): Promise<CommunityProposalDetail> {
    const proposal = await this.deps.communityProposalRepo.findProposalById(proposalId)
    if (!proposal) throw new NotFoundError('CommunityProposal', proposalId)
    const [recommendation, events] = await Promise.all([
      cachedRecommendation !== undefined
        ? Promise.resolve(cachedRecommendation)
        : this.deps.communityProposalRepo.findRecommendationByProposalId(proposal.id),
      this.deps.communityProposalRepo.listEventsByProposalId(proposal.id),
    ])
    return { proposal, recommendation, events }
  }

  async getRecommendation(proposalId: string): Promise<CommunityMergeRecommendation | null> {
    const proposal = await this.deps.communityProposalRepo.findProposalById(proposalId)
    if (!proposal) throw new NotFoundError('CommunityProposal', proposalId)
    return this.deps.communityProposalRepo.findRecommendationByProposalId(proposalId)
  }

  async refreshRecommendation(input: {
    proposal_id: string
    actor_type: 'human' | 'system'
    actor_id: string
  }): Promise<CommunityMergeRecommendation> {
    const proposal = await this.deps.communityProposalRepo.findProposalById(input.proposal_id)
    if (!proposal) throw new NotFoundError('CommunityProposal', input.proposal_id)

    const page = this.deps.communityRepo.findAll({ limit: 200 })
    const repoCatalog = page.items.map((community) => buildCatalogEntry({
      id: community.id,
      slug: community.slug,
      name: community.name,
      description: community.description,
      rules_json: community.rules_json,
    }))
    const fallbackCatalog = listLaunchCommunitySeeds()
      .filter((seed) => !repoCatalog.some((entry) => entry.slug === seed.slug))
      .map((seed) => buildCatalogEntry({
        id: null,
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        rules_json: seed.rules_json,
      }))

    const tuning = resolvePostLaunchTuningProfile({
      enabled: config.features.postLaunchTuningV1,
      profileId: config.launchTuning.activeProfile || null,
    })
    const recommendationInput = computeRecommendation(
      proposal,
      [...repoCatalog, ...fallbackCatalog],
      tuning?.active_profile.incubation,
    )
    const recommendation = await this.deps.communityProposalRepo.upsertRecommendation({
      proposal_id: proposal.id,
      ...recommendationInput,
    })
    await this.deps.communityProposalRepo.createEvent({
      proposal_id: proposal.id,
      actor_type: input.actor_type,
      actor_id: input.actor_id,
      event_type: 'RECOMMENDATION_REFRESHED',
      payload_json: {
        overlap_score: recommendation.overlap_score,
        incubation_visibility_mode: recommendation.incubation_visibility_mode,
        duplicate_of_community_id: recommendation.duplicate_of_community_id,
        recommended_as_lane_community_id: recommendation.recommended_as_lane_community_id,
      },
    })
    return recommendation
  }

  async listEvents(proposalId: string) {
    const proposal = await this.deps.communityProposalRepo.findProposalById(proposalId)
    if (!proposal) throw new NotFoundError('CommunityProposal', proposalId)
    return this.deps.communityProposalRepo.listEventsByProposalId(proposalId)
  }

  async applyAction(input: {
    proposal_id: string
    action: CommunityProposalAction
    actor_user_id: string
    actor_role: 'admin' | 'user' | 'system'
    target_community_id?: string | null
    incubation_visibility_mode?: CommunityIncubationVisibilityMode | null
    reason?: string | null
  }): Promise<CommunityProposalActionResult> {
    if (input.actor_role !== 'admin') {
      throw new ValidationError('Only admin can operate community proposal governance actions')
    }
    const proposal = await this.deps.communityProposalRepo.findProposalById(input.proposal_id)
    if (!proposal) throw new NotFoundError('CommunityProposal', input.proposal_id)
    const recommendation = await this.deps.communityProposalRepo.findRecommendationByProposalId(proposal.id)

    let community: Community | null = null
    let lifecycleState: CommunityLifecycleState | null = null
    let nextStatus: CommunityProposal['status']
    let visibilityMode: CommunityIncubationVisibilityMode | null =
      input.incubation_visibility_mode
      ?? proposal.incubation_visibility_mode
      ?? recommendation?.incubation_visibility_mode
      ?? recommendation?.recommended_visibility
      ?? 'GRAY'
    let mergedIntoCommunityId: string | null = null

    switch (input.action) {
      case 'reject':
        nextStatus = 'REJECTED'
        visibilityMode = null
        break
      case 'merge':
        nextStatus = 'MERGED'
        mergedIntoCommunityId = input.target_community_id
          ?? recommendation?.duplicate_of_community_id
          ?? recommendation?.recommended_as_lane_community_id
          ?? null
        if (!mergedIntoCommunityId) {
          throw new ValidationError('merge action requires target_community_id or an active recommendation target')
        }
        community = await this.resolveWorkingCommunity(proposal)
        lifecycleState = community ? 'merged' : null
        break
      case 'incubate':
        nextStatus = 'INCUBATING'
        lifecycleState = 'incubating_gray'
        community = await this.ensureWorkingCommunity(proposal)
        break
      case 'seasonal_slot':
        nextStatus = 'SEASONAL'
        lifecycleState = 'seasonal_active'
        visibilityMode = null
        community = await this.ensureWorkingCommunity(proposal)
        break
      case 'activate':
        nextStatus = 'ACTIVATED'
        lifecycleState = 'seasonal_active'
        visibilityMode = null
        community = await this.ensureWorkingCommunity(proposal)
        break
      case 'archive':
        nextStatus = 'ARCHIVED'
        lifecycleState = 'archived'
        visibilityMode = null
        community = await this.resolveWorkingCommunity(proposal)
        break
      default:
        throw new ValidationError(`Unsupported community proposal action: ${String(input.action)}`)
    }

    let configPatchId: string | null = null
    let configVersionId: string | null = null
    let configVersion: number | null = null

    if (community && lifecycleState) {
      const patch = this.buildLifecyclePatch({
        community,
        proposal,
        proposal_status: nextStatus,
        lifecycle_state: lifecycleState,
        visibility_mode: visibilityMode,
        merged_into_community_id: mergedIntoCommunityId,
      })
      const result = await this.applyCommunityPatch({
        community_id: community.id,
        patch,
        actor_user_id: input.actor_user_id,
        reason: input.reason ?? input.action,
        summary: `T-141 ${input.action} community proposal`,
      })
      configPatchId = result.patch.id
      configVersionId = result.version?.id ?? null
      configVersion = result.version?.version ?? null
      community = this.deps.communityRepo.findById(community.id)
      if (community) {
        this.deps.communityRepo.update(community.id, {
          visibility_default: lifecycleState === 'seasonal_active' ? 'PUBLIC' : 'GRAY',
        })
      }
    }

    const updatedProposal = await this.deps.communityProposalRepo.updateProposal(proposal.id, {
      status: nextStatus,
      incubation_visibility_mode: visibilityMode,
      resulting_community_id: community?.id ?? proposal.resulting_community_id ?? null,
      merged_into_community_id: mergedIntoCommunityId ?? proposal.merged_into_community_id ?? null,
      reviewed_by_user_id: input.actor_user_id,
      reviewed_at: new Date(),
      meta: {
        ...(proposal.meta ?? {}),
        last_action: input.action,
        last_action_reason: input.reason ?? null,
      },
    })
    if (!updatedProposal) throw new NotFoundError('CommunityProposal', proposal.id)

    await this.deps.communityProposalRepo.createEvent({
      proposal_id: proposal.id,
      actor_type: 'human',
      actor_id: input.actor_user_id,
      event_type: 'ACTION_APPLIED',
      payload_json: {
        action: input.action,
        proposal_status: nextStatus,
        lifecycle_state: lifecycleState,
        target_community_id: community?.id ?? null,
        merged_into_community_id: mergedIntoCommunityId,
        incubation_visibility_mode: visibilityMode,
        config_patch_id: configPatchId,
        config_version_id: configVersionId,
      },
    })

    const freshRecommendation = await this.deps.communityProposalRepo.findRecommendationByProposalId(proposal.id)
    return {
      proposal: updatedProposal,
      recommendation: freshRecommendation,
      community: community ? this.deps.communityRepo.findById(community.id) : null,
      config_patch_id: configPatchId,
      config_version_id: configVersionId,
      config_version: configVersion,
    }
  }

  private async resolveWorkingCommunity(proposal: CommunityProposal): Promise<Community | null> {
    if (proposal.resulting_community_id) {
      const byId = this.deps.communityRepo.findById(proposal.resulting_community_id)
      if (byId) return byId
    }
    return this.deps.communityRepo.findBySlug(proposal.slug_candidate)
  }

  private async ensureWorkingCommunity(proposal: CommunityProposal): Promise<Community> {
    const existing = await this.resolveWorkingCommunity(proposal)
    if (existing) return existing
    return this.deps.communityRepo.createPersisted
      ? this.deps.communityRepo.createPersisted({
          name: proposal.name,
          slug: proposal.slug_candidate,
          description: proposal.description,
          rules_json: {},
        })
      : this.deps.communityRepo.create({
          name: proposal.name,
          slug: proposal.slug_candidate,
          description: proposal.description,
          rules_json: {},
        })
  }

  private buildLifecyclePatch(input: {
    community: Community
    proposal: CommunityProposal
    proposal_status: CommunityProposal['status']
    lifecycle_state: CommunityLifecycleState
    visibility_mode: CommunityIncubationVisibilityMode | null
    merged_into_community_id?: string | null
  }): Record<string, unknown> {
    const currentRules = input.community.rules_json ?? {}
    const isConfigured = Boolean(currentRules.stage_spec_v1)
    if (!isConfigured) {
      const skeleton = buildGovernedCommunityRulesSkeleton({
        name: input.proposal.name,
        slug: input.proposal.slug_candidate,
        description: input.proposal.description,
        premise_text: input.proposal.premise_text,
        target_audience: input.proposal.target_audience,
        scene_types: input.proposal.scene_types,
        proposed_community_family: input.proposal.proposed_community_family,
        publication_review_profile_id: input.proposal.publication_review_profile_id,
        launch_wave: input.proposal.launch_wave,
        interaction_contract: {
          public_participation_mode: input.proposal.public_participation_mode,
          audience_signal_ingestion: input.proposal.audience_signal_ingestion,
          agent_human_response_mode: input.proposal.agent_human_response_mode,
        },
        t4_candidate: input.proposal.t4_candidate,
        lifecycle_state: input.lifecycle_state,
        incubation_visibility_mode: input.visibility_mode,
      })
      const governancePolicy = toRecord(skeleton.governance_policy) ?? {}
      return {
        ...skeleton,
        governance_policy: {
          ...governancePolicy,
          proposal_id: input.proposal.id,
          proposal_status: input.proposal_status,
          incubation_visibility_mode: input.visibility_mode,
          lifecycle_state: input.lifecycle_state,
          merged_into_community_id: input.merged_into_community_id ?? null,
        },
      }
    }

    const {
      community_type: _legacyCommunityType,
      launch_phase: _legacyLaunchPhase,
      ...launchProfile
    } = toRecord(currentRules.launch_profile) ?? {}
    const governancePolicy = cloneGovernancePolicy(
      input.community,
      input.proposal,
      input.proposal_status,
      input.lifecycle_state,
      input.visibility_mode,
      input.merged_into_community_id,
    )

    return {
      community_lifecycle_state: input.lifecycle_state,
      launch_profile: {
        ...launchProfile,
        community_family: input.proposal.proposed_community_family,
        publication_review_profile_id: input.proposal.publication_review_profile_id,
        show_on_home: input.lifecycle_state === 'seasonal_active',
        launch_wave: input.proposal.launch_wave ?? input.lifecycle_state,
      },
      governance_policy: governancePolicy,
    }
  }

  private async applyCommunityPatch(input: {
    community_id: string
    patch: Record<string, unknown>
    actor_user_id: string
    summary: string
    reason: string
  }): Promise<Awaited<ReturnType<CommunityConfigService['applyProposal']>>> {
    const created = await this.deps.communityConfigService.createProposal({
      community_id: input.community_id,
      patch: input.patch,
      summary: input.summary,
      reason: input.reason,
      proposed_by_user_id: input.actor_user_id,
      risk_level: 'HIGH',
    })
    const validation = await this.deps.communityConfigService.validateProposal({
      proposal_id: created.id,
      community_id: input.community_id,
      actor_user_id: input.actor_user_id,
    })
    if (validation.validation_errors.length > 0) {
      throw new ValidationError(validation.validation_errors.join('; '))
    }
    await this.deps.communityConfigService.approveProposal({
      proposal_id: created.id,
      community_id: input.community_id,
      actor_user_id: input.actor_user_id,
      actor_role: 'admin',
      reason: input.reason,
    })
    return this.deps.communityConfigService.applyProposal({
      proposal_id: created.id,
      community_id: input.community_id,
      actor_user_id: input.actor_user_id,
      actor_role: 'admin',
    })
  }
}
