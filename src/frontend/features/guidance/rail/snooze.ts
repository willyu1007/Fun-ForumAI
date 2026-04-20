import type { GuidanceRailSnoozeRecord } from './types'

const GUIDANCE_RAIL_SNOOZE_KEY_PREFIX = 'guidance-rail-snooze'

function getStorageKey(actorId: string): string {
  return `${GUIDANCE_RAIL_SNOOZE_KEY_PREFIX}:${actorId}`
}

function isGuidanceRailSnoozeRecord(value: unknown): value is GuidanceRailSnoozeRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.reason === 'string' &&
    typeof candidate.scope_key === 'string' &&
    typeof candidate.expires_at === 'string'
  )
}

function pruneExpired(records: GuidanceRailSnoozeRecord[], now: Date): GuidanceRailSnoozeRecord[] {
  return records.filter((record) => {
    const expiresAt = new Date(record.expires_at)
    return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime()
  })
}

export function readGuidanceRailSnoozeRecords(
  actorId: string | null,
  now = new Date(),
): GuidanceRailSnoozeRecord[] {
  if (!actorId || typeof localStorage === 'undefined') {
    return []
  }

  try {
    const raw = localStorage.getItem(getStorageKey(actorId))
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    const records = Array.isArray(parsed) ? parsed.filter(isGuidanceRailSnoozeRecord) : []
    const next = pruneExpired(records, now)

    if (next.length !== records.length) {
      localStorage.setItem(getStorageKey(actorId), JSON.stringify(next))
    }

    return next
  } catch {
    return []
  }
}

export function writeGuidanceRailSnoozeRecord(
  actorId: string | null,
  record: GuidanceRailSnoozeRecord,
  now = new Date(),
): GuidanceRailSnoozeRecord[] {
  if (!actorId || typeof localStorage === 'undefined') {
    return []
  }

  const records = readGuidanceRailSnoozeRecords(actorId, now)
  const next = [
    ...records.filter(
      (item) => !(item.reason === record.reason && item.scope_key === record.scope_key),
    ),
    record,
  ]
  localStorage.setItem(getStorageKey(actorId), JSON.stringify(next))
  return next
}

export function clearGuidanceRailSnoozeRecords(actorId: string | null): void {
  if (!actorId || typeof localStorage === 'undefined') {
    return
  }
  localStorage.removeItem(getStorageKey(actorId))
}
