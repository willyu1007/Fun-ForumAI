/**
 * T-209 cue-data-and-board — `CueRepository` interface and in-memory impl.
 *
 * Owns CRUD for the public discussion cue programming layer:
 *   - PublicDiscussionCueSchedule
 *   - PublicDiscussionCue
 *   - PublicDiscussionCueChange (audit log)
 *   - PublicDiscussionCueMedia
 *   - CueExecutionAttempt (write API stubbed; T-212 implements; reads usable now)
 *
 * Repositories return **domain objects** (camelCase types from programming/cue
 * and contract layers). Prisma types do not leak across this seam (per
 * AGENTS.md DB-SSOT rule).
 *
 * Cross-domain references (community, asset, agent, post, user) are plain
 * strings — no FK enforcement at ORM level (umbrella decision: cue tables stay
 * loosely coupled to existing models in MVP).
 */

import { randomUUID } from 'node:crypto'
import { buildIdempotencyKey } from '../programming/contract/index.js'
import type {
  CueAdmissionPolicy,
  CueCommunityScope,
  CueLane,
  CueLoadPolicy,
  CueMediaPolicy,
  CueRiskLevel,
  CueRoleRequirementVector,
  CueSafetyPolicy,
  CueSceneConstraints,
  CueSourceType,
  CueThemeIntent,
  PublicDiscussionCueDomain,
  PublicDiscussionCueStatus,
} from '../programming/cue/types.js'
import type { DispatchPolicy } from '../programming/contract/index.js'

// =============================================================================
// Schedule domain
// =============================================================================

export type CueScheduleStatus =
  | 'draft'
  | 'review'
  | 'published'
  | 'active'
  | 'archived'
  | 'rolled_back'

export type CueScheduleSource = 'baseline' | 'manual' | 'automated' | 'mixed'

export type CueScopeType = 'global' | 'community' | 'room'

export interface PublicDiscussionCueScheduleDomain {
  id: string
  scope_type: CueScopeType
  community_id: string | null
  room_id: string | null
  timezone: string
  date_range_start: Date
  date_range_end: Date
  baseline_contract_version: string | null
  status: CueScheduleStatus
  source: CueScheduleSource
  version: number
  base_schedule_id: string | null
  rollback_from_schedule_id: string | null
  summary: string | null
  created_by_user_id: string | null
  created_by_system: string | null
  published_at: Date | null
  approved_by_user_id: string | null
  approved_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface CreateCueScheduleInput {
  scope_type: CueScopeType
  community_id?: string | null
  room_id?: string | null
  timezone?: string
  date_range_start: Date
  date_range_end: Date
  baseline_contract_version?: string | null
  status?: CueScheduleStatus
  source: CueScheduleSource
  version?: number
  base_schedule_id?: string | null
  rollback_from_schedule_id?: string | null
  summary?: string | null
  created_by_user_id?: string | null
  created_by_system?: string | null
}

export interface ScheduleScopeQuery {
  scope_type: CueScopeType
  community_id?: string | null
  room_id?: string | null
}

// =============================================================================
// Cue domain (write inputs; read shape is `PublicDiscussionCueDomain`)
// =============================================================================

export interface CreateCueInput {
  schedule_id: string
  source_type: CueSourceType
  status?: PublicDiscussionCueStatus
  community_id?: string | null
  scope: CueCommunityScope

  trigger_at: Date
  timezone?: string
  prewarm_at?: Date | null
  latest_start_at?: Date | null
  expire_at?: Date | null

  priority?: number
  lane?: CueLane

  dispatch_policy: DispatchPolicy
  admission_policy?: CueAdmissionPolicy
  load_policy?: CueLoadPolicy

  theme_intent: CueThemeIntent
  scene_constraints: CueSceneConstraints
  role_requirements: CueRoleRequirementVector
  media_policy?: CueMediaPolicy

  safety?: CueSafetyPolicy
  locked_fields?: string[]
  risk_level?: CueRiskLevel

  /**
   * Optional explicit idempotency key. If omitted the repository derives one
   * via `buildIdempotencyKey('cue', schedule_id, <generated cue id>, '0')`
   * (revision 0 marks the create event; subsequent revisions live on
   * `CueExecutionAttempt`).
   */
  idempotency_key?: string

