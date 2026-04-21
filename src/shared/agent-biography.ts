export type BiographyMaterialSourceType =
  | 'CHRONICLE_ENTRY'
  | 'ACHIEVEMENT'
  | 'RELATION_EVENT'
  | 'PRIVATE_DIGEST'
  | 'OWNER_INTERACTION'
  | 'SYSTEM_TUNING'
  | 'PERSONALITY_NARRATIVE'
  | 'SCENE_JOIN'
  | 'PUBLIC_DISCUSSION'

export type BiographyMaterialEffect =
  | 'SELF_EXPRESSION'
  | 'SOCIAL_POSITION'
  | 'RELATIONSHIP_PATTERN'
  | 'INNER_TENDENCY'
  | 'PUBLIC_PERSONA'
  | 'STABLE_TRAIT'
  | 'UNRESOLVED_HOOK'

export type BiographyActorRole =
  | 'SELF'
  | 'OWNER'
  | 'PEER_AGENT'
  | 'HUMAN'
  | 'SYSTEM'
  | 'SCENE'

export type BiographySceneType =
  | 'PUBLIC_FORUM'
  | 'CHATROOM'
  | 'PRIVATE_CHAT'
  | 'SYSTEM'
  | 'COMMUNITY'

export type BiographyChapterStatus = 'ACTIVE' | 'CLOSED' | 'REVISED'

export type BiographyChapterRole =
  | 'OPENING'
  | 'FORMATION'
  | 'TURNING_POINT'
  | 'CONSOLIDATION'
  | 'AFTERMATH'
  | 'LATER_NOTE'

export type BiographyNarrativeMode =
  | 'MEMOIR'
  | 'SCENE_DRIVEN'
  | 'FRAGMENTARY'
  | 'AFTERWORD'
  | 'QUIET_REFLECTION'

export type BiographyChangeAxis =
  | 'SELF_EXPRESSION'
  | 'SOCIAL_POSITION'
  | 'RELATIONSHIP_PATTERN'
  | 'INNER_TENDENCY'
  | 'PUBLIC_PERSONA'

export type BiographyInfluenceSourceType =
  | 'PUBLIC_SCENE'
  | 'PRIVATE_CONVERSATION'
  | 'RELATIONSHIP'
  | 'ACHIEVEMENT'
  | 'SYSTEM_TUNING'
  | 'REPEATED_BEHAVIOR'

export type BiographyDirectoryStatusLabel =
  | '正在书写'
  | '已经定稿'
  | '后来补记'
  | '暂存片段'

export type BiographyVisualMotifType =
  | 'PAPER'
  | 'DIALOGUE'
  | 'STAGE'
  | 'SHADOW'
  | 'STAMP'
  | 'LIGHT'
  | 'THREAD'

export type BiographyVisualMotifIntensity = 'LOW' | 'MEDIUM' | 'HIGH'

export type BiographyCompileStatus =
  | 'CLEAN'
  | 'DIRTY'
  | 'PLANNING'
  | 'WRITING'
  | 'AUDITING'
  | 'PUBLISHED'
  | 'FAILED'

export type BiographyWriterFactualityMode = 'SKELETON_ONLY'

export type BiographyToneNarrativeDistance = 'CLOSE' | 'MEDIUM' | 'DISTANT'

export type BiographyToneTemperature =
  | 'COOL'
  | 'WARM'
  | 'SHARP'
  | 'PLAYFUL'
  | 'MELANCHOLIC'
  | 'ABSURD'

export type BiographyToneRhythm = 'SHORT' | 'BALANCED' | 'LONG'
export type BiographyToneDensity = 'LOW' | 'MEDIUM' | 'HIGH'
export type BiographyToneHumor = 'NONE' | 'DRY' | 'LIGHT' | 'ABSURD'
export type BiographyToneSelfAwareness = 'LOW' | 'MEDIUM' | 'HIGH'

export type BiographyRevisionGenerationStatus =
  | 'PENDING'
  | 'GENERATED'
  | 'FAILED'
  | 'NEEDS_REVIEW'
  | 'PUBLISHED'

export type BiographyMaterialRole =
  | 'TRIGGER'
  | 'SUPPORT'
  | 'TURNING_POINT'
  | 'INFLUENCE'
  | 'TRACE'

export interface BiographyMaterialActor {
  id: string
  name?: string
  role: BiographyActorRole
}

export interface BiographyMaterialScene {
  scene_id?: string
  scene_name?: string
  scene_type?: BiographySceneType
}

export interface BiographyMaterial {
  id: string
  agent_id: string
  source_type: BiographyMaterialSourceType
  source_id: string
  occurred_at: string
  title: string
  factual_summary: string
  actors: BiographyMaterialActor[]
  scene?: BiographyMaterialScene
  possible_effects: BiographyMaterialEffect[]
  importance_score: number
  can_be_turning_point: boolean
  can_be_later_note: boolean
  biography_hint?: string
  deferred_source?: boolean
  raw_ref: {
    source_type: string
    source_id: string
  }
}

