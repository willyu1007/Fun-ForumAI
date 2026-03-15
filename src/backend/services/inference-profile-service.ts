import type { RenderTier, VoiceLineId } from '../../shared/agent-persona-catalog.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import type { UsageLedgerRepository } from '../llm/usage-ledger.js'
import { personaObservability } from '../runtime/persona-observability.js'
import { runtimeFeatureMetrics } from '../runtime/runtime-feature-metrics.js'
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
  type AgentInferenceProfile,
  type AgentInferenceShadowReview,
  type CoreFamily,
  type InferenceProfileSnapshot,
  type InferenceRouteDecision,
  type OwnerPersonalityNarrative,
  type ShadowReviewEvidence,
} from '../runtime/inference-profile-types.js'
import {
  HOME_LINE_FAMILY_MAP,
  buildNarrativeSummary,
  buildRuntimeProfile,
  compileInferenceSignals,
  compileTemperamentAxes,
  findChallengerFamily,
  resolveBlockedReason,
  resolveChallengerVoiceLine,
  resolveGrowthGate,
  resolveRequestedTierFloor,
  resolveMigrationState,
  scoreFamilies,
} from './inference-profile-service/compile.js'
import {
  buildIdentityWriteDelta,
  parseCoreFamily,
  toRuntimeProfile,
  toRuntimeShadowReview,
  serializeSnapshot,
} from './inference-profile-service/codec.js'
import {
  buildCollectedShadowReviewSummary,
  buildNotRunGateSnapshot,
  buildRunningShadowReviewEvidence,
  buildRunningShadowReviewSummary,
  buildShadowCompareDimensions,
  serializeShadowReviewEvidence,
  serializeShadowReviewSummary,
  summarizeWindow,
  toShadowReviewFallbackEntry,
} from './inference-profile-service/shadow-review.js'
import { buildVisibleRouteDecision } from './inference-profile-service/route-resolution.js'

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
    return buildVisibleRouteDecision({
      requestedTier: input.requestedTier,
      requestedTierFloor: compiled.snapshot.requestedTierFloor,
      homeVoiceLineId: identity.summary.home_voice_line_id,
      agentModel: agent.model,
      visibleModelPin: compiled.profile.visibleModelPin,
      profile: compiled.profile,
      snapshot: compiled.snapshot,
    })
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
      shadowStartedAt: compiled.profile.shadowStartedAt,
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
    shadowStartedAt: string | null
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
      started_at: input.shadowStartedAt ? new Date(input.shadowStartedAt) : new Date(),
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

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
