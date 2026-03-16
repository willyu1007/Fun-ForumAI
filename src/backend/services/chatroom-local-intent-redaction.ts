type JsonRecord = Record<string, unknown>

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function stripChatroomCompatFields<T>(payload: T): T {
  if (!isJsonRecord(payload)) {
    return payload
  }

  const next = { ...payload }
  for (const key of Object.keys(next)) {
    if (key === 'director_goal' || key.startsWith('director_goal_')) {
      delete next[key]
    }
  }
  return next as T
}
