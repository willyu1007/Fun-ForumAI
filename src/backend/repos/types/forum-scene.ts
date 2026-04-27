export type ForumSceneMetadataTargetType = 'POST' | 'THREAD' | 'TURN'

/**
 * T-215 B-M1 — programming column promotion. Production path tells the
 * downstream consumer which writer produced this scene metadata; cue refs
 * tie the row back to the cue lifecycle for audit + public projection.
 *
 * Mirrors `ScenePayloadProgramming.production_path` exactly so the dual-
 * write between `payload_json.programming.production_path` and the
 * promoted column produces identical strings (post-scheduler →
 * `'autonomous'`, cue worker → `'cue'`).
 */
export type ForumSceneProductionPath = 'autonomous' | 'cue'

export interface ForumSceneMetadata {
  id: string
  target_type: ForumSceneMetadataTargetType
  community_id: string
  post_id: string | null
  thread_id: string | null
  turn_id: string | null
  episode_id: string
  selection_id: string
  episode_plan_id: string
  local_intent_id: string
  director_surface: string
  actor_surface: string
  scene_template_id: string
  scene_template_version: string
  scene_binding_id: string | null
  overlay_id: string | null
  beat_id: string | null
  phase: 'opening' | 'escalation' | 'pivot' | 'closure' | 'aftershow'
  selection_mode: 'pool_guided' | 'pool_strict' | 'autonomous_anchored'
  expires_at: Date | null
  payload_json: Record<string, unknown>
  /** T-215 — promoted from `payload_json.programming.production_path`. */
  programming_production_path: ForumSceneProductionPath | null
  /** T-215 — promoted from `payload_json.programming.cue_id`. */
  programming_cue_id: string | null
  /** T-215 — promoted from `payload_json.programming.attempt_id`. */
  programming_attempt_id: string | null
  /** T-215 — promoted from `payload_json.programming.schedule_id`. */
  programming_schedule_id: string | null
  /** T-215 — promoted from `payload_json.programming.source_type` (manual / automated / system). */
  programming_source_type: string | null
  created_at: Date
  updated_at: Date
}

export interface CreateForumSceneMetadataInput {
  target_type: ForumSceneMetadataTargetType
  community_id: string
  post_id?: string | null
  thread_id?: string | null
  turn_id?: string | null
  episode_id: string
  selection_id: string
  episode_plan_id: string
  local_intent_id: string
  director_surface: string
  actor_surface: string
  scene_template_id: string
  scene_template_version: string
  scene_binding_id?: string | null
  overlay_id?: string | null
  beat_id?: string | null
  phase: 'opening' | 'escalation' | 'pivot' | 'closure' | 'aftershow'
  selection_mode: 'pool_guided' | 'pool_strict' | 'autonomous_anchored'
  expires_at?: Date | null
  payload_json: Record<string, unknown>
  /** T-215 — set by cue-runtime / manual writers; autonomous defaults to null until backfill. */
  programming_production_path?: ForumSceneProductionPath | null
  programming_cue_id?: string | null
  programming_attempt_id?: string | null
  programming_schedule_id?: string | null
  programming_source_type?: string | null
}
