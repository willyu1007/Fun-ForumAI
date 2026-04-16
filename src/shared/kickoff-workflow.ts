export type KickoffBootstrapMode = 'candidate' | 'active'

export type KickoffProfileId =
  | 'local-llm-assisted-candidate'
  | 'local-llm-assisted-runtime-simulation'

export type KickoffDataMode =
  | 'canonical'
  | 'smoke-minimal'
  | 'kickoff-candidate'
  | 'kickoff-active'
  | 'unknown'

export type KickoffFlowPhase = 'idle' | 'foundation' | 'activation' | 'active' | 'runtime'

export type KickoffGenerationMode =
  | 'kickoff_candidate'
  | 'warmup_candidate'
  | 'warmup_topup_candidate'
  | 'governance_restore'

export type KickoffOperationAction =
  | 'create'
  | 'attach_media'
  | 'runtime_instruction'

export type KickoffEntityKind =
  | 'post'
  | 'thread'
  | 'turn'
  | 'vote'
  | 'media'
  | 'runtime_instruction'

export type KickoffImportRunType = 'bootstrap' | 'import' | 'edit'

export interface KickoffCommunitySelector {
  slug: string
}

export interface KickoffActorSelector {
  agent_id?: string | null
  roster_entry_id?: string | null
  display_name?: string | null
}

export interface KickoffPatchMeta {
  contract_version: 1
  patch_id: string
  patch_kind: KickoffProfileId
  generated_by_tool: string
  generated_at: string
  iteration: number
  parent_patch_id?: string | null
  repair_of_patch_id?: string | null
}

export interface KickoffPatchTarget {
  mode: KickoffBootstrapMode
  suite_label: string
  expected_seed_profile: 'launch'
  target_environment: 'local'
  target_batch_scope: 'kickoff' | 'warmup' | 'both'
}

export interface KickoffPatchSourceContractRefs {
  launch_manifest_path: string
  manifest_version: 1
  community_rules_contract_path: string
  system_roster_contract_path: string
  programming_schedule_contract_path: string
  visual_rollout_contract_path: string
}

export interface KickoffPatchPreconditions {
  require_clean_db: boolean
  require_launch_seed_ready: boolean
  require_no_other_review_ready_suite: boolean
  require_roster_memberships_ready: boolean
  require_media_backend_available: boolean
}

export interface KickoffPostPayload {
  title: string
  body: string
  tags?: string[]
  content_kind?: 'highlight_hero' | 'note_entry' | 'programming_slot' | 'standard'
  storyline_hooks?: string[]
}

export interface KickoffThreadPayload {
  post_ref_key: string
  body: string
  channel?: 'STAGE' | 'ASIDE'
}

export interface KickoffTurnPayload {
  thread_ref_key: string
  body: string
  anchor_turn_key?: string | null
  channel?: 'STAGE' | 'ASIDE'
}

export interface KickoffVotePayload {
  target_ref_key: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
}

export interface KickoffMediaPayload {
  post_ref_key: string
  source_kind: 'repo_local' | 'inline_base64'
  relative_path?: string | null
  inline_base64?: string | null
  mime_type: string
  owner_note?: string | null
  alt_intent?: string | null
  semantic_expectation?: string | null
  safety_expectation?: string | null
}

export interface KickoffRuntimeInstructionPayload {
  community_selector: KickoffCommunitySelector
  actor_selector: KickoffActorSelector
  title: string
  body: string
  tags?: string[]
  director_goal: string
  scene_hint?: string | null
  placement_goal?: string | null
  topup_reason?: string | null
}

export interface KickoffBaseOperation {
  op_id: string
  action: KickoffOperationAction
  entity_kind: KickoffEntityKind
  logical_key: string
  depends_on?: string[]
  target_batch_kind?: 'kickoff' | 'warmup'
  generation_mode?: KickoffGenerationMode
}

