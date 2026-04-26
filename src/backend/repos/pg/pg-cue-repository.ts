/**
 * T-209 cue-data-and-board — Postgres implementation of `CueRepository`.
 *
 * Hydrates JSON columns to typed domain objects via Zod parse on read.
 * Cross-domain references (community / asset / agent / post / user) are
 * stored as plain string columns; no Prisma `@relation` to existing models.
 */

import {
  Prisma,
  type PrismaClient,
  type CueChangeApprovalStatus as PrismaCueChangeApprovalStatus,
  type CueChangeSource as PrismaCueChangeSource,
  type CueChangeType as PrismaCueChangeType,
  type CueChangeValidationStatus as PrismaCueChangeValidationStatus,
  type CueExecutionAttempt as PrismaCueExecutionAttempt,
  type CueExecutionAttemptStatus as PrismaCueExecutionAttemptStatus,
  type CueLane as PrismaCueLane,
  type CueMediaCreatedByType as PrismaCueMediaCreatedByType,
  type CueMediaRole as PrismaCueMediaRole,
  type CueMediaUsageStrength as PrismaCueMediaUsageStrength,
  type CueMediaUsePolicy as PrismaCueMediaUsePolicy,
  type CueMediaValidationStatus as PrismaCueMediaValidationStatus,
  type CueRiskLevel as PrismaCueRiskLevel,
  type CueScheduleSource as PrismaCueScheduleSource,
  type CueScheduleStatus as PrismaCueScheduleStatus,
  type CueScopeType as PrismaCueScopeType,
  type CueSourceType as PrismaCueSourceType,
  type PublicDiscussionCue as PrismaPublicDiscussionCue,
  type PublicDiscussionCueChange as PrismaPublicDiscussionCueChange,
  type PublicDiscussionCueMedia as PrismaPublicDiscussionCueMedia,
  type PublicDiscussionCueSchedule as PrismaPublicDiscussionCueSchedule,
  type PublicDiscussionCueStatus as PrismaPublicDiscussionCueStatus,
} from '@prisma/client'
import type {
  AttachCueMediaInput,
  ClaimDueCuesInput,
  ClaimedCue,
  CreateCueAttemptInput,
  CreateCueInput,
  CreateCueScheduleInput,
  CueChangeApprovalStatus,
  CueChangeSource,
  CueChangeType,
  CueChangeValidationStatus,
  CueExecutionAttemptDomain,
  CueExecutionAttemptStatus,
  CueMediaCreatedByType,
  CueMediaRole,
  CueMediaUsageStrength,
  CueMediaUsePolicy,
  CueMediaValidationStatus,
  CueRepository,
  CueScheduleSource,
  CueScheduleStatus,
  CueScopeType,
  ListUpcomingCuesQuery,
  PublicDiscussionCueChangeDomain,
  PublicDiscussionCueMediaDomain,
  PublicDiscussionCueScheduleDomain,
  ReclaimExpiredLeasesInput,
  ReclaimedLease,
  RecordCueChangeInput,
  ScheduleScopeQuery,
  UpdateCueAttemptPatch,
  UpdateCueInput,
} from '../cue-repository.js'
import {
  assertScopeConsistency,
  attemptIdempotencyKey,
  defaultCueIdempotencyKey,
  IN_FLIGHT_ATTEMPT_STATUSES,
} from '../cue-repository.js'
import {
  CueAdmissionPolicySchema,
  CueCommunityScopeSchema,
  CueLoadPolicySchema,
  CueMediaPolicySchema,
  CueRoleRequirementVectorSchema,
  CueSafetyPolicySchema,
  CueSceneConstraintsSchema,
  CueThemeIntentSchema,
  LockedFieldsSchema,
  type CueLane,
  type CueRiskLevel,
  type CueSourceType,
  type PublicDiscussionCueDomain,
  type PublicDiscussionCueStatus,
} from '../../programming/cue/types.js'
import { DispatchPolicySchema } from '../../programming/contract/index.js'

// =============================================================================
// Enum bridges (snake_case domain <-> SCREAMING_CASE Prisma)
// =============================================================================

const SCHEDULE_STATUS_TO_DB: Record<CueScheduleStatus, PrismaCueScheduleStatus> = {
  draft: 'DRAFT',
  review: 'REVIEW',
  published: 'PUBLISHED',
  active: 'ACTIVE',
  archived: 'ARCHIVED',
  rolled_back: 'ROLLED_BACK',
}
const SCHEDULE_STATUS_FROM_DB: Record<PrismaCueScheduleStatus, CueScheduleStatus> = {
  DRAFT: 'draft',
  REVIEW: 'review',
  PUBLISHED: 'published',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  ROLLED_BACK: 'rolled_back',
}

const SCHEDULE_SOURCE_TO_DB: Record<CueScheduleSource, PrismaCueScheduleSource> = {
  baseline: 'BASELINE',
  manual: 'MANUAL',
  automated: 'AUTOMATED',
  mixed: 'MIXED',
}
const SCHEDULE_SOURCE_FROM_DB: Record<PrismaCueScheduleSource, CueScheduleSource> = {
  BASELINE: 'baseline',
  MANUAL: 'manual',
  AUTOMATED: 'automated',
  MIXED: 'mixed',
}

const SCOPE_TYPE_TO_DB: Record<CueScopeType, PrismaCueScopeType> = {
  global: 'GLOBAL',
  community: 'COMMUNITY',
  room: 'ROOM',
}
const SCOPE_TYPE_FROM_DB: Record<PrismaCueScopeType, CueScopeType> = {
  GLOBAL: 'global',
  COMMUNITY: 'community',
  ROOM: 'room',
}

const CUE_SOURCE_TO_DB: Record<CueSourceType, PrismaCueSourceType> = {
  manual: 'MANUAL',
  automated: 'AUTOMATED',
  baseline: 'BASELINE',
  system: 'SYSTEM',
}
const CUE_SOURCE_FROM_DB: Record<PrismaCueSourceType, CueSourceType> = {
  MANUAL: 'manual',
  AUTOMATED: 'automated',
  BASELINE: 'baseline',
  SYSTEM: 'system',
}

