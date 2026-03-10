export type RoomStatus = 'active' | 'cooling' | 'archived'
export type RoomMemberJoinSource = 'dispatched' | 'wandering' | 'creator'
export type ChatMessageKind = 'normal' | 'skip_feedback' | 'ambient' | 'greeting'
export type RoomSceneType =
  | 'FREE_CHAT'
  | 'TALK_SHOW'
  | 'ROUND_TABLE'
  | 'ROAST'
  | 'DEBATE'
  | 'SLICE_OF_LIFE'
  | 'STORY_LAB'
export type RoomEpisodeStatus = 'ACTIVE' | 'ENDED'
export type RoomCastRole =
  | 'HOST'
  | 'REGULAR'
  | 'FOIL'
  | 'SKEPTIC'
  | 'EXPLAINER'
  | 'WILDCARD'
  | 'CHRONICLER'
export type RoomBeatType =
  | 'OPENING'
  | 'HOOK'
  | 'EXPLAIN'
  | 'CLASH'
  | 'CALLBACK'
  | 'COOL_DOWN'
  | 'RECAP'
  | 'LANDING'
export type RoomCueType =
  | 'ADVANCE'
  | 'ASK'
  | 'CALLBACK'
  | 'SUMMARIZE'
  | 'COOL_DOWN'
  | 'CLOSE'
export type RoomProgramEventType = 'RAW_MESSAGE' | 'ROOM_TICK' | 'PROGRAM_CUE'
export type RoomProgramEventStatus = 'PENDING' | 'PLANNED' | 'EXECUTED' | 'SKIPPED' | 'FAILED'
export type RoomHighlightKind =
  | 'CALLBACK'
  | 'PUNCHLINE'
  | 'CHARACTER_MOMENT'
  | 'SUMMARY'
  | 'CLASH'

export interface RoomCallbackCandidate {
  message_id: string
  author_agent_id: string
  summary_text: string
  weight: number
  created_at: string
}

export interface RoomSelectionReason {
  code: string
  value: number
  message: string
}

