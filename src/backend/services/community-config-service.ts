import { isDeepStrictEqual } from 'node:util'
import type {
  CommunityRepository,
  CommunityConfigRepository,
  EventRepository,
  CommunityConfigPatch,
  CommunityConfigVersion,
  ConfigRiskLevel,
} from '../repos/index.js'
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js'
import { resolveStageSpecFromRules } from '../stage/index.js'
import type { UpdateCommunityConfigPatchInput } from '../repos/index.js'
import {
  deepMerge,
  inferCommunityConfigRiskLevel,
  normalizeCommunityConfigPatchRecord,
  normalizeCommunityConfigRules,
  normalizeCommunityConfigVersionRecord,
  normalizeIncomingCommunityConfigPatch,
} from './community-config-normalization.js'

export interface CommunityConfigServiceDeps {
  communityRepo: CommunityRepository
  configRepo: CommunityConfigRepository
  eventRepo: EventRepository
}

interface ConfigApplyActor {
  actor_type: 'human' | 'system'
  actor_id: string
  actor_role: 'admin' | 'user' | 'system'
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return value
}

function lintProposedConfig(proposedRules: Record<string, unknown>): string[] {
  const errors: string[] = []

  const stageSpec = toRecord(proposedRules.stage_spec_v1)
  const allocator = stageSpec ? toRecord(stageSpec.allocator) : null
  const communityMaxAgents = allocator ? toNumber(allocator.community_max_agents) : null
  const threadMaxAgents = allocator ? toNumber(allocator.thread_max_agents) : null
  if (
    communityMaxAgents !== null
    && threadMaxAgents !== null
    && threadMaxAgents > communityMaxAgents
  ) {
    errors.push('stage_spec_v1.allocator.thread_max_agents must be <= stage_spec_v1.allocator.community_max_agents')
  }

  const moderation = stageSpec ? toRecord(stageSpec.moderation) : null
  const thresholds = moderation ? toRecord(moderation.thresholds) : null
  const low = thresholds ? toNumber(thresholds.low_max_score) : null
  const medium = thresholds ? toNumber(thresholds.medium_max_score) : null
  const reject = thresholds ? toNumber(thresholds.auto_reject_score) : null
  if (low !== null && medium !== null && reject !== null) {
    if (!(low < medium && medium < reject)) {
      errors.push('moderation.thresholds must satisfy low_max_score < medium_max_score < auto_reject_score')
    }
  }

  return errors
}

function isFutureDate(input: Date): boolean {
  return input.getTime() > Date.now()
}

function getRetryCount(meta: Record<string, unknown> | null): number {
  if (!meta) return 0
  const raw = meta.scheduler_retry_count
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0
  return raw
}

export class CommunityConfigService {
  private readonly activationComponents = ['prompt', 'allocator', 'moderation', 'aftershow_scheduler', 'notification_policy']

  constructor(private readonly deps: CommunityConfigServiceDeps) {}

  async getCurrentConfig(communityId: string): Promise<{
    community_id: string
    rules_json: Record<string, unknown>
    active_version: CommunityConfigVersion | null
  }> {
    const community = this.deps.communityRepo.findById(communityId)
    if (!community) throw new NotFoundError('Community', communityId)
    const versions = (await this.deps.configRepo.listVersionsByCommunity(communityId))
      .map((item) => normalizeCommunityConfigVersionRecord(item))
    const activeVersion = versions.find((item) => item.status === 'ACTIVE') ?? null
    const rules = normalizeCommunityConfigRules((community.rules_json ?? {}) as Record<string, unknown>)
    return {
      community_id: communityId,
      rules_json: rules,
      active_version: activeVersion,
    }
  }