const CUE_STATUS_TO_DB: Record<PublicDiscussionCueStatus, PrismaPublicDiscussionCueStatus> = {
  draft: 'DRAFT',
  validating: 'VALIDATING',
  validated: 'VALIDATED',
  scheduled: 'SCHEDULED',
  prewarming: 'PREWARMING',
  due: 'DUE',
  claimed: 'CLAIMED',
  executing: 'EXECUTING',
  consumed: 'CONSUMED',
  deferred: 'DEFERRED',
  skipped: 'SKIPPED',
  expired: 'EXPIRED',
  cancelled: 'CANCELLED',
  failed: 'FAILED',
}
const CUE_STATUS_FROM_DB: Record<PrismaPublicDiscussionCueStatus, PublicDiscussionCueStatus> = {
  DRAFT: 'draft',
  VALIDATING: 'validating',
  VALIDATED: 'validated',
  SCHEDULED: 'scheduled',
  PREWARMING: 'prewarming',
  DUE: 'due',
  CLAIMED: 'claimed',
  EXECUTING: 'executing',
  CONSUMED: 'consumed',
  DEFERRED: 'deferred',
  SKIPPED: 'skipped',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
}

const LANE_TO_DB: Record<CueLane, PrismaCueLane> = {
  prime: 'PRIME',
  standard: 'STANDARD',
  background: 'BACKGROUND',
}
const LANE_FROM_DB: Record<PrismaCueLane, CueLane> = {
  PRIME: 'prime',
  STANDARD: 'standard',
  BACKGROUND: 'background',
}

const RISK_TO_DB: Record<CueRiskLevel, PrismaCueRiskLevel> = {
  low: 'LOW',
  standard: 'STANDARD',
  high: 'HIGH',
  strict_review: 'STRICT_REVIEW',
}
const RISK_FROM_DB: Record<PrismaCueRiskLevel, CueRiskLevel> = {
  LOW: 'low',
  STANDARD: 'standard',
  HIGH: 'high',
  STRICT_REVIEW: 'strict_review',
}

const CHANGE_TYPE_TO_DB: Record<CueChangeType, PrismaCueChangeType> = {
  create_cue: 'CREATE_CUE',
  update_cue: 'UPDATE_CUE',
  cancel_cue: 'CANCEL_CUE',
  defer_cue: 'DEFER_CUE',
  merge_into_existing_cue: 'MERGE_INTO_EXISTING_CUE',
  split_cue: 'SPLIT_CUE',
  attach_media: 'ATTACH_MEDIA',
  remove_media: 'REMOVE_MEDIA',
  update_dispatch_policy: 'UPDATE_DISPATCH_POLICY',
  update_risk_level: 'UPDATE_RISK_LEVEL',
  publish_schedule: 'PUBLISH_SCHEDULE',
  rollback_schedule: 'ROLLBACK_SCHEDULE',
}
const CHANGE_TYPE_FROM_DB: Record<PrismaCueChangeType, CueChangeType> = {
  CREATE_CUE: 'create_cue',
  UPDATE_CUE: 'update_cue',
  CANCEL_CUE: 'cancel_cue',
  DEFER_CUE: 'defer_cue',
  MERGE_INTO_EXISTING_CUE: 'merge_into_existing_cue',
  SPLIT_CUE: 'split_cue',
  ATTACH_MEDIA: 'attach_media',
  REMOVE_MEDIA: 'remove_media',
  UPDATE_DISPATCH_POLICY: 'update_dispatch_policy',
  UPDATE_RISK_LEVEL: 'update_risk_level',
  PUBLISH_SCHEDULE: 'publish_schedule',
  ROLLBACK_SCHEDULE: 'rollback_schedule',
}

const CHANGE_SOURCE_TO_DB: Record<CueChangeSource, PrismaCueChangeSource> = {
  manual: 'MANUAL',
  automated: 'AUTOMATED',
  system: 'SYSTEM',
}
const CHANGE_SOURCE_FROM_DB: Record<PrismaCueChangeSource, CueChangeSource> = {
  MANUAL: 'manual',
  AUTOMATED: 'automated',
  SYSTEM: 'system',
}

const CHANGE_VALIDATION_TO_DB: Record<
  CueChangeValidationStatus,
  PrismaCueChangeValidationStatus
> = { pending: 'PENDING', passed: 'PASSED', failed: 'FAILED' }
const CHANGE_VALIDATION_FROM_DB: Record<
  PrismaCueChangeValidationStatus,
  CueChangeValidationStatus
> = { PENDING: 'pending', PASSED: 'passed', FAILED: 'failed' }

const CHANGE_APPROVAL_TO_DB: Record<
  CueChangeApprovalStatus,
  PrismaCueChangeApprovalStatus
> = {
  pending: 'PENDING',
  auto_applied: 'AUTO_APPLIED',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  rolled_back: 'ROLLED_BACK',
}
const CHANGE_APPROVAL_FROM_DB: Record<
  PrismaCueChangeApprovalStatus,
  CueChangeApprovalStatus
> = {
  PENDING: 'pending',
  AUTO_APPLIED: 'auto_applied',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ROLLED_BACK: 'rolled_back',
}

const MEDIA_ROLE_TO_DB: Record<CueMediaRole, PrismaCueMediaRole> = {
  context_anchor: 'CONTEXT_ANCHOR',
  mood_reference: 'MOOD_REFERENCE',
  evidence_card: 'EVIDENCE_CARD',
  visual_seed: 'VISUAL_SEED',
  cover_candidate: 'COVER_CANDIDATE',
  continuity_anchor: 'CONTINUITY_ANCHOR',
}
const MEDIA_ROLE_FROM_DB: Record<PrismaCueMediaRole, CueMediaRole> = {
  CONTEXT_ANCHOR: 'context_anchor',
  MOOD_REFERENCE: 'mood_reference',
  EVIDENCE_CARD: 'evidence_card',
  VISUAL_SEED: 'visual_seed',
  COVER_CANDIDATE: 'cover_candidate',
  CONTINUITY_ANCHOR: 'continuity_anchor',
}

