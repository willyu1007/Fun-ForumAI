import type {
  CommunityConfigVersion,
  CommunityConfigPatch,
  CommunityConfigApproval,
  CreateCommunityConfigVersionInput,
  CreateCommunityConfigPatchInput,
  UpdateCommunityConfigPatchInput,
  CreateCommunityConfigApprovalInput,
  ConfigVersionStatus,
} from './types.js'

export interface CommunityConfigRepository {
  createVersion(input: CreateCommunityConfigVersionInput): Promise<CommunityConfigVersion>
  updateVersion(
    versionId: string,
    input: {
      status?: ConfigVersionStatus
      applied_at?: Date | null
      rolled_back_at?: Date | null
    },
  ): Promise<CommunityConfigVersion | null>
  listVersionsByCommunity(communityId: string): Promise<CommunityConfigVersion[]>
  findLatestVersionByCommunity(communityId: string): Promise<CommunityConfigVersion | null>
  findVersionById(id: string): Promise<CommunityConfigVersion | null>

  createPatch(input: CreateCommunityConfigPatchInput): Promise<CommunityConfigPatch>
  updatePatch(patchId: string, input: UpdateCommunityConfigPatchInput): Promise<CommunityConfigPatch | null>
  findPatchById(id: string): Promise<CommunityConfigPatch | null>
  listPatchesByCommunity(communityId: string): Promise<CommunityConfigPatch[]>
  listDueScheduledPatches(now: Date, limit: number): Promise<CommunityConfigPatch[]>

  createApproval(input: CreateCommunityConfigApprovalInput): Promise<CommunityConfigApproval>
  listApprovalsByPatch(patchId: string): Promise<CommunityConfigApproval[]>
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

export class InMemoryCommunityConfigRepository implements CommunityConfigRepository {
  private versions = new Map<string, CommunityConfigVersion>()
  private patches = new Map<string, CommunityConfigPatch>()
  private approvals = new Map<string, CommunityConfigApproval>()

  async createVersion(input: CreateCommunityConfigVersionInput): Promise<CommunityConfigVersion> {
    const now = new Date()
    const row: CommunityConfigVersion = {
      id: cuid('cfg_ver'),
      community_id: input.community_id,
      version: input.version,
      rules_json: input.rules_json,
      source_patch_id: input.source_patch_id ?? null,
      seed_key: input.seed_key ?? null,
      source: input.source ?? null,
      status: input.status ?? 'ACTIVE',
      risk_level: input.risk_level ?? 'LOW',
      created_by_user_id: input.created_by_user_id ?? null,
      applied_by_actor_id: input.applied_by_actor_id ?? null,
      rollback_from_version_id: input.rollback_from_version_id ?? null,
      rollback_reason: input.rollback_reason ?? null,
      effective_at: input.effective_at ?? null,
      applied_at: input.applied_at ?? null,
      rolled_back_at: input.rolled_back_at ?? null,
      created_at: now,
      updated_at: now,
    }
    this.versions.set(row.id, row)
    return row
  }

  async updateVersion(
    versionId: string,
    input: {
      status?: ConfigVersionStatus
      applied_at?: Date | null
      rolled_back_at?: Date | null
    },
  ): Promise<CommunityConfigVersion | null> {
    const row = this.versions.get(versionId)
    if (!row) return null
    if (input.status !== undefined) row.status = input.status
    if (input.applied_at !== undefined) row.applied_at = input.applied_at
    if (input.rolled_back_at !== undefined) row.rolled_back_at = input.rolled_back_at
    row.updated_at = new Date()
    this.versions.set(row.id, row)
    return row
  }

  async listVersionsByCommunity(communityId: string): Promise<CommunityConfigVersion[]> {
    return Array.from(this.versions.values())
      .filter((item) => item.community_id === communityId)
      .sort((a, b) => b.version - a.version || b.created_at.getTime() - a.created_at.getTime())
  }

  async findLatestVersionByCommunity(communityId: string): Promise<CommunityConfigVersion | null> {
    const list = await this.listVersionsByCommunity(communityId)
    return list[0] ?? null
  }

  async findVersionById(id: string): Promise<CommunityConfigVersion | null> {
    return this.versions.get(id) ?? null
  }