export interface KickoffPostOperation extends KickoffBaseOperation {
  action: 'create'
  entity_kind: 'post'
  community_selector: KickoffCommunitySelector
  actor_selector: KickoffActorSelector
  payload: KickoffPostPayload
}

export interface KickoffThreadOperation extends KickoffBaseOperation {
  action: 'create'
  entity_kind: 'thread'
  actor_selector: KickoffActorSelector
  payload: KickoffThreadPayload
}

export interface KickoffTurnOperation extends KickoffBaseOperation {
  action: 'create'
  entity_kind: 'turn'
  actor_selector: KickoffActorSelector
  payload: KickoffTurnPayload
}

export interface KickoffVoteOperation extends KickoffBaseOperation {
  action: 'create'
  entity_kind: 'vote'
  actor_selector: KickoffActorSelector
  payload: KickoffVotePayload
}

export interface KickoffMediaOperation extends KickoffBaseOperation {
  action: 'attach_media'
  entity_kind: 'media'
  actor_selector: KickoffActorSelector
  payload: KickoffMediaPayload
}

export interface KickoffRuntimeInstructionOperation extends KickoffBaseOperation {
  action: 'runtime_instruction'
  entity_kind: 'runtime_instruction'
  payload: KickoffRuntimeInstructionPayload
}

export type KickoffAuthoringOperation =
  | KickoffPostOperation
  | KickoffThreadOperation
  | KickoffTurnOperation
  | KickoffVoteOperation
  | KickoffMediaOperation
  | KickoffRuntimeInstructionOperation

export interface KickoffQualityExpectations {
  summary_floor: {
    posts: number
    threads: number
    turns: number
    votes: number
  }
  coverage_floor: {
    communities: number
    media_coverage_ratio: number
  }
  media_floor: {
    minimum_media_assets: number
  }
  interaction_floor: {
    minimum_threads: number
    minimum_turns: number
  }
  key_communities_expected: string[]
  key_shelves_expected: string[]
  aftershow_pipeline_expected: boolean
  allow_public_growth_expected: boolean
}

export interface KickoffAuthoringPatch {
  patch_meta: KickoffPatchMeta
  target: KickoffPatchTarget
  source_contract_refs: KickoffPatchSourceContractRefs
  preconditions: KickoffPatchPreconditions
  operations: KickoffAuthoringOperation[]
  quality_expectations: KickoffQualityExpectations
  notes?: string[]
}

export interface KickoffResolvedRef {
  logical_key: string
  entity_kind: KickoffEntityKind
  id: string
}

export interface KickoffImportPreflightResult {
  check: string
  ok: boolean
  detail: string
}

export interface KickoffImportOpResult {
  op_id: string
  logical_key: string
  entity_kind: KickoffEntityKind
  action: KickoffOperationAction
  status: 'success' | 'skipped' | 'failed'
  detail: string
  created_id?: string | null
}

export interface KickoffImportSummary {
  posts: number
  threads: number
  turns: number
  votes: number
  media: number
  communities: number
  media_covered_posts: number
  media_coverage_ratio: number
}

export interface KickoffLayerReadiness {
  kickoff_layer_ready: boolean
  warmup_layer_ready: boolean
  key_communities_ready: boolean
  key_shelves_ready: boolean
  media_access_ok: boolean
  aftershow_pipeline_ok: boolean
}

export interface KickoffAdmissionState {
  allow_public_growth: boolean
  reasons: string[]
  has_active_baseline: boolean
  active_baseline_id: string | null
}

export interface KickoffRuntimeReadiness {
  contract_version: 1
  suite_id: string | null
  suite_label: string | null
  suite_state: 'draft' | 'review_ready' | 'active' | 'archived' | 'unknown'
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  active_baseline_id: string | null
  activation_readiness: {
    ok: boolean
    reasons: string[]
  }
  layer_readiness: KickoffLayerReadiness
  quality_state: {
    summary: KickoffImportSummary
    warning_count: number
    warnings: Array<{
      code: string
      severity: 'warn' | 'critical'
      message: string
      affected_daypart?: string | null
      affected_community_slug?: string | null
    }>
  }
  admission: KickoffAdmissionState
  generated_at: string
}

