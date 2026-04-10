import type { BadgeSourceKind } from './catalog.js'
import type { BadgeSurfacePolicy } from './surface-policy.js'

export type BadgeDebugType = 'IDENTITY' | 'ACHIEVEMENT'
export type BadgeDebugVisibility = 'PUBLIC' | 'OWNER_ONLY'
export type BadgeDebugScope = 'global' | 'community' | 'peer'
export type BadgeDebugTriggerMode = 'system_rule' | 'event' | 'daily' | 'weekly'
export type BadgeDebugCheckStatus = 'pass' | 'warn' | 'fail'
export type BadgeDebugBoundaryStatus = 'boundary_only'

export interface BadgeDebugCatalogItem {
  key: string
  source_kind: BadgeSourceKind
  badge_type: BadgeDebugType
  internal_code: string
  family_code: string
  name: string
  family_name: string
  description: string
  icon_src: string | null
  visibility: BadgeDebugVisibility
  scope: BadgeDebugScope
  tier: 1 | 2 | 3 | null
  threshold: number | null
  trigger_mode: BadgeDebugTriggerMode
  trigger_signals: string[]
  metric: string | null
  prerequisites: string[]
  condition_summary: string
  evidence_summary: string
  cooldown_rule: string
  evidence_rule: string
  success_rule: string
  dedupe_rule: string
  governance_filter: string | null
  display_layer: string
  display_priority: string
  priority_base: number
  priority_rank: number
  value_direction: string
  core_ability: string
  public_surfaces: string[]
  product_goal: string
  implementation_status: string
}

export interface BadgeDebugConsistencyCheck {
  key: string
  label: string
  status: BadgeDebugCheckStatus
  detail: string
}

export interface BadgeDebugBoundaryField {
  field:
    | 'identity_labels_flat'
    | 'proof_badges_flat'
    | 'projection_tagline_flat'
    | 'projection_public_bio_flat'
  status: BadgeDebugBoundaryStatus
  derived_from: string
  note: string
}

export interface BadgeDebugSemanticContract {
  public_identity_role: string
  public_projection_role: string
  public_proof_role: string
  identity_badges_path: string
  proof_badges_path: string
  projection_path: string
  boundary_outputs: BadgeDebugBoundaryField[]
  optional_adopters: string[]
}

export interface BadgeDebugMeta {
  total: number
  consistency_checks: BadgeDebugConsistencyCheck[]
  semantic_contract: BadgeDebugSemanticContract
  surface_policies: BadgeSurfacePolicy[]
}