const MEDIA_STRENGTH_TO_DB: Record<
  CueMediaUsageStrength,
  PrismaCueMediaUsageStrength
> = {
  optional: 'OPTIONAL',
  preferred: 'PREFERRED',
  anchor: 'ANCHOR',
  selected_only_pool: 'SELECTED_ONLY_POOL',
}
const MEDIA_STRENGTH_FROM_DB: Record<
  PrismaCueMediaUsageStrength,
  CueMediaUsageStrength
> = {
  OPTIONAL: 'optional',
  PREFERRED: 'preferred',
  ANCHOR: 'anchor',
  SELECTED_ONLY_POOL: 'selected_only_pool',
}

const MEDIA_USE_POLICY_TO_DB: Record<CueMediaUsePolicy, PrismaCueMediaUsePolicy> = {
  runtime_only: 'RUNTIME_ONLY',
  prefer_runtime_context: 'PREFER_RUNTIME_CONTEXT',
  prefer_public_display: 'PREFER_PUBLIC_DISPLAY',
  allow_generated_derivative: 'ALLOW_GENERATED_DERIVATIVE',
  require_public_display: 'REQUIRE_PUBLIC_DISPLAY',
}
const MEDIA_USE_POLICY_FROM_DB: Record<PrismaCueMediaUsePolicy, CueMediaUsePolicy> = {
  RUNTIME_ONLY: 'runtime_only',
  PREFER_RUNTIME_CONTEXT: 'prefer_runtime_context',
  PREFER_PUBLIC_DISPLAY: 'prefer_public_display',
  ALLOW_GENERATED_DERIVATIVE: 'allow_generated_derivative',
  REQUIRE_PUBLIC_DISPLAY: 'require_public_display',
}

const MEDIA_VALIDATION_TO_DB: Record<
  CueMediaValidationStatus,
  PrismaCueMediaValidationStatus
> = {
  valid: 'VALID',
  invalid: 'INVALID',
  blocked: 'BLOCKED',
  degraded: 'DEGRADED',
}
const MEDIA_VALIDATION_FROM_DB: Record<
  PrismaCueMediaValidationStatus,
  CueMediaValidationStatus
> = {
  VALID: 'valid',
  INVALID: 'invalid',
  BLOCKED: 'blocked',
  DEGRADED: 'degraded',
}

const MEDIA_CREATED_BY_TO_DB: Record<
  CueMediaCreatedByType,
  PrismaCueMediaCreatedByType
> = { admin: 'ADMIN', system_llm: 'SYSTEM_LLM', baseline: 'BASELINE' }
const MEDIA_CREATED_BY_FROM_DB: Record<
  PrismaCueMediaCreatedByType,
  CueMediaCreatedByType
> = { ADMIN: 'admin', SYSTEM_LLM: 'system_llm', BASELINE: 'baseline' }

const ATTEMPT_STATUS_FROM_DB: Record<
  PrismaCueExecutionAttemptStatus,
  CueExecutionAttemptStatus
> = {
  PENDING: 'pending',
  ADMITTED: 'admitted',
  LEASED: 'leased',
  ALLOCATING: 'allocating',
  COMPILING: 'compiling',
  EXECUTING: 'executing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  DELAYED: 'delayed',
  MISFIRED: 'misfired',
  CANCELLED: 'cancelled',
}
const ATTEMPT_STATUS_TO_DB: Record<
  CueExecutionAttemptStatus,
  PrismaCueExecutionAttemptStatus
> = {
  pending: 'PENDING',
  admitted: 'ADMITTED',
  leased: 'LEASED',
  allocating: 'ALLOCATING',
  compiling: 'COMPILING',
  executing: 'EXECUTING',
  succeeded: 'SUCCEEDED',
  failed: 'FAILED',
  skipped: 'SKIPPED',
  delayed: 'DELAYED',
  misfired: 'MISFIRED',
  cancelled: 'CANCELLED',
}

// =============================================================================
// PgCueRepository
// =============================================================================