  async createProposal(input: {
    community_id: string
    patch: Record<string, unknown>
    summary?: string
    reason?: string
    proposed_by_user_id: string
    risk_level?: ConfigRiskLevel
  }): Promise<CommunityConfigPatch> {
    const community = this.deps.communityRepo.findById(input.community_id)
    if (!community) throw new NotFoundError('Community', input.community_id)
    if (!input.patch || Object.keys(input.patch).length === 0) {
      throw new ValidationError('patch is required')
    }

    const latest = await this.deps.configRepo.findLatestVersionByCommunity(input.community_id)
    const baseRules = normalizeCommunityConfigRules((community.rules_json ?? {}) as Record<string, unknown>)
    const normalizedPatch = normalizeIncomingCommunityConfigPatch(input.patch)
    const merged = normalizeCommunityConfigRules(
      deepMerge(baseRules, normalizedPatch) as Record<string, unknown>,
    )
    const riskLevel = inferCommunityConfigRiskLevel(normalizedPatch, input.risk_level)
    const patch = await this.deps.configRepo.createPatch({
      community_id: input.community_id,
      base_version_id: latest?.id ?? null,
      status: 'PROPOSED',
      risk_level: riskLevel,
      patch_json: normalizedPatch,
      proposed_rules_json: merged,
      summary: input.summary ?? null,
      reason: input.reason ?? null,
      proposed_by_user_id: input.proposed_by_user_id,
    })

    this.deps.eventRepo.create({
      event_type: 'COMMUNITY_CONFIG_PROPOSED',
      plane: 'CONTROL',
      schema_version: 'v1',
      community_id: input.community_id,
      actor_type: 'human',
      actor_id: input.proposed_by_user_id,
      correlation_id: patch.id,
      payload_json: {
        patch_id: patch.id,
        base_version_id: patch.base_version_id,
        risk_level: patch.risk_level,
      },
    })

    return normalizeCommunityConfigPatchRecord(patch)
  }

  async validateProposal(input: {
    proposal_id: string
    community_id?: string
    actor_user_id: string
  }): Promise<{ patch: CommunityConfigPatch; validation_errors: string[] }> {
    const rawPatch = await this.deps.configRepo.findPatchById(input.proposal_id)
    if (!rawPatch) throw new NotFoundError('CommunityConfigPatch', input.proposal_id)
    const { patch, normalizationUpdate } = await this.normalizePatchForEvaluation(rawPatch)
    this.assertPatchBelongsToCommunity(patch, input.community_id)
    this.assertPatchStatusForAction(patch, ['PROPOSED'], 'validated')

    const proposed = patch.proposed_rules_json ?? {}
    const stage = resolveStageSpecFromRules(proposed, { community_id: patch.community_id })
    const lintErrors = lintProposedConfig(proposed)
    const errors = [...stage.errors, ...lintErrors]

    const nextStatus: CommunityConfigPatch['status'] = errors.length > 0 ? 'REJECTED' : 'VALIDATED'
    const updated = await this.deps.configRepo.updatePatch(patch.id, {
      ...(normalizationUpdate ?? {}),
      status: nextStatus,
      risk_level: patch.risk_level,
      proposed_rules_json: proposed,
      validated_by_user_id: input.actor_user_id,
      validated_at: new Date(),
      rejected_reason: errors.length > 0 ? errors.join('; ') : null,
      meta: errors.length > 0
        ? {
            ...(patch.meta ?? {}),
            validation_failed_at: new Date().toISOString(),
          }
        : patch.meta ?? null,
    })
    if (!updated) throw new NotFoundError('CommunityConfigPatch', patch.id)
    const normalizedUpdated = normalizeCommunityConfigPatchRecord(updated)

    this.deps.eventRepo.create({
      event_type: errors.length > 0 ? 'COMMUNITY_CONFIG_VALIDATION_FAILED' : 'COMMUNITY_CONFIG_VALIDATED',
      plane: 'CONTROL',
      schema_version: 'v1',
      community_id: patch.community_id,
      actor_type: 'human',
      actor_id: input.actor_user_id,
      correlation_id: patch.id,
      payload_json: {
        patch_id: patch.id,
        status: nextStatus,
        validation_errors: errors,
      },
    })

    return {
      patch: normalizedUpdated,
      validation_errors: errors,
    }
  }

