import type {
  GuidanceChecklistItem,
  GuidanceItemCard,
  GuidanceItemModuleType,
} from '@/api/types'

export type GuidanceRailMode = 'RECENT_ACTIVITY' | 'GUIDANCE'

export type GuidanceRailTakeoverReason =
  | 'NO_AGENT_BOOTSTRAP'
  | 'UNREAD_RECEIPT_READY'
  | 'FIRST_PRIVATE_CHAT_BLOCKER'
  | 'PUBLIC_EFFECT_READY'

export interface GuidanceRailSnoozeRecord {
  reason: GuidanceRailTakeoverReason
  scope_key: string
  expires_at: string
}

export interface GuidanceRailTakeoverCandidate {
  reason: GuidanceRailTakeoverReason
  priority: number
  scope_key: string
  source_item_id: string | null
  primary: 'CHECKLIST' | GuidanceItemModuleType | null
  secondary_action_reason_codes: string[]
  continuation_item_id: string | null
}

export interface GuidanceRailSelection {
  mode: GuidanceRailMode
  candidate: GuidanceRailTakeoverCandidate | null
  primary_checklist_item: GuidanceChecklistItem | null
  primary_item: GuidanceItemCard | null
  secondary_actions: GuidanceChecklistItem[]
  continuation_item: GuidanceItemCard | null
}
