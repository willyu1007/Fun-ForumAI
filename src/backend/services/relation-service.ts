import type { DomainEvent, RelationState, RelationView, AgentRelation } from '../repos/types.js'
import type { RelationRepository } from '../repos/relation-repository.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { AgentService } from './agent-service.js'
import type { TraitEngine } from './trait-engine.js'
import type { GrowthEngine } from './growth-engine.js'
import type { PostRepository } from '../repos/post-repository.js'
import type { CommentRepository } from '../repos/comment-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import { RelationEngine, type RelationPairStats } from './relation-engine.js'
import { RelationMetrics } from './relation-metrics.js'

const DAYS_7_MS = 7 * 24 * 60 * 60 * 1000
const ACTIVE_RELATION_STATES: RelationState[] = ['shadow', 'effective']

const LEVEL_CAPACITY: Record<number, number> = {
  1: 20,
  2: 40,
  3: 80,
  4: 120,
  5: 180,
}

export type PairRelationHint = 'none' | 'following' | 'follower' | 'friend' | 'blocked'

export interface RelationSignalInput {
  from_agent_id: string
  to_agent_id: string
  event_type: 'co_presence' | 'reciprocal_reply' | 'forum_reply' | 'room_message' | 'safety_warning' | 'safety_severe'
  source_type: string
  source_ref_id?: string | null
  idempotency_key: string
  payload?: Record<string, unknown>
}

export interface RelationServiceDeps {
  relationRepo: RelationRepository
  agentRepo: AgentRepository
  agentService: AgentService
  traitEngine?: TraitEngine | null
  growthEngine?: GrowthEngine | null
  postRepo?: PostRepository
  commentRepo?: CommentRepository
  roomRepo?: RoomRepository
  relationEngine?: RelationEngine
  metrics?: RelationMetrics
}

export interface RelationListItem {
  relation_id: string
  pair_agent_id: string
  direction: 'outgoing' | 'incoming' | 'mutual'
  state: RelationState
  relation_score: number
  interaction_score: number
  persona_score: number
  safety_score: number
  shadow_started_at: string | null
  effective_at: string | null
  blocked_at: string | null
  updated_at: string
}

export interface RelationListResult {
  items: RelationListItem[]
  next_cursor: string | null
}

export interface RelationSummary {
  following: { shadow: number; effective: number; inactive: number; blocked: number }
  followers: { shadow: number; effective: number; inactive: number; blocked: number }
  friends: number
}

export class RelationService {
  private readonly engine: RelationEngine
  private readonly metrics: RelationMetrics
  private readonly pairHintCache = new Map<string, PairRelationHint>()

  constructor(private readonly deps: RelationServiceDeps) {
    this.engine = deps.relationEngine ?? new RelationEngine()
    this.metrics = deps.metrics ?? new RelationMetrics()
  }

  getMetrics(): RelationMetrics {
    return this.metrics
  }

  getPairHintSync(fromAgentId: string, toAgentId: string): PairRelationHint {
    return this.pairHintCache.get(this.pairKey(fromAgentId, toAgentId)) ?? 'none'
  }

  async ingestSignal(input: RelationSignalInput): Promise<void> {
    if (input.from_agent_id === input.to_agent_id) return

    const severity = input.event_type === 'safety_severe'
      ? 'severe'
      : input.event_type === 'safety_warning'
        ? 'warning'
        : 'info'

    const eventResult = await this.deps.relationRepo.createEvent({
      from_agent_id: input.from_agent_id,
      to_agent_id: input.to_agent_id,
      event_type: input.event_type,
      severity,
      source_type: input.source_type,
      source_ref_id: input.source_ref_id ?? null,
      idempotency_key: input.idempotency_key,
      payload: input.payload ?? null,
    })

    if (eventResult.deduped) {
      this.metrics.markDedupHit()
      return
    }

    await this.evaluateAndPersist(input.from_agent_id, input.to_agent_id)
  }

