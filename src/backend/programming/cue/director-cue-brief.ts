/**
 * T-212 M3 — DirectorCueBrief: cue → director-shaped brief.
 *
 * Sidecar wrapper around `EpisodeOverlayV1`. The overlay schema is frozen
 * (`stage/public-director-contract.d.ts:200`); we do NOT extend it. Instead,
 * the brief carries a `programming` block alongside the overlay so:
 *   - Existing director / selector code consumes the overlay through the
 *     normal path (no schema migration cost).
 *   - The cue worker (M4) reads `programming` for cue-specific compose
 *     (theme intent, scene constraints, role requirements, media pool,
 *     audit refs).
 *
 * `compile()` is **stateless and pure** — no DB calls. The worker (or
 * preview chain) fetches media + change ids upstream and passes them in.
 * This makes the function trivially unit-testable and keeps the seam clean
 * for T-213's load-aware extensions.
 */

import type {
  CueRoleRequirementVector,
  CueSceneConstraints,
  CueSourceType,
  CueThemeIntent,
  PublicDiscussionCueDomain,
} from './types.js'
import type {
  CueMediaRole,
  CueMediaUsageStrength,
  CueMediaUsePolicy,
  PublicDiscussionCueMediaDomain,
} from '../../repos/cue-repository.js'
import type { EpisodeOverlayV1 } from '../../stage/index.js'

// =============================================================================
// Brief shape
// =============================================================================

/**
 * Audit refs that connect the brief back to the cue + attempt chain. The
 * worker (M4) uses these to populate `ForumSceneMetadata.payloadJson.programming.cue`.
 *
 * `attempt_id` is required for `live` briefs (the worker has it after claim).
 * For `dryRun`, the caller passes `'preview'` or omits — the resulting brief
 * is not safe to write through the data plane (the source field marks it).
 */
export interface DirectorCueBriefAuditRefs {
  schedule_id: string
  cue_id: string
  attempt_id: string
  source_type: CueSourceType
  /** Optional: list of CueChange ids that built or last modified this cue. */
  change_ids?: string[]
}

export interface DirectorCueBriefMediaResource {
  asset_id: string
  role: CueMediaRole
  usage_strength: CueMediaUsageStrength
  use_policy: CueMediaUsePolicy
  sort_order: number
}

/**
 * The cue-specific block that travels alongside `EpisodeOverlayV1`. Contains
 * everything the runtime needs to express the cue's intent without having to
 * re-read the cue table.
 */
export interface DirectorCueBriefProgramming {
  audit_refs: DirectorCueBriefAuditRefs
  theme_intent: CueThemeIntent
  scene_constraints: CueSceneConstraints
  role_requirements: CueRoleRequirementVector
  media_resource_pool: DirectorCueBriefMediaResource[]
  safety_boundary: { no_persona_writeback: true; no_private_leak: true }
  privacy_boundary: {
    privacy_mode: 'public_only'
    prohibited_reference_types: string[]
  }
}

export interface DirectorCueBrief {
  overlay: EpisodeOverlayV1
  programming: DirectorCueBriefProgramming
  /**
   * `live` = produced by an admitted cue with a real attempt id; safe to
   * propagate into the data plane.
   * `preview_dry_run` = produced by a preview / dry-run; must NOT be written.
   */
  source: 'live' | 'preview_dry_run'
}

// =============================================================================
// Compile API
// =============================================================================

export interface CompileDirectorCueBriefBaseInput {
  cue: PublicDiscussionCueDomain
  /** Media attached to the cue at compile time. Pass `[]` if none. */
  media?: PublicDiscussionCueMediaDomain[]
  /** CueChange ids that built / last modified this cue (audit linkage). */
  changeIds?: string[]
  /**
   * Override `expire_at` for the wrapping overlay TTL. Defaults to the cue's
   * `expire_at` when set, otherwise `trigger_at + 24h`.
   */
  overlayExpireAt?: Date
  /**
   * Override the wrapping overlay id. The selector (M3+) generates one when
   * the brief is consumed live; for dry-runs the caller may leave undefined
   * (compile generates a deterministic placeholder).
   */
  overlayId?: string
  /** Override overlay binding id (defaults to null for cue-driven scenes). */
  overlayBindingId?: string | null
}

export type CompileDirectorCueBriefInput =
  | (CompileDirectorCueBriefBaseInput & {
      dryRun?: false
      attemptId: string
    })
  | (CompileDirectorCueBriefBaseInput & { dryRun: true; attemptId?: string })

export interface DirectorCueBriefService {
  compile(input: CompileDirectorCueBriefInput): Promise<DirectorCueBrief>
}

// =============================================================================
// Implementation
// =============================================================================

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/**
 * Default privacy boundary for any cue-driven scene. T-216 may extend the
 * `prohibited_reference_types` list once anchor / selected_only_pool media
 * semantics arrive.
 */
const DEFAULT_PROHIBITED_REFERENCE_TYPES: ReadonlyArray<string> = [
  'owner_private_speech',
  'private_memory',
  'hidden_director_goal',
]

