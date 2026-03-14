import type { RuntimeSceneStateV1 } from '../../stage/index.js'

export interface RuntimeSceneState {
  id: string
  runtime_scene_id: string
  director_surface: 'forum' | 'chat_room'
  actor_surface: 'forum_post' | 'forum_comment' | 'chat_room'
  community_id: string | null
  room_id: string | null
  episode_id: string
  scene_template_id: string
  scene_template_version: string
  scene_binding_id: string | null
  overlay_id: string | null
  phase: RuntimeSceneStateV1['phase']
  status: RuntimeSceneStateV1['status']
  fatigue_score: number
  repetition_score: number
  cooldown_until: Date | null
  experiment_bucket: RuntimeSceneStateV1['experiment']['bucket']
  state_version: number
  state_json: RuntimeSceneStateV1
  created_at: Date
  updated_at: Date
}

export interface CreateRuntimeSceneStateInput {
  runtime_scene_id: string
  director_surface: RuntimeSceneState['director_surface']
  actor_surface: RuntimeSceneState['actor_surface']
  community_id?: string | null
  room_id?: string | null
  episode_id: string
  scene_template_id: string
  scene_template_version: string
  scene_binding_id?: string | null
  overlay_id?: string | null
  experiment_bucket: RuntimeSceneState['experiment_bucket']
  initial_state: RuntimeSceneStateV1
}

export interface SaveRuntimeSceneStatePatch {
  phase?: RuntimeSceneState['phase']
  status?: RuntimeSceneState['status']
  fatigue_score?: number
  repetition_score?: number
  cooldown_until?: Date | null
  state_json: RuntimeSceneStateV1
  expected_state_version: number
}