  async onForumCommentEvent(event: DomainEvent): Promise<void> {
    if (!this.deps.postRepo || !this.deps.commentRepo) return
    const payload = event.payload_json
    if (event.event_type !== 'COMMENT_CREATED') return

    const commentId = typeof payload.comment_id === 'string' ? payload.comment_id : ''
    const postId = typeof payload.post_id === 'string' ? payload.post_id : ''
    const authorAgentId = typeof payload.author_agent_id === 'string' ? payload.author_agent_id : ''
    if (!commentId || !postId || !authorAgentId) return

    const [post, comment] = await Promise.all([
      this.deps.postRepo.findById(postId),
      this.deps.commentRepo.findById(commentId),
    ])
    if (!post || !comment) return

    if (post.author_agent_id !== authorAgentId) {
      await this.ingestSignal({
        from_agent_id: authorAgentId,
        to_agent_id: post.author_agent_id,
        event_type: 'forum_reply',
        source_type: 'forum_comment',
        source_ref_id: commentId,
        idempotency_key: `forum:${event.id}:post:${authorAgentId}:${post.author_agent_id}`,
        payload: { post_id: postId, comment_id: commentId },
      })
    }

    if (comment.parent_comment_id) {
      const parent = await this.deps.commentRepo.findById(comment.parent_comment_id)
      if (parent && parent.author_agent_id !== authorAgentId) {
        await this.ingestSignal({
          from_agent_id: authorAgentId,
          to_agent_id: parent.author_agent_id,
          event_type: 'reciprocal_reply',
          source_type: 'forum_comment',
          source_ref_id: commentId,
          idempotency_key: `forum:${event.id}:parent:${authorAgentId}:${parent.author_agent_id}`,
          payload: { post_id: postId, comment_id: commentId, parent_comment_id: parent.id },
        })
      }
    }
  }

  async onRoomMessage(roomId: string, messageId: string, authorAgentId: string): Promise<void> {
    if (!this.deps.roomRepo) return

    const members = await this.deps.roomRepo.getMembers(roomId)
    const now = Date.now()

    for (const member of members) {
      if (member.member_id === authorAgentId) continue

      await this.ingestSignal({
        from_agent_id: authorAgentId,
        to_agent_id: member.member_id,
        event_type: 'co_presence',
        source_type: 'room_message',
        source_ref_id: messageId,
        idempotency_key: `room:${roomId}:msg:${messageId}:co:${authorAgentId}:${member.member_id}`,
        payload: { room_id: roomId, message_id: messageId },
      })

      const lastSpokeMs = member.last_spoke_at ? member.last_spoke_at.getTime() : 0
      if (lastSpokeMs > now - DAYS_7_MS) {
        await this.ingestSignal({
          from_agent_id: authorAgentId,
          to_agent_id: member.member_id,
          event_type: 'reciprocal_reply',
          source_type: 'room_message',
          source_ref_id: messageId,
          idempotency_key: `room:${roomId}:msg:${messageId}:rr:${authorAgentId}:${member.member_id}`,
          payload: { room_id: roomId, message_id: messageId },
        })
      }
    }
  }

  async onPrivateDigestCompleted(_agentId: string, _sessionId: string): Promise<void> {
    // Private digest currently has no deterministic peer-agent anchor.
    // Keep this hook for pipeline completeness and future pair extraction.
  }

  async adminUnblock(fromAgentId: string, toAgentId: string, reason: string): Promise<AgentRelation | null> {
    const existing = await this.deps.relationRepo.getRelation(fromAgentId, toAgentId)
    if (!existing || existing.state !== 'blocked') return existing

    await this.deps.relationRepo.createEvent({
      from_agent_id: fromAgentId,
      to_agent_id: toAgentId,
      event_type: 'manual_unblock',
      severity: 'info',
      source_type: 'admin',
      source_ref_id: null,
      idempotency_key: `admin-unblock:${fromAgentId}:${toAgentId}:${Date.now()}`,
      payload: { reason },
    })

    const next = await this.deps.relationRepo.upsertRelation({
      from_agent_id: fromAgentId,
      to_agent_id: toAgentId,
      state: 'inactive',
      relation_score: existing.relation_score,
      interaction_score: existing.interaction_score,
      persona_score: existing.persona_score,
      safety_score: Math.max(existing.safety_score, 0.3),
      blocked_at: null,
      inactive_at: new Date(),
      last_state_changed_at: new Date(),
      last_evaluated_at: new Date(),
      expected_version: existing.version,
    })

    await this.refreshPairHints(fromAgentId, toAgentId)
    return next
  }

