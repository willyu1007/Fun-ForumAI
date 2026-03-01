import { config } from '../lib/config.js'
import type {
  DomainEvent,
  EvidenceRef,
  AgentRepository,
  RelationRepository,
  ChronicleEntry,
} from '../repos/index.js'
import type { AchievementRepository, ChronicleRepository } from '../repos/index.js'
import { ACHIEVEMENT_DEFINITIONS_V1, type AchievementDefinition, type AchievementSignalKind } from './achievements/definitions.js'
import { AchievementChronicleService } from './achievement-chronicle-service.js'
import { ImportanceScorerV1, IMPORTANCE_D_MAP_V1, IMPORTANCE_R_MAP_V1 } from './achievements/importance-scorer-v1.js'

export interface AchievementSignal {
  kind: AchievementSignalKind
  agent_id: string
  occurred_at?: Date
  evidence?: EvidenceRef[]
  dedup_key?: string
  metadata?: Record<string, unknown>
}

interface MetricSnapshot {
  posts: number
  comments: number
  votes_received: number
  private_digests: number
  effective_relations: number
  governance_actions: number
  public_entries: number
  activity_days: number
  cross_scene: number
  chronicle_entries: number
}

export interface AchievementsOrchestratorDeps {
  agentRepo: AgentRepository
  relationRepo?: RelationRepository | null
  achievementRepo: AchievementRepository
  chronicleRepo: ChronicleRepository
  chronicleService: AchievementChronicleService
  scorer?: ImportanceScorerV1
}

const SIGNAL_TAG_PREFIX = 'signal:'

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  const day = d.getDay()
  const delta = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - delta)
  return d
}

function getSignalChronicleType(kind: AchievementSignalKind): ChronicleEntry['type'] {
  switch (kind) {
    case 'private_digest':
      return 'PRIVATE_DIGEST'
    case 'relation_change':
      return 'RELATION_CHANGE'
    case 'governance':
      return 'MODERATION'
    default:
      return 'HIGHLIGHT'
  }
}

function uniqueSignalKinds(entries: ChronicleEntry[]): Set<string> {
  const kinds = new Set<string>()
  for (const entry of entries) {
    for (const tag of entry.tags) {
      if (tag.startsWith(SIGNAL_TAG_PREFIX)) {
        kinds.add(tag.slice(SIGNAL_TAG_PREFIX.length))
      }
    }
  }
  return kinds
}

export class AchievementsOrchestrator {
  private readonly scorer: ImportanceScorerV1

  constructor(private readonly deps: AchievementsOrchestratorDeps) {
    this.scorer = deps.scorer ?? new ImportanceScorerV1()
  }

  async processDomainEvent(event: DomainEvent): Promise<void> {
    if (!config.features.achievementChronicleV1) return

    const payload = event.payload_json
    try {
      if (event.event_type === 'POST_CREATED') {
        const authorId = typeof payload.author_agent_id === 'string' ? payload.author_agent_id : ''
        const postId = typeof payload.post_id === 'string' ? payload.post_id : ''
        if (authorId && postId) {
          await this.processSignal({
            kind: 'forum_post',
            agent_id: authorId,
            dedup_key: `post:${postId}`,
            evidence: [{ kind: 'post', ref_id: postId }],
            metadata: { event_id: event.id },
          })
        }
      } else if (event.event_type === 'COMMENT_CREATED') {
        const authorId = typeof payload.author_agent_id === 'string' ? payload.author_agent_id : ''
        const commentId = typeof payload.comment_id === 'string' ? payload.comment_id : ''
        if (authorId && commentId) {
          await this.processSignal({
            kind: 'forum_comment',
            agent_id: authorId,
            dedup_key: `comment:${commentId}`,
            evidence: [{ kind: 'comment', ref_id: commentId }],
            metadata: { event_id: event.id },
          })
        }
      } else if (event.event_type === 'VOTE_CAST') {
        const direction = typeof payload.direction === 'string' ? payload.direction : ''
        const targetAuthorId = typeof payload.target_author_agent_id === 'string' ? payload.target_author_agent_id : ''
        const voteId = typeof payload.vote_id === 'string' ? payload.vote_id : ''
        if (direction === 'UP' && targetAuthorId && voteId) {
          await this.processSignal({
            kind: 'vote_received',
            agent_id: targetAuthorId,
            dedup_key: `vote:${voteId}`,
            evidence: [{ kind: 'vote', ref_id: voteId }],
            metadata: { event_id: event.id },
          })
        }
      }
    } catch (error) {
      console.error('[AchievementsOrchestrator] processDomainEvent failed:', error)
    }
  }

  async processPrivateDigest(input: { agent_id: string; session_id: string; memory_id?: string }): Promise<void> {
    if (!config.features.achievementChronicleV1) return

    await this.processSignal({
      kind: 'private_digest',
      agent_id: input.agent_id,
      dedup_key: `private-digest:${input.session_id}`,
      evidence: [
        { kind: 'private_digest', ref_id: input.session_id },
        ...(input.memory_id ? [{ kind: 'memory', ref_id: input.memory_id }] : []),
      ],
    })
  }

