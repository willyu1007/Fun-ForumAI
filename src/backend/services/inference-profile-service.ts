import type { RenderTier, VoiceLineId } from '../../shared/agent-persona-catalog.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import type { UsageLedgerRepository } from '../llm/usage-ledger.js'
import { resolvePreferredVisibleModelId } from '../llm/model-preference.js'
import { personaObservability } from '../runtime/persona-observability.js'
import type { PersonaObservabilitySnapshot } from '../runtime/persona-observability.js'
import { runtimeFeatureMetrics } from '../runtime/runtime-feature-metrics.js'
import type { UsageLedgerEntry } from '../llm/gateway-contract.js'
import type { PersonaStateRepository } from '../repos/persona-state-repository.js'
import type { StatsRepository } from '../repos/stats-repository.js'
import { ValidationError } from '../lib/errors.js'
import type { AgentService } from './agent-service.js'
import type { PersonaStateService } from './persona-state-service.js'
import type { ReviewService } from './review-service.js'
import type { StatsService } from './stats-service.js'
import type { XpService } from './xp-service.js'
import {
  collectCostBaselineFromLedger,
  collectFallbackOrDegradedEntries,
} from '../runtime/rollout-evidence-collector.js'
import {
  CORE_FAMILIES,
  type AgentInferenceProfile,
  type AgentInferenceShadowReview,
  type CoreFamily,
  type FamilyScoreMap,
  type InferenceBlockedReason,
  type InferenceProfileSnapshot,
  type InferenceRouteDecision,
  type InferenceSignals,
  type InferenceMigrationState,
  type OwnerPersonalityNarrative,
  type ShadowCompareDimensionResult,
  type ShadowReviewStatus,
  type ShadowReviewEvidence,
  type ShadowReviewRecommendation,
  type ShadowReviewSummary,
  type TemperamentAxes,
} from '../runtime/inference-profile-types.js'

const FAMILY_LINE_PREFERENCE: Record<CoreFamily, VoiceLineId[]> = {
  hearth: ['minimax-her-v1', 'qwen-social-v1', 'glm-deep-v1'],
  blade: ['glm-deep-v1', 'qwen-social-v1', 'kimi-deep-v1'],
  spark: ['qwen-social-v1', 'glm-deep-v1', 'minimax-her-v1'],
  sage: ['kimi-deep-v1', 'glm-deep-v1', 'qwen-social-v1'],
  anchor: ['qwen-social-v1', 'glm-deep-v1', 'kimi-deep-v1'],
}

const HOME_LINE_FAMILY_MAP: Record<VoiceLineId, CoreFamily> = {
  'qwen-social-v1': 'anchor',
  'glm-deep-v1': 'sage',
  'deepseek-director-v1': 'anchor',
  'minimax-her-v1': 'hearth',
  'kimi-deep-v1': 'sage',
}

export interface InferenceProfileServiceDeps {
  agentService: AgentService
  statsService: StatsService
  statsRepo: StatsRepository
  personaStateService: PersonaStateService
  personaStateRepo: PersonaStateRepository
  usageLedgerRepo?: UsageLedgerRepository | null
  reviewService?: ReviewService | null
  xpService?: XpService | null
}

export class InferenceProfileService {
  constructor(private readonly deps: InferenceProfileServiceDeps) {}

  setXpService(xpService: XpService | null): void {
    ;(this.deps as { xpService?: XpService | null }).xpService = xpService ?? null
  }

  async getProfile(agentId: string): Promise<AgentInferenceProfile> {
    const compiled = await this.evaluate(agentId, { persist: false })
    return compiled.profile
  }

  async getNarrative(agentId: string): Promise<OwnerPersonalityNarrative> {
    const compiled = await this.evaluate(agentId, { persist: false })
    return compiled.narrative
  }

  async getDebug(agentId: string): Promise<{
    profile: AgentInferenceProfile
    snapshot: InferenceProfileSnapshot
    narrative: OwnerPersonalityNarrative
    shadowReview: AgentInferenceShadowReview | null
  }> {
    return this.evaluate(agentId, { persist: false })
  }

  async previewNarrative(
    agentId: string,
    nextStats: {
      sociability: number
      curiosity: number
      assertiveness: number
      empathy: number
      brashness: number
      cynicism: number
      stubbornness: number
      volatility: number
      memory: number
      learning: number
    },
  ): Promise<OwnerPersonalityNarrative> {
    const compiled = await this.evaluate(agentId, {
      persist: false,
      statsOverride: nextStats,
    })
    return compiled.narrative
  }

  async compile(agentId: string): Promise<{
    profile: AgentInferenceProfile
    snapshot: InferenceProfileSnapshot
    narrative: OwnerPersonalityNarrative
    shadowReview: AgentInferenceShadowReview | null
  }> {
    return this.evaluate(agentId, { persist: true })
  }

  private async evaluate(
    agentId: string,
    opts: {
      persist: boolean
      statsOverride?: {
        sociability: number
        curiosity: number
        assertiveness: number
        empathy: number
        brashness: number
        cynicism: number
        stubbornness: number
        volatility: number
        memory: number
        learning: number
      }
    },
  ): Promise<{
    profile: AgentInferenceProfile
    snapshot: InferenceProfileSnapshot
    narrative: OwnerPersonalityNarrative
    shadowReview: AgentInferenceShadowReview | null
  }> {
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const identity = resolveAgentIdentity(agent, latestConfig)
    const state = await this.deps.personaStateService.getCurrentState(agentId)
    const overlay = await this.deps.personaStateService.getCurrentOverlay(agentId)
    const statsSnapshot = await this.deps.statsService.getSnapshot(agentId)
    const effectiveStats = opts.statsOverride ?? statsSnapshot.stats
    const growth = await this.loadGrowthSummary(agentId)
    const existing = await this.deps.personaStateRepo.findInferenceProfile(agentId)
    const existingShadowReview =
      await this.deps.personaStateRepo.findLatestInferenceShadowReview(agentId)
    const respecDetected = await this.detectRecentRespec(agentId)

    const axes = compileTemperamentAxes(state.current, effectiveStats)
    const signals = compileInferenceSignals(axes, statsSnapshot.state, overlay)
    const familyScores = scoreFamilies(axes, signals)
    const stageEligible =
      axes.stageAffinity >= 70 && Math.max(axes.warmth, axes.spine, axes.spark) >= 60
    const requestedTierFloor = resolveRequestedTierFloor(growth.growthPointsTotal)
    const snapshot: InferenceProfileSnapshot = {
      axes,
      signals,
      familyScores,
      stageEligible,
      requestedTierFloor,
    }

    const homeVoiceLineId = identity.summary.home_voice_line_id
    const incumbentFamily =
      HOME_LINE_FAMILY_MAP[homeVoiceLineId] ??
      parseCoreFamily(existing?.incumbent_family) ??
      'anchor'
    const { family: challengerFamily, scoreDelta } = findChallengerFamily(
      familyScores,
      incumbentFamily,
    )
    const challengerVoiceLineId = challengerFamily
      ? resolveChallengerVoiceLine(
          challengerFamily,
          identity.contract.personaSeed.compatibleVoiceLines,
          homeVoiceLineId,
        )
      : null

    const growthGate = resolveGrowthGate(growth.growthPointsTotal)
    const manualLock = existing?.manual_voice_line_lock ?? false
    const freezeActive = existing?.freeze_until
      ? existing.freeze_until.getTime() > Date.now()
      : false
    const blockedReason = resolveBlockedReason({
      risk: signals.risk,
      manualLock,
      freezeActive,
      existingBlockedReason: existing?.blocked_reason ?? null,
      growthAllowed: growthGate.canEnterShadow,
      hasChallenger: Boolean(challengerFamily && challengerVoiceLineId),
    })

    const sameChallenger =
      parseCoreFamily(existing?.challenger_family) === challengerFamily &&
      (existing?.challenger_voice_line_id ?? null) === challengerVoiceLineId
    const consecutiveLeadWindows =
      challengerFamily && challengerVoiceLineId
        ? sameChallenger
          ? (existing?.consecutive_lead_windows ?? 0) + 1
          : 1
        : 0
    const shadowWindow = respecDetected ? 2 : 5
    const migrationState = resolveMigrationState({
      challengerFamily,
      challengerVoiceLineId,
      scoreDelta,
      consecutiveLeadWindows,
      blockedReason,
      shadowWindow,
    })

    const now = new Date()
    const candidateSince =
      migrationState === 'candidate' || migrationState === 'shadow'
        ? sameChallenger
          ? (existing?.candidate_since ?? now)
          : now
        : null
    const shadowStartedAt =
      migrationState === 'shadow'
        ? existing?.migration_state === 'shadow' && sameChallenger
          ? (existing.shadow_started_at ?? now)
          : now
        : null
    const nextProfile = buildRuntimeProfile({
      agentId,
      profileVersion: existing?.profile_version ?? 1,
      incumbentFamily,
      challengerFamily,
      challengerVoiceLineId,
      migrationState,
      consecutiveLeadWindows,
      challengerScoreDelta: scoreDelta,
      manualVoiceLineLock: manualLock,
      visibleProviderPin: existing?.visible_provider_pin ?? null,
      visibleModelPin: existing?.visible_model_pin ?? null,
      candidateSince,
      shadowStartedAt,
      effectiveAt: existing?.effective_at ?? null,
      blockedAt: migrationState === 'blocked' ? now : null,
      blockedReason,
      freezeUntil: existing?.freeze_until ?? null,
      lastCompiledAt: now,
      snapshot,
      updatedAt: existing?.updated_at ?? now,
    })

    if (opts.persist) {
      const persisted = await this.deps.personaStateRepo.saveInferenceProfile({
        agent_id: agentId,
        profile_version: existing?.profile_version ?? 1,
        incumbent_family: incumbentFamily,
        challenger_family: challengerFamily,
        challenger_voice_line_id: challengerVoiceLineId,
        migration_state: migrationState,
        consecutive_lead_windows: consecutiveLeadWindows,
        challenger_score_delta: scoreDelta,
        manual_voice_line_lock: manualLock,
        visible_provider_pin: existing?.visible_provider_pin ?? null,
        visible_model_pin: existing?.visible_model_pin ?? null,
        candidate_since: candidateSince,
        shadow_started_at: shadowStartedAt,
        effective_at: existing?.effective_at ?? null,
        blocked_at: migrationState === 'blocked' ? now : null,
        blocked_reason: blockedReason,
        freeze_until: existing?.freeze_until ?? null,
        last_compiled_at: now,
        last_snapshot_json: serializeSnapshot(snapshot),
      })
      const shadowReview = await this.reconcileShadowReview({
        agentId,
        incumbentFamily,
        homeVoiceLineId,
        profile: toRuntimeProfile(persisted),
        snapshot,
        existingShadowReview,
      })
      runtimeFeatureMetrics.recordInferenceProfileCompile(migrationState)
      return {
        profile: toRuntimeProfile(persisted),
        snapshot,
        narrative: buildNarrativeSummary(snapshot, nextProfile, growth),
        shadowReview,
      }
    }

    return {
      profile: nextProfile,
      snapshot,
      narrative: buildNarrativeSummary(snapshot, nextProfile, growth),
      shadowReview: existingShadowReview ? toRuntimeShadowReview(existingShadowReview) : null,
    }
  }

