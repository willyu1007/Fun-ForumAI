export const WARMUP_VERIFIER_PHASES = [
  'kickoff_resolution',
  'activation_precheck',
  'baseline_admission',
  'runtime_probe_write',
  'surface_feed',
  'surface_home',
  'surface_highlights',
  'surface_search',
  'governance_quarantine',
  'governance_restore',
  'artifact_persist',
] as const

export type WarmupVerifierPhase = (typeof WARMUP_VERIFIER_PHASES)[number]

export const WARMUP_VERIFIER_SUBSYSTEMS = [
  'warmup_governance',
  'runtime_gate',
  'post_scheduler',
  'forum_write',
  'search_projection',
  'home_programming',
  'highlights_projection',
  'feed_read',
  'media_pipeline',
  'aftershow',
  'artifact_storage',
] as const

export type WarmupVerifierSubsystem = (typeof WARMUP_VERIFIER_SUBSYSTEMS)[number]

export const WARMUP_VERIFIER_SURFACES = ['feed', 'home', 'highlights', 'search'] as const

export type WarmupVerifierSurface = (typeof WARMUP_VERIFIER_SURFACES)[number]

export type WarmupVerifierSeverity = 'error' | 'warning'
export type WarmupVerifierRunStatus = 'running' | 'passed' | 'failed'
export type WarmupVerifierTerminalRunStatus = Exclude<WarmupVerifierRunStatus, 'running'>
export type WarmupVerifierSurfaceExpectation =
  | 'probe_visible'
  | 'probe_hidden'
  | 'baseline_content_present'
export type WarmupVerifierSurfaceFailureKind = 'read_exception'

export interface WarmupProbeContextInput {
  run_id: string
  probe_token: string
  triggered_by: string | null
  forced: true
}

export interface WarmupVerifierEvidenceRef {
  artifact: string
  pointer?: string | null
  note?: string | null
}

export interface WarmupVerifierDiagnosis {
  phase: WarmupVerifierPhase
  subsystem: WarmupVerifierSubsystem
  code: string
  severity: WarmupVerifierSeverity
  summary_zh: string
  evidence_refs: WarmupVerifierEvidenceRef[]
  recommended_next_check: string
  raw_reason?: string | null
}

export interface WarmupVerifierSurfaceCheckpoint {
  surface: WarmupVerifierSurface
  ok: boolean
  expectation: WarmupVerifierSurfaceExpectation
  detail: string
  failure_kind?: WarmupVerifierSurfaceFailureKind
  probe_post_id?: string | null
  observed_post_ids?: string[]
  matched_probe?: boolean
  baseline_match_count?: number
  checked_at: string
}

export interface WarmupVerifierSurfaceAuditStage {
  stage: 'initial' | 'after_quarantine' | 'after_restore' | 'after_cleanup'
  feed: WarmupVerifierSurfaceCheckpoint
  home: WarmupVerifierSurfaceCheckpoint
  highlights: WarmupVerifierSurfaceCheckpoint
  search: WarmupVerifierSurfaceCheckpoint
}

export interface WarmupVerifierSurfaceAudit {
  initial: WarmupVerifierSurfaceAuditStage | null
  after_quarantine: WarmupVerifierSurfaceAuditStage | null
  after_restore: WarmupVerifierSurfaceAuditStage | null
  after_cleanup: WarmupVerifierSurfaceAuditStage | null
}

export interface WarmupVerifierGovernanceDrillStep {
  action: 'quarantine' | 'restore' | 'cleanup'
  ok: boolean
  detail: string
  checked_at: string
}

export interface WarmupVerifierGovernanceDrill {
  quarantine: WarmupVerifierGovernanceDrillStep | null
  restore: WarmupVerifierGovernanceDrillStep | null
  cleanup: WarmupVerifierGovernanceDrillStep | null
}

export interface WarmupVerifierSurfaceMatrix {
  feed: boolean | null
  home: boolean | null
  highlights: boolean | null
  search: boolean | null
}

export interface WarmupVerifierArtifactPaths {
  artifact_dir: string
  run_summary_path: string
  kickoff_snapshot_before_path: string
  kickoff_snapshot_after_path: string
  baseline_admission_before_path: string
  baseline_admission_after_path: string
  probe_manifest_path: string
  surface_audit_path: string
  governance_drill_path: string
  diagnosis_path: string
  failure_log_path: string
  result_summary_path: string
}

export interface WarmupVerifierRunSummary {
  run_id: string
  status: WarmupVerifierRunStatus
  triggered_by_user_id: string | null
  kickoff_baseline_id: string | null
  kickoff_baseline_label: string | null
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  probe_token: string | null
  probe_post_id: string | null
  failed_phase: WarmupVerifierPhase | null
  top_diagnosis_code: string | null
  top_diagnosis_summary_zh: string | null
  surface_matrix: WarmupVerifierSurfaceMatrix
  governance_drill: {
    quarantine_ok: boolean | null
    restore_ok: boolean | null
    cleanup_ok: boolean | null
  }
  artifact_dir: string
  started_at: string
  completed_at: string | null
}

export interface WarmupVerifierProbeManifest {
  run_id: string
  probe_token: string
  triggered_by_user_id: string | null
  forced: true
  agent_id: string | null
  community_id: string | null
  post_id: string | null
  title: string | null
  tags: string[]
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE' | null
  state: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  created_at: string
}

export interface WarmupVerifierFailureLogEntry {
  phase: WarmupVerifierPhase
  message: string
  at: string
}

export interface WarmupVerifierRunDetail {
  summary: WarmupVerifierRunSummary
  artifacts: WarmupVerifierArtifactPaths
  diagnoses: WarmupVerifierDiagnosis[]
  top_diagnosis: WarmupVerifierDiagnosis | null
  surface_audit: WarmupVerifierSurfaceAudit | null
  governance_drill: WarmupVerifierGovernanceDrill | null
  probe_manifest: WarmupVerifierProbeManifest | null
}