  async processRelationStateChange(input: {
    from_agent_id: string
    to_agent_id: string
    previous_state: string | null
    next_state: string
    relation_id: string
  }): Promise<void> {
    if (!config.features.achievementChronicleV1) return
    if (input.next_state !== 'effective') return

    await this.processSignal({
      kind: 'relation_change',
      agent_id: input.from_agent_id,
      dedup_key: `relation:${input.relation_id}:effective`,
      evidence: [{ kind: 'relation', ref_id: input.relation_id }],
      metadata: {
        to_agent_id: input.to_agent_id,
        previous_state: input.previous_state,
        next_state: input.next_state,
      },
    })
  }

  async processGovernanceResult(input: {
    target_agent_id: string
    action: string
    source_ref_id: string
    admin_user_id: string
  }): Promise<void> {
    if (!config.features.achievementChronicleV1) return

    await this.processSignal({
      kind: 'governance',
      agent_id: input.target_agent_id,
      dedup_key: `governance:${input.action}:${input.source_ref_id}`,
      evidence: [{ kind: 'governance', ref_id: input.source_ref_id }],
      metadata: {
        action: input.action,
        admin_user_id: input.admin_user_id,
      },
    })
  }

  async runDailyBatch(now = new Date()): Promise<{ scanned: number }> {
    if (!config.features.achievementChronicleV1) return { scanned: 0 }

    let cursor: string | undefined
    let scanned = 0
    const dayKey = startOfDay(now).toISOString().slice(0, 10)

    while (true) {
      const page = this.deps.agentRepo.findActive({ cursor, limit: 100 })
      if (page.items.length === 0) break

      for (const agent of page.items) {
        scanned += 1
        await this.processSignal({
          kind: 'batch_daily',
          agent_id: agent.id,
          dedup_key: `batch-daily:${dayKey}`,
          evidence: [
            { kind: 'activity', ref_id: dayKey },
            { kind: 'chronicle', ref_id: `day:${dayKey}` },
          ],
        })
      }

      if (!page.next_cursor) break
      cursor = page.next_cursor
    }

    return { scanned }
  }

  async runWeeklyBatch(now = new Date()): Promise<{ scanned: number }> {
    if (!config.features.achievementChronicleV1) return { scanned: 0 }

    let cursor: string | undefined
    let scanned = 0
    const weekKey = startOfWeek(now).toISOString().slice(0, 10)

    while (true) {
      const page = this.deps.agentRepo.findActive({ cursor, limit: 100 })
      if (page.items.length === 0) break

      for (const agent of page.items) {
        scanned += 1
        await this.processSignal({
          kind: 'batch_weekly',
          agent_id: agent.id,
          dedup_key: `batch-weekly:${weekKey}`,
          evidence: [
            { kind: 'activity', ref_id: weekKey },
            { kind: 'cross_scene', ref_id: `week:${weekKey}` },
            { kind: 'chronicle', ref_id: `week:${weekKey}` },
          ],
        })
      }

      if (!page.next_cursor) break
      cursor = page.next_cursor
    }

    return { scanned }
  }

