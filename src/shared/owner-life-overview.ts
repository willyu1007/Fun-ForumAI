export type SourceDimension = 'WORLD' | 'SOCIAL' | 'OWNER' | 'SYSTEM'

export type SourceDimensionLabel = '论坛里' | '和别人' | '来自你' | '系统层'

export interface ChronicleStoryMetaV1 {
  version: 1
  source_dimension: SourceDimension
  source_label: SourceDimensionLabel
  story_kind: string
  chapter_key: string
  chapter_title: string
  scene_label: string | null
  emotion_before: string | null
  emotion_after: string | null
  reaction_sentence: string | null
  outcome_sentence: string | null
  next_hook: string | null
  linked_achievement_codes: string[]
  source_tags: string[]
  scope: string | null
  scope_key: string | null
}

export interface NarrativeAchievementSeal {
  id: string
  achievement_id: string
  code: string
  name: string
  category: string
  tier: 1 | 2 | 3
  rarity_label: '常见' | '少见' | '稀有' | '传说'
  visibility: 'PUBLIC' | 'OWNER_ONLY'
  source_dimension: SourceDimension
  source_label: SourceDimensionLabel
  scope: string
  scope_key: string
  scope_label: string
  seal_label: string
  summary_line: string
  reason_line: string
  story_link: {
    beat_id?: string
    chapter_key?: string
    title?: string
  } | null
  achieved_at: string
  source_tags: string[]
}

export interface OwnerStoryBeatActor {
  actor_id: string
  actor_name: string
}

export interface OwnerStoryBeat {
  id: string
  chronicle_entry_id: string
  source_dimension: SourceDimension
  source_label: SourceDimensionLabel
  story_kind: string
  chapter_key: string
  chapter_title: string
  title: string
  summary: string
  scene_label: string | null
  emotion_before: string | null
  emotion_after: string | null
  reaction_sentence: string | null
  outcome_sentence: string | null
  next_hook: string | null
  actors: OwnerStoryBeatActor[]
  source_tags: string[]
  occurred_at: string
  importance_score: number
  seals: NarrativeAchievementSeal[]
}

export interface OwnerNowCompany {
  actor_id: string
  actor_name: string
  tone_label: string
  chapter_key: string | null
  chapter_title: string | null
}

export interface OwnerNowSnapshot {
  headline: string
  scene_label: string
  presence_label: string
  mood_label: string
  next_tendency_label: string
  recent_company: OwnerNowCompany[]
  last_active_at: string | null
  source_tags: string[]
}

export interface OwnerProjectionLatestSession {
  session_id: string | null
  last_active_at: string | null
  source_type: 'PRIVATE_CHAT'
}

export interface OwnerProjectionSnapshot {
  headline: string
  carryover_theme: string
  emotional_residue_label: string
  public_echo_line: string
  borrowed_motifs: string[]
  carryover_topics: string[]
  latest_session: OwnerProjectionLatestSession | null
  privacy_mode_note: string
  source_tags: string[]
}

export interface OwnerChapterCastEntry {
  actor_id: string
  actor_name: string
  role_label: string
  source_dimension: SourceDimension
  last_seen_at: string | null
}

export interface OwnerChapterCast {
  chapter_key: string
  chapter_title: string
  cast: OwnerChapterCastEntry[]
  source_tags: string[]
  updated_at: string
}

export type NurtureSuggestionLane = 'WORLD' | 'SOCIAL' | 'OWNER' | 'TUNING'
export type NurtureSuggestionPriority = 'now' | 'soon' | 'optional'
export type NurtureSuggestionActionKind =
  | 'nudge_to_community'
  | 'revisit_scene'
  | 'rejoin_cast'
  | 'share_owner_life'
  | 'open_system_panel'

export interface NurtureSuggestionAction {
  kind: NurtureSuggestionActionKind
  label: string
  href: string | null
}

export interface NurtureSuggestion {
  id: string
  lane: NurtureSuggestionLane
  priority: NurtureSuggestionPriority
  title: string
  body: string
  why_now: string
  expected_progress: string
  primary_action: NurtureSuggestionAction
  secondary_action: NurtureSuggestionAction | null
  source_tags: string[]
}

export interface OwnerLifeOverviewHero {
  headline: string
  tagline: string
  supporting_line: string
  source_tags: string[]
}

export interface OwnerLifeOverviewEntryPoint {
  label: string
  href: string
  hint: string | null
}

export interface OwnerLifeOverviewEntryPoints {
  chronicle: OwnerLifeOverviewEntryPoint
  system: OwnerLifeOverviewEntryPoint
}

export interface OwnerLifeOverviewMeta {
  generated_at: string
  degraded: boolean
}

export interface OwnerLifeOverview {
  agent_id: string
  hero: OwnerLifeOverviewHero
  now: OwnerNowSnapshot
  recent_story_beats: OwnerStoryBeat[]
  owner_projection: OwnerProjectionSnapshot
  chapter_cast: OwnerChapterCast | null
  recent_achievement_seals: NarrativeAchievementSeal[]
  nurture_suggestions: NurtureSuggestion[]
  entry_points: OwnerLifeOverviewEntryPoints
  meta: OwnerLifeOverviewMeta
}

export interface OwnerChronicleFeed {
  agent_id: string
  items: OwnerStoryBeat[]
  chapters: OwnerChapterCast[]
}

export interface OwnerNurtureSuggestionList {
  agent_id: string
  generated_at: string
  items: NurtureSuggestion[]
}
