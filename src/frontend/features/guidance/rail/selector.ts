import type {
  Agent,
  GuidanceChecklistItem,
  GuidanceItemCard,
  GuidanceSummaryData,
} from '@/api/types'
import type {
  GuidanceRailSelection,
  GuidanceRailSnoozeRecord,
  GuidanceRailTakeoverCandidate,
  GuidanceRailTakeoverReason,
} from './types'

const TAKEOVER_FRESHNESS_MS = 72 * 60 * 60_000

const SNOOZE_DURATION_MS: Record<GuidanceRailTakeoverReason, number> = {
  NO_AGENT_BOOTSTRAP: 24 * 60 * 60_000,
  UNREAD_RECEIPT_READY: 12 * 60 * 60_000,
  FIRST_PRIVATE_CHAT_BLOCKER: 24 * 60 * 60_000,
  PUBLIC_EFFECT_READY: 12 * 60 * 60_000,
}

function isChecklistModule(
  module: GuidanceSummaryData['modules'][number] | undefined,
): module is Extract<GuidanceSummaryData['modules'][number], { type: 'CHECKLIST' }> {
  return Boolean(module && module.type === 'CHECKLIST')
}

function isItemModule(
  module: GuidanceSummaryData['modules'][number],
): module is Extract<GuidanceSummaryData['modules'][number], { type: 'CARD' | 'RECEIPT' }> {
  return module.type === 'CARD' || module.type === 'RECEIPT'
}

function isFresh(timestamp: string | null | undefined, now: Date): boolean {
  if (!timestamp) return false
  const value = new Date(timestamp)
  if (!Number.isFinite(value.getTime())) return false
  return now.getTime() - value.getTime() <= TAKEOVER_FRESHNESS_MS
}

function getChecklist(summary: GuidanceSummaryData | undefined) {
  const module = summary?.modules.find(isChecklistModule)
  return module ?? null
}

function getItemCards(summary: GuidanceSummaryData | undefined): GuidanceItemCard[] {
  return summary?.modules.filter(isItemModule).map((module) => module.item) ?? []
}

function getIncompleteChecklistItems(summary: GuidanceSummaryData | undefined): GuidanceChecklistItem[] {
  return (getChecklist(summary)?.items ?? []).filter((item) => !item.completed)
}

function findChecklistAction(
  summary: GuidanceSummaryData | undefined,
  reasonCode: string,
): GuidanceChecklistItem | null {
  return getIncompleteChecklistItems(summary).find((item) => item.reason_code === reasonCode) ?? null
}

function findFreshUnreadReceipt(summary: GuidanceSummaryData | undefined, now: Date): GuidanceItemCard | null {
  return getItemCards(summary).find((item) =>
    item.module_type === 'RECEIPT'
    && item.unread
    && isFresh(item.updated_at, now)
  ) ?? null
}

function findPublicEffectItem(summary: GuidanceSummaryData | undefined, now: Date): GuidanceItemCard | null {
  if (summary?.actor.completed.watch_public_effect) {
    return null
  }

  return getItemCards(summary).find((item) =>
    item.reason_code === 'WATCH_PUBLIC_EFFECT'
    && Boolean(item.cta?.target)
    && isFresh(item.updated_at, now)
  ) ?? null
}

function findAgentCreationTimestamp(agents: Agent[], agentId: string | null): string | null {
  if (!agentId) {
    return null
  }
  return agents.find((agent) => agent.id === agentId)?.created_at ?? null
}

function isCandidateSnoozed(
  snoozeRecords: GuidanceRailSnoozeRecord[],
  candidate: GuidanceRailTakeoverCandidate,
  now: Date,
): boolean {
  return snoozeRecords.some((record) => {
    if (record.reason !== candidate.reason || record.scope_key !== candidate.scope_key) {
      return false
    }
    const expiresAt = new Date(record.expires_at)
    return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime()
  })
}

function buildContinuationItem(
  items: GuidanceItemCard[],
  primaryItem: GuidanceItemCard | null,
): GuidanceItemCard | null {
  const remaining = items.filter((item) => item.id !== primaryItem?.id)
  if (primaryItem?.module_type === 'RECEIPT') {
    return remaining.find((item) => item.reason_code === 'WATCH_PUBLIC_EFFECT')
      ?? remaining.find((item) => item.reason_code === 'FOLLOWED_AGENT_STORY_ESCALATED')
      ?? remaining[0]
      ?? null
  }

  return remaining.find((item) =>
    item.reason_code === 'WATCH_PUBLIC_EFFECT'
    || item.reason_code === 'FOLLOWED_AGENT_STORY_ESCALATED'
    || item.module_type === 'RECEIPT'
  ) ?? null
}