export class DirectorCueBriefServiceImpl implements DirectorCueBriefService {
  async compile(input: CompileDirectorCueBriefInput): Promise<DirectorCueBrief> {
    return Promise.resolve(buildDirectorCueBrief(input))
  }
}

/**
 * Synchronous compile — exposed for callers (and tests) that don't need the
 * `Promise` wrapper. `DirectorCueBriefServiceImpl.compile` defers to this.
 */
export function buildDirectorCueBrief(
  input: CompileDirectorCueBriefInput,
): DirectorCueBrief {
  const cue = input.cue
  const dryRun = input.dryRun === true
  const attemptId = dryRun ? input.attemptId ?? 'preview' : input.attemptId
  if (!attemptId) {
    throw new Error(
      'buildDirectorCueBrief: attemptId is required when dryRun=false',
    )
  }

  const overlayId =
    input.overlayId ??
    (dryRun ? `cue_overlay_preview_${cue.id}` : `cue_overlay_${cue.id}_${attemptId}`)

  const expireAt =
    input.overlayExpireAt ??
    (cue.expire_at ? new Date(cue.expire_at) : null) ??
    new Date(new Date(cue.trigger_at).getTime() + TWENTY_FOUR_HOURS_MS)

  const overlay: EpisodeOverlayV1 = {
    overlay_id: overlayId,
    template_id: deriveTemplateIdFromCue(cue),
    binding_id: input.overlayBindingId ?? null,
    source: {
      type: cueSourceTypeToOverlaySource(cue.source_type),
      actor:
        cue.created_by_system ??
        cue.created_by_user_id ??
        `cue:${cue.source_type}`,
    },
    status: dryRun ? 'draft' : 'active',
    topical_context: {
      topic_bundle: buildTopicBundle(cue.theme_intent),
      factual_basis: 'none',
      facts_digest: [],
    },
    direction: {
      target_mood: cue.theme_intent.tone_band,
      relationship_goals: deriveRelationshipGoals(cue.role_requirements),
      must_hit_points: [],
      avoid_repeat: [],
    },
    ttl: {
      start_at: cue.trigger_at,
      expire_at: expireAt.toISOString(),
      expire_action: 'archive',
    },
    safety: {
      risk_level: cue.risk_level === 'low' ? 'low' : cue.risk_level === 'high' || cue.risk_level === 'strict_review' ? 'high' : 'medium',
      moderation_mode: 'inherit',
    },
    guardrails: {
      no_persona_writeback: true,
      no_private_leak: true,
    },
  }

  const mediaPool: DirectorCueBriefMediaResource[] = (input.media ?? [])
    .filter((m) => m.validation_status === 'valid' || m.validation_status === 'degraded')
    .map((m) => ({
      asset_id: m.asset_id,
      role: m.role,
      usage_strength: m.usage_strength,
      use_policy: m.use_policy,
      sort_order: m.sort_order,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)

  const programming: DirectorCueBriefProgramming = {
    audit_refs: {
      schedule_id: cue.schedule_id,
      cue_id: cue.id,
      attempt_id: attemptId,
      source_type: cue.source_type,
      ...(input.changeIds && input.changeIds.length > 0
        ? { change_ids: [...input.changeIds] }
        : {}),
    },
    theme_intent: cue.theme_intent,
    scene_constraints: cue.scene_constraints,
    role_requirements: cue.role_requirements,
    media_resource_pool: mediaPool,
    safety_boundary: { no_persona_writeback: true, no_private_leak: true },
    privacy_boundary: {
      privacy_mode: 'public_only',
      prohibited_reference_types: [...DEFAULT_PROHIBITED_REFERENCE_TYPES],
    },
  }

  return {
    overlay,
    programming,
    source: dryRun ? 'preview_dry_run' : 'live',
  }
}

// =============================================================================
// Helpers
// =============================================================================

function cueSourceTypeToOverlaySource(
  source: CueSourceType,
): EpisodeOverlayV1['source']['type'] {
  switch (source) {
    case 'manual':
    case 'baseline':
      return 'editorial'
    case 'automated':
      return 'automated'
    case 'system':
      return 'autonomous'
  }
}

function deriveTemplateIdFromCue(cue: PublicDiscussionCueDomain): string {
  // The cue path doesn't pre-bind a stage template id (the selector picks one
  // at runtime). The overlay's template_id is informational here; we use a
  // synthesized identifier so the overlay remains shape-valid even before
  // selector ranking runs.
  return `cue_synthetic_${cue.id}`
}

function buildTopicBundle(themeIntent: CueThemeIntent): string[] {
  const bundle: string[] = [themeIntent.topic_seed]
  if (themeIntent.discussion_question) bundle.push(themeIntent.discussion_question)
  if (themeIntent.angle_hint) bundle.push(themeIntent.angle_hint)
  return bundle
}

function deriveRelationshipGoals(
  roleRequirements: CueRoleRequirementVector,
): string[] {
  const goals: string[] = []
  if (roleRequirements.relationship_shape) {
    goals.push(`relationship_shape:${roleRequirements.relationship_shape}`)
  }
  for (const req of roleRequirements.requirements ?? []) {
    if (req.role) goals.push(`role:${req.role}`)
  }
  return goals
}
