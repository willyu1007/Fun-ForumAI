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

function deepMerge(base: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch
  if (!base || typeof base !== 'object' || Array.isArray(base)) return patch
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const existing = out[key]
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && existing
      && typeof existing === 'object'
      && !Array.isArray(existing)
    ) {
      out[key] = deepMerge(existing, value)
    } else {
      out[key] = value
    }
  }
  return out
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return value
}

function inferRiskLevel(patch: Record<string, unknown>, explicit?: ConfigRiskLevel): ConfigRiskLevel {
  if (explicit) return explicit
  const serialized = JSON.stringify(patch)
  const highRiskMarkers = [
    'aftershow',
    'incubation',
    'allocator',
    'moderation',
    'notifications',
    'threshold',
    'grant_required',
  ]
  if (highRiskMarkers.some((item) => serialized.includes(item))) return 'HIGH'
  return 'LOW'
}

function lintProposedConfig(proposedRules: Record<string, unknown>): string[] {
  const errors: string[] = []

  const moderation = toRecord(proposedRules.moderation)
  const thresholds = moderation ? toRecord(moderation.thresholds) : null
  const low = thresholds ? toNumber(thresholds.low_max_score) : null
  const medium = thresholds ? toNumber(thresholds.medium_max_score) : null
  const reject = thresholds ? toNumber(thresholds.auto_reject_score) : null
  if (low !== null && medium !== null && reject !== null) {
    if (!(low < medium && medium < reject)) {
      errors.push('moderation.thresholds must satisfy low_max_score < medium_max_score < auto_reject_score')
    }
  }

  const allocator = toRecord(proposedRules.allocator)
  const communityMax = allocator ? toNumber(allocator.community_max_agents) : null
  const threadMax = allocator ? toNumber(allocator.thread_max_agents) : null
  if (communityMax !== null && threadMax !== null && threadMax > communityMax) {
    errors.push('allocator.thread_max_agents cannot be greater than allocator.community_max_agents')
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
    const versions = await this.deps.configRepo.listVersionsByCommunity(communityId)
    const activeVersion = versions.find((item) => item.status === 'ACTIVE') ?? null
    const rules = (community.rules_json ?? {}) as Record<string, unknown>
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
    const baseRules = (community.rules_json ?? {}) as Record<string, unknown>
    const merged = deepMerge(baseRules, input.patch) as Record<string, unknown>
    const riskLevel = inferRiskLevel(input.patch, input.risk_level)
    const patch = await this.deps.configRepo.createPatch({
      community_id: input.community_id,
      base_version_id: latest?.id ?? null,
      status: 'PROPOSED',
      risk_level: riskLevel,
      patch_json: input.patch,
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

    return patch
  }

  async validateProposal(input: {
    proposal_id: string
    community_id?: string
    actor_user_id: string
  }): Promise<{ patch: CommunityConfigPatch; validation_errors: string[] }> {
    const patch = await this.deps.configRepo.findPatchById(input.proposal_id)
    if (!patch) throw new NotFoundError('CommunityConfigPatch', input.proposal_id)
    this.assertPatchBelongsToCommunity(patch, input.community_id)
    this.assertPatchStatusForAction(patch, ['PROPOSED'], 'validated')

    const proposed = patch.proposed_rules_json ?? {}
    const stage = resolveStageSpecFromRules(proposed, { community_id: patch.community_id })
    const lintErrors = lintProposedConfig(proposed)
    const errors = [...stage.errors, ...lintErrors]

    const nextStatus: CommunityConfigPatch['status'] = errors.length > 0 ? 'REJECTED' : 'VALIDATED'
    const updated = await this.deps.configRepo.updatePatch(patch.id, {
      status: nextStatus,
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
      patch: updated,
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
    const patch = await this.deps.configRepo.findPatchById(input.proposal_id)
    if (!patch) throw new NotFoundError('CommunityConfigPatch', input.proposal_id)
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
      status: 'APPROVED',
      approved_by_user_id: input.actor_user_id,
      approved_at: new Date(),
      rejected_reason: null,
    })
    if (!updated) throw new NotFoundError('CommunityConfigPatch', patch.id)

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

    return updated
  }

  async rejectProposal(input: {
    proposal_id: string
    community_id?: string
    actor_user_id: string
    actor_role: 'admin' | 'user'
    reason?: string
  }): Promise<CommunityConfigPatch> {
    const patch = await this.deps.configRepo.findPatchById(input.proposal_id)
    if (!patch) throw new NotFoundError('CommunityConfigPatch', input.proposal_id)
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
      status: 'REJECTED',
      approved_by_user_id: input.actor_user_id,
      approved_at: new Date(),
      rejected_reason: input.reason ?? 'rejected_by_admin',
    })
    if (!updated) throw new NotFoundError('CommunityConfigPatch', patch.id)

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

    return updated
  }

  async applyProposal(input: {
    proposal_id: string
    community_id?: string
    actor_user_id: string
    actor_role: 'admin' | 'user'
    effective_at?: Date | null
  }): Promise<{ patch: CommunityConfigPatch; version: CommunityConfigVersion | null }> {
    const patch = await this.deps.configRepo.findPatchById(input.proposal_id)
    if (!patch) throw new NotFoundError('CommunityConfigPatch', input.proposal_id)
    this.assertPatchBelongsToCommunity(patch, input.community_id)
    this.assertPatchApplyAllowed(patch, input.actor_role)

    const effectiveAt = input.effective_at ?? null
    if (effectiveAt && isFutureDate(effectiveAt)) {
      const scheduled = await this.deps.configRepo.updatePatch(patch.id, {
        status: 'SCHEDULED',
        effective_at: effectiveAt,
        meta: {
          ...(patch.meta ?? {}),
          scheduled_by: input.actor_user_id,
          scheduled_at: new Date().toISOString(),
        },
      })
      if (!scheduled) throw new NotFoundError('CommunityConfigPatch', patch.id)
      return { patch: scheduled, version: null }
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

    for (const patch of duePatches) {
      const previousRetryCount = getRetryCount(patch.meta)
      if (previousRetryCount >= maxRetries) {
        exhausted += 1
        failed += 1
        await this.deps.configRepo.updatePatch(patch.id, {
          status: 'REJECTED',
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
          ...(exhaustedNow
            ? {
                status: 'REJECTED',
                rejected_reason: 'scheduler_retry_exhausted',
              }
            : {
                status: 'SCHEDULED',
                effective_at: nextRetryAt,
              }),
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
    const targetVersion = await this.deps.configRepo.findVersionById(input.version_id)
    if (!targetVersion || targetVersion.community_id !== input.community_id) {
      throw new NotFoundError('CommunityConfigVersion', input.version_id)
    }

    const latest = await this.deps.configRepo.findLatestVersionByCommunity(input.community_id)
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
    return { versions, patches }
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

    const latest = await this.deps.configRepo.findLatestVersionByCommunity(patch.community_id)
    if (latest && latest.status === 'ACTIVE') {
      await this.deps.configRepo.updateVersion(latest.id, {
        status: 'RETIRED',
      })
    }

    const nextVersionNumber = (latest?.version ?? 0) + 1
    const nextRules = (patch.proposed_rules_json ?? community.rules_json ?? {}) as Record<string, unknown>

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
      effective_at: input.effective_at ?? patch.effective_at ?? input.applied_at,
      applied_version_id: version.id,
      applied_at: input.applied_at,
      meta: {
        ...(patch.meta ?? {}),
        applied_version: nextVersionNumber,
      },
    })
    if (!updatedPatch) throw new NotFoundError('CommunityConfigPatch', patch.id)

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
        version_id: version.id,
        version: version.version,
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
          version_id: version.id,
          component,
          state: 'activated',
        },
      })
    }

    return { patch: updatedPatch, version }
  }
}
