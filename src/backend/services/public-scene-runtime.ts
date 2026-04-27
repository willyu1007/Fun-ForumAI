import { randomUUID } from 'node:crypto'
import type { CreateForumSceneMetadataInput } from '../repos/types.js'
import type { PublicSceneVisualRef } from '../repos/types.js'
import {
  episodeBriefSchema,
  localIntentSchema,
  sceneMetadataSchema,
} from '../stage/index.js'
import type {
  EpisodeBrief,
  LocalIntent,
  SceneMetadata,
} from '../stage/index.js'

/**
 * T-212 M1 (T-207 §4.1) — `production_path` enum frozen at the umbrella level.
 * Every root-post write should carry one of these values; missing is a defect
 * (invariant I-1). The field stays optional on the TS type for backward
 * compatibility with legacy `ForumSceneMetadata.payloadJson` rows that
 * predate the contract; parsers reject **malformed** programming blocks.
 */
export type ProductionPath = 'autonomous' | 'cue'

export type CueSourceTypeForProgramming =
  | 'manual'
  | 'automated'
  | 'baseline'
  | 'system'

/**
 * T-212 M1 (T-207 §4.2) — programming attribution attached to every
 * `ForumSceneMetadata.payloadJson`. Cue refs are required iff
 * `production_path === 'cue'`.
 */
export interface ScenePayloadProgramming {
  production_path: ProductionPath
  cue?: {
    schedule_id: string
    cue_id: string
    change_ids?: string[]
    attempt_id: string
    source_type: CueSourceTypeForProgramming
  }
}

export interface PublicSceneWritePayload {
  scene_metadata: SceneMetadata
  episode_brief: EpisodeBrief
  local_intent: LocalIntent
  local_intent_block: string
  selection_audit?: Record<string, unknown> | null
  planning_audit?: Record<string, unknown> | null
  visual_ref?: PublicSceneVisualRef | null
  launch_programming?: {
    storyline?: Record<string, unknown> | null
    creator_note?: Record<string, unknown> | null
    editorial_intent?: Record<string, unknown> | null
  } | null
  /**
   * Programming attribution for invariant I-1. New write sites MUST set this
   * (PostScheduler stamps `'autonomous'`; CueWorker stamps `'cue'` + cue refs).
   * Legacy reads tolerate missing (parser returns `programming: undefined`),
   * but a present-but-malformed programming block is a hard parse failure.
   */
  programming?: ScenePayloadProgramming
}

export function generateSceneId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

export function buildLocalIntentBlock(localIntent: LocalIntent, episodeBrief: EpisodeBrief): string {
  const targetRef = describeTargetRef(localIntent.target_ref)
  const hardConstraints = localIntent.hard_constraints.length > 0
    ? localIntent.hard_constraints.map((item) => `- ${item}`).join('\n')
    : '- （无）'
  const softConstraints = localIntent.soft_constraints.length > 0
    ? localIntent.soft_constraints.map((item) => `- ${item}`).join('\n')
    : '- （无）'

  return [
    '## Local Intent',
    `- episode_id: ${episodeBrief.episode_id}`,
    `- initiative: ${localIntent.initiative}`,
    `- tone_hint: ${localIntent.tone_hint}`,
    `- relation_focus: ${localIntent.relation_focus}`,
    `- privacy_mode: ${localIntent.privacy_mode}`,
    `- memory_scope: ${localIntent.memory_scope}`,
    `- reference_scope: ${localIntent.reference_scope}`,
    `- target_ref: ${targetRef}`,
    `- scene_goal: ${episodeBrief.scene_goal.viewer_goal}`,
    `- phase: ${episodeBrief.phase}`,
    '### Hard Constraints',
    hardConstraints,
    '### Soft Constraints',
    softConstraints,
  ].join('\n')
}

export function buildPublicScenePayloadJson(payload: PublicSceneWritePayload): Record<string, unknown> {
  return {
    scene_metadata: payload.scene_metadata,
    episode_brief: payload.episode_brief,
    local_intent: payload.local_intent,
    local_intent_block: payload.local_intent_block,
    selection_audit: payload.selection_audit ?? null,
    planning_audit: payload.planning_audit ?? null,
    visual_ref: payload.visual_ref ?? null,
    launch_programming: payload.launch_programming ?? null,
    programming: payload.programming ?? null,
  }
}

