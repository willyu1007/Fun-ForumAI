import { config } from '../lib/config.js'
import type {
  AchievementRepository,
  ChronicleRepository,
  AgentRepository,
  AchievementVisibility,
  AgentAchievement,
  ChronicleEntry,
  EvidenceRef,
} from '../repos/index.js'

export interface AchievementChronicleServiceDeps {
  achievementRepo: AchievementRepository
  chronicleRepo: ChronicleRepository
  agentRepo: AgentRepository
}

export interface ChronicleListResult {
  items: ChronicleEntry[]
  next_cursor: string | null
  folded_count: number
}

export interface PublicBadge {
  code: string
  name: string
  tier: 1 | 2 | 3
}

export interface PublicHighlights {
  badges: PublicBadge[]
  tagline: string | null
  top_chronicle: Array<{
    id: string
    title: string
    summary: string
    occurred_at: Date
    importance_score: number
  }>
}

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  const resolved = Number.isFinite(limit) ? Math.trunc(limit as number) : fallback
  return Math.min(Math.max(resolved, 1), max)
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function applyDensity(entries: ChronicleEntry[], perDayCap: number): ChronicleListResult {
  const groups = new Map<string, ChronicleEntry[]>()

  for (const entry of entries) {
    const key = dayKey(entry.occurred_at)
    const list = groups.get(key) ?? []
    list.push(entry)
    groups.set(key, list)
  }

  const kept: ChronicleEntry[] = []
  let foldedCount = 0

  for (const list of groups.values()) {
    list.sort((a, b) => b.importance_score - a.importance_score || b.occurred_at.getTime() - a.occurred_at.getTime())
    kept.push(...list.slice(0, perDayCap))
    if (list.length > perDayCap) {
      foldedCount += list.length - perDayCap
    }
  }

  kept.sort((a, b) => b.occurred_at.getTime() - a.occurred_at.getTime() || b.id.localeCompare(a.id))

  return {
    items: kept,
    next_cursor: null,
    folded_count: foldedCount,
  }
}

function ensureEvidence(evidence: EvidenceRef[], maxEvidence: number): EvidenceRef[] {
  const normalized = evidence
    .filter((item) => item.kind.trim() && item.ref_id.trim())
    .slice(0, Math.max(1, maxEvidence))
  return normalized
}

function isSignalEntry(entry: ChronicleEntry): boolean {
  return entry.tags.some((tag) => tag.startsWith('signal:'))
}

function firstSignalTag(entry: ChronicleEntry): string | null {
  const tag = entry.tags.find((item) => item.startsWith('signal:'))
  return tag ?? null
}

function isHighQualityPublicEntry(entry: ChronicleEntry): boolean {
  if (!isSignalEntry(entry)) return true
  return entry.importance_score >= 0.72
}

function compressSignalEntries(entries: ChronicleEntry[]): ChronicleEntry[] {
  const grouped = new Map<string, ChronicleEntry[]>()
  const passthrough: ChronicleEntry[] = []

  for (const entry of entries) {
    const signalTag = firstSignalTag(entry)
    if (!signalTag) {
      passthrough.push(entry)
      continue
    }
    const day = dayKey(entry.occurred_at)
    const key = `${day}:${signalTag}`
    const list = grouped.get(key) ?? []
    list.push(entry)
    grouped.set(key, list)
  }

  const compressed = [...passthrough]
  for (const list of grouped.values()) {
    if (list.length === 1) {
      compressed.push(list[0])
      continue
    }
    const anchor = list
      .slice()
      .sort((a, b) => b.importance_score - a.importance_score || b.occurred_at.getTime() - a.occurred_at.getTime())[0]
    compressed.push({
      ...anchor,
      summary: `${anchor.summary}（同类信号 ${list.length} 条，已压缩）`,
      meta: {
        ...(anchor.meta ?? {}),
        signal_compressed_count: list.length,
      },
    })
  }

  return compressed
}

export class AchievementChronicleService {
  constructor(private readonly deps: AchievementChronicleServiceDeps) {}