function buildSelection(
  candidate: GuidanceRailTakeoverCandidate,
  checklistItem: GuidanceChecklistItem | null,
  primaryItem: GuidanceItemCard | null,
  summary: GuidanceSummaryData | undefined,
): GuidanceRailSelection {
  const secondaryActions = getIncompleteChecklistItems(summary)
    .filter((item) => item.reason_code !== checklistItem?.reason_code)
    .slice(0, 2)
  const continuationItem = buildContinuationItem(getItemCards(summary), primaryItem)

  return {
    mode: 'GUIDANCE',
    candidate: {
      ...candidate,
      secondary_action_reason_codes: secondaryActions.map((item) => item.reason_code),
      continuation_item_id: continuationItem?.id ?? null,
    },
    primary_checklist_item: checklistItem,
    primary_item: primaryItem,
    secondary_actions: secondaryActions,
    continuation_item: continuationItem,
  }
}

export function buildGuidanceRailSnoozeRecord(candidate: GuidanceRailTakeoverCandidate, now = new Date()): GuidanceRailSnoozeRecord {
  return {
    reason: candidate.reason,
    scope_key: candidate.scope_key,
    expires_at: new Date(now.getTime() + SNOOZE_DURATION_MS[candidate.reason]).toISOString(),
  }
}

export function selectGuidanceRail(input: {
  summary?: GuidanceSummaryData
  myAgents?: Agent[]
  myAgentsLoaded?: boolean
  isAuthenticated: boolean
  snoozeRecords?: GuidanceRailSnoozeRecord[]
  now?: Date
}): GuidanceRailSelection {
  const now = input.now ?? new Date()
  const summary = input.summary
  const myAgents = input.myAgents ?? []
  const myAgentsLoaded = input.myAgentsLoaded ?? input.myAgents !== undefined
  const snoozeRecords = input.snoozeRecords ?? []
  const startPrivateChatAction = findChecklistAction(summary, 'START_FIRST_PRIVATE_CHAT')
  const unreadReceipt = findFreshUnreadReceipt(summary, now)
  const publicEffectItem = findPublicEffectItem(summary, now)
  const firstAgentCreatedAt = findAgentCreationTimestamp(myAgents, summary?.actor.latest_owner_agent_id ?? null)

  const candidates: Array<{
    candidate: GuidanceRailTakeoverCandidate
    checklistItem: GuidanceChecklistItem | null
    primaryItem: GuidanceItemCard | null
  }> = []

  if (input.isAuthenticated && myAgentsLoaded && myAgents.length === 0 && startPrivateChatAction) {
    candidates.push({
      candidate: {
        reason: 'NO_AGENT_BOOTSTRAP',
        priority: 100,
        scope_key: 'global',
        source_item_id: null,
        primary: 'CHECKLIST',
        secondary_action_reason_codes: [],
        continuation_item_id: null,
      },
      checklistItem: startPrivateChatAction,
      primaryItem: null,
    })
  }

  if (unreadReceipt) {
    candidates.push({
      candidate: {
        reason: 'UNREAD_RECEIPT_READY',
        priority: 90,
        scope_key: unreadReceipt.related_session_id
          ? `session:${unreadReceipt.related_session_id}`
          : `receipt:${unreadReceipt.id}`,
        source_item_id: unreadReceipt.id,
        primary: unreadReceipt.module_type,
        secondary_action_reason_codes: [],
        continuation_item_id: null,
      },
      checklistItem: null,
      primaryItem: unreadReceipt,
    })
  }

  if (
    summary?.actor.latest_owner_agent_id
    && summary.actor.completed.created_agent
    && !summary.actor.completed.started_private_chat
    && startPrivateChatAction
    && isFresh(firstAgentCreatedAt, now)
  ) {
    candidates.push({
      candidate: {
        reason: 'FIRST_PRIVATE_CHAT_BLOCKER',
        priority: 80,
        scope_key: `agent:${summary.actor.latest_owner_agent_id}`,
        source_item_id: null,
        primary: 'CHECKLIST',
        secondary_action_reason_codes: [],
        continuation_item_id: null,
      },
      checklistItem: startPrivateChatAction,
      primaryItem: null,
    })
  }

  if (publicEffectItem) {
    const payloadPostId = typeof publicEffectItem.payload?.post_id === 'string'
      ? publicEffectItem.payload.post_id
      : null
    candidates.push({
      candidate: {
        reason: 'PUBLIC_EFFECT_READY',
        priority: 70,
        scope_key: payloadPostId ? `post:${payloadPostId}` : `watch:${publicEffectItem.id}`,
        source_item_id: publicEffectItem.id,
        primary: publicEffectItem.module_type,
        secondary_action_reason_codes: [],
        continuation_item_id: null,
      },
      checklistItem: null,
      primaryItem: publicEffectItem,
    })
  }

  const next = candidates
    .sort((left, right) => right.candidate.priority - left.candidate.priority)
    .find((entry) => !isCandidateSnoozed(snoozeRecords, entry.candidate, now))
  if (!next) {
    return {
      mode: 'RECENT_ACTIVITY',
      candidate: null,
      primary_checklist_item: null,
      primary_item: null,
      secondary_actions: [],
      continuation_item: null,
    }
  }

  return buildSelection(next.candidate, next.checklistItem, next.primaryItem, summary)
}