  async listRelations(
    agentId: string,
    opts: {
      view: RelationView
      state?: RelationState
      cursor?: string
      limit: number
    },
  ): Promise<RelationListResult> {
    const listOpts = { cursor: opts.cursor, limit: opts.limit }

    if (opts.view === 'friends') {
      const result = await this.deps.relationRepo.listMutualEffective(agentId, listOpts)
      return {
        items: result.items.map((item) => this.toViewItem(item, 'mutual', item.to_agent_id)),
        next_cursor: result.next_cursor,
      }
    }

    if (opts.view === 'following') {
      const result = await this.deps.relationRepo.listOutgoing(agentId, {
        ...listOpts,
        state: opts.state,
      })
      return {
        items: result.items.map((item) => this.toViewItem(item, 'outgoing', item.to_agent_id)),
        next_cursor: result.next_cursor,
      }
    }

    const result = await this.deps.relationRepo.listIncoming(agentId, {
      ...listOpts,
      state: opts.state,
    })
    return {
      items: result.items.map((item) => this.toViewItem(item, 'incoming', item.from_agent_id)),
      next_cursor: result.next_cursor,
    }
  }

  async getSummary(agentId: string): Promise<RelationSummary> {
    const states: RelationState[] = ['shadow', 'effective', 'inactive', 'blocked']

    const followingEntries = await Promise.all(states.map(async (state) => ({
      state,
      count: await this.deps.relationRepo.countOutgoingByStates(agentId, [state]),
    })))

    const followersEntries = await Promise.all(states.map(async (state) => ({
      state,
      count: await this.deps.relationRepo.countIncomingByStates(agentId, [state]),
    })))

    return {
      following: {
        shadow: byState(followingEntries, 'shadow'),
        effective: byState(followingEntries, 'effective'),
        inactive: byState(followingEntries, 'inactive'),
        blocked: byState(followingEntries, 'blocked'),
      },
      followers: {
        shadow: byState(followersEntries, 'shadow'),
        effective: byState(followersEntries, 'effective'),
        inactive: byState(followersEntries, 'inactive'),
        blocked: byState(followersEntries, 'blocked'),
      },
      friends: await this.deps.relationRepo.countMutualEffective(agentId),
    }
  }

  async reconcile(limit: number): Promise<{ scanned: number; updated: number }> {
    const rows = await this.deps.relationRepo.listRelationsByStates(['shadow', 'effective', 'inactive'], limit)
    let updated = 0

    for (const relation of rows) {
      const changed = await this.evaluateAndPersist(relation.from_agent_id, relation.to_agent_id, relation)
      if (changed) updated += 1
    }

    return { scanned: rows.length, updated }
  }

  private async evaluateAndPersist(
    fromAgentId: string,
    toAgentId: string,
    existingOverride?: AgentRelation,
  ): Promise<boolean> {
    const start = Date.now()
    const now = new Date()

    const existing = existingOverride ?? await this.deps.relationRepo.getRelation(fromAgentId, toAgentId)
    const [stats, personaScore, safetyScore] = await Promise.all([
      this.computePairStats(fromAgentId, toAgentId, now),
      this.computePersonaScore(fromAgentId, toAgentId),
      this.computeSafetyScore(fromAgentId, toAgentId),
    ])

    const capacityAllowed = await this.isCapacityAllowed(fromAgentId, existing)

    const evaluated = this.engine.evaluate({
      existing,
      stats,
      persona_score: personaScore,
      safety_score: safetyScore,
      capacity_allowed: capacityAllowed,
      now,
    })

    this.metrics.markEval(Date.now() - start)
    if (!evaluated.should_persist) {
      return false
    }

    const next = await this.deps.relationRepo.upsertRelation({
      from_agent_id: fromAgentId,
      to_agent_id: toAgentId,
      state: evaluated.next_state,
      relation_score: evaluated.relation_score,
      interaction_score: evaluated.interaction_score,
      persona_score: evaluated.persona_score,
      safety_score: evaluated.safety_score,
      shadow_started_at: evaluated.shadow_started_at,
      effective_at: evaluated.effective_at,
      inactive_at: evaluated.inactive_at,
      blocked_at: evaluated.blocked_at,
      below_threshold_since: evaluated.below_threshold_since,
      last_signal_at: now,
      last_interaction_at: evaluated.last_interaction_at,
      last_evaluated_at: now,
      last_state_changed_at: evaluated.last_state_changed_at,
      expected_version: existing?.version,
    })

    if (existing?.state !== next.state) {
      this.metrics.markStateTransition()
      if (next.state === 'blocked') {
        this.metrics.markBlock()
      }
    }

    await this.refreshPairHints(fromAgentId, toAgentId)
    return true
  }