export function parsePublicScenePayload(input: unknown): PublicSceneWritePayload | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const record = input as Record<string, unknown>

  // Programming validation runs OUTSIDE the try/catch (T-212 R2): a
  // present-but-malformed `programming` block must hard-reject, not be
  // swallowed alongside scene-shape parse errors. Missing programming is
  // accepted as `undefined` (back-compat with legacy rows).
  const programmingResult = parseProgrammingForRead(record.programming)
  if (programmingResult.kind === 'invalid') return null

  try {
    const sceneMetadata = sceneMetadataSchema.parse(record.scene_metadata)
    const episodeBrief = episodeBriefSchema.parse(record.episode_brief)
    const localIntent = localIntentSchema.parse(record.local_intent)
    const localIntentBlock = typeof record.local_intent_block === 'string'
      ? record.local_intent_block
      : buildLocalIntentBlock(localIntent, episodeBrief)

    return {
      scene_metadata: sceneMetadata,
      episode_brief: episodeBrief,
      local_intent: localIntent,
      local_intent_block: localIntentBlock,
      selection_audit: toRecord(record.selection_audit),
      planning_audit: toRecord(record.planning_audit),
      visual_ref: parseVisualRef(record.visual_ref),
      launch_programming: parseLaunchProgramming(record.launch_programming),
      ...(programmingResult.kind === 'present'
        ? { programming: programmingResult.value }
        : {}),
    }
  } catch {
    return null
  }
}

export function buildForumSceneMetadataInput(input: {
  community_id: string
  target_type: 'POST' | 'THREAD' | 'TURN'
  post_id?: string | null
  thread_id?: string | null
  turn_id?: string | null
  payload: PublicSceneWritePayload
}): CreateForumSceneMetadataInput {
  // T-215 B-M1 — promote the embedded programming block to explicit
  // column inputs alongside the legacy payload_json.programming write.
  // Missing programming → all five columns persist as NULL (legacy /
  // pre-cue rows). The shape is intentionally additive so call sites
  // upstream don't need to change their `programming` construction logic.
  const programming = input.payload.programming ?? null
  const programmingColumns = programming
    ? {
        programming_production_path: programming.production_path,
        programming_cue_id: programming.cue?.cue_id ?? null,
        programming_attempt_id: programming.cue?.attempt_id ?? null,
        programming_schedule_id: programming.cue?.schedule_id ?? null,
        programming_source_type: programming.cue?.source_type ?? null,
      }
    : {}

  return {
    target_type: input.target_type,
    community_id: input.community_id,
    post_id: input.post_id ?? null,
    thread_id: input.thread_id ?? null,
    turn_id: input.turn_id ?? null,
    episode_id: input.payload.scene_metadata.episode_id,
    selection_id: input.payload.scene_metadata.selection_id,
    episode_plan_id: input.payload.scene_metadata.episode_plan_id,
    local_intent_id: input.payload.scene_metadata.local_intent_id,
    director_surface: input.payload.scene_metadata.director_surface,
    actor_surface: input.payload.scene_metadata.actor_surface,
    scene_template_id: input.payload.scene_metadata.scene_template_id,
    scene_template_version: input.payload.scene_metadata.scene_template_version,
    scene_binding_id: input.payload.scene_metadata.scene_binding_id,
    overlay_id: input.payload.scene_metadata.overlay_id,
    beat_id: input.payload.scene_metadata.beat_id,
    phase: input.payload.scene_metadata.phase,
    selection_mode: input.payload.scene_metadata.selection_mode,
    expires_at: input.payload.scene_metadata.expires_at
      ? new Date(input.payload.scene_metadata.expires_at)
      : null,
    payload_json: buildPublicScenePayloadJson(input.payload),
    ...programmingColumns,
  }
}

function describeTargetRef(targetRef: LocalIntent['target_ref']): string {
  switch (targetRef.kind) {
    case 'agent':
      return `agent:${targetRef.agent_id}`
    case 'thread':
      return `thread:${targetRef.post_id}/${targetRef.thread_id}`
    case 'turn':
      return `turn:${targetRef.post_id}/${targetRef.thread_id}/${targetRef.turn_id}`
    case 'message':
      return `message:${targetRef.message_id}`
    default:
      return 'none'
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function parseVisualRef(value: unknown): PublicSceneVisualRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.directive_id !== 'string') return null
  const runtimeCardIds = Array.isArray(record.runtime_card_ids)
    ? record.runtime_card_ids.filter((item): item is string => typeof item === 'string')
    : []
  return {
    directive_id: record.directive_id,
    image_plan_id: typeof record.image_plan_id === 'string' ? record.image_plan_id : undefined,
    runtime_card_ids: runtimeCardIds,
  }
}