export interface BiographyMaterialDigestExperience {
  material_id: string
  title: string
  factual_summary: string
  why_it_may_matter: string
  likely_effects: string[]
}

export interface BiographyMaterialDigest {
  agent_id: string
  from: string
  to: string
  material_count: number
  top_experiences: BiographyMaterialDigestExperience[]
  repeated_patterns: string[]
  relationship_signals: Array<{
    actor_id?: string
    actor_name?: string
    signal: string
    possible_change: string
  }>
  private_influence_signals: Array<{
    source_label: string
    influence_summary: string
    biography_safe_summary: string
  }>
  achievement_signals: Array<{
    achievement_id: string
    title: string
    as_biography_trace: string
  }>
  possible_turning_points: Array<{
    material_id: string
    title: string
    before: string
    after: string
  }>
}

export interface AgentBiographyChapterSkeletonV1 {
  version: 1
  agent_id: string
  chapter_id: string
  chapter_no: number
  status: BiographyChapterStatus
  created_at: string
  updated_at: string
  time_range: {
    from: string
    to: string | null
  }
  book_position: {
    volume_title?: string
    chapter_title: string
    chapter_subtitle?: string
    chapter_role: BiographyChapterRole
  }
  mainline: {
    thesis: string
    question?: string
    emotional_direction?: string
    narrative_mode: BiographyNarrativeMode
  }
  start_state: {
    self_expression: string
    social_position: string
    relationship_pattern: string
    inner_tendency?: string
    public_persona?: string
  }
  key_experiences: Array<{
    experience_id: string
    title: string
    scene: string
    what_happened: string
    why_it_mattered: string
    changed_what: BiographyChangeAxis
  }>
  turning_points: Array<{
    title: string
    before: string
    moment: string
    after: string
  }>
  influences: Array<{
    source_label: string
    source_type: BiographyInfluenceSourceType
    influence_summary: string
  }>
  end_state: {
    self_expression: string
    social_position: string
    relationship_pattern: string
    inner_tendency?: string
    public_persona?: string
  }
  sediments: {
    stable_traits: string[]
    acquired_habits: string[]
    relationship_marks: string[]
    public_impression: string[]
    unresolved_hooks: string[]
  }
  writer_notes: {
    tone_profile_id: string
    style_hints: string[]
    avoid_patterns: string[]
  }
  source_digest: {
    material_count: number
    material_summary: string
    evidence_index_ref?: string
  }
}

export interface AgentBiographyChapter {
  id: string
  agent_id: string
  chapter_no: number
  status: BiographyChapterStatus
  title: string | null
  subtitle: string | null
  start_at: string
  end_at: string | null
  skeleton: AgentBiographyChapterSkeletonV1
  current_revision_id: string | null
  material_count: number
  chapter_digest: BiographyChapterDigest | null
  created_at: string
  updated_at: string
}

export interface BiographyChapterDigest {
  chapter_id: string
  chapter_no: number
  title: string
  one_line_summary: string
  start_state: string
  end_state: string
  key_turning_points: string[]
  sediments: string[]
  unresolved_hooks: string[]
  style_notes: string[]
  closing_line?: string
}

export interface BiographyBookMemory {
  agent_id: string
  updated_at: string
  stable_traits: string[]
  recurring_themes: string[]
  expression_patterns: string[]
  relationship_patterns: Array<{
    pattern: string
    last_seen_chapter_id?: string
  }>
  public_position?: string
  private_influence_pattern?: string
  current_life_phase: string
  unresolved_hooks: Array<{
    hook_id: string
    description: string
    first_seen_chapter_id: string
    last_seen_chapter_id: string
  }>
  recent_chapter_index: Array<{
    chapter_id: string
    chapter_no: number
    title: string
    thesis: string
    end_state: string
  }>
}

export interface BiographyToneProfile {
  tone_profile_id: string
  agent_id: string
  updated_at: string
  narrative_distance: BiographyToneNarrativeDistance
  emotional_temperature: BiographyToneTemperature
  rhythm: BiographyToneRhythm
  imagery: BiographyToneDensity
  humor: BiographyToneHumor
  self_awareness: BiographyToneSelfAwareness
  metaphor_density: BiographyToneDensity
  preferred_motifs: string[]
  avoid_patterns: string[]
  sample_voice_notes?: string[]
}

export interface BiographyChapterBodyV1 {
  chapter_title: string
  chapter_subtitle?: string
  epigraph?: string
  opening: string
  body_sections: Array<{
    title?: string
    text: string
    visual_anchor?: string
  }>
  turning_point?: {
    title: string
    text: string
  }
  afterword: string
  closing_line: string
  trace_text: string
  margin_notes?: Array<{
    anchor_section_index: number
    text: string
  }>
}

export interface BiographyFactualAudit {
  revision_id: string
  status: 'PASS' | 'NEEDS_REVIEW' | 'FAILED'
  failure_categories: string[]
  unsupported_claims: Array<{
    claim: string
    reason: string
  }>
  private_overreach_claims: Array<{
    claim: string
    safer_rewrite: string
  }>
  forbidden_lexicon_hits: Array<{
    phrase: string
    safer_rewrite: string
  }>
  invented_abstractions: Array<{
    phrase: string
    reason: string
  }>
  invented_entities: string[]
  invented_relationships: string[]
}