  created_by_user_id?: string | null
  created_by_system?: string | null
}

export interface ListUpcomingCuesQuery {
  schedule_id?: string
  community_id?: string
  from?: Date
  to?: Date
  limit?: number
  cursor?: string
}

/**
 * T-210 M1 — selective cue update.
 *
 * Each field is optional. Set a value to overwrite the column; pass `null` to
 * clear an optional column (only meaningful for optional fields). Omitted
 * keys are left unchanged.
 *
 * The repository increments `revision` by 1 and refreshes `updated_at`.
 *
 * Required fields (`trigger_at`, `timezone`, `priority`, `lane`,
 * `dispatch_policy`, `theme_intent`, `scene_constraints`, `role_requirements`,
 * `risk_level`, `locked_fields`) cannot accept `null`. Service layer rejects
 * `removed_fields` entries that target required keys.
 */
export interface UpdateCueInput {
  trigger_at?: Date
  timezone?: string
  prewarm_at?: Date | null
  latest_start_at?: Date | null
  expire_at?: Date | null
  priority?: number
  lane?: CueLane
  community_id?: string | null
  dispatch_policy?: DispatchPolicy
  admission_policy?: CueAdmissionPolicy | null
  load_policy?: CueLoadPolicy | null
  theme_intent?: CueThemeIntent
  scene_constraints?: CueSceneConstraints
  role_requirements?: CueRoleRequirementVector
  media_policy?: CueMediaPolicy | null
  safety?: CueSafetyPolicy | null
  locked_fields?: string[]
  risk_level?: CueRiskLevel
}

// =============================================================================
// Change domain
// =============================================================================

export type CueChangeType =
  | 'create_cue'
  | 'update_cue'
  | 'cancel_cue'
  | 'defer_cue'
  | 'merge_into_existing_cue'
  | 'split_cue'
  | 'attach_media'
  | 'remove_media'
  | 'update_dispatch_policy'
  | 'update_risk_level'
  | 'publish_schedule'
  | 'rollback_schedule'

export type CueChangeSource = 'manual' | 'automated' | 'system'

export type CueChangeApprovalStatus =
  | 'pending'
  | 'auto_applied'
  | 'approved'
  | 'rejected'
  | 'rolled_back'

export type CueChangeValidationStatus = 'pending' | 'passed' | 'failed'

export interface PublicDiscussionCueChangeDomain {
  id: string
  schedule_id: string | null
  cue_id: string | null
  source: CueChangeSource
  actor_user_id: string | null
  actor_system: string | null
  trigger_id: string | null
  trigger_type: string | null
  change_type: CueChangeType
  base_revision: number | null
  patch_json: unknown
  diff_json: unknown
  validation_status: CueChangeValidationStatus
  validation_json: unknown
  risk_level: CueRiskLevel
  approval_status: CueChangeApprovalStatus
  load_snapshot_json: unknown
  reason: string | null
  applied_at: Date | null
  created_at: Date
}

export interface RecordCueChangeInput {
  schedule_id?: string | null
  cue_id?: string | null
  source: CueChangeSource
  actor_user_id?: string | null
  actor_system?: string | null
  trigger_id?: string | null
  trigger_type?: string | null
  change_type: CueChangeType
  base_revision?: number | null
  patch_json: unknown
  diff_json?: unknown
  validation_status?: CueChangeValidationStatus
  validation_json?: unknown
  risk_level?: CueRiskLevel
  approval_status?: CueChangeApprovalStatus
  load_snapshot_json?: unknown
  reason?: string | null
  applied_at?: Date | null
}

// =============================================================================
// Media domain
// =============================================================================

export type CueMediaRole =
  | 'context_anchor'
  | 'mood_reference'
  | 'evidence_card'
  | 'visual_seed'
  | 'cover_candidate'
  | 'continuity_anchor'

export type CueMediaUsageStrength =
  | 'optional'
  | 'preferred'
  | 'anchor'
  | 'selected_only_pool'

export type CueMediaUsePolicy =
  | 'runtime_only'
  | 'prefer_runtime_context'
  | 'prefer_public_display'
  | 'allow_generated_derivative'
  | 'require_public_display'

export type CueMediaValidationStatus =
  | 'valid'
  | 'invalid'
  | 'blocked'
  | 'degraded'

export type CueMediaCreatedByType = 'admin' | 'system_llm' | 'baseline'

export interface PublicDiscussionCueMediaDomain {
  id: string
  cue_id: string
  asset_id: string
  semantic_snapshot_id: string | null
  role: CueMediaRole
  usage_strength: CueMediaUsageStrength
  use_policy: CueMediaUsePolicy
  display_policy: string
  selection_note: string | null
  sort_order: number
  reuse_limit: number | null
  validation_status: CueMediaValidationStatus
  validation_reason: string | null
  created_by_type: CueMediaCreatedByType
  created_by_id: string | null
  created_at: Date
}

export interface AttachCueMediaInput {
  cue_id: string
  asset_id: string
  semantic_snapshot_id?: string | null
  role: CueMediaRole
  usage_strength?: CueMediaUsageStrength
  use_policy?: CueMediaUsePolicy
  selection_note?: string | null
  sort_order?: number
  reuse_limit?: number | null
  validation_status?: CueMediaValidationStatus
  validation_reason?: string | null
  created_by_type: CueMediaCreatedByType
  created_by_id?: string | null
}

// =============================================================================
// Attempt domain (read-only here; T-212 owns writes)
// =============================================================================

export type CueExecutionAttemptStatus =
  | 'pending'
  | 'admitted'
  | 'leased'
  | 'allocating'
  | 'compiling'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'delayed'
  | 'misfired'
  | 'cancelled'

export interface CueExecutionAttemptDomain {
  id: string
  cue_id: string
  attempt_no: number
  scheduled_trigger_at: Date
  actual_claimed_at: Date | null
  status: CueExecutionAttemptStatus
  lease_owner: string | null
  lease_expires_at: Date | null
  idempotency_key: string
  // Process audit fields (T-212 populates):
  admission_result_json: unknown
  allocator_result_json: unknown
  director_brief_json: unknown
  selected_cast_json: unknown
  // Result fields (T-212 populates):
  post_id: string | null
  thread_id: string | null
  forum_scene_metadata_id: string | null
  // Latency:
  total_latency_ms: number | null
  // Error:
  error_code: string | null
  error_text: string | null
  created_at: Date
  started_at: Date | null
  finished_at: Date | null
}

// =============================================================================
// Repository interface
// =============================================================================

export interface CueRepository {
  // Schedule
  createSchedule(input: CreateCueScheduleInput): Promise<PublicDiscussionCueScheduleDomain>
  findScheduleById(id: string): Promise<PublicDiscussionCueScheduleDomain | null>
  findActiveScheduleForScope(
    query: ScheduleScopeQuery,
  ): Promise<PublicDiscussionCueScheduleDomain | null>
  listSchedules(opts?: { limit?: number }): Promise<PublicDiscussionCueScheduleDomain[]>
  updateScheduleStatus(
    id: string,
    status: CueScheduleStatus,
  ): Promise<PublicDiscussionCueScheduleDomain | null>