  async approveProposal(input: {
    proposal_id: string
    community_id?: string
    actor_user_id: string
    actor_role: 'admin' | 'user'
    reason?: string
  }): Promise<CommunityConfigPatch> {
    const rawPatch = await this.deps.configRepo.findPatchById(input.proposal_id)
    if (!rawPatch) throw new NotFoundError('CommunityConfigPatch', input.proposal_id)
    const { patch, normalizationUpdate } = await this.normalizePatchForEvaluation(rawPatch)
    this.assertPatchBelongsToCommunity(patch, input.community_id)
    this.assertPatchStatusForAction(patch, ['VALIDATED'], 'approved')
    if (input.actor_role !== 'admin') {
      throw new ForbiddenError('Only admin can approve config patches')
    }

    await this.deps.configRepo.createApproval({
      patch_id: patch.id,
      actor_user_id: input.actor_user_id,
      decision: 'APPROVED',
      reason: input.reason ?? null,
    })

    const updated = await this.deps.configRepo.updatePatch(patch.id, {
      ...(normalizationUpdate ?? {}),
      status: 'APPROVED',
      risk_level: patch.risk_level,
      proposed_rules_json: patch.proposed_rules_json,
      approved_by_user_id: input.actor_user_id,
      approved_at: new Date(),
      rejected_reason: null,
    })
    if (!updated) throw new NotFoundError('CommunityConfigPatch', patch.id)
    const normalizedUpdated = normalizeCommunityConfigPatchRecord(updated)

    this.deps.eventRepo.create({
      event_type: 'COMMUNITY_CONFIG_APPROVED',
      plane: 'CONTROL',
      schema_version: 'v1',
      community_id: patch.community_id,
      actor_type: 'human',
      actor_id: input.actor_user_id,
      correlation_id: patch.id,
      payload_json: {
        patch_id: patch.id,
        reason: input.reason ?? null,
      },
    })

    return normalizedUpdated
  }

  async rejectProposal(input: {
    proposal_id: string
    community_id?: string
    actor_user_id: string
    actor_role: 'admin' | 'user'
    reason?: string
  }): Promise<CommunityConfigPatch> {
    const rawPatch = await this.deps.configRepo.findPatchById(input.proposal_id)
    if (!rawPatch) throw new NotFoundError('CommunityConfigPatch', input.proposal_id)
    const { patch, normalizationUpdate } = await this.normalizePatchForEvaluation(rawPatch)
    this.assertPatchBelongsToCommunity(patch, input.community_id)
    this.assertPatchStatusForAction(patch, ['PROPOSED', 'VALIDATED'], 'rejected')
    if (input.actor_role !== 'admin') {
      throw new ForbiddenError('Only admin can reject config patches')
    }

    await this.deps.configRepo.createApproval({
      patch_id: patch.id,
      actor_user_id: input.actor_user_id,
      decision: 'REJECTED',
      reason: input.reason ?? null,
    })

    const updated = await this.deps.configRepo.updatePatch(patch.id, {
      ...(normalizationUpdate ?? {}),
      status: 'REJECTED',
      risk_level: patch.risk_level,
      proposed_rules_json: patch.proposed_rules_json,
      approved_by_user_id: input.actor_user_id,
      approved_at: new Date(),
      rejected_reason: input.reason ?? 'rejected_by_admin',
    })
    if (!updated) throw new NotFoundError('CommunityConfigPatch', patch.id)
    const normalizedUpdated = normalizeCommunityConfigPatchRecord(updated)

    this.deps.eventRepo.create({
      event_type: 'COMMUNITY_CONFIG_REJECTED',
      plane: 'CONTROL',
      schema_version: 'v1',
      community_id: patch.community_id,
      actor_type: 'human',
      actor_id: input.actor_user_id,
      correlation_id: patch.id,
      payload_json: {
        patch_id: patch.id,
        reason: input.reason ?? null,
      },
    })

    return normalizedUpdated
  }