export interface BiographyChapterRevision {
  id: string
  chapter_id: string
  agent_id: string
  revision_no: number
  skeleton: AgentBiographyChapterSkeletonV1
  body: BiographyChapterBodyV1 | null
  body_kind: 'CHAPTER' | 'LATER_NOTE'
  later_notes: Array<{
    note_id: string
    text: string
  }>
  material_digest: BiographyMaterialDigest | null
  writer_config_id: string | null
  model_name: string | null
  prompt_template_id: string | null
  prompt_version: number | null
  prompt_hash: string | null
  input_hash: string | null
  generation_status: BiographyRevisionGenerationStatus
  factual_audit: BiographyFactualAudit | null
  published_at: string | null
  created_at: string
}

export interface BiographyChapterMaterialRef {
  id: string
  chapter_id: string
  agent_id: string
  material_id: string
  source_type: string
  source_id: string
  material_role: BiographyMaterialRole
  importance_score: number | null
  contribution_summary: string | null
  occurred_at: string
  created_at: string
}

export interface AgentBiographyCompileState {
  agent_id: string
  dirty: boolean
  dirty_reasons: string[]
  last_material_id: string | null
  last_compiled_material_id: string | null
  active_chapter_id: string | null
  skeleton_revision: number
  published_body_revision: number | null
  compile_status: BiographyCompileStatus
  latest_material_digest: BiographyMaterialDigest | null
  stale_since: string | null
  last_compiled_at: string | null
  last_error?: string | null
}

export interface BiographyBookCoverViewModel {
  title: string
  subtitle?: string
  agent_name: string
  current_stage: string
  cover_line: string
  visual_motif?: {
    motif_type: BiographyVisualMotifType
    intensity: BiographyVisualMotifIntensity
    notes?: string
  }
}

export interface BiographyChapterViewModel {
  chapter_id: string
  chapter_no: number
  title: string
  subtitle?: string
  status_label: BiographyDirectoryStatusLabel
  epigraph?: string
  opening: string
  body_sections: Array<{
    title?: string
    text: string
    visual_anchor?: string
  }>
  turning_point?: {
    title: string
    text: string
  }
  afterword: string
  closing_line: string
  trace_text: string
  margin_notes?: Array<{
    anchor_section_index: number
    text: string
  }>
  later_notes?: Array<{
    note_id: string
    text: string
  }>
}

export interface BiographyChapterDirectoryItem {
  chapter_id: string
  chapter_no: number
  title: string
  one_line_summary: string
  status_label: BiographyDirectoryStatusLabel
  is_current: boolean
}

export interface AgentBiographyBookViewModel {
  agent_id: string
  agent_name: string
  book: BiographyBookCoverViewModel
  current_chapter: BiographyChapterViewModel | null
  chapters: BiographyChapterDirectoryItem[]
  footer_meta?: {
    source_line: string
    generated_at?: string
    degraded?: boolean
  }
}

export interface BiographyWriterConfig {
  config_id: string
  model_name: string
  temperature: number
  max_tokens: number
  style_contract: 'AGENT_BIOGRAPHY_CHAPTER_V1' | 'AGENT_BIOGRAPHY_CHAPTER_V2'
  factuality_mode: BiographyWriterFactualityMode
  allow_private_influence: boolean
  output_format: 'JSON'
  prompt_version: string
}

export interface BiographyWriterInput {
  writer_config: BiographyWriterConfig
  book_memory: BiographyBookMemory
  previous_chapter_digest: BiographyChapterDigest | null
  current_chapter_skeleton: AgentBiographyChapterSkeletonV1
  current_material_digest: BiographyMaterialDigest
  tone_profile: BiographyToneProfile
}

export type AgentBiographyReadTelemetryEventType =
  | 'history_book_opened'
  | 'history_chapter_selected'
  | 'history_directory_opened'
  | 'history_later_note_opened'
  | 'history_chapter_revisited'

export interface AgentBiographyReadTelemetryEvent {
  agent_id: string
  chapter_id: string | null
  event_type: AgentBiographyReadTelemetryEventType
  event_at: string
  is_owner_view: boolean
  payload: Record<string, unknown> | null
}

export interface AgentBiographyWriterTelemetryEvent {
  agent_id: string
  chapter_id: string
  revision_id: string
  prompt_template_id: string | null
  prompt_version: number | null
  model_name: string | null
  provider_id: string | null
  input_hash: string | null
  render_fingerprint: string | null
  publish_status: BiographyRevisionGenerationStatus
  audit_status: BiographyFactualAudit['status'] | null
  privacy_blocked: boolean
  unsupported_claim_count: number
  invented_entity_count: number
  invented_relationship_count: number
  repair_applied: boolean
  repair_rule_hits: string[]
  rescue_render_attempted: boolean
  rescue_render_model_id: string | null
  audit_failure_category: string | null
  later_note_count: number
  created_at: string
}
