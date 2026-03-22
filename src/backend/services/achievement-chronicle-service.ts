import { config } from '../lib/config.js'
import type {
  AchievementRepository,
  ChronicleRepository,
  AgentRepository,
  AchievementVisibility,
  AgentAchievement,
  ChronicleEntry,
  EvidenceRef,
  SurfaceMediaAttachmentView,
} from '../repos/index.js'
import { buildChronicleStoryMetaV1, withChronicleStoryMeta } from './chronicle-story-meta.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import { resolveSurfaceMediaAttachmentFromEvidence } from '../media/surface-media-view.js'

export interface AchievementChronicleServiceDeps {
  achievementRepo: AchievementRepository
  chronicleRepo: ChronicleRepository
  agentRepo: AgentRepository
  sceneMediaBindingRepo?: SceneMediaBindingRepository | null
  mediaContextProjectionRepo?: MediaContextProjectionRepository | null
  onRecord?: (input: {
    agent_id: string
    type: ChronicleEntry['type']
    visibility: AchievementVisibility
  }) => Promise<void> | void
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
    visual?: SurfaceMediaAttachmentView | null
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

function selectTopUniqueBadges(achievements: AgentAchievement[], limit: number): PublicBadge[] {
  const seen = new Set<string>()
  const badges: PublicBadge[] = []
  const sorted = achievements
    .slice()
    .sort((a, b) => b.tier - a.tier || b.achieved_at.getTime() - a.achieved_at.getTime())

  for (const item of sorted) {
    const key = `${item.code}:${item.tier}`
    if (seen.has(key)) continue
    seen.add(key)
    badges.push({ code: item.code, name: item.name, tier: item.tier })
    if (badges.length >= limit) break
  }

  return badges
}

export class AchievementChronicleService {
  setRecordHook(
    hook: (input: {
      agent_id: string
      type: ChronicleEntry['type']
      visibility: AchievementVisibility
    }) => Promise<void> | void,
  ): void {
    this.deps.onRecord = hook
  }

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

    const badges = selectTopUniqueBadges(achievements.items, 2)

    const publicDensity = applyDensity(chronicle.items, 3)
    const candidateEntries = compressSignalEntries(publicDensity.items)

    const topChronicle = await Promise.all(candidateEntries
      .filter((entry) => (config.features.signalLogV1 ? !isSignalEntry(entry) : true))
      .filter((entry) => isHighQualityPublicEntry(entry))
      .slice()
      .sort((a, b) => b.importance_score - a.importance_score || b.occurred_at.getTime() - a.occurred_at.getTime())
      .slice(0, 3)
      .map(async (entry) => ({
        id: entry.id,
        title: entry.title,
        summary: entry.summary,
        occurred_at: entry.occurred_at,
        importance_score: entry.importance_score,
        visual: config.features.mediaHighlightsSurfaceV1
          && this.deps.sceneMediaBindingRepo
          && this.deps.mediaContextProjectionRepo
          ? await resolveSurfaceMediaAttachmentFromEvidence(
              {
                sceneMediaBindingRepo: this.deps.sceneMediaBindingRepo,
                mediaContextProjectionRepo: this.deps.mediaContextProjectionRepo,
              },
              {
                evidence: entry.evidence,
                fallbackCommunityId: typeof entry.meta?.community_id === 'string'
                  ? entry.meta.community_id
                  : null,
              },
            )
          : null,
      })))

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
    const occurredAt = input.occurred_at ?? new Date()
    const storyMeta = buildChronicleStoryMetaV1({
      occurred_at: occurredAt,
      visibility: input.visibility,
      type: input.type,
      title: input.title,
      summary: input.summary,
      location: input.location,
      tags: input.tags,
      meta: input.meta,
    })
    const created = await this.deps.chronicleRepo.create({
      ...input,
      evidence: ensureEvidence(input.evidence, input.maxEvidence ?? 5),
      occurred_at: occurredAt,
      meta: withChronicleStoryMeta(input.meta, storyMeta),
    })
    if (this.deps.onRecord) {
      Promise.resolve(this.deps.onRecord({
        agent_id: input.agent_id,
        type: input.type,
        visibility: input.visibility,
      })).catch((error) => {
        console.error('[AchievementChronicleService] record hook failed:', error)
      })
    }
    return created
  }

  async ensureAgentExists(agentId: string): Promise<boolean> {
    return Boolean(this.deps.agentRepo.findById(agentId))
  }
}
