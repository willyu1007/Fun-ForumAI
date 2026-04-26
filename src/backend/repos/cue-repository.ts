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
// Attempt write API (T-212 M2)
// =============================================================================

/**
 * One element in a `claimDueCues` batch — the claimed cue along with the
 * `CueExecutionAttempt` row created for it (status='leased').
 */
export interface ClaimedCue {
  cue: PublicDiscussionCueDomain
  attempt: CueExecutionAttemptDomain
}

/**
 * Atomic claim of due cues via DB-level lease (FOR UPDATE SKIP LOCKED in pg).
 *
 * Eligible cues: `status ∈ {'scheduled','due','deferred'} AND
 * triggerAt <= now + graceSeconds`. The repository transitions matched cues
 * to status='claimed' and creates a fresh `CueExecutionAttempt`
 * (status='leased', `lease_owner`, `lease_expires_at = now + leaseSeconds`,
 * `attempt_no = max(prior attempts for cue) + 1`).
 *
 * Multiple workers may call this concurrently — SKIP LOCKED guarantees no
 * cue is double-claimed. Returns at most `batchSize` rows.
 */
export interface ClaimDueCuesInput {
  now: Date
  graceSeconds: number
  leaseOwner: string
  leaseSeconds: number
  batchSize: number
  /** Optional schedule scope restriction (mostly for tests / partitioned workers). */
  scheduleId?: string
}

export interface CreateCueAttemptInput {
  cue_id: string
  /** Must be >= 1. Caller is responsible for computing the next attempt number. */
  attempt_no: number
  scheduled_trigger_at: Date
  status?: CueExecutionAttemptStatus
  lease_owner?: string | null
  lease_expires_at?: Date | null
  /**
   * Caller provides; idempotency namespace `cue:<scheduleId>:<cueId>:<attempt_no>`.
   * Cue creation occupies `cue:<scheduleId>:pending-XXXX:0`, so attempt keys
   * (attempt_no >= 1) never collide with cue creation keys.
   */
  idempotency_key: string
  admission_result_json?: unknown
  allocator_result_json?: unknown
  director_brief_json?: unknown
  selected_cast_json?: unknown
  load_snapshot_json?: unknown
}

export interface UpdateCueAttemptPatch {
  status?: CueExecutionAttemptStatus
  lease_owner?: string | null
  lease_expires_at?: Date | null
  actual_claimed_at?: Date | null
  admission_result_json?: unknown
  allocator_result_json?: unknown
  director_brief_json?: unknown
  selected_cast_json?: unknown
  post_id?: string | null
  thread_id?: string | null
  forum_scene_metadata_id?: string | null
  total_latency_ms?: number | null
  error_code?: string | null
  error_text?: string | null
  started_at?: Date | null
  finished_at?: Date | null
}

export interface ReclaimExpiredLeasesInput {
  now: Date
  /** Cap on rows reset per call. */
  batchSize?: number
}

/**
 * Identity of an attempt whose lease was reclaimed (marked failed with
 * `error_code='lease_expired'`); the corresponding cue is reset to
 * `deferred` so the next worker tick can re-claim it.
 */
export interface ReclaimedLease {
  attempt_id: string
  cue_id: string
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

  // Load counters (T-213 M1) — community-scoped counts the live admission
  // load service consumes on the hot path. Bounded windows / status filters
  // keep each query O(index lookup).
  countCuesForCommunity(input: CountCuesForCommunityInput): Promise<number>
  countAttemptsForCommunity(input: CountAttemptsForCommunityInput): Promise<number>

  // Attempt (T-212 M2)
  listAttemptsForCue(cueId: string): Promise<CueExecutionAttemptDomain[]>
  /**
   * T-212 M5 — find cues whose prewarm window is open: `prewarm_at <= now AND
   * trigger_at > now AND status='scheduled'`. Worker uses this to drive the
   * prewarm dry-run sweep (no DB lease — prewarm is best-effort and racing
   * workers will simply re-do the dry-runs harmlessly).
   */
  findPrewarmableCues(input: {
    now: Date
    batchSize: number
  }): Promise<PublicDiscussionCueDomain[]>
  claimDueCues(input: ClaimDueCuesInput): Promise<ClaimedCue[]>
  createAttempt(input: CreateCueAttemptInput): Promise<CueExecutionAttemptDomain>
  updateAttempt(
    id: string,
    patch: UpdateCueAttemptPatch,
  ): Promise<CueExecutionAttemptDomain | null>
  releaseLease(attemptId: string): Promise<CueExecutionAttemptDomain | null>
  extendLease(
    attemptId: string,
    leaseSeconds: number,
    now?: Date,
  ): Promise<CueExecutionAttemptDomain | null>
  findInFlightAttemptForCue(
    cueId: string,
  ): Promise<CueExecutionAttemptDomain | null>
  reclaimExpiredLeases(input: ReclaimExpiredLeasesInput): Promise<ReclaimedLease[]>
}

