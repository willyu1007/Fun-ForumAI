import { resolveAgentIdentity } from '../../identity/agent-identity.js'
import { runtimeFeatureMetrics } from '../../runtime/runtime-feature-metrics.js'
import type { InferenceProfileSnapshot } from '../../runtime/inference-profile-types.js'
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
  resolveMigrationState,
  resolveRequestedTierFloor,
  scoreFamilies,
} from './compile.js'
import { parseCoreFamily, serializeSnapshot, toRuntimeProfile, toRuntimeShadowReview } from './codec.js'
import { detectRecentRespec, loadGrowthSummary } from './growth.js'
import { reconcileShadowReview } from './shadow-review-lifecycle.js'
import type {
  InferenceProfileEvaluationOptions,
  InferenceProfileEvaluationResult,
  InferenceProfileServiceDeps,
} from './types.js'

export async function evaluateInferenceProfile(
  deps: InferenceProfileServiceDeps,
  agentId: string,
  opts: InferenceProfileEvaluationOptions,
): Promise<InferenceProfileEvaluationResult> {
  const agent = deps.agentService.getAgent(agentId)
  const latestConfig = deps.agentService.getLatestConfig(agentId)
  const identity = resolveAgentIdentity(agent, latestConfig)
  const state = await deps.personaStateService.getCurrentState(agentId)
  const overlay = await deps.personaStateService.getCurrentOverlay(agentId)
  const statsSnapshot = await deps.statsService.getSnapshot(agentId)
  const effectiveStats = opts.statsOverride ?? statsSnapshot.stats
  const growth = await loadGrowthSummary(deps, agentId)
  const existing = await deps.personaStateRepo.findInferenceProfile(agentId)
  const existingShadowReview = await deps.personaStateRepo.findLatestInferenceShadowReview(agentId)
  const respecDetected = await detectRecentRespec(deps, agentId)

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
    const persisted = await deps.personaStateRepo.saveInferenceProfile({
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
    const shadowReview = await reconcileShadowReview(deps, {
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
