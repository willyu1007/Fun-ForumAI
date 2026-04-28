import type { ChronicleRepository } from '../repos/chronicle-repository.js'
import type {
  AgentAchievement,
  AchievementScope,
  AchievementVisibility,
  ChronicleEntry,
} from '../repos/types.js'

const SIGNAL_TAG_PREFIX = 'signal:'
const PAGE_SIZE = 200
const MAX_SCAN = 2_000

const SYNTHETIC_ENTRY_SOURCE_PREFIXES = [
  'dev_seed',
  'system_batch',
]

const SYNTHETIC_DEDUP_PREFIXES = [
  'canonical-moments:',
  'batch-daily:',
  'batch-weekly:',
]

const SYNTHETIC_SIGNAL_SUMMARY_PREFIX = 'Signal captured for '
const SYNTHETIC_SIGNAL_TITLE_PREFIX = 'Signal · '
const BATCH_TRIGGER_KINDS = new Set(['batch_daily', 'batch_weekly'])

export interface ProductSafeChronicleMetrics {
  public_entries: number
  activity_days: number
  chronicle_entries: number
}

function startsWithAny(value: string | null | undefined, prefixes: string[]): boolean {
  if (!value) return false
  return prefixes.some((prefix) => value.startsWith(prefix))
}

export function isSignalOnlyChronicleEntry(entry: ChronicleEntry): boolean {
  return entry.tags.some((tag) => tag.startsWith(SIGNAL_TAG_PREFIX))
    || entry.title.startsWith(SYNTHETIC_SIGNAL_TITLE_PREFIX)
    || entry.summary.startsWith(SYNTHETIC_SIGNAL_SUMMARY_PREFIX)
}

export function isSyntheticChronicleEntry(entry: ChronicleEntry): boolean {
  return startsWithAny(entry.entry_source, SYNTHETIC_ENTRY_SOURCE_PREFIXES)
    || startsWithAny(entry.dedup_key, SYNTHETIC_DEDUP_PREFIXES)
    || isSignalOnlyChronicleEntry(entry)
}

export function isProductSafePublicChronicleEntry(entry: ChronicleEntry): boolean {
  return entry.visibility === 'PUBLIC' && !isSyntheticChronicleEntry(entry)
}

export function isChronicleEligibleForBiographyMaterial(entry: ChronicleEntry): boolean {
  return !isSyntheticChronicleEntry(entry)
}

export function isProductSafePublicAchievement(achievement: AgentAchievement): boolean {
  if (achievement.visibility !== 'PUBLIC') return false
  const triggerKind = achievement.award_context?.trigger_kind ?? null
  if (triggerKind && BATCH_TRIGGER_KINDS.has(triggerKind)) return false
  const dedupKey = achievement.award_context?.dedup_key ?? achievement.signal_context?.dedup_key ?? null
  return !startsWithAny(dedupKey, SYNTHETIC_DEDUP_PREFIXES)
}

export async function listProductSafePublicChronicleEntries(
  repo: ChronicleRepository,
  agentId: string,
  opts: {
    limit?: number
    from?: Date
    to?: Date
    scope?: AchievementScope
    scope_key?: string
  } = {},
): Promise<ChronicleEntry[]> {
  const limit = Math.max(0, Math.trunc(opts.limit ?? 20))
  if (limit === 0) return []

  const items: ChronicleEntry[] = []
  let cursor: string | undefined
  let scanned = 0

  while (items.length < limit && scanned < MAX_SCAN) {
    const page = await repo.findByAgent(agentId, {
      cursor,
      limit: Math.min(PAGE_SIZE, limit - items.length + PAGE_SIZE),
      visibility: ['PUBLIC'],
      from: opts.from,
      to: opts.to,
    })
    scanned += page.items.length
    for (const entry of page.items) {
      if (opts.scope && entry.scope !== opts.scope) continue
      if (opts.scope_key && entry.scope_key !== opts.scope_key) continue
      if (isProductSafePublicChronicleEntry(entry)) {
        items.push(entry)
        if (items.length >= limit) break
      }
    }
    if (!page.next_cursor) break
    cursor = page.next_cursor
  }

  return items
}

export async function listChronicleEntriesEligibleForBiographyMaterial(
  repo: ChronicleRepository,
  agentId: string,
  opts: {
    limit?: number
    visibility?: AchievementVisibility[]
    from?: Date
    to?: Date
    scope?: AchievementScope
    scope_key?: string
  } = {},
): Promise<ChronicleEntry[]> {
  const limit = Math.max(0, Math.trunc(opts.limit ?? 20))
  if (limit === 0) return []

  const items: ChronicleEntry[] = []
  let cursor: string | undefined
  let scanned = 0

  while (items.length < limit && scanned < MAX_SCAN) {
    const page = await repo.findByAgent(agentId, {
      cursor,
      limit: Math.min(PAGE_SIZE, limit - items.length + PAGE_SIZE),
      visibility: opts.visibility,
      from: opts.from,
      to: opts.to,
    })
    scanned += page.items.length
    for (const entry of page.items) {
      if (opts.scope && entry.scope !== opts.scope) continue
      if (opts.scope_key && entry.scope_key !== opts.scope_key) continue
      if (isChronicleEligibleForBiographyMaterial(entry)) {
        items.push(entry)
        if (items.length >= limit) break
      }
    }
    if (!page.next_cursor) break
    cursor = page.next_cursor
  }

  return items
}

export async function countProductSafePublicChronicleEntries(
  repo: ChronicleRepository,
  agentId: string,
  opts: {
    from?: Date
    to?: Date
    scope?: AchievementScope
    scope_key?: string
    maxScan?: number
  } = {},
): Promise<number> {
  const maxScan = Math.max(1, Math.trunc(opts.maxScan ?? MAX_SCAN))
  let count = 0
  let cursor: string | undefined
  let scanned = 0

  while (scanned < maxScan) {
    const page = await repo.findByAgent(agentId, {
      cursor,
      limit: Math.min(PAGE_SIZE, maxScan - scanned),
      visibility: ['PUBLIC'],
      from: opts.from,
      to: opts.to,
    })
    scanned += page.items.length
    for (const entry of page.items) {
      if (opts.scope && entry.scope !== opts.scope) continue
      if (opts.scope_key && entry.scope_key !== opts.scope_key) continue
      if (isProductSafePublicChronicleEntry(entry)) count += 1
    }
    if (!page.next_cursor) break
    cursor = page.next_cursor
  }

  return count
}

export async function hasProductSafePublicChronicleEntry(
  repo: ChronicleRepository,
  agentId: string,
  opts: {
    from?: Date
    to?: Date
    scope?: AchievementScope
    scope_key?: string
  } = {},
): Promise<boolean> {
  const items = await listProductSafePublicChronicleEntries(repo, agentId, {
    ...opts,
    limit: 1,
  })
  return items.length > 0
}

export async function collectProductSafePublicChronicleMetrics(
  repo: ChronicleRepository,
  agentId: string,
  opts: {
    since?: Date
    scope?: AchievementScope
    scope_key?: string
  } = {},
): Promise<ProductSafeChronicleMetrics> {
  const entries = await listProductSafePublicChronicleEntries(repo, agentId, {
    limit: MAX_SCAN,
    from: opts.since,
    scope: opts.scope,
    scope_key: opts.scope_key,
  })
  const days = new Set(entries.map((entry) => entry.occurred_at.toISOString().slice(0, 10)))
  return {
    public_entries: entries.length,
    activity_days: days.size,
    chronicle_entries: entries.length,
  }
}