export interface Room {
  id: string
  name: string
  slug: string
  description: string
  community_id: string | null
  created_by_agent_id: string
  max_agents: number
  tick_interval_base: number
  status: RoomStatus
  last_message_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface RoomMember {
  room_id: string
  member_id: string
  member_type: 'agent'
  join_source: RoomMemberJoinSource
  personal_tick_interval: number
  messages_this_hour: number
  last_spoke_at: Date | null
  joined_at: Date
}

export interface RoomProgram {
  id: string
  room_id: string
  enabled: boolean
  scene_type: RoomSceneType
  pacing_preset: string
  target_cast_min: number
  target_cast_max: number
  callback_window: number
  recap_every_turns: number
  max_consecutive_turns: number
  idle_cue_after_ms: number
  allow_wandering: boolean
  director_policy_json: Record<string, unknown>
  discoverability_tags: string[]
  discoverability_short_hook: string | null
  discoverability_default_view: string
  created_at: Date
  updated_at: Date
}

export interface RoomEpisode {
  id: string
  room_id: string
  program_id: string
  status: RoomEpisodeStatus
  summary_text: string
  unresolved_question: string | null
  callback_bank_json: RoomCallbackCandidate[]
  energy: number
  tension: number
  turn_count: number
  message_count: number
  started_at: Date
  ended_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface RoomEpisodeCast {
  id: string
  room_id: string
  episode_id: string
  agent_id: string
  role: RoomCastRole
  entry_source: string
  chemistry_score: number
  spotlight_weight: number
  joined_at: Date
  left_at: Date | null
}

export interface RoomEpisodeBeat {
  id: string
  room_id: string
  episode_id: string
  ordinal: number
  beat_type: RoomBeatType
  cue_type: RoomCueType
  director_goal: string
  prompt_hint: string | null
  anchor_message_id: string | null
  callback_message_id: string | null
  target_role: RoomCastRole | null
  selected_speaker_agent_id: string | null
  status: string
  audit_json: Record<string, unknown> | null
  created_at: Date
  completed_at: Date | null
}

export interface RoomProgramEvent {
  id: string
  room_id: string
  episode_id: string | null
  beat_id: string | null
  event_type: RoomProgramEventType
  status: RoomProgramEventStatus
  cue_type: RoomCueType | null
  director_goal: string | null
  selected_speaker_agent_id: string | null
  idempotency_key: string
  payload_json: Record<string, unknown> | null
  error_text: string | null
  created_at: Date
  updated_at: Date
}

export interface RoomSelectionLedger {
  id: string
  room_id: string
  episode_id: string | null
  beat_id: string | null
  program_event_id: string
  candidate_agent_id: string
  selected: boolean
  final_score: number
  reasons_json: RoomSelectionReason[]
  created_at: Date
}

export interface RoomHighlight {
  id: string
  room_id: string
  episode_id: string | null
  beat_id: string | null
  source_message_id: string
  kind: RoomHighlightKind
  text: string
  actor_agent_ids: string[]
  score: number
  created_at: Date
}

export interface RoomLiveCastItem {
  agent_id: string
  name: string
  role: RoomCastRole
  last_spoke_at: Date | null
}

export interface RoomLiveSnapshot {
  id: string
  room_id: string
  episode_id: string | null
  scene_type: RoomSceneType
  current_beat: RoomBeatType | null
  live_hook: string | null
  unresolved_question: string | null
  recap_short: string | null
  active_cast: RoomLiveCastItem[]
  last_highlight_text: string | null
  energy: number
  tension: number
  message_cursor_id: string | null
  version: number
  created_at: Date
  updated_at: Date
}

export interface RoomWatchabilitySummary {
  scene_type: RoomSceneType
  current_beat: RoomBeatType | null
  live_hook: string | null
  unresolved_question: string | null
  active_cast_preview: Array<Pick<RoomLiveCastItem, 'agent_id' | 'name' | 'role'>>
  last_highlight_text: string | null
  energy: number
  tension: number
  snapshot_updated_at: Date | null
}

export interface RoomCastMemberView {
  agent_id: string
  name: string
  role: RoomCastRole
  chemistry_score: number
  spotlight_weight: number
  last_spoke_at: Date | null
}

export interface RoomProgramReadModel {
  room_id: string
  enabled: boolean
  scene_type: RoomSceneType
  pacing_preset: string
  target_cast_min: number
  target_cast_max: number
  callback_window: number
  recap_every_turns: number
  max_consecutive_turns: number
  idle_cue_after_ms: number
  allow_wandering: boolean
  director_policy: Record<string, unknown>
  discoverability: {
    tags: string[]
    short_hook: string | null
    default_view: string
  }
  current_episode: {
    episode_id: string
    current_beat: RoomBeatType | null
    energy: number
    tension: number
    turn_count: number
    message_count: number
  } | null
}

export interface ChatMessage {
  id: string
  room_id: string
  author_id: string
  author_type: 'agent'
  episode_id: string | null
  beat_id: string | null
  program_event_id: string | null
  speaker_role: RoomCastRole | null
  cue_type: RoomCueType | null
  body: string
  message_kind: ChatMessageKind
  parent_message_id: string | null
  vote_score: number
  created_at: Date
}

export interface CreateRoomInput {
  name: string
  slug: string
  description: string
  community_id?: string | null
  created_by_agent_id: string
  greeting_message?: string
}

export interface CreateChatMessageInput {
  room_id: string
  author_id: string
  episode_id?: string | null
  beat_id?: string | null
  program_event_id?: string | null
  speaker_role?: RoomCastRole | null
  cue_type?: RoomCueType | null
  body: string
  message_kind?: ChatMessageKind
  parent_message_id?: string | null
}
