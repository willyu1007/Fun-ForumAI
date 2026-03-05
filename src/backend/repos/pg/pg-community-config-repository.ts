import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  CommunityConfigVersion,
  CommunityConfigPatch,
  CommunityConfigApproval,
  CreateCommunityConfigVersionInput,
  CreateCommunityConfigPatchInput,
  UpdateCommunityConfigPatchInput,
  CreateCommunityConfigApprovalInput,
  ConfigPatchStatus,
} from '../types.js'
import type { CommunityConfigRepository } from '../community-config-repository.js'

function toVersion(row: {
  id: string
  communityId: string
  version: number
  rulesJson: Prisma.JsonValue
  sourcePatchId: string | null
  riskLevel: 'LOW' | 'HIGH'
  createdByUserId: string | null
  rollbackFromVersionId: string | null
  appliedAt: Date | null
  rolledBackAt: Date | null
  metaJson: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}): CommunityConfigVersion {
  return {
    id: row.id,
    community_id: row.communityId,
    version: row.version,
    rules_json: row.rulesJson as Record<string, unknown>,
    source_patch_id: row.sourcePatchId,
    risk_level: row.riskLevel,
    created_by_user_id: row.createdByUserId,
    rollback_from_version_id: row.rollbackFromVersionId,
    applied_at: row.appliedAt,
    rolled_back_at: row.rolledBackAt,
    meta: row.metaJson as Record<string, unknown> | null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toPatch(row: {
  id: string
  communityId: string
  baseVersionId: string | null
  status: ConfigPatchStatus
  riskLevel: 'LOW' | 'HIGH'
  patchJson: Prisma.JsonValue
  proposedRulesJson: Prisma.JsonValue | null
  summary: string | null
  reason: string | null
  proposedByUserId: string
  validatedByUserId: string | null
  approvedByUserId: string | null
  appliedVersionId: string | null
  rejectedReason: string | null
  validatedAt: Date | null
  approvedAt: Date | null
  appliedAt: Date | null
  rolledBackAt: Date | null
  metaJson: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}): CommunityConfigPatch {
  return {
    id: row.id,
    community_id: row.communityId,
    base_version_id: row.baseVersionId,
    status: row.status,
    risk_level: row.riskLevel,
    patch_json: row.patchJson as Record<string, unknown>,
    proposed_rules_json: row.proposedRulesJson as Record<string, unknown> | null,
    summary: row.summary,
    reason: row.reason,
    proposed_by_user_id: row.proposedByUserId,
    validated_by_user_id: row.validatedByUserId,
    approved_by_user_id: row.approvedByUserId,
    applied_version_id: row.appliedVersionId,
    rejected_reason: row.rejectedReason,
    validated_at: row.validatedAt,
    approved_at: row.approvedAt,
    applied_at: row.appliedAt,
    rolled_back_at: row.rolledBackAt,
    meta: row.metaJson as Record<string, unknown> | null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toApproval(row: {
  id: string
  patchId: string
  actorUserId: string
  decision: 'APPROVED' | 'REJECTED'
  reason: string | null
  createdAt: Date
}): CommunityConfigApproval {
  return {
    id: row.id,
    patch_id: row.patchId,
    actor_user_id: row.actorUserId,
    decision: row.decision,
    reason: row.reason,
    created_at: row.createdAt,
  }
}

export class PgCommunityConfigRepository implements CommunityConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createVersion(input: CreateCommunityConfigVersionInput): Promise<CommunityConfigVersion> {
    const now = new Date()
    const row = await this.prisma.communityConfigVersion.create({
      data: {
        id: randomUUID(),
        communityId: input.community_id,
        version: input.version,
        rulesJson: input.rules_json as Prisma.InputJsonValue,
        sourcePatchId: input.source_patch_id ?? null,
        riskLevel: input.risk_level ?? 'LOW',
        createdByUserId: input.created_by_user_id ?? null,
        rollbackFromVersionId: input.rollback_from_version_id ?? null,
        appliedAt: input.applied_at ?? null,
        rolledBackAt: input.rolled_back_at ?? null,
        metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull,
        createdAt: now,
        updatedAt: now,
      },
    })
    return toVersion({ ...row, metaJson: row.metaJson })
  }

  async listVersionsByCommunity(communityId: string): Promise<CommunityConfigVersion[]> {
    const rows = await this.prisma.communityConfigVersion.findMany({
      where: { communityId },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    })
    return rows.map((row) => toVersion({ ...row, metaJson: row.metaJson }))
  }

  async findLatestVersionByCommunity(communityId: string): Promise<CommunityConfigVersion | null> {
    const row = await this.prisma.communityConfigVersion.findFirst({
      where: { communityId },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    })
    return row ? toVersion({ ...row, metaJson: row.metaJson }) : null
  }

  async findVersionById(id: string): Promise<CommunityConfigVersion | null> {
    const row = await this.prisma.communityConfigVersion.findUnique({ where: { id } })
    return row ? toVersion({ ...row, metaJson: row.metaJson }) : null
  }

  async createPatch(input: CreateCommunityConfigPatchInput): Promise<CommunityConfigPatch> {
    const now = new Date()
    const row = await this.prisma.communityConfigPatch.create({
      data: {
        id: randomUUID(),
        communityId: input.community_id,
        baseVersionId: input.base_version_id ?? null,
        status: input.status ?? 'DRAFT',
        riskLevel: input.risk_level ?? 'LOW',
        patchJson: input.patch_json as Prisma.InputJsonValue,
        proposedRulesJson: input.proposed_rules_json
          ? (input.proposed_rules_json as Prisma.InputJsonValue)
          : Prisma.DbNull,
        summary: input.summary ?? null,
        reason: input.reason ?? null,
        proposedByUserId: input.proposed_by_user_id,
        validatedByUserId: input.validated_by_user_id ?? null,
        approvedByUserId: input.approved_by_user_id ?? null,
        appliedVersionId: input.applied_version_id ?? null,
        rejectedReason: input.rejected_reason ?? null,
        validatedAt: input.validated_at ?? null,
        approvedAt: input.approved_at ?? null,
        appliedAt: input.applied_at ?? null,
        rolledBackAt: input.rolled_back_at ?? null,
        metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull,
        createdAt: now,
        updatedAt: now,
      },
    })
    return toPatch({
      ...row,
      proposedRulesJson: row.proposedRulesJson,
      metaJson: row.metaJson,
    })
  }

  async updatePatch(patchId: string, input: UpdateCommunityConfigPatchInput): Promise<CommunityConfigPatch | null> {
    const row = await this.prisma.communityConfigPatch.update({
      where: { id: patchId },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.risk_level !== undefined ? { riskLevel: input.risk_level } : {}),
        ...(input.proposed_rules_json !== undefined
          ? {
              proposedRulesJson: input.proposed_rules_json
                ? (input.proposed_rules_json as Prisma.InputJsonValue)
                : Prisma.DbNull,
            }
          : {}),
        ...(input.validated_by_user_id !== undefined ? { validatedByUserId: input.validated_by_user_id } : {}),
        ...(input.approved_by_user_id !== undefined ? { approvedByUserId: input.approved_by_user_id } : {}),
        ...(input.applied_version_id !== undefined ? { appliedVersionId: input.applied_version_id } : {}),
        ...(input.rejected_reason !== undefined ? { rejectedReason: input.rejected_reason } : {}),
        ...(input.validated_at !== undefined ? { validatedAt: input.validated_at } : {}),
        ...(input.approved_at !== undefined ? { approvedAt: input.approved_at } : {}),
        ...(input.applied_at !== undefined ? { appliedAt: input.applied_at } : {}),
        ...(input.rolled_back_at !== undefined ? { rolledBackAt: input.rolled_back_at } : {}),
        ...(input.meta !== undefined
          ? {
              metaJson: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.DbNull,
            }
          : {}),
        updatedAt: new Date(),
      },
    }).catch((err) => (err?.code === 'P2025' ? null : Promise.reject(err)))

    if (!row) return null
    return toPatch({
      ...row,
      proposedRulesJson: row.proposedRulesJson,
      metaJson: row.metaJson,
    })
  }

  async findPatchById(id: string): Promise<CommunityConfigPatch | null> {
    const row = await this.prisma.communityConfigPatch.findUnique({ where: { id } })
    return row
      ? toPatch({ ...row, proposedRulesJson: row.proposedRulesJson, metaJson: row.metaJson })
      : null
  }

  async listPatchesByCommunity(communityId: string): Promise<CommunityConfigPatch[]> {
    const rows = await this.prisma.communityConfigPatch.findMany({
      where: { communityId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => toPatch({
      ...row,
      proposedRulesJson: row.proposedRulesJson,
      metaJson: row.metaJson,
    }))
  }

  async createApproval(input: CreateCommunityConfigApprovalInput): Promise<CommunityConfigApproval> {
    const row = await this.prisma.communityConfigApproval.create({
      data: {
        id: randomUUID(),
        patchId: input.patch_id,
        actorUserId: input.actor_user_id,
        decision: input.decision,
        reason: input.reason ?? null,
        createdAt: new Date(),
      },
    })
    return toApproval(row)
  }

  async listApprovalsByPatch(patchId: string): Promise<CommunityConfigApproval[]> {
    const rows = await this.prisma.communityConfigApproval.findMany({
      where: { patchId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map(toApproval)
  }
}