function parseLaunchProgramming(
  value: unknown,
): PublicSceneWritePayload['launch_programming'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return {
    storyline: toRecord(record.storyline),
    creator_note: toRecord(record.creator_note),
    editorial_intent: toRecord(record.editorial_intent),
  }
}

const PRODUCTION_PATH_VALUES: ReadonlySet<ProductionPath> = new Set([
  'autonomous',
  'cue',
])

const CUE_SOURCE_TYPE_VALUES: ReadonlySet<CueSourceTypeForProgramming> =
  new Set(['manual', 'automated', 'baseline', 'system'])

type ProgrammingReadResult =
  | { kind: 'absent' }
  | { kind: 'invalid' }
  | { kind: 'present'; value: ScenePayloadProgramming }

/**
 * Parse the `programming` block from a stored payload_json read. Distinct
 * outcomes:
 *   - `absent`: field missing or `null` — legacy row, return `undefined` to
 *     callers (back-compat).
 *   - `invalid`: field present but malformed — caller hard-rejects the whole
 *     payload (returns `null` from `parsePublicScenePayload`).
 *   - `present`: field present and well-formed — return the typed value.
 *
 * Validation rules:
 *   - `production_path` ∈ {'autonomous','cue'}
 *   - When `production_path === 'cue'`: `cue.{schedule_id, cue_id, attempt_id}`
 *     all non-empty strings; `cue.source_type` ∈ allowed values; optional
 *     `cue.change_ids` must be an array of non-empty strings if present.
 *   - When `production_path === 'autonomous'`: a `cue` block is **forbidden**
 *     (to keep invariant I-1 attribution clean — autonomous rows never carry
 *     cue refs).
 */
function parseProgrammingForRead(value: unknown): ProgrammingReadResult {
  if (value === undefined || value === null) return { kind: 'absent' }
  if (typeof value !== 'object' || Array.isArray(value)) return { kind: 'invalid' }
  const record = value as Record<string, unknown>

  const productionPath = record.production_path
  if (typeof productionPath !== 'string') return { kind: 'invalid' }
  if (!PRODUCTION_PATH_VALUES.has(productionPath as ProductionPath)) {
    return { kind: 'invalid' }
  }

  if (productionPath === 'autonomous') {
    if (record.cue !== undefined && record.cue !== null) {
      return { kind: 'invalid' }
    }
    return {
      kind: 'present',
      value: { production_path: 'autonomous' },
    }
  }

  // production_path === 'cue'
  const cueRaw = record.cue
  if (!cueRaw || typeof cueRaw !== 'object' || Array.isArray(cueRaw)) {
    return { kind: 'invalid' }
  }
  const cue = cueRaw as Record<string, unknown>
  if (!isNonEmptyString(cue.schedule_id)) return { kind: 'invalid' }
  if (!isNonEmptyString(cue.cue_id)) return { kind: 'invalid' }
  if (!isNonEmptyString(cue.attempt_id)) return { kind: 'invalid' }
  if (typeof cue.source_type !== 'string') return { kind: 'invalid' }
  if (!CUE_SOURCE_TYPE_VALUES.has(cue.source_type as CueSourceTypeForProgramming)) {
    return { kind: 'invalid' }
  }
  let changeIds: string[] | undefined
  if (cue.change_ids !== undefined && cue.change_ids !== null) {
    if (!Array.isArray(cue.change_ids)) return { kind: 'invalid' }
    if (!cue.change_ids.every(isNonEmptyString)) return { kind: 'invalid' }
    changeIds = cue.change_ids as string[]
  }

  return {
    kind: 'present',
    value: {
      production_path: 'cue',
      cue: {
        schedule_id: cue.schedule_id as string,
        cue_id: cue.cue_id as string,
        attempt_id: cue.attempt_id as string,
        source_type: cue.source_type as CueSourceTypeForProgramming,
        ...(changeIds ? { change_ids: changeIds } : {}),
      },
    },
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