export class PgCueRepository implements CueRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    // No in-memory cache; cue ops are admin-only and async-friendly.
  }

  // ---- Schedule ----

  async createSchedule(
    input: CreateCueScheduleInput,
  ): Promise<PublicDiscussionCueScheduleDomain> {
    const row = await this.prisma.publicDiscussionCueSchedule.create({
      data: {
        scopeType: SCOPE_TYPE_TO_DB[input.scope_type],
        communityId: input.community_id ?? null,
        roomId: input.room_id ?? null,
        timezone: input.timezone ?? 'Asia/Shanghai',
        dateRangeStart: input.date_range_start,
        dateRangeEnd: input.date_range_end,
        baselineContractVersion: input.baseline_contract_version ?? null,
        status: input.status ? SCHEDULE_STATUS_TO_DB[input.status] : 'DRAFT',
        source: SCHEDULE_SOURCE_TO_DB[input.source],
        version: input.version ?? 1,
        baseScheduleId: input.base_schedule_id ?? null,
        rollbackFromScheduleId: input.rollback_from_schedule_id ?? null,
        summary: input.summary ?? null,
        createdByUserId: input.created_by_user_id ?? null,
        createdBySystem: input.created_by_system ?? null,
      },
    })
    return this.scheduleToDomain(row)
  }

  async findScheduleById(
    id: string,
  ): Promise<PublicDiscussionCueScheduleDomain | null> {
    const row = await this.prisma.publicDiscussionCueSchedule.findUnique({
      where: { id },
    })
    return row ? this.scheduleToDomain(row) : null
  }

  async findActiveScheduleForScope(
    query: ScheduleScopeQuery,
  ): Promise<PublicDiscussionCueScheduleDomain | null> {
    const row = await this.prisma.publicDiscussionCueSchedule.findFirst({
      where: {
        status: 'ACTIVE',
        scopeType: SCOPE_TYPE_TO_DB[query.scope_type],
        communityId:
          query.scope_type === 'community' ? query.community_id ?? null : undefined,
        roomId: query.scope_type === 'room' ? query.room_id ?? null : undefined,
      },
      orderBy: [{ dateRangeStart: 'desc' }, { createdAt: 'desc' }],
    })
    return row ? this.scheduleToDomain(row) : null
  }

  async listSchedules(opts?: {
    limit?: number
  }): Promise<PublicDiscussionCueScheduleDomain[]> {
    const rows = await this.prisma.publicDiscussionCueSchedule.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts?.limit,
    })
    return rows.map((row) => this.scheduleToDomain(row))
  }

  async updateScheduleStatus(
    id: string,
    status: CueScheduleStatus,
  ): Promise<PublicDiscussionCueScheduleDomain | null> {
    try {
      const data: Prisma.PublicDiscussionCueScheduleUpdateInput = {
        status: SCHEDULE_STATUS_TO_DB[status],
      }
      if (status === 'published') {
        data.publishedAt = new Date()
      }
      const row = await this.prisma.publicDiscussionCueSchedule.update({
        where: { id },
        data,
      })
      return this.scheduleToDomain(row)
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return null
      }
      throw err
    }
  }

  // ---- Cue ----

  async createCue(input: CreateCueInput): Promise<PublicDiscussionCueDomain> {
    // Scope consistency: a community-scoped schedule may only host cues
    // whose scope matches it (umbrella §I-1). Look up the schedule first so
    // the validator runs against the same domain object the in-memory
    // implementation sees.
    const scheduleRow = await this.prisma.publicDiscussionCueSchedule.findUnique(
      { where: { id: input.schedule_id } },
    )
    if (scheduleRow == null) {
      throw new Error(`createCue: schedule ${input.schedule_id} not found`)
    }
    assertScopeConsistency(this.scheduleToDomain(scheduleRow), input)

    // UUID-derived idempotency key — collision-safe across concurrent creates.
    const idempotencyKey =
      input.idempotency_key ?? defaultCueIdempotencyKey(input.schedule_id)

    const row = await this.prisma.publicDiscussionCue.create({
      data: {
        scheduleId: input.schedule_id,
        sourceType: CUE_SOURCE_TO_DB[input.source_type],
        status: input.status ? CUE_STATUS_TO_DB[input.status] : 'DRAFT',
        communityId: input.community_id ?? null,
        scopeJson: input.scope as unknown as Prisma.InputJsonValue,
        triggerAt: input.trigger_at,
        timezone: input.timezone ?? 'Asia/Shanghai',
        prewarmAt: input.prewarm_at ?? null,
        latestStartAt: input.latest_start_at ?? null,
        expireAt: input.expire_at ?? null,
        priority: input.priority ?? 50,
        lane: input.lane ? LANE_TO_DB[input.lane] : 'STANDARD',
        dispatchPolicyJson:
          input.dispatch_policy as unknown as Prisma.InputJsonValue,
        admissionPolicyJson: input.admission_policy
          ? (input.admission_policy as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        loadPolicyJson: input.load_policy
          ? (input.load_policy as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        themeIntentJson:
          input.theme_intent as unknown as Prisma.InputJsonValue,
        sceneConstraintsJson:
          input.scene_constraints as unknown as Prisma.InputJsonValue,
        roleRequirementsJson:
          input.role_requirements as unknown as Prisma.InputJsonValue,
        mediaPolicyJson: input.media_policy
          ? (input.media_policy as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        safetyJson: input.safety
          ? (input.safety as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        lockedFieldsJson:
          (input.locked_fields ?? []) as unknown as Prisma.InputJsonValue,
        riskLevel: input.risk_level ? RISK_TO_DB[input.risk_level] : 'STANDARD',
        revision: 1,
        idempotencyKey,
        createdByUserId: input.created_by_user_id ?? null,
        createdBySystem: input.created_by_system ?? null,
      },
    })
    return this.cueToDomain(row)
  }

  async findCueById(id: string): Promise<PublicDiscussionCueDomain | null> {
    const row = await this.prisma.publicDiscussionCue.findUnique({
      where: { id },
    })
    return row ? this.cueToDomain(row) : null
  }

  async listCuesForSchedule(
    scheduleId: string,
  ): Promise<PublicDiscussionCueDomain[]> {
    const rows = await this.prisma.publicDiscussionCue.findMany({
      where: { scheduleId },
      orderBy: [{ triggerAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.cueToDomain(row))
  }

  async listUpcomingCues(
    query: ListUpcomingCuesQuery,
  ): Promise<PublicDiscussionCueDomain[]> {
    const where: Prisma.PublicDiscussionCueWhereInput = {}
    if (query.schedule_id) where.scheduleId = query.schedule_id
    if (query.community_id) where.communityId = query.community_id
    if (query.from || query.to) {
      where.triggerAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      }
    }
    const rows = await this.prisma.publicDiscussionCue.findMany({
      where,
      orderBy: [{ triggerAt: 'asc' }, { id: 'asc' }],
      take: query.limit,
    })
    return rows.map((row) => this.cueToDomain(row))
  }

  async setCueStatus(
    id: string,
    status: PublicDiscussionCueStatus,
  ): Promise<PublicDiscussionCueDomain | null> {
    try {
      const row = await this.prisma.publicDiscussionCue.update({
        where: { id },
        data: { status: CUE_STATUS_TO_DB[status] },
      })
      return this.cueToDomain(row)
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return null
      }
      throw err
    }
  }

  async updateCue(
    id: string,
    input: UpdateCueInput,
  ): Promise<PublicDiscussionCueDomain | null> {
    const data: Prisma.PublicDiscussionCueUpdateInput = {
      revision: { increment: 1 },
    }
    if (input.trigger_at !== undefined) data.triggerAt = input.trigger_at
    if (input.timezone !== undefined) data.timezone = input.timezone
    if (input.prewarm_at !== undefined) data.prewarmAt = input.prewarm_at
    if (input.latest_start_at !== undefined) data.latestStartAt = input.latest_start_at
    if (input.expire_at !== undefined) data.expireAt = input.expire_at
    if (input.priority !== undefined) data.priority = input.priority
    if (input.lane !== undefined) data.lane = LANE_TO_DB[input.lane]
    if (input.community_id !== undefined) data.communityId = input.community_id
    if (input.dispatch_policy !== undefined) {
      data.dispatchPolicyJson = input.dispatch_policy as unknown as Prisma.InputJsonValue
    }
    if (input.admission_policy !== undefined) {
      data.admissionPolicyJson =
        input.admission_policy === null
          ? Prisma.JsonNull
          : (input.admission_policy as unknown as Prisma.InputJsonValue)
    }
    if (input.load_policy !== undefined) {
      data.loadPolicyJson =
        input.load_policy === null
          ? Prisma.JsonNull
          : (input.load_policy as unknown as Prisma.InputJsonValue)
    }
    if (input.theme_intent !== undefined) {
      data.themeIntentJson = input.theme_intent as unknown as Prisma.InputJsonValue
    }
    if (input.scene_constraints !== undefined) {
      data.sceneConstraintsJson =
        input.scene_constraints as unknown as Prisma.InputJsonValue
    }
    if (input.role_requirements !== undefined) {
      data.roleRequirementsJson =
        input.role_requirements as unknown as Prisma.InputJsonValue
    }
    if (input.media_policy !== undefined) {
      data.mediaPolicyJson =
        input.media_policy === null
          ? Prisma.JsonNull
          : (input.media_policy as unknown as Prisma.InputJsonValue)
    }
    if (input.safety !== undefined) {
      data.safetyJson =
        input.safety === null
          ? Prisma.JsonNull
          : (input.safety as unknown as Prisma.InputJsonValue)
    }
    if (input.locked_fields !== undefined) {
      data.lockedFieldsJson = input.locked_fields as unknown as Prisma.InputJsonValue
    }
    if (input.risk_level !== undefined) data.riskLevel = RISK_TO_DB[input.risk_level]

    try {
      const row = await this.prisma.publicDiscussionCue.update({
        where: { id },
        data,
      })
      return this.cueToDomain(row)
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return null
      }
      throw err
    }
  }

  // ---- Change ----

  async recordChange(
    input: RecordCueChangeInput,
  ): Promise<PublicDiscussionCueChangeDomain> {
    const row = await this.prisma.publicDiscussionCueChange.create({
      data: {
        scheduleId: input.schedule_id ?? null,
        cueId: input.cue_id ?? null,
        source: CHANGE_SOURCE_TO_DB[input.source],
        actorUserId: input.actor_user_id ?? null,
        actorSystem: input.actor_system ?? null,
        triggerId: input.trigger_id ?? null,
        triggerType: input.trigger_type ?? null,
        changeType: CHANGE_TYPE_TO_DB[input.change_type],
        baseRevision: input.base_revision ?? null,
        patchJson: input.patch_json as Prisma.InputJsonValue,
        diffJson:
          input.diff_json === undefined
            ? Prisma.JsonNull
            : (input.diff_json as Prisma.InputJsonValue),
        validationStatus: input.validation_status
          ? CHANGE_VALIDATION_TO_DB[input.validation_status]
          : 'PENDING',
        validationJson:
          input.validation_json === undefined
            ? Prisma.JsonNull
            : (input.validation_json as Prisma.InputJsonValue),
        riskLevel: input.risk_level ? RISK_TO_DB[input.risk_level] : 'STANDARD',
        approvalStatus: input.approval_status
          ? CHANGE_APPROVAL_TO_DB[input.approval_status]
          : 'PENDING',
        loadSnapshotJson:
          input.load_snapshot_json === undefined
            ? Prisma.JsonNull
            : (input.load_snapshot_json as Prisma.InputJsonValue),
        reason: input.reason ?? null,
        appliedAt: input.applied_at ?? null,
      },
    })
    return this.changeToDomain(row)
  }

  async listChangesForCue(
    cueId: string,
  ): Promise<PublicDiscussionCueChangeDomain[]> {
    const rows = await this.prisma.publicDiscussionCueChange.findMany({
      where: { cueId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.changeToDomain(row))
  }

  async listChangesForSchedule(
    scheduleId: string,
  ): Promise<PublicDiscussionCueChangeDomain[]> {
    const rows = await this.prisma.publicDiscussionCueChange.findMany({
      where: { scheduleId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.changeToDomain(row))
  }

  // ---- Media ----

  async attachMedia(
    input: AttachCueMediaInput,
  ): Promise<PublicDiscussionCueMediaDomain> {
    const row = await this.prisma.publicDiscussionCueMedia.create({
      data: {
        cueId: input.cue_id,
        assetId: input.asset_id,
        semanticSnapshotId: input.semantic_snapshot_id ?? null,
        role: MEDIA_ROLE_TO_DB[input.role],
        usageStrength: input.usage_strength
          ? MEDIA_STRENGTH_TO_DB[input.usage_strength]
          : 'OPTIONAL',
        usePolicy: input.use_policy
          ? MEDIA_USE_POLICY_TO_DB[input.use_policy]
          : 'PREFER_RUNTIME_CONTEXT',
        displayPolicy: 'runtime_decides',
        selectionNote: input.selection_note ?? null,
        sortOrder: input.sort_order ?? 0,
        reuseLimit: input.reuse_limit ?? null,
        validationStatus: input.validation_status
          ? MEDIA_VALIDATION_TO_DB[input.validation_status]
          : 'VALID',
        validationReason: input.validation_reason ?? null,
        createdByType: MEDIA_CREATED_BY_TO_DB[input.created_by_type],
        createdById: input.created_by_id ?? null,
      },
    })
    return this.mediaToDomain(row)
  }

  async removeMedia(id: string): Promise<boolean> {
    try {
      await this.prisma.publicDiscussionCueMedia.delete({ where: { id } })
      return true
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return false
      }
      throw err
    }
  }

  async listMediaForCue(
    cueId: string,
  ): Promise<PublicDiscussionCueMediaDomain[]> {
    const rows = await this.prisma.publicDiscussionCueMedia.findMany({
      where: { cueId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return rows.map((row) => this.mediaToDomain(row))
  }

  // ---- Attempt (T-212 M2 — full write API) ----

  async listAttemptsForCue(
    cueId: string,
  ): Promise<CueExecutionAttemptDomain[]> {
    const rows = await this.prisma.cueExecutionAttempt.findMany({
      where: { cueId },
      orderBy: [{ attemptNo: 'asc' }],
    })
    return rows.map((row) => this.attemptToDomain(row))
  }

  async findPrewarmableCues(input: {
    now: Date
    batchSize: number
  }): Promise<PublicDiscussionCueDomain[]> {
    const rows = await this.prisma.publicDiscussionCue.findMany({
      where: {
        status: 'SCHEDULED',
        prewarmAt: { lte: input.now, not: null },
        triggerAt: { gt: input.now },
      },
      orderBy: [{ triggerAt: 'asc' }, { id: 'asc' }],
      take: Math.max(0, input.batchSize),
    })
    return rows.map((row) => this.cueToDomain(row))
  }

  async claimDueCues(input: ClaimDueCuesInput): Promise<ClaimedCue[]> {
    if (input.batchSize <= 0) return []
    const horizon = new Date(input.now.getTime() + input.graceSeconds * 1000)
    const leaseExpiresAt = new Date(input.now.getTime() + input.leaseSeconds * 1000)

    return this.prisma.$transaction(async (tx) => {
      // Atomic claim: select due/scheduled/deferred cues with row-level lock,
      // skipping rows other workers have locked, then transition to CLAIMED
      // and return the cue ids in a single round-trip.
      const scheduleFilter = input.scheduleId
        ? Prisma.sql`AND schedule_id = ${input.scheduleId}`
        : Prisma.empty
      const claimedRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        WITH due AS (
          SELECT id
          FROM public_discussion_cues
          WHERE trigger_at <= ${horizon}
            AND status IN ('SCHEDULED', 'DUE', 'DEFERRED', 'PREWARMING')
            ${scheduleFilter}
          ORDER BY priority DESC, trigger_at ASC, id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${input.batchSize}
        )
        UPDATE public_discussion_cues AS cue
        SET status = 'CLAIMED', updated_at = NOW()
        WHERE cue.id IN (SELECT id FROM due)
        RETURNING cue.id
      `)
      if (claimedRows.length === 0) return []

      const claimedIds = claimedRows.map((row) => row.id)
      const cueRows = await tx.publicDiscussionCue.findMany({
        where: { id: { in: claimedIds } },
      })
      const cuesById = new Map(cueRows.map((row) => [row.id, row]))

      // For each claimed cue, compute next attempt_no and insert the LEASED
      // attempt row. attempt_no = max(prior attempts.attemptNo) + 1 (>=1).
      const attemptsByCueId = await tx.cueExecutionAttempt.groupBy({
        by: ['cueId'],
        where: { cueId: { in: claimedIds } },
        _max: { attemptNo: true },
      })
      const maxAttemptByCueId = new Map(
        attemptsByCueId.map((a) => [a.cueId, a._max.attemptNo ?? 0]),
      )

      const out: ClaimedCue[] = []
      for (const cueId of claimedIds) {
        const cueRow = cuesById.get(cueId)
        if (!cueRow) continue
        const nextAttemptNo = (maxAttemptByCueId.get(cueId) ?? 0) + 1
        const idempotencyKey = attemptIdempotencyKey(
          cueRow.scheduleId,
          cueRow.id,
          nextAttemptNo,
        )
        const attemptRow = await tx.cueExecutionAttempt.create({
          data: {
            cueId: cueRow.id,
            attemptNo: nextAttemptNo,
            scheduledTriggerAt: cueRow.triggerAt,
            actualClaimedAt: input.now,
            status: 'LEASED',
            leaseOwner: input.leaseOwner,
            leaseExpiresAt,
            idempotencyKey,
          },
        })
        out.push({
          cue: this.cueToDomain(cueRow),
          attempt: this.attemptToDomain(attemptRow),
        })
      }
      return out
    })
  }

  async createAttempt(
    input: CreateCueAttemptInput,
  ): Promise<CueExecutionAttemptDomain> {
    if (!Number.isInteger(input.attempt_no) || input.attempt_no < 1) {
      throw new Error('createAttempt: attempt_no must be a positive integer (>= 1)')
    }
    // Honor idempotency_key uniqueness — if this caller has already created
    // an attempt with the same key (e.g. due to a transient retry), return
    // the existing row instead of throwing.
    const existing = await this.prisma.cueExecutionAttempt.findUnique({
      where: { idempotencyKey: input.idempotency_key },
    })
    if (existing) return this.attemptToDomain(existing)

    const row = await this.prisma.cueExecutionAttempt.create({
      data: {
        cueId: input.cue_id,
        attemptNo: input.attempt_no,
        scheduledTriggerAt: input.scheduled_trigger_at,
        actualClaimedAt: input.lease_owner ? new Date() : null,
        status: input.status ? ATTEMPT_STATUS_TO_DB[input.status] : 'LEASED',
        leaseOwner: input.lease_owner ?? null,
        leaseExpiresAt: input.lease_expires_at ?? null,
        idempotencyKey: input.idempotency_key,
        admissionResultJson:
          input.admission_result_json === undefined
            ? Prisma.JsonNull
            : (input.admission_result_json as Prisma.InputJsonValue),
        allocatorResultJson:
          input.allocator_result_json === undefined
            ? Prisma.JsonNull
            : (input.allocator_result_json as Prisma.InputJsonValue),
        directorBriefJson:
          input.director_brief_json === undefined
            ? Prisma.JsonNull
            : (input.director_brief_json as Prisma.InputJsonValue),
        selectedCastJson:
          input.selected_cast_json === undefined
            ? Prisma.JsonNull
            : (input.selected_cast_json as Prisma.InputJsonValue),
        loadSnapshotJson:
          input.load_snapshot_json === undefined
            ? Prisma.JsonNull
            : (input.load_snapshot_json as Prisma.InputJsonValue),
      },
    })
    return this.attemptToDomain(row)
  }

  async updateAttempt(
    id: string,
    patch: UpdateCueAttemptPatch,
  ): Promise<CueExecutionAttemptDomain | null> {
    const data: Prisma.CueExecutionAttemptUpdateInput = {}
    if (patch.status !== undefined) data.status = ATTEMPT_STATUS_TO_DB[patch.status]
    if (patch.lease_owner !== undefined) data.leaseOwner = patch.lease_owner
    if (patch.lease_expires_at !== undefined) {
      data.leaseExpiresAt = patch.lease_expires_at
    }
    if (patch.actual_claimed_at !== undefined) {
      data.actualClaimedAt = patch.actual_claimed_at
    }
    if (patch.admission_result_json !== undefined) {
      data.admissionResultJson =
        patch.admission_result_json === null
          ? Prisma.JsonNull
          : (patch.admission_result_json as Prisma.InputJsonValue)
    }
    if (patch.allocator_result_json !== undefined) {
      data.allocatorResultJson =
        patch.allocator_result_json === null
          ? Prisma.JsonNull
          : (patch.allocator_result_json as Prisma.InputJsonValue)
    }
    if (patch.director_brief_json !== undefined) {
      data.directorBriefJson =
        patch.director_brief_json === null
          ? Prisma.JsonNull
          : (patch.director_brief_json as Prisma.InputJsonValue)
    }
    if (patch.selected_cast_json !== undefined) {
      data.selectedCastJson =
        patch.selected_cast_json === null
          ? Prisma.JsonNull
          : (patch.selected_cast_json as Prisma.InputJsonValue)
    }
    if (patch.post_id !== undefined) data.postId = patch.post_id
    if (patch.thread_id !== undefined) data.threadId = patch.thread_id
    if (patch.forum_scene_metadata_id !== undefined) {
      data.forumSceneMetadataId = patch.forum_scene_metadata_id
    }
    if (patch.total_latency_ms !== undefined) {
      data.totalLatencyMs = patch.total_latency_ms
    }
    if (patch.error_code !== undefined) data.errorCode = patch.error_code
    if (patch.error_text !== undefined) data.errorText = patch.error_text
    if (patch.started_at !== undefined) data.startedAt = patch.started_at
    if (patch.finished_at !== undefined) data.finishedAt = patch.finished_at

    try {
      const row = await this.prisma.cueExecutionAttempt.update({
        where: { id },
        data,
      })
      return this.attemptToDomain(row)
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return null
      }
      throw err
    }
  }

  async releaseLease(
    attemptId: string,
  ): Promise<CueExecutionAttemptDomain | null> {
    try {
      const row = await this.prisma.cueExecutionAttempt.update({
        where: { id: attemptId },
        data: { leaseOwner: null, leaseExpiresAt: null },
      })
      return this.attemptToDomain(row)
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return null
      }
      throw err
    }
  }

  async extendLease(
    attemptId: string,
    leaseSeconds: number,
    now?: Date,
  ): Promise<CueExecutionAttemptDomain | null> {
    const baseTime = (now ?? new Date()).getTime()
    try {
      const row = await this.prisma.cueExecutionAttempt.update({
        where: { id: attemptId },
        data: { leaseExpiresAt: new Date(baseTime + leaseSeconds * 1000) },
      })
      return this.attemptToDomain(row)
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return null
      }
      throw err
    }
  }

  async findInFlightAttemptForCue(
    cueId: string,
  ): Promise<CueExecutionAttemptDomain | null> {
    const inFlightDb = IN_FLIGHT_ATTEMPT_STATUSES.map(
      (s) => ATTEMPT_STATUS_TO_DB[s],
    )
    const row = await this.prisma.cueExecutionAttempt.findFirst({
      where: { cueId, status: { in: inFlightDb } },
      orderBy: [{ attemptNo: 'desc' }],
    })
    return row ? this.attemptToDomain(row) : null
  }

  async reclaimExpiredLeases(
    input: ReclaimExpiredLeasesInput,
  ): Promise<ReclaimedLease[]> {
    const inFlightDb = IN_FLIGHT_ATTEMPT_STATUSES.map(
      (s) => ATTEMPT_STATUS_TO_DB[s],
    )
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.cueExecutionAttempt.findMany({
        where: {
          status: { in: inFlightDb },
          leaseExpiresAt: { lt: input.now },
        },
        orderBy: [{ createdAt: 'asc' }],
        take: input.batchSize,
      })
      if (expired.length === 0) return []
      const expiredIds = expired.map((row) => row.id)
      await tx.cueExecutionAttempt.updateMany({
        where: {
          id: { in: expiredIds },
          status: { in: inFlightDb },
        },
        data: {
          status: 'FAILED',
          errorCode: 'lease_expired',
          errorText: 'lease expired before completion',
          leaseOwner: null,
          leaseExpiresAt: null,
          finishedAt: input.now,
        },
      })
      const cueIds = Array.from(new Set(expired.map((row) => row.cueId)))
      await tx.publicDiscussionCue.updateMany({
        where: {
          id: { in: cueIds },
          status: { in: ['CLAIMED', 'EXECUTING'] },
        },
        data: { status: 'DEFERRED' },
      })
      return expired.map((row) => ({
        attempt_id: row.id,
        cue_id: row.cueId,
      }))
    })
  }

  // ---- Domain mappers ----

  private scheduleToDomain(
    row: PrismaPublicDiscussionCueSchedule,
  ): PublicDiscussionCueScheduleDomain {
    return {
      id: row.id,
      scope_type: SCOPE_TYPE_FROM_DB[row.scopeType],
      community_id: row.communityId,
      room_id: row.roomId,
      timezone: row.timezone,
      date_range_start: row.dateRangeStart,
      date_range_end: row.dateRangeEnd,
      baseline_contract_version: row.baselineContractVersion,
      status: SCHEDULE_STATUS_FROM_DB[row.status],
      source: SCHEDULE_SOURCE_FROM_DB[row.source],
      version: row.version,
      base_schedule_id: row.baseScheduleId,
      rollback_from_schedule_id: row.rollbackFromScheduleId,
      summary: row.summary,
      created_by_user_id: row.createdByUserId,
      created_by_system: row.createdBySystem,
      published_at: row.publishedAt,
      approved_by_user_id: row.approvedByUserId,
      approved_at: row.approvedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private cueToDomain(row: PrismaPublicDiscussionCue): PublicDiscussionCueDomain {
    return {
      id: row.id,
      schedule_id: row.scheduleId,
      source_type: CUE_SOURCE_FROM_DB[row.sourceType],
      status: CUE_STATUS_FROM_DB[row.status],
      community_id: row.communityId ?? undefined,
      scope: CueCommunityScopeSchema.parse(row.scopeJson),
      trigger_at: row.triggerAt.toISOString(),
      timezone: row.timezone,
      prewarm_at: row.prewarmAt?.toISOString(),
      latest_start_at: row.latestStartAt?.toISOString(),
      expire_at: row.expireAt?.toISOString(),
      priority: row.priority,
      lane: LANE_FROM_DB[row.lane],
      dispatch_policy: DispatchPolicySchema.parse(row.dispatchPolicyJson),
      admission_policy:
        row.admissionPolicyJson == null
          ? undefined
          : CueAdmissionPolicySchema.parse(row.admissionPolicyJson),
      load_policy:
        row.loadPolicyJson == null
          ? undefined
          : CueLoadPolicySchema.parse(row.loadPolicyJson),
      theme_intent: CueThemeIntentSchema.parse(row.themeIntentJson),
      scene_constraints: CueSceneConstraintsSchema.parse(row.sceneConstraintsJson),
      role_requirements: CueRoleRequirementVectorSchema.parse(
        row.roleRequirementsJson,
      ),
      media_policy:
        row.mediaPolicyJson == null
          ? undefined
          : CueMediaPolicySchema.parse(row.mediaPolicyJson),
      safety:
        row.safetyJson == null
          ? undefined
          : CueSafetyPolicySchema.parse(row.safetyJson),
      locked_fields: LockedFieldsSchema.parse(row.lockedFieldsJson ?? []),
      risk_level: RISK_FROM_DB[row.riskLevel],
      revision: row.revision,
      idempotency_key: row.idempotencyKey,
      created_by_user_id: row.createdByUserId ?? undefined,
      created_by_system: row.createdBySystem ?? undefined,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
  }

  private changeToDomain(
    row: PrismaPublicDiscussionCueChange,
  ): PublicDiscussionCueChangeDomain {
    return {
      id: row.id,
      schedule_id: row.scheduleId,
      cue_id: row.cueId,
      source: CHANGE_SOURCE_FROM_DB[row.source],
      actor_user_id: row.actorUserId,
      actor_system: row.actorSystem,
      trigger_id: row.triggerId,
      trigger_type: row.triggerType,
      change_type: CHANGE_TYPE_FROM_DB[row.changeType],
      base_revision: row.baseRevision,
      patch_json: row.patchJson,
      diff_json: row.diffJson,
      validation_status: CHANGE_VALIDATION_FROM_DB[row.validationStatus],
      validation_json: row.validationJson,
      risk_level: RISK_FROM_DB[row.riskLevel],
      approval_status: CHANGE_APPROVAL_FROM_DB[row.approvalStatus],
      load_snapshot_json: row.loadSnapshotJson,
      reason: row.reason,
      applied_at: row.appliedAt,
      created_at: row.createdAt,
    }
  }

  private mediaToDomain(
    row: PrismaPublicDiscussionCueMedia,
  ): PublicDiscussionCueMediaDomain {
    return {
      id: row.id,
      cue_id: row.cueId,
      asset_id: row.assetId,
      semantic_snapshot_id: row.semanticSnapshotId,
      role: MEDIA_ROLE_FROM_DB[row.role],
      usage_strength: MEDIA_STRENGTH_FROM_DB[row.usageStrength],
      use_policy: MEDIA_USE_POLICY_FROM_DB[row.usePolicy],
      display_policy: row.displayPolicy,
      selection_note: row.selectionNote,
      sort_order: row.sortOrder,
      reuse_limit: row.reuseLimit,
      validation_status: MEDIA_VALIDATION_FROM_DB[row.validationStatus],
      validation_reason: row.validationReason,
      created_by_type: MEDIA_CREATED_BY_FROM_DB[row.createdByType],
      created_by_id: row.createdById,
      created_at: row.createdAt,
    }
  }

  private attemptToDomain(
    row: PrismaCueExecutionAttempt,
  ): CueExecutionAttemptDomain {
    return {
      id: row.id,
      cue_id: row.cueId,
      attempt_no: row.attemptNo,
      scheduled_trigger_at: row.scheduledTriggerAt,
      actual_claimed_at: row.actualClaimedAt,
      status: ATTEMPT_STATUS_FROM_DB[row.status],
      lease_owner: row.leaseOwner,
      lease_expires_at: row.leaseExpiresAt,
      idempotency_key: row.idempotencyKey,
      admission_result_json: row.admissionResultJson,
      allocator_result_json: row.allocatorResultJson,
      director_brief_json: row.directorBriefJson,
      selected_cast_json: row.selectedCastJson,
      post_id: row.postId,
      thread_id: row.threadId,
      forum_scene_metadata_id: row.forumSceneMetadataId,
      total_latency_ms: row.totalLatencyMs,
      error_code: row.errorCode,
      error_text: row.errorText,
      created_at: row.createdAt,
      started_at: row.startedAt,
      finished_at: row.finishedAt,
    }
  }
}

