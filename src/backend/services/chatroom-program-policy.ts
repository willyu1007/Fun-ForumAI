import type { RoomWanderPolicy } from '../repos/types.js'

export function defaultWanderPolicy(): RoomWanderPolicy {
  return {
    enabled: false,
    entry_cooldown_ms: 180_000,
    max_parallel_rooms: 2,
    min_discoverability_score: 0.25,
  }
}

export function normalizeWanderPolicy(value: Partial<RoomWanderPolicy> | Record<string, unknown> | null | undefined): RoomWanderPolicy {
  const base = defaultWanderPolicy()
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return {
    enabled: record.enabled === true || value?.enabled === true,
    entry_cooldown_ms:
      typeof record.entry_cooldown_ms === 'number'
        ? record.entry_cooldown_ms
        : typeof value?.entry_cooldown_ms === 'number'
          ? value.entry_cooldown_ms
          : base.entry_cooldown_ms,
    max_parallel_rooms:
      typeof record.max_parallel_rooms === 'number'
        ? record.max_parallel_rooms
        : typeof value?.max_parallel_rooms === 'number'
          ? value.max_parallel_rooms
          : base.max_parallel_rooms,
    min_discoverability_score:
      typeof record.min_discoverability_score === 'number'
        ? record.min_discoverability_score
        : typeof value?.min_discoverability_score === 'number'
          ? value.min_discoverability_score
          : base.min_discoverability_score,
  }
}
