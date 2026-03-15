import { resolveAgentIdentity } from '../../identity/agent-identity.js'
import { ValidationError } from '../../lib/errors.js'
import { runtimeFeatureMetrics } from '../../runtime/runtime-feature-metrics.js'
import { resolveBlockedReason, resolveGrowthGate, resolveMigrationState } from './compile.js'
import { serializeSnapshot, toRuntimeProfile } from './codec.js'
import { evaluateInferenceProfile } from './evaluation.js'
import { detectRecentRespec, loadGrowthSummary } from './growth.js'
import {
  collectShadowReviewEvidence,
  createShadowReview,
  finalizeShadowReview,
} from './shadow-review-lifecycle.js'
import { buildVisibleRouteDecision } from './route-resolution.js'
import type { InferenceProfileServiceDeps, ResolveVisibleRouteInput } from './types.js'

export async function resolveInferenceVisibleRoute(
  deps: InferenceProfileServiceDeps,
  input: ResolveVisibleRouteInput,
) {
  const agent = deps.agentService.getAgent(input.agentId)
  const latestConfig = deps.agentService.getLatestConfig(input.agentId)
  const identity = resolveAgentIdentity(agent, latestConfig)
  const compiled = await evaluateInferenceProfile(deps, input.agentId, { persist: true })
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

export async function approveShadow(
  deps: InferenceProfileServiceDeps,
  agentId: string,
  updatedBy: string,
) {
  const compiled = await evaluateInferenceProfile(deps, agentId, { persist: true })
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
  const growthGate = resolveGrowthGate((await loadGrowthSummary(deps, agentId)).growthPointsTotal)
  if (!growthGate.canRareReanchor) {
    throw new ValidationError('Growth gate has not unlocked rare reanchor yet')
  }

  await deps.agentService.updateConfig(
    agentId,
    {
      voice: {
        homeVoiceLineId: compiled.profile.challengerVoiceLineId,
        selectedAt: new Date().toISOString(),
      },
    },
    updatedBy,
  )

  const recompiled = await evaluateInferenceProfile(deps, agentId, { persist: false })
  const persisted = await deps.personaStateRepo.saveInferenceProfile({
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
    freeze_until: recompiled.profile.freezeUntil ? new Date(recompiled.profile.freezeUntil) : null,
    last_compiled_at: new Date(),
    last_snapshot_json: serializeSnapshot(recompiled.snapshot),
  })
  await finalizeShadowReview(
    deps,
    compiled.shadowReview.id,
    'applied',
    updatedBy,
    'shadow_compare_applied',
  )
  runtimeFeatureMetrics.recordInferenceProfileReanchor()
  return toRuntimeProfile(persisted)
}

export async function startShadowReview(
  deps: InferenceProfileServiceDeps,
  agentId: string,
  actorUserId = 'system',
) {
  const agent = deps.agentService.getAgent(agentId)
  const latestConfig = deps.agentService.getLatestConfig(agentId)
  const identity = resolveAgentIdentity(agent, latestConfig)
  const compiled = await evaluateInferenceProfile(deps, agentId, { persist: true })
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

  return createShadowReview(deps, {
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
}

export async function collectShadowReview(
  deps: InferenceProfileServiceDeps,
  agentId: string,
  actorUserId = 'system',
) {
  const agent = deps.agentService.getAgent(agentId)
  const latestConfig = deps.agentService.getLatestConfig(agentId)
  const identity = resolveAgentIdentity(agent, latestConfig)
  const compiled = await evaluateInferenceProfile(deps, agentId, { persist: true })
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

  return collectShadowReviewEvidence(deps, {
    agentId,
    actorUserId,
    compiled,
    review,
    incumbentVoiceLineId: identity.summary.home_voice_line_id,
  })
}

export async function setManualVoiceLineLock(
  deps: InferenceProfileServiceDeps,
  agentId: string,
  locked: boolean,
  actorUserId = 'system',
) {
  const compiled = await evaluateInferenceProfile(deps, agentId, { persist: false })
  const growthGate = resolveGrowthGate((await loadGrowthSummary(deps, agentId)).growthPointsTotal)
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
    shadowWindow: (await detectRecentRespec(deps, agentId)) ? 2 : 5,
  })
  const persisted = await deps.personaStateRepo.saveInferenceProfile({
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
    await finalizeShadowReview(
      deps,
      compiled.shadowReview.id,
      'rejected',
      actorUserId,
      'shadow_compare_manual_lock',
    )
  }
  return toRuntimeProfile(persisted)
}

export async function blockChallenger(
  deps: InferenceProfileServiceDeps,
  agentId: string,
  actorUserId = 'system',
) {
  const compiled = await evaluateInferenceProfile(deps, agentId, { persist: false })
  const freezeUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const persisted = await deps.personaStateRepo.saveInferenceProfile({
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
    candidate_since: compiled.profile.candidateSince ? new Date(compiled.profile.candidateSince) : null,
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
    await finalizeShadowReview(
      deps,
      compiled.shadowReview.id,
      'rejected',
      actorUserId,
      'shadow_compare_rejected',
    )
  }
  return toRuntimeProfile(persisted)
}
