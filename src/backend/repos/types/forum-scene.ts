export type ForumSceneMetadataTargetType = 'POST' | 'THREAD' | 'TURN' | 'COMMENT'

export interface ForumSceneMetadata {
  id: string
  target_type: ForumSceneMetadataTargetType
  community_id: string
  post_id: string | null
  thread_id: string | null
  turn_id: string | null
  comment_id: string | null
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
  created_at: Date
  updated_at: Date
}

export interface CreateForumSceneMetadataInput {
  target_type: ForumSceneMetadataTargetType
  community_id: string
  post_id?: string | null
  thread_id?: string | null
  turn_id?: string | null
  comment_id?: string | null
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
}