  async processSignal(signal: AchievementSignal): Promise<void> {
    if (!config.features.achievementChronicleV1) return

    const exists = await this.deps.chronicleService.ensureAgentExists(signal.agent_id)
    if (!exists) return

    const occurredAt = signal.occurred_at ?? new Date()
    const evidence = signal.evidence ?? []
    const signalTag = `${SIGNAL_TAG_PREFIX}${signal.kind}`
    const existingAchievements = await this.deps.achievementRepo.findByAgent(signal.agent_id, { limit: 200 })
    const latestAwardByCode = new Map<string, Date>()

    for (const achievement of existingAchievements.items) {
      const prev = latestAwardByCode.get(achievement.code)
      if (!prev || prev.getTime() < achievement.achieved_at.getTime()) {
        latestAwardByCode.set(achievement.code, achievement.achieved_at)
      }
    }

    await this.deps.chronicleService.recordChronicle({
      agent_id: signal.agent_id,
      visibility: signal.kind === 'private_digest' || signal.kind === 'governance' ? 'OWNER_ONLY' : 'PUBLIC',
      type: getSignalChronicleType(signal.kind),
      title: `Signal · ${signal.kind}`,
      summary: `Signal captured for ${signal.kind}`,
      importance_score: this.scorer.score({
        F: 0.5,
        S: 0.45,
        R: 0.35,
        D: signal.kind === 'private_digest' ? IMPORTANCE_D_MAP_V1.OWNER_ONLY : IMPORTANCE_D_MAP_V1.PUBLIC,
        O: 0.3,
        N: 0.2,
        C: 0.4,
        T: this.scorer.timeDecay(occurredAt),
        spamPenalty: 0,
      }),
      evidence,
      tags: [signalTag],
      meta: signal.metadata ?? null,
      dedup_key: signal.dedup_key,
      occurred_at: occurredAt,
      maxEvidence: 5,
    })

    const definitions = ACHIEVEMENT_DEFINITIONS_V1.filter((item) => item.triggerSignals.includes(signal.kind))
    if (definitions.length === 0) return

    const metric = await this.collectMetrics(signal.agent_id)

    for (const definition of definitions) {
      if (this.isInCooldown(definition, occurredAt, latestAwardByCode)) {
        continue
      }

      const value = metric[definition.metric]
      if (value < definition.threshold) continue

      const hasPrerequisites = await this.hasAllPrerequisites(signal.agent_id, definition)
      if (!hasPrerequisites) continue

      const requiredKinds = new Set(definition.evidencePolicy.requiredKinds)
      const providedKinds = new Set(evidence.map((item) => item.kind))
      const evidenceSatisfied = Array.from(requiredKinds).every((kind) => providedKinds.has(kind))
      const visibility = evidenceSatisfied ? definition.visibility : 'OWNER_ONLY'

      const granted = await this.deps.achievementRepo.grant({
        agent_id: signal.agent_id,
        code: definition.code,
        name: definition.name,
        category: definition.category,
        tier: definition.tier,
        rarity: definition.rarity,
        visibility,
        achieved_at: occurredAt,
        evidence: evidence.slice(0, definition.evidencePolicy.maxEvidence),
        meta: {
          trigger_kind: signal.kind,
          metric: definition.metric,
          threshold: definition.threshold,
          value,
          evidence_satisfied: evidenceSatisfied,
        },
      })

      if (!granted.created) continue

      latestAwardByCode.set(definition.code, granted.achievement.achieved_at)

      await this.deps.chronicleService.recordChronicle({
        agent_id: signal.agent_id,
        visibility,
        type: 'ACHIEVEMENT',
        title: definition.chronicleTemplate.title,
        summary: definition.chronicleTemplate.summary,
        importance_score: this.scorer.score({
          F: 0.65,
          S: 0.75,
          R: IMPORTANCE_R_MAP_V1[definition.tier],
          D: visibility === 'PUBLIC' ? IMPORTANCE_D_MAP_V1.PUBLIC : IMPORTANCE_D_MAP_V1.OWNER_ONLY,
          O: definition.rarity,
          N: 0.55,
          C: 0.7,
          T: this.scorer.timeDecay(occurredAt),
          spamPenalty: signal.kind === 'vote_received' ? 0.1 : 0,
        }),
        evidence,
        tags: [...definition.chronicleTemplate.tags, `achievement:${definition.code}`, `tier:${definition.tier}`],
        dedup_key: `achievement:${signal.agent_id}:${definition.code}:${definition.tier}`,
        occurred_at: occurredAt,
        maxEvidence: definition.evidencePolicy.maxEvidence,
        meta: {
          code: definition.code,
          tier: definition.tier,
          trigger_kind: signal.kind,
        },
      })
    }
  }

  private isInCooldown(
    definition: AchievementDefinition,
    occurredAt: Date,
    latestAwardByCode: Map<string, Date>,
  ): boolean {
    if (definition.cooldownMs <= 0) return false
    const latestAward = latestAwardByCode.get(definition.code)
    if (!latestAward) return false
    return occurredAt.getTime() - latestAward.getTime() < definition.cooldownMs
  }

  private async hasAllPrerequisites(agentId: string, definition: AchievementDefinition): Promise<boolean> {
    for (const prerequisite of definition.prerequisites) {
      const [code, tierText] = prerequisite.split(':tier')
      const tierNum = Number(tierText) as 1 | 2 | 3
      if (!code || !tierNum || Number.isNaN(tierNum)) return false
      const existing = await this.deps.achievementRepo.findByCodeTier(agentId, code, tierNum)
      if (!existing) return false
    }
    return true
  }

  private async collectMetrics(agentId: string): Promise<MetricSnapshot> {
    const entries: ChronicleEntry[] = []
    let cursor: string | undefined
    let loops = 0

    while (loops < 20) {
      loops += 1
      const page = await this.deps.chronicleRepo.findByAgent(agentId, {
        cursor,
        limit: 200,
      })
      entries.push(...page.items)
      if (!page.next_cursor) break
      cursor = page.next_cursor
    }

    const tags = (kind: string): number => entries.filter((entry) => entry.tags.includes(`${SIGNAL_TAG_PREFIX}${kind}`)).length
    const publicEntries = entries.filter((entry) => entry.visibility === 'PUBLIC').length
    const activityDays = new Set(entries.map((entry) => dayKey(entry.occurred_at))).size
    const scenes = uniqueSignalKinds(entries)

    const effectiveRelations = this.deps.relationRepo
      ? await this.deps.relationRepo.countOutgoingByStates(agentId, ['effective'])
      : entries.filter((entry) => entry.tags.includes(`${SIGNAL_TAG_PREFIX}relation_change`)).length

    return {
      posts: tags('forum_post'),
      comments: tags('forum_comment'),
      votes_received: tags('vote_received'),
      private_digests: tags('private_digest'),
      effective_relations: effectiveRelations,
      governance_actions: tags('governance'),
      public_entries: publicEntries,
      activity_days: activityDays,
      cross_scene: scenes.size,
      chronicle_entries: entries.length,
    }
  }
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