  async applyProposal(input: {
    proposal_id: string
    community_id?: string
    actor_user_id: string
    actor_role: 'admin' | 'user'
    effective_at?: Date | null
  }): Promise<{ patch: CommunityConfigPatch; version: CommunityConfigVersion | null }> {
    const rawPatch = await this.deps.configRepo.findPatchById(input.proposal_id)
    if (!rawPatch) throw new NotFoundError('CommunityConfigPatch', input.proposal_id)
    const { patch, normalizationUpdate } = await this.normalizePatchForEvaluation(rawPatch)
    this.assertPatchBelongsToCommunity(patch, input.community_id)
    this.assertPatchApplyAllowed(patch, input.actor_role)

    const effectiveAt = input.effective_at ?? null
    if (effectiveAt && isFutureDate(effectiveAt)) {
      const scheduled = await this.deps.configRepo.updatePatch(patch.id, {
        ...(normalizationUpdate ?? {}),
        status: 'SCHEDULED',
        risk_level: patch.risk_level,
        proposed_rules_json: patch.proposed_rules_json,
        effective_at: effectiveAt,
        meta: {
          ...(patch.meta ?? {}),
          scheduled_by: input.actor_user_id,
          scheduled_at: new Date().toISOString(),
        },
      })
      if (!scheduled) throw new NotFoundError('CommunityConfigPatch', patch.id)
      return { patch: normalizeCommunityConfigPatchRecord(scheduled), version: null }
    }

    const result = await this.applyProposalNow({
      patch,
      actor: {
        actor_type: 'human',
        actor_id: input.actor_user_id,
        actor_role: input.actor_role,
      },
      applied_at: new Date(),
      effective_at: effectiveAt,
    })
    return { patch: result.patch, version: result.version }
  }

  async processDueScheduled(input?: {
    limit?: number
    max_retries?: number
    backoff_base_ms?: number
    backoff_max_ms?: number
  }): Promise<{ processed: number; failed: number; exhausted: number }> {
    const limit = input?.limit ?? 20
    const maxRetries = input?.max_retries ?? 5
    const backoffBaseMs = input?.backoff_base_ms ?? 30_000
    const backoffMaxMs = input?.backoff_max_ms ?? 15 * 60_000

    const duePatches = await this.deps.configRepo.listDueScheduledPatches(new Date(), limit)
    let failed = 0
    let exhausted = 0

    for (const duePatch of duePatches) {
      const { patch, normalizationUpdate } = await this.normalizePatchForEvaluation(duePatch)
      const previousRetryCount = getRetryCount(patch.meta)
      if (previousRetryCount >= maxRetries) {
        exhausted += 1
        failed += 1
        await this.deps.configRepo.updatePatch(patch.id, {
          ...(normalizationUpdate ?? {}),
          status: 'REJECTED',
          risk_level: patch.risk_level,
          proposed_rules_json: patch.proposed_rules_json,
          rejected_reason: 'scheduler_retry_exhausted',
          meta: {
            ...(patch.meta ?? {}),
            scheduler_retry_exhausted_at: new Date().toISOString(),
            scheduler_retry_count: previousRetryCount,
          },
        })
        this.deps.eventRepo.create({
          event_type: 'COMMUNITY_CONFIG_APPLY_FAILED',
          plane: 'CONTROL',
          schema_version: 'v1',
          community_id: patch.community_id,
          actor_type: 'system',
          actor_id: 'community_config_scheduler',
          correlation_id: patch.id,
          payload_json: {
            patch_id: patch.id,
            retry_count: previousRetryCount,
            terminal: true,
            error: 'scheduler_retry_exhausted',
          },
        })
        continue
      }

      try {
        await this.applyProposalNow({
          patch,
          actor: {
            actor_type: 'system',
            actor_id: 'community_config_scheduler',
            actor_role: 'system',
          },
          applied_at: new Date(),
          effective_at: patch.effective_at ?? null,
        })
      } catch (err) {
        failed += 1
        const message = err instanceof Error ? err.message : String(err)
        const retryCount = previousRetryCount + 1
        const exhaustedNow = retryCount >= maxRetries
        const backoffMs = Math.min(backoffBaseMs * (2 ** Math.max(0, retryCount - 1)), backoffMaxMs)
        const nextRetryAt = new Date(Date.now() + backoffMs)
        if (exhaustedNow) {
          exhausted += 1
        }
        await this.deps.configRepo.updatePatch(patch.id, {
          ...(normalizationUpdate ?? {}),
          ...(exhaustedNow
            ? {
                status: 'REJECTED',
                rejected_reason: 'scheduler_retry_exhausted',
              }
            : {
                status: 'SCHEDULED',
                effective_at: nextRetryAt,
              }),
          risk_level: patch.risk_level,
          proposed_rules_json: patch.proposed_rules_json,
          meta: {
            ...(patch.meta ?? {}),
            scheduler_retry_count: retryCount,
            scheduler_last_error: message,
            scheduler_last_error_at: new Date().toISOString(),
            ...(exhaustedNow
              ? {
                  scheduler_retry_exhausted_at: new Date().toISOString(),
                }
              : {
                  scheduler_next_retry_at: nextRetryAt.toISOString(),
                }),
          },
        })
        this.deps.eventRepo.create({
          event_type: 'COMMUNITY_CONFIG_APPLY_FAILED',
          plane: 'CONTROL',
          schema_version: 'v1',
          community_id: patch.community_id,
          actor_type: 'system',
          actor_id: 'community_config_scheduler',
          correlation_id: patch.id,
          payload_json: {
            patch_id: patch.id,
            retry_count: retryCount,
            terminal: exhaustedNow,
            next_retry_at: exhaustedNow ? null : nextRetryAt.toISOString(),
            error: message,
          },
        })
      }
    }

    return { processed: duePatches.length, failed, exhausted }
  }

