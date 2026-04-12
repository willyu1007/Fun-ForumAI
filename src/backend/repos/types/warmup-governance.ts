export type WarmupSuiteState = 'draft' | 'review_ready' | 'active' | 'archived'

export type WarmStartBatchKind = 'kickoff' | 'warmup'

export type WarmStartBatchState =
  | 'draft'
  | 'generating'
  | 'review_ready'
  | 'active'
  | 'archived'
  | 'failed'

export type WarmupReviewDecision = 'pass_to_active' | 'not_passed'

export const WARMUP_REVIEW_REASON_CODES = [
  'content_quality',
  'distribution_density',
  'media_coverage',
  'kickoff_invalid',
  'process_issue',
] as const

export type WarmupReviewReasonCode = (typeof WARMUP_REVIEW_REASON_CODES)[number]

export const WARM_START_GENERATION_MODES = [
  'warmup_candidate',
  'warmup_topup_candidate',
  'governance_restore',
] as const

export type WarmStartGenerationMode = (typeof WARM_START_GENERATION_MODES)[number]

export const GOVERNANCE_BATCH_ACTIONS = ['quarantine', 'restore', 'archive'] as const

export type GovernanceBatchAction = (typeof GOVERNANCE_BATCH_ACTIONS)[number]

export interface WarmupSuite {
  id: string
  state: WarmupSuiteState
  suite_label: string | null
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  created_by_user_id: string | null
  activated_at: Date | null
  archived_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface WarmStartBatch {
  id: string
  suite_id: string
  batch_kind: WarmStartBatchKind
  state: WarmStartBatchState
  source_batch_id: string | null
  revision_key: string | null
  package_hash: string | null
  notes: string | null
  activated_at: Date | null
  archived_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface WarmupSuiteReview {
  id: string
  suite_id: string
  reviewer_user_id: string | null
  decision: WarmupReviewDecision
  reason_codes: WarmupReviewReasonCode[]
  note: string | null
  created_at: Date
}

export interface ActiveBaseline {
  id: string
  suite_id: string
  kickoff_batch_id: string
  warmup_batch_id: string
  previous_baseline_id: string | null
  is_current: boolean
  activated_by_user_id: string | null
  activated_at: Date
  deactivated_at: Date | null
}

export interface GovernanceBatch {
  id: string
  action: GovernanceBatchAction
  requested_by_user_id: string | null
  suite_id: string | null
  warm_start_batch_ids: string[]
  content_ids: string[]
  scope_json: Record<string, unknown>
  preview_json: Record<string, unknown>
  result_json: Record<string, unknown> | null
  executed_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface CreateWarmupSuiteInput {
  suite_label?: string | null
  state?: WarmupSuiteState
  kickoff_batch_id?: string | null
  warmup_batch_id?: string | null
  created_by_user_id?: string | null
  activated_at?: Date | null
  archived_at?: Date | null
}

export interface UpdateWarmupSuiteInput {
  state?: WarmupSuiteState
  suite_label?: string | null
  kickoff_batch_id?: string | null
  warmup_batch_id?: string | null
  activated_at?: Date | null
  archived_at?: Date | null
}

export interface CreateWarmStartBatchInput {
  suite_id: string
  batch_kind: WarmStartBatchKind
  state?: WarmStartBatchState
  source_batch_id?: string | null
  revision_key?: string | null
  package_hash?: string | null
  notes?: string | null
  activated_at?: Date | null
  archived_at?: Date | null
}

export interface UpdateWarmStartBatchInput {
  state?: WarmStartBatchState
  source_batch_id?: string | null
  revision_key?: string | null
  package_hash?: string | null
  notes?: string | null
  activated_at?: Date | null
  archived_at?: Date | null
}

export interface CreateWarmupSuiteReviewInput {
  suite_id: string
  reviewer_user_id?: string | null
  decision: WarmupReviewDecision
  reason_codes?: WarmupReviewReasonCode[]
  note?: string | null
}

export interface CreateActiveBaselineInput {
  suite_id: string
  kickoff_batch_id: string
  warmup_batch_id: string
  previous_baseline_id?: string | null
  is_current?: boolean
  activated_by_user_id?: string | null
  activated_at?: Date
  deactivated_at?: Date | null
}

export interface UpdateActiveBaselineInput {
  is_current?: boolean
  previous_baseline_id?: string | null
  activated_by_user_id?: string | null
  activated_at?: Date
  deactivated_at?: Date | null
}

export interface CreateGovernanceBatchInput {
  action: GovernanceBatchAction
  requested_by_user_id?: string | null
  suite_id?: string | null
  warm_start_batch_ids?: string[]
  content_ids?: string[]
  scope_json?: Record<string, unknown>
  preview_json?: Record<string, unknown>
  result_json?: Record<string, unknown> | null
  executed_at?: Date | null
}

export interface UpdateGovernanceBatchInput {
  preview_json?: Record<string, unknown>
  result_json?: Record<string, unknown> | null
  executed_at?: Date | null
}
