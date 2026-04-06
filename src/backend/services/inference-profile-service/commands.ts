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
import type {
  InferenceProfileEvaluationResult,
  InferenceProfileServiceDeps,
  ResolveVisibleRouteInput,
} from './types.js'

export async function resolveInferenceVisibleRoute(
  deps: InferenceProfileServiceDeps,
  input: ResolveVisibleRouteInput,
) {
  const { agent, homeVoiceLineId } = getAgentRoutingContext(deps, input.agentId)
  const compiled = await evaluateInferenceProfile(deps, input.agentId, { persist: true })
  return buildVisibleRouteDecision({
    requestedTier: input.requestedTier,
    requestedTierFloor: compiled.snapshot.requestedTierFloor,
    requestedTierCeiling: input.requestedTierCeiling,
    homeVoiceLineId,
    agentModel: agent.model,
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
  const persisted = await deps.personaStateRepo.saveInferenceProfile(buildPersistedProfileInput(
    recompiled,
    {
      challenger_family: null,
      challenger_voice_line_id: null,
      migration_state: 'stable',
      consecutive_lead_windows: 0,
      challenger_score_delta: null,
      candidate_since: null,
      shadow_started_at: null,
      effective_at: new Date(),
      blocked_at: null,
      blocked_reason: null,
      last_compiled_at: new Date(),
    },
  ))
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
  const { homeVoiceLineId } = getAgentRoutingContext(deps, agentId)
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
    incumbentVoiceLineId: homeVoiceLineId,
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
  const { homeVoiceLineId } = getAgentRoutingContext(deps, agentId)
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
    incumbentVoiceLineId: homeVoiceLineId,
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
  const persisted = await deps.personaStateRepo.saveInferenceProfile(buildPersistedProfileInput(
    compiled,
    {
      manual_voice_line_lock: locked,
      migration_state: nextMigrationState,
      blocked_at: nextMigrationState === 'blocked' ? new Date() : null,
      blocked_reason: nextBlockedReason,
      candidate_since:
        nextMigrationState === 'candidate' || nextMigrationState === 'shadow'
          ? toDate(compiled.profile.candidateSince) ?? new Date()
          : null,
      shadow_started_at:
        nextMigrationState === 'shadow'
          ? toDate(compiled.profile.shadowStartedAt) ?? new Date()
          : null,
    },
  ))
  await rejectPendingShadowReview(deps, compiled, locked, actorUserId, 'shadow_compare_manual_lock')
  return toRuntimeProfile(persisted)
}

export async function blockChallenger(
  deps: InferenceProfileServiceDeps,
  agentId: string,
  actorUserId = 'system',
) {
  const compiled = await evaluateInferenceProfile(deps, agentId, { persist: false })
  const freezeUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const persisted = await deps.personaStateRepo.saveInferenceProfile(buildPersistedProfileInput(
    compiled,
    {
      migration_state: compiled.profile.challengerFamily ? 'blocked' : 'stable',
      blocked_at: compiled.profile.challengerFamily ? new Date() : null,
      blocked_reason: compiled.profile.challengerFamily ? 'admin_block' : null,
      freeze_until: compiled.profile.challengerFamily ? freezeUntil : null,
    },
  ))
  await rejectPendingShadowReview(deps, compiled, true, actorUserId, 'shadow_compare_rejected')
  return toRuntimeProfile(persisted)
}

type SaveInferenceProfileInput = Parameters<
  InferenceProfileServiceDeps['personaStateRepo']['saveInferenceProfile']
>[0]

function getAgentRoutingContext(deps: InferenceProfileServiceDeps, agentId: string) {
  const agent = deps.agentService.getAgent(agentId)
  const latestConfig = deps.agentService.getLatestConfig(agentId)
  const identity = resolveAgentIdentity(agent, latestConfig)
  return {
    agent,
    homeVoiceLineId: identity.summary.home_voice_line_id,
  }
}

function buildPersistedProfileInput(
  compiled: InferenceProfileEvaluationResult,
  overrides: Partial<SaveInferenceProfileInput>,
): SaveInferenceProfileInput {
  return {
    agent_id: compiled.profile.agentId,
    profile_version: compiled.profile.profileVersion,
    incumbent_family: compiled.profile.incumbentFamily,
    challenger_family: compiled.profile.challengerFamily,
    challenger_voice_line_id: compiled.profile.challengerVoiceLineId,
    migration_state: compiled.profile.migrationState,
    consecutive_lead_windows: compiled.profile.consecutiveLeadWindows,
    challenger_score_delta: compiled.profile.challengerScoreDelta,
    manual_voice_line_lock: compiled.profile.manualVoiceLineLock,
    candidate_since: toDate(compiled.profile.candidateSince),
    shadow_started_at: toDate(compiled.profile.shadowStartedAt),
    effective_at: toDate(compiled.profile.effectiveAt),
    blocked_at: toDate(compiled.profile.blockedAt),
    blocked_reason: compiled.profile.blockedReason,
    freeze_until: toDate(compiled.profile.freezeUntil),
    last_compiled_at: toDate(compiled.profile.lastCompiledAt) ?? new Date(),
    last_snapshot_json: serializeSnapshot(compiled.snapshot),
    ...overrides,
  }
}

async function rejectPendingShadowReview(
  deps: InferenceProfileServiceDeps,
  compiled: InferenceProfileEvaluationResult,
  shouldReject: boolean,
  actorUserId: string,
  resolutionAction: string,
): Promise<void> {
  if (!shouldReject || !compiled.shadowReview || compiled.shadowReview.status === 'applied') {
    return
  }

  await finalizeShadowReview(
    deps,
    compiled.shadowReview.id,
    'rejected',
    actorUserId,
    resolutionAction,
  )
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}