  async rollbackToVersion(input: {
    community_id: string
    version_id: string
    actor_user_id: string
    actor_role: 'admin' | 'user'
    reason?: string
  }): Promise<CommunityConfigVersion> {
    if (input.actor_role !== 'admin') {
      throw new ForbiddenError('Only admin can rollback community config')
    }
    const rawTargetVersion = await this.deps.configRepo.findVersionById(input.version_id)
    const targetVersion = rawTargetVersion ? normalizeCommunityConfigVersionRecord(rawTargetVersion) : null
    if (!targetVersion || targetVersion.community_id !== input.community_id) {
      throw new NotFoundError('CommunityConfigVersion', input.version_id)
    }

    const latestRaw = await this.deps.configRepo.findLatestVersionByCommunity(input.community_id)
    const latest = latestRaw ? normalizeCommunityConfigVersionRecord(latestRaw) : null
    if (latest && latest.status === 'ACTIVE') {
      await this.deps.configRepo.updateVersion(latest.id, {
        status: 'ROLLED_BACK',
        rolled_back_at: new Date(),
      })
    }

    const nextVersionNumber = (latest?.version ?? 0) + 1
    const updatedCommunity = this.deps.communityRepo.update(input.community_id, {
      rules_json: targetVersion.rules_json,
    })
    if (!updatedCommunity) throw new NotFoundError('Community', input.community_id)

    const rollbackVersion = await this.deps.configRepo.createVersion({
      community_id: input.community_id,
      version: nextVersionNumber,
      rules_json: targetVersion.rules_json,
      source_patch_id: null,
      status: 'ACTIVE',
      risk_level: 'HIGH',
      created_by_user_id: input.actor_user_id,
      rollback_from_version_id: targetVersion.id,
      effective_at: new Date(),
      applied_at: new Date(),
      meta: {
        rollback_reason: input.reason ?? null,
      },
    })

    this.deps.eventRepo.create({
      event_type: 'COMMUNITY_CONFIG_ROLLED_BACK',
      plane: 'CONTROL',
      schema_version: 'v1',
      community_id: input.community_id,
      actor_type: 'human',
      actor_id: input.actor_user_id,
      correlation_id: rollbackVersion.id,
      payload_json: {
        from_version_id: latest?.id ?? null,
        to_version_id: targetVersion.id,
        rollback_version_id: rollbackVersion.id,
        reason: input.reason ?? null,
      },
    })

    return rollbackVersion
  }

