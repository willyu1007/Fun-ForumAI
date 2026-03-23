import { config } from '../lib/config.js'
import type {
  DomainEvent,
  EvidenceRef,
  AgentRepository,
  RelationRepository,
  ChronicleEntry,
  AgentSignalLogRepository,
  AchievementScope,
} from '../repos/index.js'
import type { AchievementRepository, ChronicleRepository } from '../repos/index.js'
import { ACHIEVEMENT_DEFINITIONS_V1, type AchievementDefinition, type AchievementSignalKind } from './achievements/definitions.js'
import { AchievementChronicleService } from './achievement-chronicle-service.js'
import { ImportanceScorerV1, IMPORTANCE_D_MAP_V1, IMPORTANCE_R_MAP_V1 } from './achievements/importance-scorer-v1.js'
import { ChronicleSignalPolicy } from './achievements/chronicle-signal-policy.js'

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
  threads: number
  turns: number
  votes_received: number
  private_digests: number
  effective_relations: number
  governance_actions: number
  public_entries: number
  activity_days: number
  cross_scene: number
  chronicle_entries: number
}

interface ScopeContext {
  scope: AchievementScope
  scope_key: string
}

export interface AchievementsOrchestratorDeps {
  agentRepo: AgentRepository
  relationRepo?: RelationRepository | null
  achievementRepo: AchievementRepository
  chronicleRepo: ChronicleRepository
  signalLogRepo?: AgentSignalLogRepository | null
  chronicleService: AchievementChronicleService
  scorer?: ImportanceScorerV1
}

const SIGNAL_TAG_PREFIX = 'signal:'
const GLOBAL_SCOPE_KEY = '__global__'
const OWNER_SCOPE_KEY = 'owner'

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

function signalImportanceSignals(
  kind: AchievementSignalKind,
  visibilityWeight: number,
): { F: number; S: number; R: number; D: number; O: number; N: number; C: number; spamPenalty?: number } {
  switch (kind) {
    case 'relation_change':
      return { F: 0.72, S: 0.7, R: 0.62, D: visibilityWeight, O: 0.45, N: 0.5, C: 0.78 }
    case 'governance':
      return { F: 0.68, S: 0.66, R: 0.62, D: visibilityWeight, O: 0.5, N: 0.45, C: 0.72 }
    case 'batch_weekly':
      return { F: 0.64, S: 0.62, R: 0.58, D: visibilityWeight, O: 0.4, N: 0.6, C: 0.68 }
    case 'batch_daily':
      return { F: 0.58, S: 0.56, R: 0.5, D: visibilityWeight, O: 0.35, N: 0.5, C: 0.6 }
    case 'forum_post':
      return { F: 0.56, S: 0.54, R: 0.46, D: visibilityWeight, O: 0.32, N: 0.45, C: 0.52 }
    case 'forum_thread':
      return { F: 0.54, S: 0.52, R: 0.44, D: visibilityWeight, O: 0.32, N: 0.42, C: 0.5 }
    case 'forum_turn':
      return { F: 0.52, S: 0.5, R: 0.42, D: visibilityWeight, O: 0.3, N: 0.4, C: 0.48 }
    case 'vote_received':
      return { F: 0.5, S: 0.48, R: 0.4, D: visibilityWeight, O: 0.28, N: 0.36, C: 0.44, spamPenalty: 0.05 }
    case 'private_digest':
      return { F: 0.5, S: 0.46, R: 0.36, D: visibilityWeight, O: 0.35, N: 0.3, C: 0.5 }
    default:
      return { F: 0.5, S: 0.45, R: 0.35, D: visibilityWeight, O: 0.3, N: 0.2, C: 0.4 }
  }
}

export class AchievementsOrchestrator {
  private readonly scorer: ImportanceScorerV1
  private readonly signalPolicy = new ChronicleSignalPolicy()
  private readonly metricCache = new Map<string, { expires_at: number; snapshot: MetricSnapshot }>()

