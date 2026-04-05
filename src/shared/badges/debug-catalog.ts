import type { BadgeSourceKind } from './catalog.js'

export interface BadgeDebugCatalogItem {
  key: string
  source_kind: BadgeSourceKind
  name: string
  description: string
  icon_src: string | null
  condition_summary: string
  evidence_summary: string
  display_priority: string
  priority_rank: number
}