  async getHistory(communityId: string): Promise<{
    versions: CommunityConfigVersion[]
    patches: CommunityConfigPatch[]
  }> {
    const [versions, patches] = await Promise.all([
      this.deps.configRepo.listVersionsByCommunity(communityId),
      this.deps.configRepo.listPatchesByCommunity(communityId),
    ])
    return {
      versions: versions.map((item) => normalizeCommunityConfigVersionRecord(item)),
      patches: patches.map((item) => normalizeCommunityConfigPatchRecord(item)),
    }
  }

  private assertPatchApplyAllowed(patch: CommunityConfigPatch, actorRole: 'admin' | 'user'): void {
    if (patch.status !== 'VALIDATED' && patch.status !== 'APPROVED' && patch.status !== 'SCHEDULED') {
      throw new ValidationError(`patch status ${patch.status} cannot be applied`)
    }
    if (patch.risk_level === 'HIGH' && patch.status !== 'APPROVED' && patch.status !== 'SCHEDULED') {
      throw new ValidationError('high-risk patch must be APPROVED before apply')
    }
    if (patch.risk_level === 'HIGH' && actorRole !== 'admin') {
      throw new ForbiddenError('Only admin can apply high-risk config patches')
    }
  }

  private assertPatchBelongsToCommunity(patch: CommunityConfigPatch, communityId?: string): void {
    if (!communityId) return
    if (patch.community_id !== communityId) {
      throw new NotFoundError('CommunityConfigPatch', patch.id)
    }
  }

  private assertPatchStatusForAction(
    patch: CommunityConfigPatch,
    allowed: CommunityConfigPatch['status'][],
    action: string,
  ): void {
    if (!allowed.includes(patch.status)) {
      throw new ValidationError(`patch status ${patch.status} cannot be ${action}`)
    }
  }

