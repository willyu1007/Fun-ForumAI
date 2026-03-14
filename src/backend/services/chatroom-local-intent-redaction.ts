import { config } from '../lib/config.js'

type JsonRecord = Record<string, unknown>

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function stripChatroomCompatFields<T>(payload: T): T {
  if (!config.features.chatroomLocalIntentV1 || !isJsonRecord(payload)) {
    return payload
  }

  const next = { ...payload }
  delete next.director_goal
  delete next.director_goal_compat
  return next as T
}