  // Cue
  createCue(input: CreateCueInput): Promise<PublicDiscussionCueDomain>
  findCueById(id: string): Promise<PublicDiscussionCueDomain | null>
  listCuesForSchedule(scheduleId: string): Promise<PublicDiscussionCueDomain[]>
  listUpcomingCues(query: ListUpcomingCuesQuery): Promise<PublicDiscussionCueDomain[]>
  setCueStatus(
    id: string,
    status: PublicDiscussionCueStatus,
  ): Promise<PublicDiscussionCueDomain | null>
  updateCue(
    id: string,
    input: UpdateCueInput,
  ): Promise<PublicDiscussionCueDomain | null>

  // Change (audit log)
  recordChange(input: RecordCueChangeInput): Promise<PublicDiscussionCueChangeDomain>
  listChangesForCue(cueId: string): Promise<PublicDiscussionCueChangeDomain[]>
  listChangesForSchedule(scheduleId: string): Promise<PublicDiscussionCueChangeDomain[]>

  // Media
  attachMedia(input: AttachCueMediaInput): Promise<PublicDiscussionCueMediaDomain>
  removeMedia(id: string): Promise<boolean>
  listMediaForCue(cueId: string): Promise<PublicDiscussionCueMediaDomain[]>

  // Attempt (read API; T-212 will add write API)
  listAttemptsForCue(cueId: string): Promise<CueExecutionAttemptDomain[]>
}

// =============================================================================
// In-memory implementation
// =============================================================================

let counter = 0
function localId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36)}`
}

/**
 * Throws if the cue's scope is incompatible with the schedule's scope.
 * - global schedule    → any cue scope allowed
 * - community schedule → cue.scope.community_id must equal schedule.community_id
 *                         (and cue.community_id, when set, must match too)
 * - room schedule      → cue.scope.community_id (if any) is unconstrained at this layer;
 *                         schedule.room_id alignment is enforced by T-212 once cue worker lands
 */
export function assertScopeConsistency(
  schedule: PublicDiscussionCueScheduleDomain,
  input: CreateCueInput,
): void {
  if (schedule.scope_type === 'community') {
    const cueScopeCommunity =
      input.scope.mode === 'single' ? input.scope.community_id : null
    if (
      schedule.community_id != null &&
      cueScopeCommunity != null &&
      schedule.community_id !== cueScopeCommunity
    ) {
      throw new Error(
        `createCue: schedule ${schedule.id} is scoped to community ${schedule.community_id}, ` +
          `but cue scope.community_id is ${cueScopeCommunity}`,
      )
    }
    if (
      schedule.community_id != null &&
      input.community_id != null &&
      schedule.community_id !== input.community_id
    ) {
      throw new Error(
        `createCue: schedule ${schedule.id} is scoped to community ${schedule.community_id}, ` +
          `but cue.community_id is ${input.community_id}`,
      )
    }
  }
}

/**
 * Builder for the default cue idempotency key. Uses a UUID-derived suffix so
 * concurrent creates within the same millisecond don't collide on the unique
 * constraint.
 */
export function defaultCueIdempotencyKey(scheduleId: string): string {
  // UUID v4 has 122 bits of randomness → collision probability negligible.
  // We slice the first 12 hex chars (~48 bits) for a compact key segment that
  // still fits the segment regex `[A-Za-z0-9._-]+`.
  return buildIdempotencyKey(
    'cue',
    scheduleId,
    `pending-${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    0,
  )
}

