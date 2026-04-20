import type {
  GuidanceActorStateEntity,
  GuidanceActorType,
  GuidanceInboxItemEntity,
} from '../repos/types.js'
import type { GuidanceReasonCode } from './reason-codes.js'

export interface GuidanceActorRef {
  actor_type: GuidanceActorType
  actor_id: string
}

export interface GuidanceResolvedActor extends GuidanceActorRef {
  visitor_id: string
  user_id: string | null
}

export interface GuidanceCtaView {
  label: string
  target: string
  event_name?: string
  payload?: Record<string, unknown>
}

export interface GuidanceChecklistItemView {
  reason_code: GuidanceReasonCode
  title: string
  body: string
  completed: boolean
  cta: GuidanceCtaView | null
}

export interface GuidanceChecklistModule {
  type: 'CHECKLIST'
  title: string
  items: GuidanceChecklistItemView[]
}

export interface GuidanceItemCardView {
  id: string
  module_type: 'CARD' | 'RECEIPT'
  reason_code: string
  title: string
  body: string
  unread: boolean
  status: string
  cta: GuidanceCtaView | null
  payload: Record<string, unknown> | null
  related_agent_id: string | null
  related_session_id: string | null
  created_at: string
  updated_at: string
}

export interface GuidanceItemModule {
  type: 'CARD' | 'RECEIPT'
  item: GuidanceItemCardView
}

export type GuidanceSummaryModule =
  | GuidanceChecklistModule
  | GuidanceItemModule

export interface GuidanceActorView {
  actor_type: GuidanceActorType
  actor_id: string
  stage: GuidanceActorStateEntity['stage']
  completed: {
    followed_first_agent: boolean
    used_following_feed: boolean
    created_agent: boolean
    started_private_chat: boolean
    nurture_receipt_ready: boolean
    watch_public_effect: boolean
  }
  first_success: {
    achieved: boolean
    at: string | null
  }
  reveal: {
    style: boolean
    instructions: boolean
    advanced: boolean
  }
  latest_owner_agent_id: string | null
  latest_receipt_session_id: string | null
}

export interface GuidanceSummaryView {
  actor: GuidanceActorView
  modules: GuidanceSummaryModule[]
}

export interface GuidanceInboxView {
  items: GuidanceItemCardView[]
  unread_count: number
}

export interface GuidanceBellView {
  items: GuidanceItemCardView[]
  unread_count: number
}

export interface GuidanceChecklistSeed {
  reason_code: GuidanceReasonCode
  completed: boolean
  target_agent_id?: string | null
  target_session_id?: string | null
  target_url?: string | null
}

export interface GuidanceCopyResult {
  title: string
  body: string
  cta: GuidanceCtaView | null
}

export function toGuidanceItemCardView(item: GuidanceInboxItemEntity): GuidanceItemCardView {
  return {
    id: item.id,
    module_type: item.module_type,
    reason_code: item.reason_code,
    title: item.title,
    body: item.body,
    unread: item.unread,
    status: item.status,
    cta: item.cta_label && item.cta_target
      ? {
          label: item.cta_label,
          target: item.cta_target,
        }
      : null,
    payload: item.payload_json,
    related_agent_id: item.related_agent_id,
    related_session_id: item.related_session_id,
    created_at: item.created_at.toISOString(),
    updated_at: item.updated_at.toISOString(),
  }
}