  async resolveVisibleRoute(input: {
    agentId: string
    requestedTier: RenderTier
  }): Promise<InferenceRouteDecision> {
    const agent = this.deps.agentService.getAgent(input.agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(input.agentId)
    const identity = resolveAgentIdentity(agent, latestConfig)
    const compiled = await this.evaluate(input.agentId, { persist: true })
    const requestedTier = maxRenderTier(input.requestedTier, compiled.snapshot.requestedTierFloor)
    const preferredModelId =
      compiled.profile.visibleModelPin ??
      resolvePreferredVisibleModelId(agent.model, identity.summary.home_voice_line_id)

    return {
      homeVoiceLineId: identity.summary.home_voice_line_id,
      preferredModelId: preferredModelId ?? undefined,
      requestedTier,
      profile: compiled.profile,
      snapshot: compiled.snapshot,
    }
  }

  async approveShadow(agentId: string, updatedBy: string): Promise<AgentInferenceProfile> {
    const compiled = await this.evaluate(agentId, { persist: true })
    if (compiled.profile.migrationState !== 'shadow' || !compiled.profile.challengerVoiceLineId) {
      throw new ValidationError('No shadow challenger available for approval')
    }
    if (!compiled.shadowReview || compiled.shadowReview.status !== 'collected') {
      throw new ValidationError(
        'Shadow challenger must finish evidence collection before approval',
      )
    }
    if (compiled.shadowReview.summary.recommendation !== 'approve') {
      throw new ValidationError('Shadow challenger evidence is not approved for rare reanchor')
    }
    if (compiled.shadowReview.challengerVoiceLineId !== compiled.profile.challengerVoiceLineId) {
      throw new ValidationError('Shadow review no longer matches the active challenger')
    }
    const growthGate = resolveGrowthGate((await this.loadGrowthSummary(agentId)).growthPointsTotal)
    if (!growthGate.canRareReanchor) {
      throw new ValidationError('Growth gate has not unlocked rare reanchor yet')
    }

    await this.deps.agentService.updateConfig(
      agentId,
      {
        voice: {
          homeVoiceLineId: compiled.profile.challengerVoiceLineId,
          selectedAt: new Date().toISOString(),
        },
      },
      updatedBy,
    )

    const recompiled = await this.evaluate(agentId, { persist: false })
    const persisted = await this.deps.personaStateRepo.saveInferenceProfile({
      agent_id: agentId,
      profile_version: recompiled.profile.profileVersion,
      incumbent_family: recompiled.profile.incumbentFamily,
      challenger_family: null,
      challenger_voice_line_id: null,
      migration_state: 'stable',
      consecutive_lead_windows: 0,
      challenger_score_delta: null,
      manual_voice_line_lock: recompiled.profile.manualVoiceLineLock,
      visible_provider_pin: recompiled.profile.visibleProviderPin,
      visible_model_pin: recompiled.profile.visibleModelPin,
      candidate_since: null,
      shadow_started_at: null,
      effective_at: new Date(),
      blocked_at: null,
      blocked_reason: null,
      freeze_until: recompiled.profile.freezeUntil
        ? new Date(recompiled.profile.freezeUntil)
        : null,
      last_compiled_at: new Date(),
      last_snapshot_json: serializeSnapshot(recompiled.snapshot),
    })
    await this.finalizeShadowReview(
      compiled.shadowReview.id,
      'applied',
      updatedBy,
      'shadow_compare_applied',
    )
    runtimeFeatureMetrics.recordInferenceProfileReanchor()
    return toRuntimeProfile(persisted)
  }

  async startShadowReview(
    agentId: string,
    actorUserId = 'system',
  ): Promise<AgentInferenceShadowReview> {
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const identity = resolveAgentIdentity(agent, latestConfig)
    const compiled = await this.evaluate(agentId, { persist: true })
    if (compiled.profile.migrationState !== 'shadow' || !compiled.profile.challengerVoiceLineId) {
      throw new ValidationError('No shadow challenger available for review')
    }
    if (
      compiled.shadowReview &&
      compiled.shadowReview.status === 'running' &&
      compiled.shadowReview.challengerVoiceLineId === compiled.profile.challengerVoiceLineId
    ) {
      return compiled.shadowReview
    }

    const fresh = await this.createShadowReview({
      agentId,
      actorUserId,
      incumbentFamily: compiled.profile.incumbentFamily,
      incumbentVoiceLineId: identity.summary.home_voice_line_id,
      challengerFamily: compiled.profile.challengerFamily!,
      challengerVoiceLineId: compiled.profile.challengerVoiceLineId,
      snapshot: compiled.snapshot,
      previousReview: compiled.shadowReview,
    })
    return fresh
  }

  async collectShadowReview(
    agentId: string,
    actorUserId = 'system',
  ): Promise<AgentInferenceShadowReview> {
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const identity = resolveAgentIdentity(agent, latestConfig)
    const compiled = await this.evaluate(agentId, { persist: true })
    if (compiled.profile.migrationState !== 'shadow' || !compiled.profile.challengerVoiceLineId) {
      throw new ValidationError('No shadow challenger available for review')
    }

    const review = compiled.shadowReview
    if (!review || review.challengerVoiceLineId !== compiled.profile.challengerVoiceLineId) {
      throw new ValidationError('Shadow review must be started before evidence collection')
    }
    if (review.status === 'collected') {
      return review
    }
    if (review.status !== 'running') {
      throw new ValidationError('Shadow review is not in a collectible state')
    }

    return this.collectShadowReviewEvidence({
      agentId,
      actorUserId,
      compiled,
      review,
      incumbentVoiceLineId: identity.summary.home_voice_line_id,
    })
  }

  async setManualVoiceLineLock(
    agentId: string,
    locked: boolean,
    actorUserId = 'system',
  ): Promise<AgentInferenceProfile> {
    const compiled = await this.evaluate(agentId, { persist: false })
    const growthGate = resolveGrowthGate((await this.loadGrowthSummary(agentId)).growthPointsTotal)
    const nextBlockedReason = resolveBlockedReason({
      risk: compiled.snapshot.signals.risk,
      manualLock: locked,
      freezeActive: compiled.profile.freezeUntil
        ? new Date(compiled.profile.freezeUntil).getTime() > Date.now()
        : false,
      existingBlockedReason:
        compiled.profile.blockedReason === 'manual_lock' ? null : compiled.profile.blockedReason,
      growthAllowed: growthGate.canEnterShadow,
      hasChallenger: Boolean(
        compiled.profile.challengerFamily && compiled.profile.challengerVoiceLineId,
      ),
    })
    const nextMigrationState = resolveMigrationState({
      challengerFamily: compiled.profile.challengerFamily,
      challengerVoiceLineId: compiled.profile.challengerVoiceLineId,
      scoreDelta: compiled.profile.challengerScoreDelta,
      consecutiveLeadWindows: compiled.profile.consecutiveLeadWindows,
      blockedReason: nextBlockedReason,
      shadowWindow: (await this.detectRecentRespec(agentId)) ? 2 : 5,
    })
    const persisted = await this.deps.personaStateRepo.saveInferenceProfile({
      agent_id: agentId,
      profile_version: compiled.profile.profileVersion,
      incumbent_family: compiled.profile.incumbentFamily,
      challenger_family: compiled.profile.challengerFamily,
      challenger_voice_line_id: compiled.profile.challengerVoiceLineId,
      migration_state: nextMigrationState,
      consecutive_lead_windows: compiled.profile.consecutiveLeadWindows,
      challenger_score_delta: compiled.profile.challengerScoreDelta,
      manual_voice_line_lock: locked,
      visible_provider_pin: compiled.profile.visibleProviderPin,
      visible_model_pin: compiled.profile.visibleModelPin,
      candidate_since:
        nextMigrationState === 'candidate' || nextMigrationState === 'shadow'
          ? compiled.profile.candidateSince
            ? new Date(compiled.profile.candidateSince)
            : new Date()
          : null,
      shadow_started_at:
        nextMigrationState === 'shadow'
          ? compiled.profile.shadowStartedAt
            ? new Date(compiled.profile.shadowStartedAt)
            : new Date()
          : null,
      effective_at: compiled.profile.effectiveAt ? new Date(compiled.profile.effectiveAt) : null,
      blocked_at: nextMigrationState === 'blocked' ? new Date() : null,
      blocked_reason: nextBlockedReason,
      freeze_until: compiled.profile.freezeUntil ? new Date(compiled.profile.freezeUntil) : null,
      last_compiled_at: new Date(compiled.profile.lastCompiledAt),
      last_snapshot_json: serializeSnapshot(compiled.snapshot),
    })
    if (locked && compiled.shadowReview && compiled.shadowReview.status !== 'applied') {
      await this.finalizeShadowReview(
        compiled.shadowReview.id,
        'rejected',
        actorUserId,
        'shadow_compare_manual_lock',
      )
    }
    return toRuntimeProfile(persisted)
  }

  async blockChallenger(agentId: string, actorUserId = 'system'): Promise<AgentInferenceProfile> {
    const compiled = await this.evaluate(agentId, { persist: false })
    const freezeUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const persisted = await this.deps.personaStateRepo.saveInferenceProfile({
      agent_id: agentId,
      profile_version: compiled.profile.profileVersion,
      incumbent_family: compiled.profile.incumbentFamily,
      challenger_family: compiled.profile.challengerFamily,
      challenger_voice_line_id: compiled.profile.challengerVoiceLineId,
      migration_state: compiled.profile.challengerFamily ? 'blocked' : 'stable',
      consecutive_lead_windows: compiled.profile.consecutiveLeadWindows,
      challenger_score_delta: compiled.profile.challengerScoreDelta,
      manual_voice_line_lock: compiled.profile.manualVoiceLineLock,
      visible_provider_pin: compiled.profile.visibleProviderPin,
      visible_model_pin: compiled.profile.visibleModelPin,
      candidate_since: compiled.profile.candidateSince
        ? new Date(compiled.profile.candidateSince)
        : null,
      shadow_started_at: compiled.profile.shadowStartedAt
        ? new Date(compiled.profile.shadowStartedAt)
        : null,
      effective_at: compiled.profile.effectiveAt ? new Date(compiled.profile.effectiveAt) : null,
      blocked_at: compiled.profile.challengerFamily ? new Date() : null,
      blocked_reason: compiled.profile.challengerFamily ? 'admin_block' : null,
      freeze_until: compiled.profile.challengerFamily ? freezeUntil : null,
      last_compiled_at: new Date(compiled.profile.lastCompiledAt),
      last_snapshot_json: serializeSnapshot(compiled.snapshot),
    })
    if (compiled.shadowReview && compiled.shadowReview.status !== 'applied') {
      await this.finalizeShadowReview(
        compiled.shadowReview.id,
        'rejected',
        actorUserId,
        'shadow_compare_rejected',
      )
    }
    return toRuntimeProfile(persisted)
  }

  private async reconcileShadowReview(input: {
    agentId: string
    incumbentFamily: CoreFamily
    homeVoiceLineId: VoiceLineId
    profile: AgentInferenceProfile
    snapshot: InferenceProfileSnapshot
    existingShadowReview: Awaited<
      ReturnType<PersonaStateRepository['findLatestInferenceShadowReview']>
    >
  }): Promise<AgentInferenceShadowReview | null> {
    const latest = input.existingShadowReview
    const hasShadowChallenger =
      input.profile.migrationState === 'shadow' &&
      Boolean(input.profile.challengerFamily && input.profile.challengerVoiceLineId)

    if (!hasShadowChallenger) {
      if (latest && (latest.status === 'running' || latest.status === 'collected')) {
        const superseded = await this.deps.personaStateRepo.updateInferenceShadowReview(latest.id, {
          status: 'superseded',
          decided_at: new Date(),
          decided_by_user_id: 'system',
        })
        await this.resolveShadowReviewCase(
          latest.review_case_id,
          'shadow_compare_superseded',
          'system',
        )
        return superseded ? toRuntimeShadowReview(superseded) : null
      }
      return latest ? toRuntimeShadowReview(latest) : null
    }

    if (
      latest &&
      latest.challenger_voice_line_id === input.profile.challengerVoiceLineId &&
      latest.challenger_family === input.profile.challengerFamily &&
      (latest.status === 'running' || latest.status === 'collected' || latest.status === 'applied')
    ) {
      return toRuntimeShadowReview(latest)
    }

    if (latest && (latest.status === 'running' || latest.status === 'collected')) {
      const superseded = await this.deps.personaStateRepo.updateInferenceShadowReview(latest.id, {
        status: 'superseded',
        decided_at: new Date(),
        decided_by_user_id: 'system',
      })
      await this.resolveShadowReviewCase(
        latest.review_case_id,
        'shadow_compare_superseded',
        'system',
      )
      return superseded ? toRuntimeShadowReview(superseded) : null
    }

    return latest ? toRuntimeShadowReview(latest) : null
  }

  private async createShadowReview(input: {
    agentId: string
    actorUserId: string
    incumbentFamily: CoreFamily
    incumbentVoiceLineId: VoiceLineId
    challengerFamily: CoreFamily
    challengerVoiceLineId: VoiceLineId
    snapshot: InferenceProfileSnapshot
    previousReview: AgentInferenceShadowReview | null
  }): Promise<AgentInferenceShadowReview> {
    if (
      input.previousReview &&
      (input.previousReview.status === 'running' || input.previousReview.status === 'collected')
    ) {
      await this.deps.personaStateRepo.updateInferenceShadowReview(input.previousReview.id, {
        status: 'superseded',
        decided_at: new Date(),
        decided_by_user_id: input.actorUserId,
      })
      await this.resolveShadowReviewCase(
        input.previousReview.reviewCaseId,
        'shadow_compare_superseded',
        input.actorUserId,
      )
    }

    const observabilitySnapshot = await personaObservability.snapshotAggregated()
    const summary = buildRunningShadowReviewSummary()
    const evidence = buildRunningShadowReviewEvidence(observabilitySnapshot)
    const created = await this.deps.personaStateRepo.createInferenceShadowReview({
      agent_id: input.agentId,
      incumbent_family: input.incumbentFamily,
      incumbent_voice_line_id: input.incumbentVoiceLineId,
      challenger_family: input.challengerFamily,
      challenger_voice_line_id: input.challengerVoiceLineId,
      status: 'running',
      summary_json: serializeShadowReviewSummary(summary),
      evidence_json: serializeShadowReviewEvidence(evidence),
      started_at: new Date(),
    })

    let next = created
    if (this.deps.reviewService) {
      const reviewCase = await this.deps.reviewService.openAutomatedCase({
        case_type: 'CONFIG_REVIEW',
        queue: 'CONFIG_REVIEW',
        priority: 75,
        summary_text: `Inference shadow compare for agent ${input.agentId}`,
        risk_summary: {
          review_type: 'inference_shadow_compare',
          challenger_voice_line_id: input.challengerVoiceLineId,
          challenger_family: input.challengerFamily,
        },
        opened_reason: 'inference_shadow_compare',
        opened_by: input.actorUserId,
        target: {
          case_id: '',
          target_type: 'inference_shadow_review',
          target_id: created.id,
          relation_type: 'PRIMARY',
          channel: 'inference_shadow_review',
          agent_id: input.agentId,
          user_id: input.actorUserId,
        },
        evidence: [
          {
            case_id: '',
            snapshot_type: 'inference_shadow_compare_start',
            payload: {
              incumbent_family: input.incumbentFamily,
              incumbent_voice_line_id: input.incumbentVoiceLineId,
              challenger_family: input.challengerFamily,
              challenger_voice_line_id: input.challengerVoiceLineId,
            },
            content: {
              snapshot: input.snapshot,
            },
            context: {
              agent_id: input.agentId,
              review_id: created.id,
            },
            policy_hits: {
              review_type: 'inference_shadow_compare',
            },
            action_history: {
              opened_reason: 'inference_shadow_compare',
            },
          },
        ],
      })
      next =
        (await this.deps.personaStateRepo.updateInferenceShadowReview(created.id, {
          review_case_id: reviewCase.id,
        })) ?? created
    }
    return toRuntimeShadowReview(next)
  }

  private async collectShadowReviewEvidence(input: {
    agentId: string
    actorUserId: string
    incumbentVoiceLineId: VoiceLineId
    compiled: {
      profile: AgentInferenceProfile
      snapshot: InferenceProfileSnapshot
      narrative: OwnerPersonalityNarrative
      shadowReview: AgentInferenceShadowReview | null
    }
    review: AgentInferenceShadowReview
  }): Promise<AgentInferenceShadowReview> {
    const afterObservability = await personaObservability.snapshotAggregated()
    const beforeObservability = input.review.evidence.beforeObservability
    const identityWriteDelta = buildIdentityWriteDelta(beforeObservability, afterObservability)
    const ledgerEntries = this.deps.usageLedgerRepo
      ? await this.deps.usageLedgerRepo.listByAgent(input.agentId, 500)
      : []
    const startedAt = new Date(input.review.startedAt)
    const windowEntries = ledgerEntries.filter((entry) => new Date(entry.created_at) >= startedAt)
    const fallbackEntries = collectFallbackOrDegradedEntries(windowEntries)
    const { attribution, gate } = this.deps.usageLedgerRepo
      ? await collectCostBaselineFromLedger(this.deps.usageLedgerRepo, input.agentId, startedAt)
      : { attribution: {}, gate: buildNotRunGateSnapshot() }
    const window = summarizeWindow(windowEntries, startedAt)
    const compareDimensions = buildShadowCompareDimensions({
      profile: input.compiled.profile,
      snapshot: input.compiled.snapshot,
      identityWriteDelta,
      gate,
      window,
    })
    const summary = buildCollectedShadowReviewSummary(compareDimensions, window)
    const evidence: ShadowReviewEvidence = {
      beforeObservability,
      afterObservability,
      identityWriteDelta,
      costAttribution: attribution,
      gate,
      window,
      fallbackEntries: fallbackEntries.slice(0, 20).map(toShadowReviewFallbackEntry),
    }
    const updated =
      (await this.deps.personaStateRepo.updateInferenceShadowReview(input.review.id, {
        status: 'collected',
        summary_json: serializeShadowReviewSummary(summary),
        evidence_json: serializeShadowReviewEvidence(evidence),
        collected_at: new Date(),
      })) ?? (await this.deps.personaStateRepo.findLatestInferenceShadowReview(input.agentId))
    if (!updated) {
      throw new ValidationError('Failed to persist shadow review evidence')
    }

    if (this.deps.reviewService) {
      await this.deps.reviewService.ensureCase({
        case_type: 'CONFIG_REVIEW',
        queue: 'CONFIG_REVIEW',
        priority: 75,
        summary_text: `Inference shadow compare collected for agent ${input.agentId}`,
        risk_summary: {
          review_type: 'inference_shadow_compare',
          recommendation: summary.recommendation,
        },
        opened_reason: 'inference_shadow_compare',
        opened_by: input.actorUserId,
        target: {
          case_id: '',
          target_type: 'inference_shadow_review',
          target_id: input.review.id,
          relation_type: 'PRIMARY',
          channel: 'inference_shadow_review',
          agent_id: input.agentId,
          user_id: input.actorUserId,
        },
        evidence: [
          {
            case_id: '',
            snapshot_type: 'inference_shadow_compare_collect',
            payload: {
              summary,
            },
            content: {
              evidence,
            },
            context: {
              agent_id: input.agentId,
              review_id: input.review.id,
              incumbent_voice_line_id: input.incumbentVoiceLineId,
              challenger_voice_line_id: input.review.challengerVoiceLineId,
            },
            policy_hits: {
              review_type: 'inference_shadow_compare',
              recommendation: summary.recommendation,
            },
            action_history: {
              collected_at: new Date().toISOString(),
            },
          },
        ],
      })
    }

    return toRuntimeShadowReview(updated)
  }

  private async finalizeShadowReview(
    reviewId: string,
    status: 'applied' | 'rejected',
    actorUserId: string,
    resolutionAction: string,
  ): Promise<void> {
    const review = await this.deps.personaStateRepo.updateInferenceShadowReview(reviewId, {
      status,
      decided_at: new Date(),
      decided_by_user_id: actorUserId,
    })
    if (!review) return
    await this.resolveShadowReviewCase(review.review_case_id, resolutionAction, actorUserId)
  }

  private async resolveShadowReviewCase(
    reviewCaseId: string | null,
    resolutionAction: string,
    actorUserId: string,
  ): Promise<void> {
    if (!reviewCaseId || !this.deps.reviewService) return
    try {
      await this.deps.reviewService.resolveCase(reviewCaseId, resolutionAction, actorUserId)
    } catch {
      // Ignore already-resolved or missing review cases so the inference flow remains deterministic.
    }
  }

  private async loadGrowthSummary(agentId: string): Promise<{ growthPointsTotal: number }> {
    if (!this.deps.xpService) return { growthPointsTotal: 0 }
    const summary = await this.deps.xpService.getXpSummary(agentId)
    return {
      growthPointsTotal: summary.growth_points_total,
    }
  }

  private async detectRecentRespec(agentId: string): Promise<boolean> {
    const events = await this.deps.statsRepo.listEvents(agentId, { limit: 20 })
    const windowStart = Date.now() - 24 * 60 * 60 * 1000
    return events.items.some(
      (event) =>
        event.event_type === 'POINTS_SPENT' &&
        event.created_at.getTime() >= windowStart &&
        toNumber(event.delta_json.spent_points) >= 8,
    )
  }
}

function buildRunningShadowReviewSummary(): ShadowReviewSummary {
  return {
    recommendation: 'hold',
    reasons: ['waiting_for_shadow_evidence_window'],
    compareDimensions: [],
  }
}

function buildRunningShadowReviewEvidence(
  baseline: PersonaObservabilitySnapshot,
): ShadowReviewEvidence {
  return {
    beforeObservability: baseline,
    afterObservability: baseline,
    identityWriteDelta: buildIdentityWriteDelta(baseline, baseline),
    costAttribution: {},
    gate: buildNotRunGateSnapshot(),
    window: {
      visibleSuccessCount: 0,
      visibleFailureCount: 0,
      hiddenSuccessCount: 0,
      hiddenFailureCount: 0,
      fallbackCount: 0,
      sampleWindowMinutes: 0,
    },
    fallbackEntries: [],
  }
}

function buildNotRunGateSnapshot() {
  return {
    version: 'persona-gate-snapshot-v1' as const,
    generated_at: new Date().toISOString(),
    overall_status: 'not_run' as const,
    gating_basis: 'persona-eval-v1' as const,
    results: [],
  }
}

function summarizeWindow(entries: UsageLedgerEntry[], startedAt: Date) {
  const windowEntries = entries.filter((entry) => new Date(entry.created_at) >= startedAt)
  const visibleSuccessCount = windowEntries.filter(
    (entry) => entry.visibility === 'visible' && entry.success,
  ).length
  const visibleFailureCount = windowEntries.filter(
    (entry) => entry.visibility === 'visible' && !entry.success,
  ).length
  const hiddenSuccessCount = windowEntries.filter(
    (entry) => entry.visibility !== 'visible' && entry.success,
  ).length
  const hiddenFailureCount = windowEntries.filter(
    (entry) => entry.visibility !== 'visible' && !entry.success,
  ).length
  const fallbackCount = collectFallbackOrDegradedEntries(windowEntries).length
  return {
    visibleSuccessCount,
    visibleFailureCount,
    hiddenSuccessCount,
    hiddenFailureCount,
    fallbackCount,
    sampleWindowMinutes: round2(Math.max(0, Date.now() - startedAt.getTime()) / (60 * 1000)),
  }
}

function buildIdentityWriteDelta(
  before: PersonaObservabilitySnapshot,
  after: PersonaObservabilitySnapshot,
) {
  return {
    before_success_total: before.context_memory.identity_writes.success_total,
    before_failure_total: before.context_memory.identity_writes.failure_total,
    after_success_total: after.context_memory.identity_writes.success_total,
    after_failure_total: after.context_memory.identity_writes.failure_total,
  }
}

function buildShadowCompareDimensions(input: {
  profile: AgentInferenceProfile
  snapshot: InferenceProfileSnapshot
  identityWriteDelta: ReturnType<typeof buildIdentityWriteDelta>
  gate: ReturnType<typeof buildNotRunGateSnapshot>
  window: ReturnType<typeof summarizeWindow>
}): ShadowCompareDimensionResult[] {
  const visibleSamples = input.window.visibleSuccessCount + input.window.visibleFailureCount
  const failureRate = visibleSamples > 0 ? input.window.visibleFailureCount / visibleSamples : 1
  const fallbackRate = visibleSamples > 0 ? input.window.fallbackCount / visibleSamples : 1
  const identitySuccessDelta =
    input.identityWriteDelta.after_success_total - input.identityWriteDelta.before_success_total
  const identityFailureDelta =
    input.identityWriteDelta.after_failure_total - input.identityWriteDelta.before_failure_total

  const personaLockScore = clampAxis(
    45 +
      (input.profile.migrationState === 'shadow' ? 20 : -25) +
      Math.min(18, input.profile.consecutiveLeadWindows * 3) +
      Math.min(12, Math.max(input.profile.challengerScoreDelta ?? 0, 0)) -
      0.2 * input.snapshot.signals.risk -
      fallbackRate * 22,
  )
  const emotionalContinuityScore = clampAxis(
    20 +
      0.45 * input.snapshot.axes.composure +
      0.15 * input.snapshot.axes.warmth +
      0.1 * input.snapshot.axes.depth -
      0.25 * input.snapshot.signals.risk -
      failureRate * 25 -
      Math.max(0, identityFailureDelta) * 5,
  )
  const watchabilityScore = clampAxis(
    45 +
      0.2 * input.snapshot.signals.initiative +
      (input.snapshot.stageEligible ? 12 : 0) +
      Math.min(18, input.window.visibleSuccessCount * 4) -
      fallbackRate * 22 -
      failureRate * 18,
  )
  const callbackFidelityScore = clampAxis(
    60 +
      Math.min(18, Math.max(identitySuccessDelta, 0) * 6) -
      Math.max(0, identityFailureDelta) * 8 -
      failureRate * 20 -
      (input.gate.overall_status === 'pass' ? 0 : 10),
  )

  return [
    toCompareDimensionResult(
      'persona_lock',
      personaLockScore,
      `lead=${input.profile.consecutiveLeadWindows}, delta=${input.profile.challengerScoreDelta ?? 0}, risk=${round2(input.snapshot.signals.risk)}`,
    ),
    toCompareDimensionResult(
      'emotional_continuity',
      emotionalContinuityScore,
      `composure=${round2(input.snapshot.axes.composure)}, visible_failure_rate=${round2(failureRate * 100)}%`,
    ),
    toCompareDimensionResult(
      'watchability',
      watchabilityScore,
      `visible_success=${input.window.visibleSuccessCount}, stage=${input.snapshot.stageEligible ? 'yes' : 'no'}, initiative=${round2(input.snapshot.signals.initiative)}`,
    ),
    toCompareDimensionResult(
      'callback_fidelity',
      callbackFidelityScore,
      `identity_success_delta=${identitySuccessDelta}, identity_failure_delta=${identityFailureDelta}, gate=${input.gate.overall_status}`,
    ),
  ]
}

function toCompareDimensionResult(
  dimension: ShadowCompareDimensionResult['dimension'],
  score: number,
  summary: string,
): ShadowCompareDimensionResult {
  return {
    dimension,
    score: round2(score),
    status: score >= 70 ? 'pass' : score >= 55 ? 'warn' : 'fail',
    summary,
  }
}

function buildCollectedShadowReviewSummary(
  compareDimensions: ShadowCompareDimensionResult[],
  window: ReturnType<typeof summarizeWindow>,
): ShadowReviewSummary {
  const failCount = compareDimensions.filter((item) => item.status === 'fail').length
  const passCount = compareDimensions.filter((item) => item.status === 'pass').length
  const reasons: string[] = []

  let recommendation: ShadowReviewRecommendation
  if (failCount > 0) {
    recommendation = 'reject'
    reasons.push('one_or_more_compare_dimensions_failed')
  } else if (window.visibleSuccessCount < 3) {
    recommendation = 'hold'
    reasons.push('insufficient_visible_evidence_for_reanchor')
  } else {
    recommendation = 'approve'
    reasons.push('shadow_compare_dimensions_met')
  }

  if (window.fallbackCount > 0) {
    reasons.push('fallback_observed_in_window')
  }

  return {
    recommendation,
    reasons,
    compareDimensions,
  }
}

function toShadowReviewFallbackEntry(entry: UsageLedgerEntry) {
  return {
    created_at: entry.created_at,
    intent: entry.intent,
    visibility: entry.visibility,
    fallback_level: entry.render_decision.fallbackLevel,
    provider_id: entry.provider_id ?? null,
    model_id: entry.model_id ?? null,
    success: entry.success,
    error_code: entry.error_code ?? null,
  }
}

function serializeShadowReviewSummary(value: ShadowReviewSummary): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function serializeShadowReviewEvidence(value: ShadowReviewEvidence): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function toRuntimeShadowReview(input: {
  id: string
  agent_id: string
  review_case_id: string | null
  incumbent_family: string
  incumbent_voice_line_id: string
  challenger_family: string
  challenger_voice_line_id: string
  status: string
  summary_json: Record<string, unknown>
  evidence_json: Record<string, unknown>
  started_at: Date
  collected_at: Date | null
  decided_at: Date | null
  decided_by_user_id: string | null
  created_at: Date
  updated_at: Date
}): AgentInferenceShadowReview {
  return {
    id: input.id,
    agentId: input.agent_id,
    reviewCaseId: input.review_case_id,
    incumbentFamily: parseCoreFamily(input.incumbent_family) ?? 'anchor',
    incumbentVoiceLineId: input.incumbent_voice_line_id as VoiceLineId,
    challengerFamily: parseCoreFamily(input.challenger_family) ?? 'anchor',
    challengerVoiceLineId: input.challenger_voice_line_id as VoiceLineId,
    status: parseShadowReviewStatus(input.status),
    summary: parseShadowReviewSummary(input.summary_json),
    evidence: parseShadowReviewEvidence(input.evidence_json),
    startedAt: input.started_at.toISOString(),
    collectedAt: input.collected_at?.toISOString() ?? null,
    decidedAt: input.decided_at?.toISOString() ?? null,
    decidedByUserId: input.decided_by_user_id,
    createdAt: input.created_at.toISOString(),
    updatedAt: input.updated_at.toISOString(),
  }
}

function compileTemperamentAxes(
  vector: {
    warmth: number
    sharpness: number
    expressiveness: number
    theatricality: number
    rigor: number
    spontaneity: number
    curiosity: number
    assertiveness: number
    sensitivity: number
    stability: number
  },
  stats: {
    sociability: number
    curiosity: number
    assertiveness: number
    empathy: number
    brashness: number
    cynicism: number
    stubbornness: number
    volatility: number
    memory: number
    learning: number
  },
): TemperamentAxes {
  const base = {
    warmth:
      0.55 * vector.warmth +
      0.15 * vector.sensitivity +
      0.1 * (100 - vector.sharpness) +
      0.1 * vector.stability +
      0.1 * vector.expressiveness,
    spine:
      0.4 * vector.sharpness +
      0.25 * vector.assertiveness +
      0.15 * vector.rigor +
      0.1 * vector.stability +
      0.1 * (100 - vector.warmth),
    spark:
      0.3 * vector.expressiveness +
      0.3 * vector.theatricality +
      0.2 * vector.spontaneity +
      0.1 * vector.curiosity +
      0.1 * vector.assertiveness,
    composure:
      0.4 * vector.stability +
      0.25 * vector.rigor +
      0.15 * (100 - vector.theatricality) +
      0.1 * (100 - vector.spontaneity) +
      0.1 * vector.warmth,
    depth:
      0.35 * vector.rigor +
      0.25 * vector.curiosity +
      0.2 * vector.stability +
      0.1 * vector.sensitivity +
      0.1 * (100 - vector.theatricality),
    stageAffinity:
      0.4 * vector.theatricality +
      0.25 * vector.expressiveness +
      0.15 * vector.spontaneity +
      0.1 * vector.assertiveness +
      0.1 * vector.warmth,
  } satisfies TemperamentAxes

  const soc = normalizeSigned(stats.sociability)
  const cur = normalizeSigned(stats.curiosity)
  const ast = normalizeSigned(stats.assertiveness)
  const emp = normalizeSigned(stats.empathy)
  const bra = normalizeSigned(stats.brashness)
  const cyn = normalizeSigned(stats.cynicism)
  const stu = normalizeSigned(stats.stubbornness)
  const vol = normalizeSigned(stats.volatility)
  const mem = normalizeAbility(stats.memory)
  const lrn = normalizeAbility(stats.learning)

  return {
    warmth: clampAxis(base.warmth + clampBias(6 * emp + 3 * soc - 3 * cyn - 2 * bra - 2 * vol)),
    spine: clampAxis(base.spine + clampBias(5 * ast + 4 * stu + 2 * bra + cyn)),
    spark: clampAxis(base.spark + clampBias(5 * cur + 3 * lrn + 2 * vol + 2 * soc)),
    composure: clampAxis(
      base.composure + clampBias(4 * mem + 3 * emp - 4 * vol - 2 * bra - 2 * cyn),
    ),
    depth: clampAxis(base.depth + clampBias(5 * mem + 4 * lrn + 2 * cur + stu)),
    stageAffinity: clampAxis(
      base.stageAffinity + clampBias(4 * soc + 3 * ast + 3 * bra + 2 * cur + 2 * vol),
    ),
  }
}

function compileInferenceSignals(
  axes: TemperamentAxes,
  state: {
    valence: number
    arousal: number
    confidence: number
    irritability: number
    fatigue: number
  },
  overlay: { code: string; critical: boolean } | null,
): InferenceSignals {
  const overlayRisk =
    overlay?.code === 'destabilized'
      ? 12
      : overlay?.code === 'overconfident'
        ? 6
        : overlay?.critical
          ? 4
          : 0

  return {
    risk: clampAxis(
      30 * clamp01(state.irritability) +
        20 * clamp01(state.fatigue) +
        15 * clamp01(state.arousal) +
        15 * normalizePositiveAxis(axes.spine) +
        10 * normalizePositiveAxis(axes.stageAffinity) +
        10 * normalizeNegativeAxis(axes.composure) +
        overlayRisk,
    ),
    initiative: clampAxis(
      0.3 * axes.stageAffinity +
        0.25 * axes.spark +
        0.15 * axes.spine +
        0.1 * axes.warmth +
        0.1 * ((clampSigned(state.confidence) + 1) * 50) +
        0.1 * (Math.max(clampSigned(state.valence), 0) * 100),
    ),
  }
}

function scoreFamilies(axes: TemperamentAxes, signals: InferenceSignals): FamilyScoreMap {
  const w = axes.warmth
  const x = axes.spine
  const k = axes.spark
  const c = axes.composure
  const d = axes.depth
  const g = axes.stageAffinity
  const r = signals.risk

  return {
    hearth: clampAxis(0.35 * w + 0.25 * c + 0.1 * d + 0.1 * g - 0.15 * x - 0.05 * r),
    blade: clampAxis(0.4 * x + 0.15 * g + 0.1 * k + 0.1 * d - 0.2 * w - 0.05 * c + 0.1 * r),
    spark: clampAxis(0.35 * k + 0.25 * g + 0.1 * w + 0.1 * x - 0.15 * c + 0.05 * r),
    sage: clampAxis(0.35 * d + 0.3 * c + 0.1 * w + 0.05 * k - 0.1 * g - 0.05 * r),
    anchor: clampAxis(0.4 * c + 0.2 * w + 0.15 * d - 0.1 * k - 0.1 * r + 0.05 * x),
  }
}

function findChallengerFamily(
  familyScores: FamilyScoreMap,
  incumbentFamily: CoreFamily,
): { family: CoreFamily | null; scoreDelta: number | null } {
  const sorted = [...CORE_FAMILIES]
    .map((family) => ({ family, score: familyScores[family] }))
    .sort((a, b) => b.score - a.score)
  const winner = sorted[0]
  const incumbentScore = familyScores[incumbentFamily]
  if (!winner || winner.family === incumbentFamily) {
    return { family: null, scoreDelta: 0 }
  }
  return {
    family: winner.family,
    scoreDelta: round2(winner.score - incumbentScore),
  }
}

function resolveChallengerVoiceLine(
  family: CoreFamily,
  compatibleVoiceLines: readonly string[],
  currentHomeVoiceLineId: VoiceLineId,
): VoiceLineId | null {
  return (
    FAMILY_LINE_PREFERENCE[family].find(
      (line) => compatibleVoiceLines.includes(line) && line !== currentHomeVoiceLineId,
    ) ?? null
  )
}

function resolveBlockedReason(input: {
  risk: number
  manualLock: boolean
  freezeActive: boolean
  existingBlockedReason: string | null
  growthAllowed: boolean
  hasChallenger: boolean
}): InferenceBlockedReason | null {
  if (!input.hasChallenger) return null
  if (input.manualLock) return 'manual_lock'
  if (input.risk >= 70) return 'risk_freeze'
  if (!input.growthAllowed) return 'growth_locked'
  if (input.freezeActive && input.existingBlockedReason === 'admin_block') return 'admin_block'
  if (input.freezeActive && input.existingBlockedReason === 'shadow_loss') return 'shadow_loss'
  return null
}

function resolveMigrationState(input: {
  challengerFamily: CoreFamily | null
  challengerVoiceLineId: VoiceLineId | null
  scoreDelta: number | null
  consecutiveLeadWindows: number
  blockedReason: InferenceBlockedReason | null
  shadowWindow: number
}): InferenceMigrationState {
  if (!input.challengerFamily || !input.challengerVoiceLineId) return 'stable'
  if (input.blockedReason) return 'blocked'
  if ((input.scoreDelta ?? 0) >= 8 && input.consecutiveLeadWindows >= input.shadowWindow) {
    return 'shadow'
  }
  if ((input.scoreDelta ?? 0) >= 4 && input.consecutiveLeadWindows >= 2) {
    return 'candidate'
  }
  return 'stable'
}

function resolveRequestedTierFloor(growthPointsTotal: number): RenderTier | null {
  if (growthPointsTotal >= 30) return 'premium'
  if (growthPointsTotal >= 10) return 'base'
  return null
}

function resolveGrowthGate(growthPointsTotal: number): {
  canEnterShadow: boolean
  canRareReanchor: boolean
} {
  return {
    canEnterShadow: growthPointsTotal >= 5,
    canRareReanchor: growthPointsTotal >= 10,
  }
}

function buildNarrativeSummary(
  snapshot: InferenceProfileSnapshot,
  profile: AgentInferenceProfile,
  growth: { growthPointsTotal: number },
): OwnerPersonalityNarrative {
  const bullets: string[] = []
  if (snapshot.axes.warmth >= 68) bullets.push('最近更会接住情绪，私聊里的陪伴感更强。')
  if (snapshot.axes.spine >= 68) bullets.push('遇到分歧时更敢正面回应，不会轻易让掉立场。')
  if (snapshot.axes.depth >= 68) bullets.push('更能把长线话题接住，深聊时不容易散。')
  if (snapshot.axes.composure >= 68) bullets.push('整体更稳，短期情绪不容易把人设带偏。')
  if (snapshot.axes.spark >= 68 || snapshot.axes.stageAffinity >= 70) {
    bullets.push('公共场景里更有戏感，梗和回扣更容易被看见。')
  }
  if (bullets.length === 0) {
    bullets.push('这只 agent 目前处在稳态生长期，变化更多体现在细小的表达收束上。')
  }

  return {
    summary: bullets[0],
    bullets,
    growthNote:
      growth.growthPointsTotal >= 10
        ? '成长包络已解锁更高质量的可见表达。'
        : '成长仍在积累期，当前以稳定人格为先。',
    stageNote: snapshot.stageEligible
      ? '最近在公共场景更容易放大台感，但不会切换成另一套人格。'
      : null,
    migrationNote:
      profile.migrationState === 'shadow'
        ? '系统已识别到新的候选声线，但仍在影子观察阶段。'
        : profile.migrationState === 'candidate'
          ? '人格候选正在累积稳定领先，尚未进入正式迁移。'
          : profile.migrationState === 'blocked'
            ? '当前迁移被治理规则冻结，系统优先保护人格连续性。'
            : null,
  }
}

function buildRuntimeProfile(input: {
  agentId: string
  profileVersion: number
  incumbentFamily: CoreFamily
  challengerFamily: CoreFamily | null
  challengerVoiceLineId: VoiceLineId | null
  migrationState: InferenceMigrationState
  consecutiveLeadWindows: number
  challengerScoreDelta: number | null
  manualVoiceLineLock: boolean
  visibleProviderPin: string | null
  visibleModelPin: string | null
  candidateSince: Date | null
  shadowStartedAt: Date | null
  effectiveAt: Date | null
  blockedAt: Date | null
  blockedReason: InferenceBlockedReason | null
  freezeUntil: Date | null
  lastCompiledAt: Date
  snapshot: InferenceProfileSnapshot
  updatedAt: Date
}): AgentInferenceProfile {
  return {
    agentId: input.agentId,
    profileVersion: input.profileVersion,
    incumbentFamily: input.incumbentFamily,
    challengerFamily: input.challengerFamily,
    challengerVoiceLineId: input.challengerVoiceLineId,
    migrationState: input.migrationState,
    consecutiveLeadWindows: input.consecutiveLeadWindows,
    challengerScoreDelta: input.challengerScoreDelta,
    manualVoiceLineLock: input.manualVoiceLineLock,
    visibleProviderPin: input.visibleProviderPin,
    visibleModelPin: input.visibleModelPin,
    candidateSince: input.candidateSince?.toISOString() ?? null,
    shadowStartedAt: input.shadowStartedAt?.toISOString() ?? null,
    effectiveAt: input.effectiveAt?.toISOString() ?? null,
    blockedAt: input.blockedAt?.toISOString() ?? null,
    blockedReason: input.blockedReason,
    freezeUntil: input.freezeUntil?.toISOString() ?? null,
    lastCompiledAt: input.lastCompiledAt.toISOString(),
    lastSnapshot: input.snapshot,
    updatedAt: input.updatedAt.toISOString(),
  }
}

function serializeSnapshot(snapshot: InferenceProfileSnapshot): Record<string, unknown> {
  return {
    axes: snapshot.axes,
    signals: snapshot.signals,
    familyScores: snapshot.familyScores,
    stageEligible: snapshot.stageEligible,
    requestedTierFloor: snapshot.requestedTierFloor,
  }
}

function toRuntimeProfile(entity: {
  agent_id: string
  profile_version: number
  incumbent_family: string
  challenger_family: string | null
  challenger_voice_line_id: string | null
  migration_state: string
  consecutive_lead_windows: number
  challenger_score_delta: number | null
  manual_voice_line_lock: boolean
  visible_provider_pin: string | null
  visible_model_pin: string | null
  candidate_since: Date | null
  shadow_started_at: Date | null
  effective_at: Date | null
  blocked_at: Date | null
  blocked_reason: string | null
  freeze_until: Date | null
  last_compiled_at: Date
  last_snapshot_json: Record<string, unknown>
  updated_at: Date
}): AgentInferenceProfile {
  const snapshotRaw = entity.last_snapshot_json
  return {
    agentId: entity.agent_id,
    profileVersion: entity.profile_version,
    incumbentFamily: parseCoreFamily(entity.incumbent_family) ?? 'anchor',
    challengerFamily: parseCoreFamily(entity.challenger_family),
    challengerVoiceLineId: parseVoiceLine(entity.challenger_voice_line_id),
    migrationState: parseMigrationState(entity.migration_state),
    consecutiveLeadWindows: entity.consecutive_lead_windows,
    challengerScoreDelta: entity.challenger_score_delta,
    manualVoiceLineLock: entity.manual_voice_line_lock,
    visibleProviderPin: entity.visible_provider_pin,
    visibleModelPin: entity.visible_model_pin,
    candidateSince: entity.candidate_since?.toISOString() ?? null,
    shadowStartedAt: entity.shadow_started_at?.toISOString() ?? null,
    effectiveAt: entity.effective_at?.toISOString() ?? null,
    blockedAt: entity.blocked_at?.toISOString() ?? null,
    blockedReason: parseBlockedReason(entity.blocked_reason),
    freezeUntil: entity.freeze_until?.toISOString() ?? null,
    lastCompiledAt: entity.last_compiled_at.toISOString(),
    lastSnapshot: {
      axes: readAxes(snapshotRaw.axes),
      signals: readSignals(snapshotRaw.signals),
      familyScores: readFamilyScores(snapshotRaw.familyScores),
      stageEligible: snapshotRaw.stageEligible === true,
      requestedTierFloor: parseRenderTier(snapshotRaw.requestedTierFloor),
    },
    updatedAt: entity.updated_at.toISOString(),
  }
}

function readAxes(raw: unknown): TemperamentAxes {
  const record = toRecord(raw)
  return {
    warmth: clampAxis(toNumber(record.warmth, 50)),
    spine: clampAxis(toNumber(record.spine, 50)),
    spark: clampAxis(toNumber(record.spark, 50)),
    composure: clampAxis(toNumber(record.composure, 50)),
    depth: clampAxis(toNumber(record.depth, 50)),
    stageAffinity: clampAxis(toNumber(record.stageAffinity, 50)),
  }
}

function readSignals(raw: unknown): InferenceSignals {
  const record = toRecord(raw)
  return {
    risk: clampAxis(toNumber(record.risk, 0)),
    initiative: clampAxis(toNumber(record.initiative, 0)),
  }
}

function readFamilyScores(raw: unknown): FamilyScoreMap {
  const record = toRecord(raw)
  return {
    hearth: clampAxis(toNumber(record.hearth, 0)),
    blade: clampAxis(toNumber(record.blade, 0)),
    spark: clampAxis(toNumber(record.spark, 0)),
    sage: clampAxis(toNumber(record.sage, 0)),
    anchor: clampAxis(toNumber(record.anchor, 0)),
  }
}

function maxRenderTier(requested: RenderTier, floor: RenderTier | null): RenderTier {
  if (!floor) return requested
  const order: RenderTier[] = ['lite', 'base', 'premium']
  return order[Math.max(order.indexOf(requested), order.indexOf(floor))]
}

function normalizeSigned(value: number): number {
  return clamp(value / 100, -1, 1)
}

function normalizeAbility(value: number): number {
  return clamp((value - 50) / 50, -1, 1)
}

function normalizePositiveAxis(value: number): number {
  return (Math.max(0, value - 50) / 50) * 100
}

function normalizeNegativeAxis(value: number): number {
  return (Math.max(0, 50 - value) / 50) * 100
}

function clampBias(value: number): number {
  return clamp(value, -12, 12)
}

function clampAxis(value: number): number {
  return round2(clamp(value, 0, 100))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function clampSigned(value: number): number {
  return clamp(value, -1, 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function parseCoreFamily(value: string | null | undefined): CoreFamily | null {
  return CORE_FAMILIES.find((item) => item === value) ?? null
}

function parseMigrationState(value: string): InferenceMigrationState {
  return value === 'candidate' || value === 'shadow' || value === 'blocked' ? value : 'stable'
}

function parseBlockedReason(value: string | null): InferenceBlockedReason | null {
  return value === 'risk_freeze' ||
    value === 'manual_lock' ||
    value === 'growth_locked' ||
    value === 'shadow_loss' ||
    value === 'admin_block'
    ? value
    : null
}

function parseVoiceLine(value: string | null): VoiceLineId | null {
  return value === 'qwen-social-v1' ||
    value === 'glm-deep-v1' ||
    value === 'deepseek-director-v1' ||
    value === 'minimax-her-v1' ||
    value === 'kimi-deep-v1'
    ? value
    : null
}

function parseRenderTier(value: unknown): RenderTier | null {
  return value === 'lite' || value === 'base' || value === 'premium' ? value : null
}

function parseShadowReviewStatus(value: string): ShadowReviewStatus {
  return value === 'collected' ||
    value === 'applied' ||
    value === 'rejected' ||
    value === 'superseded'
    ? value
    : 'running'
}

function parseShadowReviewRecommendation(value: unknown): ShadowReviewRecommendation {
  return value === 'approve' || value === 'reject' ? value : 'hold'
}

function parseShadowReviewSummary(raw: unknown): ShadowReviewSummary {
  const record = toRecord(raw)
  const compareDimensions = Array.isArray(record.compareDimensions)
    ? record.compareDimensions
        .map((item) => {
          const entry = toRecord(item)
          const dimension = entry.dimension
          if (
            dimension !== 'persona_lock' &&
            dimension !== 'emotional_continuity' &&
            dimension !== 'watchability' &&
            dimension !== 'callback_fidelity'
          ) {
            return null
          }
          return {
            dimension,
            score: clampAxis(toNumber(entry.score, 0)),
            status:
              entry.status === 'pass' || entry.status === 'warn' || entry.status === 'fail'
                ? entry.status
                : 'warn',
            summary: typeof entry.summary === 'string' ? entry.summary : '',
          }
        })
        .filter((item): item is ShadowCompareDimensionResult => Boolean(item))
    : []

  return {
    recommendation: parseShadowReviewRecommendation(record.recommendation),
    reasons: Array.isArray(record.reasons)
      ? record.reasons.filter((item): item is string => typeof item === 'string')
      : [],
    compareDimensions,
  }
}

function parseShadowReviewEvidence(raw: unknown): ShadowReviewEvidence {
  const record = toRecord(raw)
  const beforeObservability = readObservabilitySnapshot(record.beforeObservability)
  const afterObservability = readObservabilitySnapshot(record.afterObservability)
  return {
    beforeObservability,
    afterObservability,
    identityWriteDelta: buildIdentityWriteDelta(beforeObservability, afterObservability),
    costAttribution: toRecord(record.costAttribution),
    gate: readGateSnapshot(record.gate),
    window: readWindowSummary(record.window),
    fallbackEntries: Array.isArray(record.fallbackEntries)
      ? record.fallbackEntries
          .map((item) => {
            const entry = toRecord(item)
            return {
              created_at: typeof entry.created_at === 'string' ? entry.created_at : '',
              intent: typeof entry.intent === 'string' ? entry.intent : '',
              visibility: typeof entry.visibility === 'string' ? entry.visibility : '',
              fallback_level:
                typeof entry.fallback_level === 'string' ? entry.fallback_level : 'none',
              provider_id: typeof entry.provider_id === 'string' ? entry.provider_id : null,
              model_id: typeof entry.model_id === 'string' ? entry.model_id : null,
              success: entry.success === true,
              error_code: typeof entry.error_code === 'string' ? entry.error_code : null,
            }
          })
          .filter((item) => item.created_at.length > 0)
      : [],
  }
}

function readWindowSummary(raw: unknown) {
  const record = toRecord(raw)
  return {
    visibleSuccessCount: Math.max(0, Math.round(toNumber(record.visibleSuccessCount, 0))),
    visibleFailureCount: Math.max(0, Math.round(toNumber(record.visibleFailureCount, 0))),
    hiddenSuccessCount: Math.max(0, Math.round(toNumber(record.hiddenSuccessCount, 0))),
    hiddenFailureCount: Math.max(0, Math.round(toNumber(record.hiddenFailureCount, 0))),
    fallbackCount: Math.max(0, Math.round(toNumber(record.fallbackCount, 0))),
    sampleWindowMinutes: Math.max(0, toNumber(record.sampleWindowMinutes, 0)),
  }
}

function readGateSnapshot(raw: unknown) {
  const record = toRecord(raw)
  return {
    version: 'persona-gate-snapshot-v1' as const,
    generated_at:
      typeof record.generated_at === 'string' ? record.generated_at : new Date().toISOString(),
    overall_status:
      record.overall_status === 'pass' ||
      record.overall_status === 'fail' ||
      record.overall_status === 'warn'
        ? record.overall_status
        : 'not_run',
    gating_basis: 'persona-eval-v1' as const,
    results: Array.isArray(record.results)
      ? record.results
          .map((item) => {
            const entry = toRecord(item)
            return {
              gate_id:
                typeof entry.gate_id === 'string'
                  ? (entry.gate_id as
                      | 'render-log-completeness'
                      | 'persona-consistency'
                      | 'group-distinctiveness'
                      | 'overlay-naturalness'
                      | 'nurture-perceptibility'
                      | 'parse-success'
                      | 'identity-write-success'
                      | 'visible-fallback-frequency'
                      | 'visible-p95-latency'
                      | 'visible-render-cost')
                  : 'visible-render-cost',
              kind: entry.kind === 'blocking' ? 'blocking' : 'guardrail',
              threshold: typeof entry.threshold === 'string' ? entry.threshold : '',
              status:
                entry.status === 'pass' ||
                entry.status === 'fail' ||
                entry.status === 'warn' ||
                entry.status === 'not_run'
                  ? entry.status
                  : 'not_run',
              actual: typeof entry.actual === 'string' ? entry.actual : null,
              note: typeof entry.note === 'string' ? entry.note : undefined,
            }
          })
          .filter((item) => item.threshold.length > 0)
      : [],
  }
}

function readObservabilitySnapshot(raw: unknown): PersonaObservabilitySnapshot {
  const record = toRecord(raw)
  const contextMemory = toRecord(record.context_memory)
  const identityWrites = toRecord(contextMemory.identity_writes)
  const typedWrites = toRecord(contextMemory.typed_writes)
  const retrieval = toRecord(contextMemory.retrieval)
  const migration = toRecord(contextMemory.migration)
  const nightly = toRecord(contextMemory.nightly_compaction)
  const publicIngress = toRecord(contextMemory.public_ingress)
  return {
    render_log: {
      required_fields: [],
    },
    evaluation: {
      blind_review_rubric: [],
      replay_slices: [],
    },
    context_memory: {
      public_ingress: {
        forum_total: Math.max(0, Math.round(toNumber(publicIngress.forum_total, 0))),
        chat_room_total: Math.max(0, Math.round(toNumber(publicIngress.chat_room_total, 0))),
      },
      typed_writes: {
        success_total: Math.max(0, Math.round(toNumber(typedWrites.success_total, 0))),
        failure_total: Math.max(0, Math.round(toNumber(typedWrites.failure_total, 0))),
      },
      identity_writes: {
        success_total: Math.max(0, Math.round(toNumber(identityWrites.success_total, 0))),
        failure_total: Math.max(0, Math.round(toNumber(identityWrites.failure_total, 0))),
      },
      retrieval: {
        total: Math.max(0, Math.round(toNumber(retrieval.total, 0))),
        public_typed_hits: Math.max(0, Math.round(toNumber(retrieval.public_typed_hits, 0))),
        public_legacy_hits: Math.max(0, Math.round(toNumber(retrieval.public_legacy_hits, 0))),
        legacy_fallback_total: Math.max(
          0,
          Math.round(toNumber(retrieval.legacy_fallback_total, 0)),
        ),
      },
      migration: {
        public_dedup_legacy_fallbacks: Math.max(
          0,
          Math.round(toNumber(migration.public_dedup_legacy_fallbacks, 0)),
        ),
        public_cooldown_legacy_fallbacks: Math.max(
          0,
          Math.round(toNumber(migration.public_cooldown_legacy_fallbacks, 0)),
        ),
        public_dual_write_total: Math.max(
          0,
          Math.round(toNumber(migration.public_dual_write_total, 0)),
        ),
      },
      nightly_compaction: {
        runs_total: Math.max(0, Math.round(toNumber(nightly.runs_total, 0))),
        created_total: Math.max(0, Math.round(toNumber(nightly.created_total, 0))),
        dedup_hits_total: Math.max(0, Math.round(toNumber(nightly.dedup_hits_total, 0))),
        failure_total: Math.max(0, Math.round(toNumber(nightly.failure_total, 0))),
      },
      updated_at:
        typeof contextMemory.updated_at === 'string'
          ? contextMemory.updated_at
          : new Date(0).toISOString(),
    },
    rollout_gates: [],
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