function nowDate(): Date {
  return new Date()
}

function defaultedTimezone(input?: string): string {
  return input ?? 'Asia/Shanghai'
}

/**
 * Snapshot a cue domain object before returning it from the in-memory repo.
 *
 * Why: prior to T-210 M1's defensive snapshot in CueEditorService, the
 * in-memory repo returned references into its internal Map. Service callers
 * that captured `existing` and then called `setCueStatus`/`updateCue`
 * unintentionally observed mutated state through the captured reference,
 * which broke transition-from audit fields. Cloning on read aligns the
 * in-memory contract with PgCueRepository (which builds fresh objects on
 * every call) and removes a subtle aliasing trap from the seam.
 */
function cloneCueDomain(cue: PublicDiscussionCueDomain): PublicDiscussionCueDomain {
  return {
    ...cue,
    scope: { ...cue.scope },
    dispatch_policy: { ...cue.dispatch_policy },
    admission_policy: cue.admission_policy ? { ...cue.admission_policy } : undefined,
    load_policy: cue.load_policy ? { ...cue.load_policy } : undefined,
    theme_intent: { ...cue.theme_intent },
    scene_constraints: { ...cue.scene_constraints },
    role_requirements: { ...cue.role_requirements },
    media_policy: cue.media_policy ? { ...cue.media_policy } : undefined,
    safety: cue.safety ? { ...cue.safety } : undefined,
    locked_fields: [...cue.locked_fields],
  }
}

