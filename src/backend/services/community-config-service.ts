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

export class CommunityConfigService {
  constructor(private readonly deps: CommunityConfigServiceDeps) {}

  async getCurrentConfig(communityId: string): Promise<{
    community_id: string
    rules_json: Record<string, unknown>
    active_version: CommunityConfigVersion | null
  }> {
    const community = this.deps.communityRepo.findById(communityId)
    if (!community) throw new NotFoundError('Community', communityId)
    const latest = await this.deps.configRepo.findLatestVersionByCommunity(communityId)
    const rules = (community.rules_json ?? {}) as Record<string, unknown>
    return {
      community_id: communityId,
      rules_json: rules,
      active_version: latest,
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
      status: 'DRAFT',
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
    patch_id: string
    actor_user_id: string
  }): Promise<{ patch: CommunityConfigPatch; validation_errors: string[] }> {
    const patch = await this.deps.configRepo.findPatchById(input.patch_id)
    if (!patch) throw new NotFoundError('CommunityConfigPatch', input.patch_id)
    const proposed = patch.proposed_rules_json ?? {}
    const stage = resolveStageSpecFromRules(proposed, { community_id: patch.community_id })
    const errors = stage.errors

    const nextStatus: CommunityConfigPatch['status'] = errors.length > 0 ? 'REJECTED' : 'VALIDATED'
    const updated = await this.deps.configRepo.updatePatch(patch.id, {
      status: nextStatus,
      validated_by_user_id: input.actor_user_id,
      validated_at: new Date(),
      ...(errors.length > 0 ? { rejected_reason: errors.join('; ') } : {}),
    })
    if (!updated) throw new NotFoundError('CommunityConfigPatch', patch.id)

    this.deps.eventRepo.create({
      event_type: 'COMMUNITY_CONFIG_VALIDATED',
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
    patch_id: string
    actor_user_id: string
    actor_role: 'admin' | 'user'
    decision: 'APPROVED' | 'REJECTED'
    reason?: string
  }): Promise<CommunityConfigPatch> {
    const patch = await this.deps.configRepo.findPatchById(input.patch_id)
    if (!patch) throw new NotFoundError('CommunityConfigPatch', input.patch_id)
    if (input.actor_role !== 'admin') {
      throw new ForbiddenError('Only admin can approve/reject high-risk config patches')
    }

    await this.deps.configRepo.createApproval({
      patch_id: patch.id,
      actor_user_id: input.actor_user_id,
      decision: input.decision,
      reason: input.reason ?? null,
    })

    const nextStatus: CommunityConfigPatch['status'] = input.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED'
    const updated = await this.deps.configRepo.updatePatch(patch.id, {
      status: nextStatus,
      approved_by_user_id: input.actor_user_id,
      approved_at: new Date(),
      ...(input.decision === 'REJECTED' ? { rejected_reason: input.reason ?? 'rejected_by_admin' } : {}),
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
        decision: input.decision,
        reason: input.reason ?? null,
      },
    })

    return updated
  }

  async applyProposal(input: {
    patch_id: string
    actor_user_id: string
    actor_role: 'admin' | 'user'
  }): Promise<{ patch: CommunityConfigPatch; version: CommunityConfigVersion }> {
    const patch = await this.deps.configRepo.findPatchById(input.patch_id)
    if (!patch) throw new NotFoundError('CommunityConfigPatch', input.patch_id)

    if (patch.status !== 'VALIDATED' && patch.status !== 'APPROVED') {
      throw new ValidationError(`patch status ${patch.status} cannot be applied`)
    }
    if (patch.risk_level === 'HIGH' && patch.status !== 'APPROVED') {
      throw new ValidationError('high-risk patch must be APPROVED before apply')
    }
    if (patch.risk_level === 'HIGH' && input.actor_role !== 'admin') {
      throw new ForbiddenError('Only admin can apply high-risk config patches')
    }

    const community = this.deps.communityRepo.findById(patch.community_id)
    if (!community) throw new NotFoundError('Community', patch.community_id)
    const latest = await this.deps.configRepo.findLatestVersionByCommunity(patch.community_id)
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
      risk_level: patch.risk_level,
      created_by_user_id: input.actor_user_id,
      applied_at: new Date(),
      meta: {
        applied_by: input.actor_user_id,
        source_patch_id: patch.id,
      },
    })

    const updatedPatch = await this.deps.configRepo.updatePatch(patch.id, {
      status: 'APPLIED',
      applied_version_id: version.id,
      applied_at: new Date(),
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
      actor_type: 'human',
      actor_id: input.actor_user_id,
      correlation_id: patch.id,
      payload_json: {
        patch_id: patch.id,
        version_id: version.id,
        version: version.version,
      },
    })

    // Component ack events are emitted for runtime services that consume rules_json.
    for (const component of ['allocator', 'aftershow_scheduler', 'notification_policy']) {
      this.deps.eventRepo.create({
        event_type: 'COMMUNITY_CONFIG_COMPONENT_ACK',
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
      risk_level: 'HIGH',
      created_by_user_id: input.actor_user_id,
      rollback_from_version_id: targetVersion.id,
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
}
