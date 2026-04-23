import type { RuntimeActionPlanV1 } from './forum-action-contract.js'
import {
  isForumTargetRef,
  isForumVoteTargetRef,
  isRuntimeActionPlanRationaleCode,
} from './forum-action-contract.js'

export type ForumActionPlanParseResult =
  | {
      status: 'ok'
      plan: RuntimeActionPlanV1
    }
  | {
      status: 'invalid'
      reason:
        | 'invalid_json'
        | 'invalid_shape'
        | 'invalid_action'
        | 'invalid_combination'
      plan: null
    }

const DEFAULT_NO_WRITE_REASON = 'no_write'

export function parseForumActionPlan(raw: string): ForumActionPlanParseResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'invalid', reason: 'invalid_json', plan: null }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { status: 'invalid', reason: 'invalid_shape', plan: null }
  }

  const record = parsed as Record<string, unknown>
  if (record.version !== 'v1' || !Array.isArray(record.actions) || record.actions.length === 0) {
    return { status: 'invalid', reason: 'invalid_shape', plan: null }
  }

  const actions: RuntimeActionPlanV1['actions'] = []

  for (const item of record.actions) {
    if (!item || typeof item !== 'object') {
      return { status: 'invalid', reason: 'invalid_shape', plan: null }
    }

    const action = item as Record<string, unknown>
    if (action.kind === 'vote') {
      if (
        !isForumVoteTargetRef(action.target_ref)
        || (action.direction !== 'UP' && action.direction !== 'DOWN' && action.direction !== 'NEUTRAL')
      ) {
        return { status: 'invalid', reason: 'invalid_action', plan: null }
      }
      if (
        action.confidence !== undefined
        && (typeof action.confidence !== 'number' || !Number.isFinite(action.confidence))
      ) {
        return { status: 'invalid', reason: 'invalid_shape', plan: null }
      }
      if (
        action.rationale_code !== undefined
        && typeof action.rationale_code !== 'string'
      ) {
        return { status: 'invalid', reason: 'invalid_shape', plan: null }
      }
      const normalizedRationaleCode = typeof action.rationale_code === 'string'
        && isRuntimeActionPlanRationaleCode(action.rationale_code)
        ? action.rationale_code
        : undefined
      actions.push({
        kind: 'vote',
        target_ref: action.target_ref,
        direction: action.direction,
        ...(typeof action.confidence === 'number' ? { confidence: action.confidence } : {}),
        ...(normalizedRationaleCode
          ? { rationale_code: normalizedRationaleCode }
          : {}),
      })
      continue
    }

    if (action.kind === 'open_thread') {
      actions.push({ kind: 'open_thread' })
      continue
    }

    if (action.kind === 'add_thread_turn') {
      if (action.target_ref !== 'reply_thread' && action.target_ref !== 'focus_turn') {
        return { status: 'invalid', reason: 'invalid_action', plan: null }
      }
      actions.push({
        kind: 'add_thread_turn',
        target_ref: action.target_ref,
      })
      continue
    }

    if (action.kind === 'no_write') {
      if (action.reason !== undefined && typeof action.reason !== 'string') {
        return { status: 'invalid', reason: 'invalid_shape', plan: null }
      }
      const normalizedReason = typeof action.reason === 'string' && action.reason.trim().length > 0
        ? action.reason.trim()
        : DEFAULT_NO_WRITE_REASON
      actions.push({
        kind: 'no_write',
        reason: normalizedReason,
      })
      continue
    }

    return { status: 'invalid', reason: 'invalid_action', plan: null }
  }

  const voteCount = actions.filter((item) => item.kind === 'vote').length
  const textCount = actions.filter(
    (item) => item.kind === 'open_thread' || item.kind === 'add_thread_turn',
  ).length
  const noWriteCount = actions.filter((item) => item.kind === 'no_write').length

  if (voteCount > 1 || textCount > 1 || noWriteCount > 1) {
    return { status: 'invalid', reason: 'invalid_combination', plan: null }
  }
  if (noWriteCount > 0 && actions.length > 1) {
    return { status: 'invalid', reason: 'invalid_combination', plan: null }
  }
  if (textCount === 2) {
    return { status: 'invalid', reason: 'invalid_combination', plan: null }
  }

  return {
    status: 'ok',
    plan: {
      version: 'v1',
      actions,
    },
  }
}

export function buildForumActionOptionsPayload(input: {
  event_type: 'NewPostCreated' | 'ThreadOpened' | 'ThreadTurnAdded'
  options: Array<{
    ref: string
    allowed_actions: string[]
    label: string
    target_type?: string
  }>
}): string {
  return JSON.stringify(
    {
      event_type: input.event_type,
      action_limits: {
        max_vote_actions: 1,
        max_text_actions: 1,
        valid_shapes: [
          ['no_write'],
          ['vote'],
          ['open_thread'],
          ['add_thread_turn'],
          ['vote', 'open_thread'],
          ['vote', 'add_thread_turn'],
        ],
      },
      visible_targets: input.options,
    },
    null,
    2,
  )
}
