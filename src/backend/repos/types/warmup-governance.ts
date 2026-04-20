export type KickoffBaselineState = 'draft' | 'active' | 'archived'

export type GovernanceBatchKind = 'kickoff' | 'warmup'

// Legacy storage compatibility only.
// Do not expose these names above the repository persistence boundary.
export type StorageBatchKind = 'kickoff' | 'warmup'

export type GovernanceBatchState =
  | 'draft'
  | 'generating'
  | 'active'
  | 'archived'
  | 'failed'

export const GOVERNANCE_GENERATION_MODES = [
  'kickoff_import',
  'warmup_runtime',
  'governance_restore',
] as const

export type GovernanceGenerationMode = (typeof GOVERNANCE_GENERATION_MODES)[number]

// Legacy storage compatibility only.
// Do not expose these names above the repository persistence boundary.
export type StorageGenerationMode = GovernanceGenerationMode

export interface KickoffBaseline {
  id: string
  state: KickoffBaselineState
  baseline_label: string | null
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  created_by_user_id: string | null
  activated_at: Date | null
  archived_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface GovernanceBatch {
  id: string
  baseline_id: string
  batch_kind: GovernanceBatchKind
  state: GovernanceBatchState
  source_batch_id: string | null
  revision_key: string | null
  package_hash: string | null
  notes: string | null
  activated_at: Date | null
  archived_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface CreateKickoffBaselineInput {
  baseline_label?: string | null
  state?: KickoffBaselineState
  kickoff_batch_id?: string | null
  warmup_batch_id?: string | null
  created_by_user_id?: string | null
  activated_at?: Date | null
  archived_at?: Date | null
}

export interface UpdateKickoffBaselineInput {
  state?: KickoffBaselineState
  baseline_label?: string | null
  kickoff_batch_id?: string | null
  warmup_batch_id?: string | null
  activated_at?: Date | null
  archived_at?: Date | null
}

export interface CreateGovernanceBatchInput {
  baseline_id: string
  batch_kind: GovernanceBatchKind
  state?: GovernanceBatchState
  source_batch_id?: string | null
  revision_key?: string | null
  package_hash?: string | null
  notes?: string | null
  activated_at?: Date | null
  archived_at?: Date | null
}

export interface UpdateGovernanceBatchInput {
  state?: GovernanceBatchState
  source_batch_id?: string | null
  revision_key?: string | null
  package_hash?: string | null
  notes?: string | null
  activated_at?: Date | null
  archived_at?: Date | null
}

export function toStorageBatchKind(kind: GovernanceBatchKind): StorageBatchKind {
  return kind
}

export function fromStorageBatchKind(kind: StorageBatchKind): GovernanceBatchKind {
  return kind
}

export function toStorageGenerationMode(
  mode: GovernanceGenerationMode,
): StorageGenerationMode {
  return mode
}

export function fromStorageGenerationMode(
  mode: string | null,
): GovernanceGenerationMode | null {
  if (mode === null) return null
  if (
    mode === 'kickoff_import'
    || mode === 'warmup_runtime'
    || mode === 'governance_restore'
  ) {
    return mode
  }
  return null
}