export class InMemoryCueRepository implements CueRepository {
  private readonly schedules = new Map<string, PublicDiscussionCueScheduleDomain>()
  private readonly cues = new Map<string, PublicDiscussionCueDomain>()
  private readonly changes = new Map<string, PublicDiscussionCueChangeDomain>()
  private readonly media = new Map<string, PublicDiscussionCueMediaDomain>()
  private readonly attempts = new Map<string, CueExecutionAttemptDomain>()

  // ---- Schedule ----

  async createSchedule(
    input: CreateCueScheduleInput,
  ): Promise<PublicDiscussionCueScheduleDomain> {
    const now = nowDate()
    const schedule: PublicDiscussionCueScheduleDomain = {
      id: localId('csched'),
      scope_type: input.scope_type,
      community_id: input.community_id ?? null,
      room_id: input.room_id ?? null,
      timezone: defaultedTimezone(input.timezone),
      date_range_start: input.date_range_start,
      date_range_end: input.date_range_end,
      baseline_contract_version: input.baseline_contract_version ?? null,
      status: input.status ?? 'draft',
      source: input.source,
      version: input.version ?? 1,
      base_schedule_id: input.base_schedule_id ?? null,
      rollback_from_schedule_id: input.rollback_from_schedule_id ?? null,
      summary: input.summary ?? null,
      created_by_user_id: input.created_by_user_id ?? null,
      created_by_system: input.created_by_system ?? null,
      published_at: null,
      approved_by_user_id: null,
      approved_at: null,
      created_at: now,
      updated_at: now,
    }
    this.schedules.set(schedule.id, schedule)
    return schedule
  }

  async findScheduleById(id: string): Promise<PublicDiscussionCueScheduleDomain | null> {
    return this.schedules.get(id) ?? null
  }

  async findActiveScheduleForScope(
    query: ScheduleScopeQuery,
  ): Promise<PublicDiscussionCueScheduleDomain | null> {
    const matches = Array.from(this.schedules.values())
      .filter((s) => s.status === 'active' && s.scope_type === query.scope_type)
      .filter((s) => {
        if (query.scope_type === 'community') {
          return s.community_id === (query.community_id ?? null)
        }
        if (query.scope_type === 'room') {
          return s.room_id === (query.room_id ?? null)
        }
        return true
      })
      .sort(
        (a, b) =>
          b.date_range_start.getTime() - a.date_range_start.getTime() ||
          b.created_at.getTime() - a.created_at.getTime(),
      )
    return matches[0] ?? null
  }