  async listAchievementsForOwner(
    agentId: string,
    opts: { cursor?: string; limit?: number },
  ): Promise<{ items: AgentAchievement[]; next_cursor: string | null }> {
    if (!config.features.achievementChronicleV1) {
      return { items: [], next_cursor: null }
    }

    const limit = clampLimit(opts.limit, 20, 100)
    return this.deps.achievementRepo.findByAgent(agentId, {
      cursor: opts.cursor,
      limit,
    })
  }

  async listChronicleForOwner(
    agentId: string,
    opts: { cursor?: string; limit?: number; include_folded?: boolean },
  ): Promise<ChronicleListResult> {
    if (!config.features.achievementChronicleV1) {
      return { items: [], next_cursor: null, folded_count: 0 }
    }

    const limit = clampLimit(opts.limit, 20, 100)
    const [raw, foldedCount] = await Promise.all([
      this.deps.chronicleRepo.findByAgent(agentId, {
        cursor: opts.cursor,
        limit: Math.min(limit * 5, 300),
      }),
      this.deps.chronicleRepo.countFoldedByAgent(agentId, { perDayCap: 10 }),
    ])

    if (opts.include_folded) {
      return {
        items: raw.items.slice(0, limit),
        next_cursor: raw.next_cursor,
        folded_count: foldedCount,
      }
    }

    const density = applyDensity(raw.items, 10)
    return {
      items: density.items.slice(0, limit),
      next_cursor: raw.next_cursor,
      folded_count: foldedCount,
    }
  }

  async getPublicHighlights(agentId: string): Promise<PublicHighlights> {
    if (!config.features.achievementPublicHighlights) {
      return { badges: [], tagline: null, top_chronicle: [] }
    }

    const [achievements, chronicle] = await Promise.all([
      this.deps.achievementRepo.findByAgent(agentId, {
        limit: 120,
        visibility: ['PUBLIC'],
      }),
      this.deps.chronicleRepo.findByAgent(agentId, {
        limit: 120,
        visibility: ['PUBLIC'],
      }),
    ])

    const badges = achievements.items
      .sort((a, b) => b.tier - a.tier || b.achieved_at.getTime() - a.achieved_at.getTime())
      .slice(0, 2)
      .map((item) => ({ code: item.code, name: item.name, tier: item.tier }))

    const publicDensity = applyDensity(chronicle.items, 3)
    const candidateEntries = config.features.chronicleSignalPolicyV2
      ? compressSignalEntries(publicDensity.items)
      : publicDensity.items

    const topChronicle = candidateEntries
      .filter((entry) => (config.features.signalLogV1 ? !isSignalEntry(entry) : true))
      .filter((entry) => (
        config.features.chronicleSignalPolicyV2
          ? isHighQualityPublicEntry(entry)
          : true
      ))
      .slice()
      .sort((a, b) => b.importance_score - a.importance_score || b.occurred_at.getTime() - a.occurred_at.getTime())
      .slice(0, 3)
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        summary: entry.summary,
        occurred_at: entry.occurred_at,
        importance_score: entry.importance_score,
      }))

    const tagline = topChronicle[0]?.summary ?? null

    return {
      badges,
      tagline,
      top_chronicle: topChronicle,
    }
  }

  async getFeedAuthorIdentity(agentId: string): Promise<{ badges?: PublicBadge[]; tagline?: string }> {
    const highlights = await this.getPublicHighlights(agentId)
    const identity: { badges?: PublicBadge[]; tagline?: string } = {}
    if (highlights.badges.length > 0) {
      identity.badges = highlights.badges
    }
    if (highlights.tagline) {
      identity.tagline = highlights.tagline
    }
    return identity
  }

  async recordChronicle(input: {
    agent_id: string
    visibility: AchievementVisibility
    type: ChronicleEntry['type']
    title: string
    summary: string
    importance_score: number
    evidence: EvidenceRef[]
    actors?: string[]
    location?: string | null
    tags?: string[]
    meta?: Record<string, unknown> | null
    dedup_key?: string | null
    maxEvidence?: number
    occurred_at?: Date
  }): Promise<ChronicleEntry> {
    return this.deps.chronicleRepo.create({
      ...input,
      evidence: ensureEvidence(input.evidence, input.maxEvidence ?? 5),
      occurred_at: input.occurred_at,
    })
  }

  async ensureAgentExists(agentId: string): Promise<boolean> {
    return Boolean(this.deps.agentRepo.findById(agentId))
  }
}
