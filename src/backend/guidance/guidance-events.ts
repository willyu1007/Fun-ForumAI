import type { GuidanceEventLogEntity } from '../repos/types.js'
import { GUIDANCE_REASON_CODES } from './reason-codes.js'

export const GUIDANCE_EVENT_TYPES = {
  BELL_DELIVERED: 'GUIDANCE_BELL_DELIVERED',
  BELL_OPENED: 'GUIDANCE_BELL_OPENED',
  ITEM_DISMISSED: 'GUIDANCE_ITEM_DISMISSED',
  ITEM_COMPLETED: 'GUIDANCE_ITEM_COMPLETED',
  TAKEOVER_SNOOZED: 'GUIDANCE_TAKEOVER_SNOOZED',
  RECALL_SUPPRESSED_SAME_REASON: 'GUIDANCE_RECALL_SUPPRESSED_SAME_REASON',
  RECALL_SUPPRESSED_24H_CAP: 'GUIDANCE_RECALL_SUPPRESSED_24H_CAP',
  RECALL_SUPPRESSED_TEACHING_FIRST: 'GUIDANCE_RECALL_SUPPRESSED_TEACHING_FIRST',
} as const

export const GUIDANCE_BELL_RECALL_REASONS = [
  GUIDANCE_REASON_CODES.USE_FOLLOWING_FEED,
  GUIDANCE_REASON_CODES.START_FIRST_PRIVATE_CHAT,
  GUIDANCE_REASON_CODES.NURTURE_RECEIPT_READY,
] as const

export const GUIDANCE_BELL_EVENT_TIME_REASONS = [
  GUIDANCE_REASON_CODES.WATCH_PUBLIC_EFFECT,
  GUIDANCE_REASON_CODES.FOLLOWED_AGENT_STORY_ESCALATED,
] as const

export const GUIDANCE_BELL_REASON_CODES = [
  ...GUIDANCE_BELL_RECALL_REASONS,
  ...GUIDANCE_BELL_EVENT_TIME_REASONS,
] as const

export function isGuidanceRecallReason(reasonCode: string): boolean {
  return GUIDANCE_BELL_RECALL_REASONS.includes(reasonCode as typeof GUIDANCE_BELL_RECALL_REASONS[number])
}

export function isGuidanceBellReason(reasonCode: string): boolean {
  return GUIDANCE_BELL_REASON_CODES.includes(reasonCode as typeof GUIDANCE_BELL_REASON_CODES[number])
}

function readPayloadString(payload: Record<string, unknown> | null | undefined, key: string): string | null {
  return typeof payload?.[key] === 'string' ? payload[key] as string : null
}

export function readGuidanceEventReasonCode(payload: Record<string, unknown> | null | undefined): string | null {
  return readPayloadString(payload, 'reason_code')
}

export function readGuidanceEventItemId(payload: Record<string, unknown> | null | undefined): string | null {
  return readPayloadString(payload, 'item_id')
}

export function readGuidanceEventDedupKey(payload: Record<string, unknown> | null | undefined): string | null {
  return readPayloadString(payload, 'dedup_key')
}

export function readGuidanceEventDelayMs(payload: Record<string, unknown> | null | undefined): number | null {
  const value = payload?.delay_ms
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function isGuidanceRecallDeliveryEvent(event: GuidanceEventLogEntity): boolean {
  if (event.event_type !== GUIDANCE_EVENT_TYPES.BELL_DELIVERED) {
    return false
  }
  return event.payload_json?.recall === true
}