  async createPatch(input: CreateCommunityConfigPatchInput): Promise<CommunityConfigPatch> {
    const now = new Date()
    const row: CommunityConfigPatch = {
      id: cuid('cfg_patch'),
      community_id: input.community_id,
      base_version_id: input.base_version_id ?? null,
      status: input.status ?? 'PROPOSED',
      risk_level: input.risk_level ?? 'LOW',
      patch_json: input.patch_json,
      proposed_rules_json: input.proposed_rules_json ?? null,
      summary: input.summary ?? null,
      reason: input.reason ?? null,
      proposed_by_user_id: input.proposed_by_user_id,
      validated_by_user_id: input.validated_by_user_id ?? null,
      approved_by_user_id: input.approved_by_user_id ?? null,
      applied_version_id: input.applied_version_id ?? null,
      applied_version_number: input.applied_version_number ?? null,
      rejected_reason: input.rejected_reason ?? null,
      validated_at: input.validated_at ?? null,
      validation_failed_at: input.validation_failed_at ?? null,
      approved_at: input.approved_at ?? null,
      scheduled_by_user_id: input.scheduled_by_user_id ?? null,
      scheduled_at: input.scheduled_at ?? null,
      effective_at: input.effective_at ?? null,
      applied_at: input.applied_at ?? null,
      rolled_back_at: input.rolled_back_at ?? null,
      scheduler_retry_count: input.scheduler_retry_count ?? 0,
      scheduler_last_error: input.scheduler_last_error ?? null,
      scheduler_last_error_at: input.scheduler_last_error_at ?? null,
      scheduler_next_retry_at: input.scheduler_next_retry_at ?? null,
      scheduler_retry_exhausted_at: input.scheduler_retry_exhausted_at ?? null,
      created_at: now,
      updated_at: now,
    }
    this.patches.set(row.id, row)
    return row
  }

  async updatePatch(patchId: string, input: UpdateCommunityConfigPatchInput): Promise<CommunityConfigPatch | null> {
    const row = this.patches.get(patchId)
    if (!row) return null
    if (input.status !== undefined) row.status = input.status
    if (input.risk_level !== undefined) row.risk_level = input.risk_level
    if (input.proposed_rules_json !== undefined) row.proposed_rules_json = input.proposed_rules_json
    if (input.validated_by_user_id !== undefined) row.validated_by_user_id = input.validated_by_user_id
    if (input.approved_by_user_id !== undefined) row.approved_by_user_id = input.approved_by_user_id
    if (input.applied_version_id !== undefined) row.applied_version_id = input.applied_version_id
    if (input.applied_version_number !== undefined) row.applied_version_number = input.applied_version_number
    if (input.rejected_reason !== undefined) row.rejected_reason = input.rejected_reason
    if (input.validated_at !== undefined) row.validated_at = input.validated_at
    if (input.validation_failed_at !== undefined) row.validation_failed_at = input.validation_failed_at
    if (input.approved_at !== undefined) row.approved_at = input.approved_at
    if (input.scheduled_by_user_id !== undefined) row.scheduled_by_user_id = input.scheduled_by_user_id
    if (input.scheduled_at !== undefined) row.scheduled_at = input.scheduled_at
    if (input.effective_at !== undefined) row.effective_at = input.effective_at
    if (input.applied_at !== undefined) row.applied_at = input.applied_at
    if (input.rolled_back_at !== undefined) row.rolled_back_at = input.rolled_back_at
    if (input.scheduler_retry_count !== undefined) row.scheduler_retry_count = input.scheduler_retry_count
    if (input.scheduler_last_error !== undefined) row.scheduler_last_error = input.scheduler_last_error
    if (input.scheduler_last_error_at !== undefined) row.scheduler_last_error_at = input.scheduler_last_error_at
    if (input.scheduler_next_retry_at !== undefined) row.scheduler_next_retry_at = input.scheduler_next_retry_at
    if (input.scheduler_retry_exhausted_at !== undefined) {
      row.scheduler_retry_exhausted_at = input.scheduler_retry_exhausted_at
    }
    row.updated_at = new Date()
    this.patches.set(row.id, row)
    return row
  }

  async findPatchById(id: string): Promise<CommunityConfigPatch | null> {
    return this.patches.get(id) ?? null
  }

  async listPatchesByCommunity(communityId: string): Promise<CommunityConfigPatch[]> {
    return Array.from(this.patches.values())
      .filter((item) => item.community_id === communityId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async listDueScheduledPatches(now: Date, limit: number): Promise<CommunityConfigPatch[]> {
    return Array.from(this.patches.values())
      .filter((item) =>
        item.status === 'SCHEDULED'
        && !!item.effective_at
        && item.effective_at.getTime() <= now.getTime())
      .sort((a, b) => a.effective_at!.getTime() - b.effective_at!.getTime())
      .slice(0, limit)
  }

  async createApproval(input: CreateCommunityConfigApprovalInput): Promise<CommunityConfigApproval> {
    const row: CommunityConfigApproval = {
      id: cuid('cfg_appr'),
      patch_id: input.patch_id,
      actor_user_id: input.actor_user_id,
      decision: input.decision,
      reason: input.reason ?? null,
      created_at: new Date(),
    }
    this.approvals.set(row.id, row)
    return row
  }

  async listApprovalsByPatch(patchId: string): Promise<CommunityConfigApproval[]> {
    return Array.from(this.approvals.values())
      .filter((item) => item.patch_id === patchId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }
}