  async listSchedules(opts?: {
    limit?: number
  }): Promise<PublicDiscussionCueScheduleDomain[]> {
    const items = Array.from(this.schedules.values()).sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    )
    return opts?.limit ? items.slice(0, opts.limit) : items
  }

  async updateScheduleStatus(
    id: string,
    status: CueScheduleStatus,
  ): Promise<PublicDiscussionCueScheduleDomain | null> {
    const schedule = this.schedules.get(id)
    if (!schedule) return null
    schedule.status = status
    schedule.updated_at = nowDate()
    if (status === 'published' && !schedule.published_at) {
      schedule.published_at = schedule.updated_at
    }
    return schedule
  }

  // ---- Cue ----

  async createCue(input: CreateCueInput): Promise<PublicDiscussionCueDomain> {
    // Scope consistency: a community-scoped schedule may only contain cues whose
    // scope.community_id matches the schedule's community_id (umbrella §I-1).
    const schedule = this.schedules.get(input.schedule_id)
    if (schedule == null) {
      throw new Error(
        `createCue: schedule ${input.schedule_id} not found`,
      )
    }
    assertScopeConsistency(schedule, input)

    const id = localId('cue')
    const now = nowDate()
    const idempotencyKey =
      input.idempotency_key ?? defaultCueIdempotencyKey(input.schedule_id)

    const cue: PublicDiscussionCueDomain = {
      id,
      schedule_id: input.schedule_id,
      source_type: input.source_type,
      status: input.status ?? 'draft',
      community_id: input.community_id ?? undefined,
      scope: input.scope,
      trigger_at: input.trigger_at.toISOString(),
      timezone: defaultedTimezone(input.timezone),
      prewarm_at: input.prewarm_at?.toISOString(),
      latest_start_at: input.latest_start_at?.toISOString(),
      expire_at: input.expire_at?.toISOString(),
      priority: input.priority ?? 50,
      lane: input.lane ?? 'standard',
      dispatch_policy: input.dispatch_policy,
      admission_policy: input.admission_policy,
      load_policy: input.load_policy,
      theme_intent: input.theme_intent,
      scene_constraints: input.scene_constraints,
      role_requirements: input.role_requirements,
      media_policy: input.media_policy,
      safety: input.safety,
      locked_fields: input.locked_fields ?? [],
      risk_level: input.risk_level ?? 'standard',
      revision: 1,
      idempotency_key: idempotencyKey,
      created_by_user_id: input.created_by_user_id ?? undefined,
      created_by_system: input.created_by_system ?? undefined,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }
    this.cues.set(id, cue)
    return cloneCueDomain(cue)
  }

  async findCueById(id: string): Promise<PublicDiscussionCueDomain | null> {
    const cue = this.cues.get(id)
    return cue ? cloneCueDomain(cue) : null
  }

  async listCuesForSchedule(scheduleId: string): Promise<PublicDiscussionCueDomain[]> {
    return Array.from(this.cues.values())
      .filter((c) => c.schedule_id === scheduleId)
      .sort(
        (a, b) =>
          new Date(a.trigger_at).getTime() - new Date(b.trigger_at).getTime() ||
          a.id.localeCompare(b.id),
      )
      .map(cloneCueDomain)
  }

  async listUpcomingCues(
    query: ListUpcomingCuesQuery,
  ): Promise<PublicDiscussionCueDomain[]> {
    let items = Array.from(this.cues.values())
    if (query.schedule_id) {
      items = items.filter((c) => c.schedule_id === query.schedule_id)
    }
    if (query.community_id) {
      items = items.filter((c) => c.community_id === query.community_id)
    }
    if (query.from) {
      const fromMs = query.from.getTime()
      items = items.filter((c) => new Date(c.trigger_at).getTime() >= fromMs)
    }
    if (query.to) {
      const toMs = query.to.getTime()
      items = items.filter((c) => new Date(c.trigger_at).getTime() <= toMs)
    }
    items.sort(
      (a, b) =>
        new Date(a.trigger_at).getTime() - new Date(b.trigger_at).getTime() ||
        a.id.localeCompare(b.id),
    )
    const sliced = query.limit ? items.slice(0, query.limit) : items
    return sliced.map(cloneCueDomain)
  }

  async setCueStatus(
    id: string,
    status: PublicDiscussionCueStatus,
  ): Promise<PublicDiscussionCueDomain | null> {
    const cue = this.cues.get(id)
    if (!cue) return null
    cue.status = status
    cue.updated_at = nowDate().toISOString()
    return cloneCueDomain(cue)
  }

  async updateCue(
    id: string,
    input: UpdateCueInput,
  ): Promise<PublicDiscussionCueDomain | null> {
    const cue = this.cues.get(id)
    if (!cue) return null

    if (input.trigger_at !== undefined) cue.trigger_at = input.trigger_at.toISOString()
    if (input.timezone !== undefined) cue.timezone = input.timezone
    if (input.prewarm_at !== undefined) {
      cue.prewarm_at = input.prewarm_at === null ? undefined : input.prewarm_at.toISOString()
    }
    if (input.latest_start_at !== undefined) {
      cue.latest_start_at =
        input.latest_start_at === null ? undefined : input.latest_start_at.toISOString()
    }
    if (input.expire_at !== undefined) {
      cue.expire_at = input.expire_at === null ? undefined : input.expire_at.toISOString()
    }
    if (input.priority !== undefined) cue.priority = input.priority
    if (input.lane !== undefined) cue.lane = input.lane
    if (input.community_id !== undefined) {
      cue.community_id = input.community_id === null ? undefined : input.community_id
    }
    if (input.dispatch_policy !== undefined) cue.dispatch_policy = input.dispatch_policy
    if (input.admission_policy !== undefined) {
      cue.admission_policy = input.admission_policy === null ? undefined : input.admission_policy
    }
    if (input.load_policy !== undefined) {
      cue.load_policy = input.load_policy === null ? undefined : input.load_policy
    }
    if (input.theme_intent !== undefined) cue.theme_intent = input.theme_intent
    if (input.scene_constraints !== undefined) cue.scene_constraints = input.scene_constraints
    if (input.role_requirements !== undefined) cue.role_requirements = input.role_requirements
    if (input.media_policy !== undefined) {
      cue.media_policy = input.media_policy === null ? undefined : input.media_policy
    }
    if (input.safety !== undefined) {
      cue.safety = input.safety === null ? undefined : input.safety
    }
    if (input.locked_fields !== undefined) cue.locked_fields = input.locked_fields
    if (input.risk_level !== undefined) cue.risk_level = input.risk_level

    cue.revision += 1
    cue.updated_at = nowDate().toISOString()
    return cloneCueDomain(cue)
  }

  // ---- Change ----

  async recordChange(
    input: RecordCueChangeInput,
  ): Promise<PublicDiscussionCueChangeDomain> {
    const change: PublicDiscussionCueChangeDomain = {
      id: localId('cchg'),
      schedule_id: input.schedule_id ?? null,
      cue_id: input.cue_id ?? null,
      source: input.source,
      actor_user_id: input.actor_user_id ?? null,
      actor_system: input.actor_system ?? null,
      trigger_id: input.trigger_id ?? null,
      trigger_type: input.trigger_type ?? null,
      change_type: input.change_type,
      base_revision: input.base_revision ?? null,
      patch_json: input.patch_json,
      diff_json: input.diff_json ?? null,
      validation_status: input.validation_status ?? 'pending',
      validation_json: input.validation_json ?? null,
      risk_level: input.risk_level ?? 'standard',
      approval_status: input.approval_status ?? 'pending',
      load_snapshot_json: input.load_snapshot_json ?? null,
      reason: input.reason ?? null,
      applied_at: input.applied_at ?? null,
      created_at: nowDate(),
    }
    this.changes.set(change.id, change)
    return change
  }

  async listChangesForCue(
    cueId: string,
  ): Promise<PublicDiscussionCueChangeDomain[]> {
    return Array.from(this.changes.values())
      .filter((c) => c.cue_id === cueId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async listChangesForSchedule(
    scheduleId: string,
  ): Promise<PublicDiscussionCueChangeDomain[]> {
    return Array.from(this.changes.values())
      .filter((c) => c.schedule_id === scheduleId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  // ---- Media ----

  async attachMedia(
    input: AttachCueMediaInput,
  ): Promise<PublicDiscussionCueMediaDomain> {
    const media: PublicDiscussionCueMediaDomain = {
      id: localId('cmed'),
      cue_id: input.cue_id,
      asset_id: input.asset_id,
      semantic_snapshot_id: input.semantic_snapshot_id ?? null,
      role: input.role,
      usage_strength: input.usage_strength ?? 'optional',
      use_policy: input.use_policy ?? 'prefer_runtime_context',
      display_policy: 'runtime_decides',
      selection_note: input.selection_note ?? null,
      sort_order: input.sort_order ?? 0,
      reuse_limit: input.reuse_limit ?? null,
      validation_status: input.validation_status ?? 'valid',
      validation_reason: input.validation_reason ?? null,
      created_by_type: input.created_by_type,
      created_by_id: input.created_by_id ?? null,
      created_at: nowDate(),
    }
    this.media.set(media.id, media)
    return media
  }

  async removeMedia(id: string): Promise<boolean> {
    return this.media.delete(id)
  }

  async listMediaForCue(
    cueId: string,
  ): Promise<PublicDiscussionCueMediaDomain[]> {
    return Array.from(this.media.values())
      .filter((m) => m.cue_id === cueId)
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.created_at.getTime() - b.created_at.getTime(),
      )
  }

  // ---- Attempt (read-only here) ----

  async listAttemptsForCue(
    cueId: string,
  ): Promise<CueExecutionAttemptDomain[]> {
    return Array.from(this.attempts.values())
      .filter((a) => a.cue_id === cueId)
      .sort((a, b) => a.attempt_no - b.attempt_no)
  }
}