export interface KickoffImportReport {
  contract_version: 1
  report_meta: {
    run_id: string
    patch_id: string | null
    dry_run: boolean
    imported_at: string
    profile_id: KickoffProfileId
  }
  resolved_context: {
    mode: KickoffBootstrapMode
    suite_id: string | null
    suite_label: string | null
    kickoff_batch_id: string | null
    warmup_batch_id: string | null
  }
  preflight_results: KickoffImportPreflightResult[]
  resolution_map: KickoffResolvedRef[]
  op_results: KickoffImportOpResult[]
  summary_after_import: KickoffImportSummary
  readiness_snapshot: KickoffRuntimeReadiness
  observability: {
    affected_post_ids: string[]
    affected_thread_ids: string[]
    artifact_dir: string
  }
  recommended_next_actions: string[]
  failure_phase: string | null
}

export interface KickoffBootstrapResult {
  mode: KickoffBootstrapMode
  suite_id: string | null
  suite_label: string | null
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  baseline_id: string | null
  counts: KickoffImportSummary
  readiness: KickoffRuntimeReadiness
  reused_existing_suite: boolean
  failed_phase: string | null
  run_id: string
}

export interface KickoffRunSummary {
  run_id: string
  run_type: KickoffImportRunType
  mode: KickoffBootstrapMode | null
  profile_id: KickoffProfileId | null
  patch_id: string | null
  suite_id: string | null
  suite_label: string | null
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  baseline_id: string | null
  failed_phase: string | null
  artifact_dir: string
  started_at: string
  completed_at: string | null
}

export interface KickoffRunArtifacts {
  context_pack_path: string | null
  generated_patch_path: string | null
  import_report_path: string | null
  readiness_snapshot_path: string | null
  diff_summary_path: string | null
  repair_patch_path: string | null
  failure_log_path: string | null
}

export interface KickoffRunDetail {
  summary: KickoffRunSummary
  artifacts: KickoffRunArtifacts
  context_pack?: Record<string, unknown> | null
  patch?: KickoffAuthoringPatch | null
  import_report?: KickoffImportReport | null
  readiness?: KickoffRuntimeReadiness | null
  diff_summary?: string | null
  failure_log?: Record<string, unknown> | null
}

export interface KickoffFlowStatus {
  phase: KickoffFlowPhase
  title: string
  summary: string
  next_action: string | null
  checkpoints: {
    foundation_ready: boolean
    activation_ready: boolean
    active_baseline_ready: boolean
    runtime_ready: boolean
  }
}

export interface KickoffStatusPayload {
  current_data_mode: KickoffDataMode
  mode_source: 'marker' | 'inferred'
  flow: KickoffFlowStatus
  latest_run: KickoffRunSummary | null
  latest_import_report: KickoffImportReport | null
  latest_runtime_readiness: KickoffRuntimeReadiness | null
  current_suite: {
    id: string | null
    label: string | null
    state: string | null
    kickoff_batch_id: string | null
    warmup_batch_id: string | null
    active_baseline_id: string | null
  }
}

export type KickoffSuiteEditAction =
  | 'rewrite_post'
  | 'replace_post_media'
  | 'regenerate_thread'
  | 'regenerate_turn'

export interface KickoffSuiteEditRequest {
  action: KickoffSuiteEditAction
  target: {
    suite_id: string
    post_id?: string | null
    thread_id?: string | null
    turn_id?: string | null
  }
  payload: Record<string, unknown>
  reason: string
}

export interface KickoffSuiteEditPreview {
  action: KickoffSuiteEditAction
  target_ids: string[]
  warnings: string[]
  impact_summary: string
}

export interface KickoffSuiteEditApplyResult {
  preview: KickoffSuiteEditPreview
  suite_readiness: KickoffRuntimeReadiness
}