  private async applyProposalNow(input: {
    patch: CommunityConfigPatch
    actor: ConfigApplyActor
    applied_at: Date
    effective_at?: Date | null
  }): Promise<{ patch: CommunityConfigPatch; version: CommunityConfigVersion }> {
    const patch = input.patch
    if (patch.status !== 'VALIDATED' && patch.status !== 'APPROVED' && patch.status !== 'SCHEDULED') {
      throw new ValidationError(`patch status ${patch.status} cannot be applied`)
    }
    if (patch.risk_level === 'HIGH' && patch.status !== 'APPROVED' && patch.status !== 'SCHEDULED') {
      throw new ValidationError('high-risk patch must be APPROVED before apply')
    }

    const community = this.deps.communityRepo.findById(patch.community_id)
    if (!community) throw new NotFoundError('Community', patch.community_id)

    const latestRaw = await this.deps.configRepo.findLatestVersionByCommunity(patch.community_id)
    const latest = latestRaw ? normalizeCommunityConfigVersionRecord(latestRaw) : null
    if (latest && latest.status === 'ACTIVE') {
      await this.deps.configRepo.updateVersion(latest.id, {
        status: 'RETIRED',
      })
    }

    const nextVersionNumber = (latest?.version ?? 0) + 1
    const nextRules = normalizeCommunityConfigRules(
      (patch.proposed_rules_json ?? community.rules_json ?? {}) as Record<string, unknown>,
    )

    const updatedCommunity = this.deps.communityRepo.update(patch.community_id, {
      rules_json: nextRules,
    })
    if (!updatedCommunity) throw new NotFoundError('Community', patch.community_id)

    const version = await this.deps.configRepo.createVersion({
      community_id: patch.community_id,
      version: nextVersionNumber,
      rules_json: nextRules,
      source_patch_id: patch.id,
      status: 'ACTIVE',
      risk_level: patch.risk_level,
      created_by_user_id: input.actor.actor_type === 'human' ? input.actor.actor_id : null,
      effective_at: input.effective_at ?? input.applied_at,
      applied_at: input.applied_at,
      meta: {
        applied_by: input.actor.actor_id,
        source_patch_id: patch.id,
      },
    })

    const updatedPatch = await this.deps.configRepo.updatePatch(patch.id, {
      status: 'APPLIED',
      risk_level: patch.risk_level,
      proposed_rules_json: nextRules,
      effective_at: input.effective_at ?? patch.effective_at ?? input.applied_at,
      applied_version_id: version.id,
      applied_at: input.applied_at,
      meta: {
        ...(patch.meta ?? {}),
        applied_version: nextVersionNumber,
      },
    })
    if (!updatedPatch) throw new NotFoundError('CommunityConfigPatch', patch.id)
    const normalizedUpdatedPatch = normalizeCommunityConfigPatchRecord(updatedPatch)
    const normalizedVersion = normalizeCommunityConfigVersionRecord(version)

    this.deps.eventRepo.create({
      event_type: 'COMMUNITY_CONFIG_APPLIED',
      plane: 'CONTROL',
      schema_version: 'v1',
      community_id: patch.community_id,
      actor_type: input.actor.actor_type,
      actor_id: input.actor.actor_id,
      correlation_id: patch.id,
      payload_json: {
        patch_id: patch.id,
        version_id: normalizedVersion.id,
        version: normalizedVersion.version,
      },
    })

    for (const component of this.activationComponents) {
      this.deps.eventRepo.create({
        event_type: 'COMMUNITY_CONFIG_ACTIVATED',
        plane: 'CONTROL',
        schema_version: 'v1',
        community_id: patch.community_id,
        actor_type: 'system',
        actor_id: component,
        correlation_id: patch.id,
        payload_json: {
          patch_id: patch.id,
          version_id: normalizedVersion.id,
          component,
          state: 'activated',
        },
      })
    }

    return { patch: normalizedUpdatedPatch, version: normalizedVersion }
  }

  private async normalizePatchForEvaluation(
    patch: CommunityConfigPatch,
  ): Promise<{ patch: CommunityConfigPatch; normalizationUpdate?: UpdateCommunityConfigPatchInput }> {
    const normalizedPatch = normalizeCommunityConfigPatchRecord(patch)
    const proposedRules = normalizedPatch.proposed_rules_json ?? normalizeCommunityConfigRules(
      deepMerge(await this.resolvePatchBaseRules(normalizedPatch), normalizedPatch.patch_json) as Record<string, unknown>,
    )
    const nextPatch: CommunityConfigPatch = {
      ...normalizedPatch,
      proposed_rules_json: proposedRules,
      risk_level: inferCommunityConfigRiskLevel(normalizedPatch.patch_json, normalizedPatch.risk_level),
    }

    const normalizationUpdate: UpdateCommunityConfigPatchInput = {}
    if (patch.risk_level !== nextPatch.risk_level) {
      normalizationUpdate.risk_level = nextPatch.risk_level
    }
    if (!isDeepStrictEqual(patch.proposed_rules_json ?? null, proposedRules)) {
      normalizationUpdate.proposed_rules_json = proposedRules
    }

    return {
      patch: nextPatch,
      normalizationUpdate: Object.keys(normalizationUpdate).length > 0 ? normalizationUpdate : undefined,
    }
  }

  private async resolvePatchBaseRules(patch: Pick<CommunityConfigPatch, 'community_id' | 'base_version_id'>): Promise<Record<string, unknown>> {
    if (patch.base_version_id) {
      const baseVersion = await this.deps.configRepo.findVersionById(patch.base_version_id)
      if (baseVersion) {
        return normalizeCommunityConfigRules(baseVersion.rules_json)
      }
    }

    const community = this.deps.communityRepo.findById(patch.community_id)
    if (!community) throw new NotFoundError('Community', patch.community_id)
    return normalizeCommunityConfigRules((community.rules_json ?? {}) as Record<string, unknown>)
  }
}