  private async computePairStats(fromAgentId: string, toAgentId: string, now: Date): Promise<RelationPairStats> {
    const since7d = new Date(now.getTime() - DAYS_7_MS)
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [events7d, warning24h] = await Promise.all([
      this.deps.relationRepo.listPairEvents(fromAgentId, toAgentId, {
        since: since7d,
        limit: 500,
      }),
      this.deps.relationRepo.listPairEvents(fromAgentId, toAgentId, {
        since: since24h,
        severity: 'warning',
        limit: 100,
      }),
    ])

    const coPresenceCount = events7d.filter((e) => e.event_type === 'co_presence').length
    const reciprocalReplyCount = events7d.filter((e) => e.event_type === 'reciprocal_reply' || e.event_type === 'forum_reply').length
    const interactionCount = events7d.filter((e) => e.event_type !== 'safety_warning' && e.event_type !== 'safety_severe').length
    const warning7d = events7d.filter((e) => e.severity === 'warning').length
    const severe7d = events7d.filter((e) => e.severity === 'severe').length
    const lastInteraction = events7d
      .filter((e) => e.event_type !== 'safety_warning' && e.event_type !== 'safety_severe')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0]?.created_at ?? null

    return {
      co_presence_count: coPresenceCount,
      reciprocal_reply_count: reciprocalReplyCount,
      interaction_count_7d: interactionCount,
      warning_count_24h: warning24h.length,
      warning_count_7d: warning7d,
      severe_count_7d: severe7d,
      last_interaction_at: lastInteraction,
    }
  }

  private async computePersonaScore(fromAgentId: string, toAgentId: string): Promise<number> {
    const [traitScore, styleScore] = await Promise.all([
      this.computeTraitSimilarity(fromAgentId, toAgentId),
      this.computeStyleSimilarity(fromAgentId, toAgentId),
    ])

    return clamp01(traitScore * 0.6 + styleScore * 0.4)
  }

  private async computeTraitSimilarity(fromAgentId: string, toAgentId: string): Promise<number> {
    if (!this.deps.traitEngine) return 0.5

    const [fromTraits, toTraits] = await Promise.all([
      this.deps.traitEngine.getTraits(fromAgentId),
      this.deps.traitEngine.getTraits(toAgentId),
    ])

    const fromSet = new Set(fromTraits.filter((t) => t.status === 'equipped').map((t) => t.traitCode))
    const toSet = new Set(toTraits.filter((t) => t.status === 'equipped').map((t) => t.traitCode))

    if (fromSet.size === 0 && toSet.size === 0) return 0.5

    let overlap = 0
    for (const code of fromSet) {
      if (toSet.has(code)) overlap += 1
    }

    const union = new Set([...fromSet, ...toSet]).size
    return union > 0 ? overlap / union : 0.5
  }

  private async computeStyleSimilarity(fromAgentId: string, toAgentId: string): Promise<number> {
    let fromConfig: Record<string, unknown> = {}
    let toConfig: Record<string, unknown> = {}

    try {
      fromConfig = this.deps.agentService.getLatestConfig(fromAgentId)?.config_json ?? {}
    } catch {
      fromConfig = {}
    }
    try {
      toConfig = this.deps.agentService.getLatestConfig(toAgentId)?.config_json ?? {}
    } catch {
      toConfig = {}
    }

    const fromStyle = extractStyle(fromConfig)
    const toStyle = extractStyle(toConfig)

    const mood = fromStyle.mood && toStyle.mood && fromStyle.mood === toStyle.mood ? 1 : 0.4
    const formality = 1 - Math.min(1, Math.abs(fromStyle.formality - toStyle.formality) / 4)
    const verbosity = 1 - Math.min(1, Math.abs(fromStyle.verbosity - toStyle.verbosity) / 4)

    const habitsA = new Set(fromStyle.habits)
    const habitsB = new Set(toStyle.habits)
    let overlap = 0
    for (const item of habitsA) {
      if (habitsB.has(item)) overlap += 1
    }
    const habitUnion = new Set([...habitsA, ...habitsB]).size
    const habitScore = habitUnion > 0 ? overlap / habitUnion : 0.5

    return clamp01(mood * 0.25 + formality * 0.25 + verbosity * 0.25 + habitScore * 0.25)
  }

  private async computeSafetyScore(fromAgentId: string, toAgentId: string): Promise<number> {
    const from = this.deps.agentRepo.findById(fromAgentId)
    const to = this.deps.agentRepo.findById(toAgentId)
    if (!from || !to) return 0.2

    if (from.status === 'BANNED' || to.status === 'BANNED') return 0
    if (from.status === 'QUARANTINED' || to.status === 'QUARANTINED') return 0.2
    return 1
  }

  private async isCapacityAllowed(fromAgentId: string, existing: AgentRelation | null): Promise<boolean> {
    if (existing) return true

    const growth = this.deps.growthEngine
      ? await this.deps.growthEngine.getGrowth(fromAgentId).catch(() => ({ level: 1 }))
      : { level: 1 }

    const level = Math.max(1, Math.floor(growth.level ?? 1))
    const cap = level >= 5 ? LEVEL_CAPACITY[5] : LEVEL_CAPACITY[level] ?? LEVEL_CAPACITY[1]

    const activeCount = await this.deps.relationRepo.countOutgoingByStates(fromAgentId, ACTIVE_RELATION_STATES)
    return activeCount < cap
  }

  private async refreshPairHints(fromAgentId: string, toAgentId: string): Promise<void> {
    const [forward, reverse] = await Promise.all([
      this.deps.relationRepo.getRelation(fromAgentId, toAgentId),
      this.deps.relationRepo.getRelation(toAgentId, fromAgentId),
    ])

    this.setHint(fromAgentId, toAgentId, resolveHint(forward?.state, reverse?.state))
    this.setHint(toAgentId, fromAgentId, resolveHint(reverse?.state, forward?.state))
  }

  private toViewItem(
    relation: AgentRelation,
    direction: 'outgoing' | 'incoming' | 'mutual',
    pairAgentId: string,
  ): RelationListItem {
    return {
      relation_id: relation.id,
      pair_agent_id: pairAgentId,
      direction,
      state: relation.state,
      relation_score: relation.relation_score,
      interaction_score: relation.interaction_score,
      persona_score: relation.persona_score,
      safety_score: relation.safety_score,
      shadow_started_at: relation.shadow_started_at?.toISOString() ?? null,
      effective_at: relation.effective_at?.toISOString() ?? null,
      blocked_at: relation.blocked_at?.toISOString() ?? null,
      updated_at: relation.updated_at.toISOString(),
    }
  }

  private setHint(fromAgentId: string, toAgentId: string, hint: PairRelationHint): void {
    this.pairHintCache.set(this.pairKey(fromAgentId, toAgentId), hint)
  }

  private pairKey(fromAgentId: string, toAgentId: string): string {
    return `${fromAgentId}:${toAgentId}`
  }
}

function resolveHint(selfState?: RelationState, reverseState?: RelationState): PairRelationHint {
  if (selfState === 'blocked' || reverseState === 'blocked') return 'blocked'
  if (selfState === 'effective' && reverseState === 'effective') return 'friend'
  if (selfState === 'effective') return 'following'
  if (reverseState === 'effective') return 'follower'
  return 'none'
}

function extractStyle(config: Record<string, unknown>): {
  mood: string
  formality: number
  verbosity: number
  habits: string[]
} {
  const style = (config.style as Record<string, unknown> | undefined) ?? {}
  const habits = Array.isArray(style.habits)
    ? style.habits.filter((h): h is string => typeof h === 'string').map((h) => h.toLowerCase())
    : []

  return {
    mood: typeof style.mood === 'string' ? style.mood : 'neutral',
    formality: typeof style.formality === 'number' ? style.formality : 3,
    verbosity: typeof style.verbosity === 'number' ? style.verbosity : 3,
    habits,
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

function byState(
  entries: Array<{ state: RelationState; count: number }>,
  state: RelationState,
): number {
  return entries.find((entry) => entry.state === state)?.count ?? 0
}
