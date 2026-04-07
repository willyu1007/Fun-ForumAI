import type { BadgeSourceKind } from './catalog.js'

export type BadgeDebugType = 'IDENTITY' | 'ACHIEVEMENT'
export type BadgeDebugVisibility = 'PUBLIC' | 'OWNER_ONLY'
export type BadgeDebugScope = 'global' | 'community' | 'peer'
export type BadgeDebugTriggerMode = 'system_rule' | 'event' | 'daily' | 'weekly'
export type BadgeDebugCheckStatus = 'pass' | 'warn' | 'fail'

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