/**
 * Statuses that count an attempt as "in flight" — leased or actively running.
 * Lease-reclaim sweeps target this set; only an in-flight attempt's lease
 * matters for cue reclaim.
 */
export const IN_FLIGHT_ATTEMPT_STATUSES: ReadonlyArray<CueExecutionAttemptStatus> =
  ['leased', 'admitted', 'allocating', 'compiling', 'executing']

// =============================================================================
// Load-counter inputs (T-213 M1)
// =============================================================================

export interface CountCuesForCommunityInput {
  communityId: string
  statuses: ReadonlyArray<PublicDiscussionCueStatus>
  /** Inclusive lower bound on `trigger_at`; omit for no lower bound. */
  triggerAtFrom?: Date
  /** Exclusive upper bound on `trigger_at`; omit for no upper bound. */
  triggerAtBefore?: Date
}

export interface CountAttemptsForCommunityInput {
  communityId: string
  statuses: ReadonlyArray<CueExecutionAttemptStatus>
}

/**
 * Build an idempotency key for a cue execution attempt.
 *
 * Namespace contract (T-212 R8):
 *   - Cue creation occupies `cue:<scheduleId>:pending-XXXX:0` (revision=0)
 *   - Attempts occupy `cue:<scheduleId>:<cueId>:<attempt_no>` with
 *     `attempt_no >= 1`.
 * The first attempt is `attempt_no=1`, never `0` — `0` is reserved for the
 * cue-creation sentinel and overlap is forbidden.
 */