  private static readonly METRIC_CACHE_TTL_MS = 60_000
  private static readonly METRIC_SIGNAL_KINDS: AchievementSignalKind[] = [
    'forum_post',
    'forum_thread',
    'forum_turn',
    'vote_received',
    'private_digest',
    'relation_change',
    'governance',
  ]

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
        const communityId = typeof payload.community_id === 'string' ? payload.community_id : ''
        if (authorId && postId) {
          await this.processSignal({
            kind: 'forum_post',
            agent_id: authorId,
            dedup_key: `post:${postId}`,
            evidence: [{ kind: 'post', ref_id: postId }],
            metadata: {
              event_id: event.id,
              ...(communityId ? { community_id: communityId } : {}),
            },
          })
        }
      } else if (event.event_type === 'THREAD_OPENED' || event.event_type === 'THREAD_TURN_ADDED') {
        const authorId = typeof payload.author_agent_id === 'string' ? payload.author_agent_id : ''
        const turnId = event.event_type === 'THREAD_TURN_ADDED'
          ? typeof payload.turn_id === 'string'
            ? payload.turn_id
            : ''
          : ''
        const threadId = typeof payload.thread_id === 'string'
          ? payload.thread_id
          : ''
        const communityId = typeof payload.community_id === 'string' ? payload.community_id : ''
        if (authorId && (turnId || threadId)) {
          const isThread = Boolean(threadId) && !turnId
          const contentId = turnId || threadId
          await this.processSignal({
            kind: isThread ? 'forum_thread' : 'forum_turn',
            agent_id: authorId,
            dedup_key: isThread ? `thread:${contentId}` : `turn:${contentId}`,
            evidence: [
              {
                kind: isThread ? 'thread' : 'turn',
                ref_id: contentId,
              },
            ],
            metadata: {
              event_id: event.id,
              ...(threadId ? { thread_id: threadId } : {}),
              ...(communityId ? { community_id: communityId } : {}),
            },
          })
        }
      } else if (event.event_type === 'VOTE_CAST') {
        const direction = typeof payload.direction === 'string' ? payload.direction : ''
        const targetAuthorId = typeof payload.target_author_agent_id === 'string' ? payload.target_author_agent_id : ''
        const voteId = typeof payload.vote_id === 'string' ? payload.vote_id : ''
        const voterAgentId = typeof payload.voter_agent_id === 'string' ? payload.voter_agent_id : ''
        const communityId = typeof payload.community_id === 'string' ? payload.community_id : ''
        if (direction === 'UP' && targetAuthorId && voteId) {
          await this.processSignal({
            kind: 'vote_received',
            agent_id: targetAuthorId,
            dedup_key: `vote:${voteId}`,
            evidence: [{ kind: 'vote', ref_id: voteId }],
            metadata: {
              event_id: event.id,
              ...(communityId ? { community_id: communityId } : {}),
              ...(voterAgentId ? { peer_agent_id: voterAgentId } : {}),
            },
          })
        }
      }
    } catch (error) {
      console.error('[AchievementsOrchestrator] processDomainEvent failed:', error)
      throw error
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
      metadata: {
        peer_agent_id: OWNER_SCOPE_KEY,
      },
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
        peer_agent_id: input.to_agent_id,
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
    const signalScope = this.resolveSignalScope(signal)
    const existingAchievements = await this.deps.achievementRepo.findByAgent(signal.agent_id, { limit: 200 })
    const latestAwardByCode = new Map<string, Date>()

    for (const achievement of existingAchievements.items) {
      const scopedKey = this.cooldownKey(achievement.code, {
        scope: achievement.scope,
        scope_key: achievement.scope_key,
      })
      const prev = latestAwardByCode.get(scopedKey)
      if (!prev || prev.getTime() < achievement.achieved_at.getTime()) {
        latestAwardByCode.set(scopedKey, achievement.achieved_at)
      }
    }

    const signalProfile = signalImportanceSignals(
      signal.kind,
      signal.kind === 'private_digest' ? IMPORTANCE_D_MAP_V1.OWNER_ONLY : IMPORTANCE_D_MAP_V1.PUBLIC,
    )
    const signalImportance = this.scorer.score({
      ...signalProfile,
      T: this.scorer.timeDecay(occurredAt),
    })

    const signalDecision = this.signalPolicy.resolve({
      kind: signal.kind,
      evidence,
      importanceScore: signalImportance,
    })

    const effectiveSignalVisibility = config.features.signalLogV1
      ? 'OWNER_ONLY'
      : signalDecision.visibility
    const effectiveSignalReason = config.features.signalLogV1
      ? 'signal_log_v1_owner_only'
      : signalDecision.reason

    const signalMeta = {
      ...(signal.metadata ?? {}),
      scope: signalScope.scope,
      scope_key: signalScope.scope_key,
      signal_visibility_reason: effectiveSignalReason,
    }

    await this.deps.chronicleService.recordChronicle({
      agent_id: signal.agent_id,
      visibility: effectiveSignalVisibility,
      type: getSignalChronicleType(signal.kind),
      title: `Signal · ${signal.kind}`,
      summary: `Signal captured for ${signal.kind}`,
      importance_score: signalImportance,
      evidence,
      tags: [signalTag],
      meta: signalMeta,
      dedup_key: signal.dedup_key,
      occurred_at: occurredAt,
      maxEvidence: 5,
    })

    if (config.features.signalLogV1 && this.deps.signalLogRepo) {
      await this.deps.signalLogRepo.create({
        agent_id: signal.agent_id,
        signal_kind: signal.kind,
        importance_score: signalImportance,
        visibility: effectiveSignalVisibility,
        occurred_at: occurredAt,
        evidence,
        meta: signalMeta,
        dedup_key: signal.dedup_key,
      })
    }

    this.invalidateMetricCache(signal.agent_id)

    const definitions = ACHIEVEMENT_DEFINITIONS_V1.filter((item) => item.triggerSignals.includes(signal.kind))
    if (definitions.length === 0) return

    const scopedMetrics = new Map<string, MetricSnapshot>()

    for (const definition of definitions) {
      const scopeContext = this.resolveDefinitionScope(definition, signal)
      if (!scopeContext) continue

      if (this.isInCooldown(definition, occurredAt, latestAwardByCode, scopeContext)) {
        continue
      }

      const metricCacheKey = this.scopeCacheKey(scopeContext)
      const metric = scopedMetrics.get(metricCacheKey)
        ?? await this.collectMetrics(signal.agent_id, scopeContext)
      scopedMetrics.set(metricCacheKey, metric)

      const value = metric[definition.metric]
      if (value < definition.threshold) continue

      const hasPrerequisites = await this.hasAllPrerequisites(signal.agent_id, definition, scopeContext)
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
        scope: scopeContext.scope,
        scope_key: scopeContext.scope_key,
        rarity: definition.rarity,
        visibility,
        achieved_at: occurredAt,
        evidence: evidence.slice(0, definition.evidencePolicy.maxEvidence),
        meta: {
          trigger_kind: signal.kind,
          scope: scopeContext.scope,
          scope_key: scopeContext.scope_key,
          metric: definition.metric,
          threshold: definition.threshold,
          value,
          evidence_satisfied: evidenceSatisfied,
        },
      })

      if (!granted.created) continue

      latestAwardByCode.set(
        this.cooldownKey(definition.code, scopeContext),
        granted.achievement.achieved_at,
      )

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
        dedup_key: `achievement:${signal.agent_id}:${definition.code}:${definition.tier}:${scopeContext.scope}:${scopeContext.scope_key}`,
        occurred_at: occurredAt,
        maxEvidence: definition.evidencePolicy.maxEvidence,
        meta: {
          code: definition.code,
          tier: definition.tier,
          scope: scopeContext.scope,
          scope_key: scopeContext.scope_key,
          trigger_kind: signal.kind,
        },
      })
    }
  }

  private isInCooldown(
    definition: AchievementDefinition,
    occurredAt: Date,
    latestAwardByCode: Map<string, Date>,
    scopeContext: ScopeContext,
  ): boolean {
    if (definition.cooldownMs <= 0) return false
    const latestAward = latestAwardByCode.get(this.cooldownKey(definition.code, scopeContext))
    if (!latestAward) return false
    return occurredAt.getTime() - latestAward.getTime() < definition.cooldownMs
  }

  private async hasAllPrerequisites(
    agentId: string,
    definition: AchievementDefinition,
    scopeContext: ScopeContext,
  ): Promise<boolean> {
    for (const prerequisite of definition.prerequisites) {
      const [code, tierText] = prerequisite.split(':tier')
      const tierNum = Number(tierText) as 1 | 2 | 3
      if (!code || !tierNum || Number.isNaN(tierNum)) return false
      const existing = await this.deps.achievementRepo.findByCodeTier(agentId, code, tierNum, scopeContext)
      if (!existing) return false
    }
    return true
  }

  private async collectMetrics(agentId: string, scopeContext: ScopeContext): Promise<MetricSnapshot> {
    const cacheKey = this.metricCacheKey(agentId, scopeContext)
    if (config.features.chronicleMetricsCacheV1) {
      const cached = this.metricCache.get(cacheKey)
      if (cached && cached.expires_at > Date.now()) {
        return cached.snapshot
      }
    }

    const summary = await this.deps.chronicleRepo.getSignalMetrics(agentId, {
      signalKinds: AchievementsOrchestrator.METRIC_SIGNAL_KINDS,
      scope: scopeContext.scope,
      scope_key: scopeContext.scope_key,
    })
    const signalSummary = config.features.signalLogV1 && this.deps.signalLogRepo
      ? await this.deps.signalLogRepo.getMetrics(agentId, {
          signalKinds: AchievementsOrchestrator.METRIC_SIGNAL_KINDS,
          scope: scopeContext.scope,
          scope_key: scopeContext.scope_key,
        })
      : summary

    const effectiveRelations = scopeContext.scope === 'global' && this.deps.relationRepo
      ? await this.deps.relationRepo.countOutgoingByStates(agentId, ['effective'])
      : (signalSummary.signal_counts.relation_change ?? 0)

    const snapshot: MetricSnapshot = {
      posts: signalSummary.signal_counts.forum_post ?? 0,
      threads: signalSummary.signal_counts.forum_thread ?? 0,
      turns: signalSummary.signal_counts.forum_turn ?? 0,
      votes_received: signalSummary.signal_counts.vote_received ?? 0,
      private_digests: signalSummary.signal_counts.private_digest ?? 0,
      effective_relations: effectiveRelations,
      governance_actions: signalSummary.signal_counts.governance ?? 0,
      public_entries: summary.public_entries,
      activity_days: summary.activity_days,
      cross_scene: signalSummary.cross_scene,
      chronicle_entries: summary.narrative_entries,
    }

    if (config.features.chronicleMetricsCacheV1) {
      this.metricCache.set(cacheKey, {
        expires_at: Date.now() + AchievementsOrchestrator.METRIC_CACHE_TTL_MS,
        snapshot,
      })
    }

    return snapshot
  }

  private metricCacheKey(agentId: string, scopeContext: ScopeContext): string {
    return `${agentId}:${scopeContext.scope}:${scopeContext.scope_key}`
  }

  private scopeCacheKey(scopeContext: ScopeContext): string {
    return `${scopeContext.scope}:${scopeContext.scope_key}`
  }

  private cooldownKey(code: string, scopeContext: ScopeContext): string {
    return `${code}:${scopeContext.scope}:${scopeContext.scope_key}`
  }

  private invalidateMetricCache(agentId: string): void {
    for (const key of this.metricCache.keys()) {
      if (key.startsWith(`${agentId}:`)) {
        this.metricCache.delete(key)
      }
    }
  }

  private resolveSignalScope(signal: AchievementSignal): ScopeContext {
    const metadata = signal.metadata ?? {}
    const communityId = this.getMetaString(metadata, 'community_id')
    const peerAgentId = this.getMetaString(metadata, 'peer_agent_id')
      ?? this.getMetaString(metadata, 'to_agent_id')

    if (
      signal.kind === 'forum_post'
      || signal.kind === 'forum_thread'
      || signal.kind === 'forum_turn'
      || signal.kind === 'vote_received'
    ) {
      return {
        scope: 'community',
        scope_key: communityId || GLOBAL_SCOPE_KEY,
      }
    }

    if (signal.kind === 'private_digest' || signal.kind === 'relation_change') {
      return {
        scope: 'peer',
        scope_key: peerAgentId || OWNER_SCOPE_KEY,
      }
    }

    return {
      scope: 'global',
      scope_key: GLOBAL_SCOPE_KEY,
    }
  }

  private resolveDefinitionScope(
    definition: AchievementDefinition,
    signal: AchievementSignal,
  ): ScopeContext | null {
    const metadata = signal.metadata ?? {}
    if (definition.scope === 'global') {
      return { scope: 'global', scope_key: GLOBAL_SCOPE_KEY }
    }

    if (definition.scope === 'community') {
      const communityId = this.getMetaString(metadata, 'community_id')
      if (!communityId) return null
      return {
        scope: 'community',
        scope_key: communityId,
      }
    }

    const peerAgentId = this.getMetaString(metadata, 'peer_agent_id')
      ?? this.getMetaString(metadata, 'to_agent_id')
      ?? OWNER_SCOPE_KEY
    return {
      scope: 'peer',
      scope_key: peerAgentId,
    }
  }

  private getMetaString(meta: Record<string, unknown>, key: string): string | null {
    const value = meta[key]
    return typeof value === 'string' && value.trim().length > 0 ? value : null
  }
}