export function attemptIdempotencyKey(
  scheduleId: string,
  cueId: string,
  attemptNo: number,
): string {
  if (!Number.isInteger(attemptNo) || attemptNo < 1) {
    throw new Error(
      `attemptIdempotencyKey: attempt_no must be a positive integer (got ${attemptNo}); ` +
        '0 is reserved for cue creation per T-212 R8.',
    )
  }
  return buildIdempotencyKey('cue', scheduleId, cueId, attemptNo)
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

  // ---- Attempt (T-212 M2 — full write API) ----

  async listAttemptsForCue(
    cueId: string,
  ): Promise<CueExecutionAttemptDomain[]> {
    return Array.from(this.attempts.values())
      .filter((a) => a.cue_id === cueId)
      .sort((a, b) => a.attempt_no - b.attempt_no)
      .map(cloneAttemptDomain)
  }

  // ---- Load counters (T-213 M1) ----

  async countCuesForCommunity(
    input: CountCuesForCommunityInput,
  ): Promise<number> {
    const statusSet = new Set(input.statuses)
    const fromMs = input.triggerAtFrom?.getTime()
    const beforeMs = input.triggerAtBefore?.getTime()
    let total = 0
    for (const cue of this.cues.values()) {
      if (cue.community_id !== input.communityId) continue
      if (!statusSet.has(cue.status)) continue
      const triggerMs = new Date(cue.trigger_at).getTime()
      if (fromMs !== undefined && triggerMs < fromMs) continue
      if (beforeMs !== undefined && triggerMs >= beforeMs) continue
      total++
    }
    return total
  }

  async countAttemptsForCommunity(
    input: CountAttemptsForCommunityInput,
  ): Promise<number> {
    const statusSet = new Set(input.statuses)
    let total = 0
    for (const attempt of this.attempts.values()) {
      if (!statusSet.has(attempt.status)) continue
      const cue = this.cues.get(attempt.cue_id)
      if (!cue || cue.community_id !== input.communityId) continue
      total++
    }
    return total
  }

  async findPrewarmableCues(input: {
    now: Date
    batchSize: number
  }): Promise<PublicDiscussionCueDomain[]> {
    const nowMs = input.now.getTime()
    return Array.from(this.cues.values())
      .filter((cue) => {
        if (cue.status !== 'scheduled') return false
        if (!cue.prewarm_at) return false
        const prewarmMs = new Date(cue.prewarm_at).getTime()
        const triggerMs = new Date(cue.trigger_at).getTime()
        return prewarmMs <= nowMs && triggerMs > nowMs
      })
      .sort((a, b) => {
        const aMs = new Date(a.trigger_at).getTime()
        const bMs = new Date(b.trigger_at).getTime()
        if (aMs !== bMs) return aMs - bMs
        return a.id.localeCompare(b.id)
      })
      .slice(0, Math.max(0, input.batchSize))
      .map(cloneCueDomain)
  }

  async claimDueCues(input: ClaimDueCuesInput): Promise<ClaimedCue[]> {
    const horizonMs = input.now.getTime() + input.graceSeconds * 1000
    const eligible = Array.from(this.cues.values())
      .filter((cue) => {
        if (
          cue.status !== 'scheduled' &&
          cue.status !== 'due' &&
          cue.status !== 'deferred' &&
          cue.status !== 'prewarming'
        ) {
          return false
        }
        if (input.scheduleId != null && cue.schedule_id !== input.scheduleId) {
          return false
        }
        return new Date(cue.trigger_at).getTime() <= horizonMs
      })
      .sort((a, b) => {
        // Higher priority first; older trigger first within priority.
        if (a.priority !== b.priority) return b.priority - a.priority
        const aMs = new Date(a.trigger_at).getTime()
        const bMs = new Date(b.trigger_at).getTime()
        if (aMs !== bMs) return aMs - bMs
        return a.id.localeCompare(b.id)
      })
      .slice(0, Math.max(0, input.batchSize))

    const out: ClaimedCue[] = []
    for (const cueRef of eligible) {
      const cue = this.cues.get(cueRef.id)
      if (cue == null) continue
      cue.status = 'claimed'
      cue.updated_at = nowDate().toISOString()

      const priorAttempts = Array.from(this.attempts.values()).filter(
        (a) => a.cue_id === cue.id,
      )
      const nextAttemptNo =
        priorAttempts.reduce((max, a) => Math.max(max, a.attempt_no), 0) + 1
      const idempotencyKey = attemptIdempotencyKey(
        cue.schedule_id,
        cue.id,
        nextAttemptNo,
      )
      const leaseExpiresAt = new Date(
        input.now.getTime() + input.leaseSeconds * 1000,
      )
      const attempt: CueExecutionAttemptDomain = {
        id: localId('catt'),
        cue_id: cue.id,
        attempt_no: nextAttemptNo,
        scheduled_trigger_at: new Date(cue.trigger_at),
        actual_claimed_at: input.now,
        status: 'leased',
        lease_owner: input.leaseOwner,
        lease_expires_at: leaseExpiresAt,
        idempotency_key: idempotencyKey,
        admission_result_json: null,
        allocator_result_json: null,
        director_brief_json: null,
        selected_cast_json: null,
        post_id: null,
        thread_id: null,
        forum_scene_metadata_id: null,
        total_latency_ms: null,
        error_code: null,
        error_text: null,
        created_at: input.now,
        started_at: null,
        finished_at: null,
      }
      this.attempts.set(attempt.id, attempt)
      out.push({ cue: cloneCueDomain(cue), attempt: cloneAttemptDomain(attempt) })
    }
    return out
  }

  async createAttempt(
    input: CreateCueAttemptInput,
  ): Promise<CueExecutionAttemptDomain> {
    if (!Number.isInteger(input.attempt_no) || input.attempt_no < 1) {
      throw new Error('createAttempt: attempt_no must be a positive integer (>= 1)')
    }
    const collision = Array.from(this.attempts.values()).find(
      (a) => a.idempotency_key === input.idempotency_key,
    )
    if (collision) return cloneAttemptDomain(collision)
    const cueScheduledTriggerAt = input.scheduled_trigger_at
    const attempt: CueExecutionAttemptDomain = {
      id: localId('catt'),
      cue_id: input.cue_id,
      attempt_no: input.attempt_no,
      scheduled_trigger_at: cueScheduledTriggerAt,
      actual_claimed_at: input.lease_owner ? nowDate() : null,
      status: input.status ?? 'leased',
      lease_owner: input.lease_owner ?? null,
      lease_expires_at: input.lease_expires_at ?? null,
      idempotency_key: input.idempotency_key,
      admission_result_json: input.admission_result_json ?? null,
      allocator_result_json: input.allocator_result_json ?? null,
      director_brief_json: input.director_brief_json ?? null,
      selected_cast_json: input.selected_cast_json ?? null,
      post_id: null,
      thread_id: null,
      forum_scene_metadata_id: null,
      total_latency_ms: null,
      error_code: null,
      error_text: null,
      created_at: nowDate(),
      started_at: null,
      finished_at: null,
    }
    this.attempts.set(attempt.id, attempt)
    return cloneAttemptDomain(attempt)
  }

  async updateAttempt(
    id: string,
    patch: UpdateCueAttemptPatch,
  ): Promise<CueExecutionAttemptDomain | null> {
    const attempt = this.attempts.get(id)
    if (!attempt) return null
    if (patch.status !== undefined) attempt.status = patch.status
    if (patch.lease_owner !== undefined) attempt.lease_owner = patch.lease_owner
    if (patch.lease_expires_at !== undefined) {
      attempt.lease_expires_at = patch.lease_expires_at
    }
    if (patch.actual_claimed_at !== undefined) {
      attempt.actual_claimed_at = patch.actual_claimed_at
    }
    if (patch.admission_result_json !== undefined) {
      attempt.admission_result_json = patch.admission_result_json
    }
    if (patch.allocator_result_json !== undefined) {
      attempt.allocator_result_json = patch.allocator_result_json
    }
    if (patch.director_brief_json !== undefined) {
      attempt.director_brief_json = patch.director_brief_json
    }
    if (patch.selected_cast_json !== undefined) {
      attempt.selected_cast_json = patch.selected_cast_json
    }
    if (patch.post_id !== undefined) attempt.post_id = patch.post_id
    if (patch.thread_id !== undefined) attempt.thread_id = patch.thread_id
    if (patch.forum_scene_metadata_id !== undefined) {
      attempt.forum_scene_metadata_id = patch.forum_scene_metadata_id
    }
    if (patch.total_latency_ms !== undefined) {
      attempt.total_latency_ms = patch.total_latency_ms
    }
    if (patch.error_code !== undefined) attempt.error_code = patch.error_code
    if (patch.error_text !== undefined) attempt.error_text = patch.error_text
    if (patch.started_at !== undefined) attempt.started_at = patch.started_at
    if (patch.finished_at !== undefined) attempt.finished_at = patch.finished_at
    return cloneAttemptDomain(attempt)
  }

  async releaseLease(
    attemptId: string,
  ): Promise<CueExecutionAttemptDomain | null> {
    const attempt = this.attempts.get(attemptId)
    if (!attempt) return null
    attempt.lease_owner = null
    attempt.lease_expires_at = null
    return cloneAttemptDomain(attempt)
  }

  async extendLease(
    attemptId: string,
    leaseSeconds: number,
    now?: Date,
  ): Promise<CueExecutionAttemptDomain | null> {
    const attempt = this.attempts.get(attemptId)
    if (!attempt) return null
    const baseTime = (now ?? nowDate()).getTime()
    attempt.lease_expires_at = new Date(baseTime + leaseSeconds * 1000)
    return cloneAttemptDomain(attempt)
  }

  async findInFlightAttemptForCue(
    cueId: string,
  ): Promise<CueExecutionAttemptDomain | null> {
    const inFlightSet: ReadonlySet<CueExecutionAttemptStatus> = new Set(
      IN_FLIGHT_ATTEMPT_STATUSES,
    )
    const candidates = Array.from(this.attempts.values())
      .filter((a) => a.cue_id === cueId && inFlightSet.has(a.status))
      .sort((a, b) => b.attempt_no - a.attempt_no)
    return candidates[0] ? cloneAttemptDomain(candidates[0]) : null
  }

  async reclaimExpiredLeases(
    input: ReclaimExpiredLeasesInput,
  ): Promise<ReclaimedLease[]> {
    const inFlightSet: ReadonlySet<CueExecutionAttemptStatus> = new Set(
      IN_FLIGHT_ATTEMPT_STATUSES,
    )
    const limit = input.batchSize ?? Number.POSITIVE_INFINITY
    const out: ReclaimedLease[] = []
    const expired = Array.from(this.attempts.values())
      .filter(
        (a) =>
          inFlightSet.has(a.status) &&
          a.lease_expires_at != null &&
          a.lease_expires_at.getTime() < input.now.getTime(),
      )
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .slice(0, limit)
    for (const attempt of expired) {
      attempt.status = 'failed'
      attempt.error_code = attempt.error_code ?? 'lease_expired'
      attempt.error_text = attempt.error_text ?? 'lease expired before completion'
      attempt.finished_at = attempt.finished_at ?? input.now
      attempt.lease_owner = null
      attempt.lease_expires_at = null
      const cue = this.cues.get(attempt.cue_id)
      if (cue && (cue.status === 'claimed' || cue.status === 'executing')) {
        cue.status = 'deferred'
        cue.updated_at = nowDate().toISOString()
      }
      out.push({ attempt_id: attempt.id, cue_id: attempt.cue_id })
    }
    return out
  }
}

function cloneAttemptDomain(
  attempt: CueExecutionAttemptDomain,
): CueExecutionAttemptDomain {
  return {
    ...attempt,
    scheduled_trigger_at: new Date(attempt.scheduled_trigger_at.getTime()),
    actual_claimed_at: attempt.actual_claimed_at
      ? new Date(attempt.actual_claimed_at.getTime())
      : null,
    lease_expires_at: attempt.lease_expires_at
      ? new Date(attempt.lease_expires_at.getTime())
      : null,
    created_at: new Date(attempt.created_at.getTime()),
    started_at: attempt.started_at
      ? new Date(attempt.started_at.getTime())
      : null,
    finished_at: attempt.finished_at
      ? new Date(attempt.finished_at.getTime())
      : null,
  }
}
