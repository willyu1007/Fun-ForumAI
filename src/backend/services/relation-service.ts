import type {
  DomainEvent,
  RelationState,
  RelationView,
  AgentRelation,
  RelationStateChangeTrigger,
} from '../repos/types.js'
import type { RelationRepository } from '../repos/relation-repository.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { AgentService } from './agent-service.js'
import type { TraitEngine } from './trait-engine.js'
import type { PostRepository } from '../repos/post-repository.js'
import type { PublicStageThreadRepository } from '../repos/public-stage-thread-repository.js'
import type { PublicStageTurnRepository } from '../repos/public-stage-turn-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { StatsService } from './stats-service.js'
import { RelationEngine, type RelationPairStats } from './relation-engine.js'
import { RelationMetrics } from './relation-metrics.js'
import { buildRelationStateChangedEventTemplate } from './relation-domain-event.js'
import { config } from '../lib/config.js'
import { LruMap } from '../lib/lru-map.js'
import {
  findPublicStageThreadTurnById,
  type PublicStageThreadTurnDeps,
} from '../lib/public-stage-thread-turn.js'

const DAYS_7_MS = 7 * 24 * 60 * 60 * 1000
const ACTIVE_RELATION_STATES: RelationState[] = ['shadow', 'effective']
const RELATION_CAPACITY = 180

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
  postRepo?: PostRepository
  publicStageThreadRepo?: PublicStageThreadRepository
  publicStageTurnRepo?: PublicStageTurnRepository
  roomRepo?: RoomRepository
  messageRepo?: MessageRepository
  statsService?: StatsService | null
  relationEngine?: RelationEngine
  metrics?: RelationMetrics
  onStateChanged?: (input: {
    from_agent_id: string
    to_agent_id: string
    previous_state: RelationState | null
    next_state: RelationState
    relation_id: string
  }) => Promise<void> | void
  onDomainEventCreated?: (event: DomainEvent) => Promise<void> | void
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
  private readonly pairHintCache = new LruMap<string, PairRelationHint>(10_000)

  constructor(private readonly deps: RelationServiceDeps) {
    this.engine = deps.relationEngine ?? new RelationEngine()
    this.metrics = deps.metrics ?? new RelationMetrics()
  }

  setStateChangeHook(
    hook: (input: {
      from_agent_id: string
      to_agent_id: string
      previous_state: RelationState | null
      next_state: RelationState
      relation_id: string
    }) => Promise<void> | void,
  ): void {
    this.deps.onStateChanged = hook
  }

  setDomainEventCreatedHook(hook: (event: DomainEvent) => Promise<void> | void): void {
    this.deps.onDomainEventCreated = hook
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

    await this.evaluateAndPersist(input.from_agent_id, input.to_agent_id, undefined, {
      trigger: 'signal_ingest',
      relation_event_id: eventResult.event.id,
    })
  }

  async onForumStageEvent(event: DomainEvent): Promise<void> {
    if (!this.deps.postRepo || !this.deps.publicStageThreadRepo || !this.deps.publicStageTurnRepo) return
    const threadTurnDeps = this.getThreadTurnDeps()
    if (!threadTurnDeps) return
    const payload = event.payload_json
    if (event.event_type !== 'THREAD_OPENED' && event.event_type !== 'THREAD_TURN_ADDED') return

    const entryId = event.event_type === 'THREAD_TURN_ADDED'
      ? typeof payload.turn_id === 'string'
        ? payload.turn_id
        : typeof payload.thread_id === 'string'
          ? payload.thread_id
          : ''
      : typeof payload.thread_id === 'string'
        ? payload.thread_id
        : ''
    const postId = typeof payload.post_id === 'string' ? payload.post_id : ''
    const authorAgentId = typeof payload.author_agent_id === 'string' ? payload.author_agent_id : ''
    if (!entryId || !postId || !authorAgentId) return

    const [post, entry] = await Promise.all([
      this.deps.postRepo.findById(postId),
      findPublicStageThreadTurnById(threadTurnDeps, entryId),
    ])
    if (!post || !entry) return

    if (entry.entry_kind === 'THREAD' && post.author_agent_id !== authorAgentId) {
      await this.ingestSignal({
        from_agent_id: authorAgentId,
        to_agent_id: post.author_agent_id,
        event_type: 'forum_reply',
        source_type: 'forum_thread',
        source_ref_id: entryId,
        idempotency_key: `forum:${event.id}:post:${authorAgentId}:${post.author_agent_id}`,
        payload: { post_id: postId, thread_id: entryId },
      })
    }

    if (entry.entry_kind === 'TURN' && entry.thread_id) {
      const thread = await findPublicStageThreadTurnById(threadTurnDeps, entry.thread_id)
      if (thread?.author_agent_id && thread.author_agent_id !== authorAgentId) {
        await this.ingestSignal({
          from_agent_id: authorAgentId,
          to_agent_id: thread.author_agent_id,
          event_type: 'forum_reply',
          source_type: 'forum_turn',
          source_ref_id: entryId,
          idempotency_key: `forum:${event.id}:thread:${authorAgentId}:${thread.author_agent_id}`,
          payload: { post_id: postId, thread_id: thread.id, turn_id: entryId },
        })
      }
    }

    if (entry.entry_kind === 'TURN' && entry.anchor_turn_id) {
      const anchor = await findPublicStageThreadTurnById(threadTurnDeps, entry.anchor_turn_id)
      if (anchor?.author_agent_id && anchor.author_agent_id !== authorAgentId) {
        await this.ingestSignal({
          from_agent_id: authorAgentId,
          to_agent_id: anchor.author_agent_id,
          event_type: 'reciprocal_reply',
          source_type: 'forum_turn',
          source_ref_id: entryId,
          idempotency_key: `forum:${event.id}:anchor:${authorAgentId}:${anchor.author_agent_id}`,
          payload: {
            post_id: postId,
            thread_id: entry.thread_id,
            turn_id: entryId,
            anchor_turn_id: anchor.id,
          },
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

  async onVoteEvent(event: DomainEvent): Promise<void> {
    const payload = event.payload_json
    const voterAgentId = typeof payload.voter_agent_id === 'string' ? payload.voter_agent_id : ''
    const targetType = typeof payload.target_type === 'string' ? payload.target_type : ''
    const targetId = typeof payload.target_id === 'string' ? payload.target_id : ''
    const direction = typeof payload.direction === 'string' ? payload.direction : ''

    if (!voterAgentId || !targetType || !targetId || !direction) return

    let targetAgentId = ''
    if (targetType === 'POST' && this.deps.postRepo) {
      const post = await this.deps.postRepo.findById(targetId)
      targetAgentId = post?.author_agent_id ?? ''
    } else if ((targetType === 'THREAD' || targetType === 'TURN') && this.deps.publicStageThreadRepo && this.deps.publicStageTurnRepo) {
      const threadTurnDeps = this.getThreadTurnDeps()
      if (!threadTurnDeps) return
      const entry = await findPublicStageThreadTurnById(threadTurnDeps, targetId)
      targetAgentId = entry?.entry_kind === targetType ? entry.author_agent_id ?? '' : ''
    } else if (targetType === 'MESSAGE' && this.deps.messageRepo) {
      const message = await this.deps.messageRepo.findById(targetId)
      targetAgentId = message?.author_id ?? ''
    }

    if (!targetAgentId || targetAgentId === voterAgentId) return

    let repeat = 1
    if (config.launch.capabilities.agentStatsVotePolicy && this.deps.statsService) {
      const voteKnobs = this.deps.statsService.getDerivedSync(voterAgentId).vote
      if (direction === 'DOWN' && voteKnobs.p_down_given_vote > 0.7) {
        repeat = 2
      } else if (direction === 'UP' && voteKnobs.p_vote > 0.7) {
        repeat = 2
      }
    }

    const signalType = direction === 'DOWN' ? 'safety_warning' : 'forum_reply'
    for (let i = 0; i < repeat; i++) {
      await this.ingestSignal({
        from_agent_id: voterAgentId,
        to_agent_id: targetAgentId,
        event_type: signalType,
        source_type: 'vote_cast',
        source_ref_id: targetId,
        idempotency_key: `vote:${event.id}:${i}:${voterAgentId}:${targetAgentId}:${direction}`,
        payload: {
          target_type: targetType,
          target_id: targetId,
          direction,
        },
      })
    }
  }

  async onPrivateDigestCompleted(_agentId: string, _sessionId: string): Promise<void> {
    // Private digest currently has no deterministic peer-agent anchor.
    // Keep this hook for pipeline completeness and future pair extraction.
  }

  async adminUnblock(fromAgentId: string, toAgentId: string, reason: string): Promise<AgentRelation | null> {
    const existing = await this.deps.relationRepo.getRelation(fromAgentId, toAgentId)
    if (!existing || existing.state !== 'blocked') return existing
    const reverse = await this.deps.relationRepo.getRelation(toAgentId, fromAgentId)

    const eventInput = {
      from_agent_id: fromAgentId,
      to_agent_id: toAgentId,
      event_type: 'manual_unblock' as const,
      severity: 'info' as const,
      source_type: 'admin',
      source_ref_id: null,
      idempotency_key: `admin-unblock:${fromAgentId}:${toAgentId}:${Date.now()}`,
      payload: { reason },
    }

    const relationInput = {
      from_agent_id: fromAgentId,
      to_agent_id: toAgentId,
      state: 'inactive' as const,
      relation_score: existing.relation_score,
      interaction_score: existing.interaction_score,
      persona_score: existing.persona_score,
      safety_score: Math.max(existing.safety_score, 0.3),
      blocked_at: null,
      inactive_at: new Date(),
      last_state_changed_at: new Date(),
      last_evaluated_at: new Date(),
      expected_version: existing.version,
    }

    const result = await this.deps.relationRepo.persistStateChangeTx({
      relation_input: relationInput,
      relation_event_input: eventInput,
      domain_event_template: buildRelationStateChangedEventTemplate({
        from_agent_id: fromAgentId,
        to_agent_id: toAgentId,
        previous_state: existing.state,
        next_state: relationInput.state,
        reverse_state_before: reverse?.state ?? null,
        next_relation_version: existing.version + 1,
        source: {
          trigger: 'admin_unblock',
        },
        scores: {
          relation_score: relationInput.relation_score,
          interaction_score: relationInput.interaction_score,
          persona_score: relationInput.persona_score,
          safety_score: relationInput.safety_score,
        },
      }),
    })

    if (result.applied) {
      this.metrics.markStateTransition()
    }

    await this.refreshPairHints(fromAgentId, toAgentId)
    if (result.domain_event_status === 'created' && result.domain_event) {
      this.emitPostCommitStateChange({
        event: result.domain_event,
        previous_state: existing.state,
        next_state: result.relation.state,
        relation_id: result.relation.id,
        from_agent_id: fromAgentId,
        to_agent_id: toAgentId,
      })
    }

    return result.relation
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
      const changed = await this.evaluateAndPersist(relation.from_agent_id, relation.to_agent_id, relation, {
        trigger: 'reconcile',
      })
      if (changed) updated += 1
    }

    return { scanned: rows.length, updated }
  }

  private async evaluateAndPersist(
    fromAgentId: string,
    toAgentId: string,
    existingOverride?: AgentRelation,
    context: {
      trigger: RelationStateChangeTrigger
      relation_event_id?: string | null
    } = { trigger: 'signal_ingest' },
  ): Promise<boolean> {
    const start = Date.now()
    const now = new Date()

    const existing = existingOverride ?? await this.deps.relationRepo.getRelation(fromAgentId, toAgentId)
    let [stats, personaScore] = await Promise.all([
      this.computePairStats(fromAgentId, toAgentId, now),
      this.computePersonaScore(fromAgentId, toAgentId),
    ])
    const safetyScore = await this.computeSafetyScore(fromAgentId, toAgentId)

    if (config.launch.capabilities.agentStatsRelationPolicy && this.deps.statsService) {
      const knobs = this.deps.statsService.getDerivedSync(fromAgentId).relation_policy
      stats = applyRelationPolicyToPairStats(stats, {
        pos_multiplier: knobs.pos_multiplier,
        neg_multiplier: knobs.neg_multiplier,
      })
      personaScore = clamp01(personaScore * (0.9 + 0.2 * clamp01((knobs.challenge_valence + 1) / 2)))
    }

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

    const relationInput = {
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
    }

    const previousState = existing?.state ?? null
    let next: AgentRelation
    let emittedEvent: DomainEvent | null = null
    let changed = false

    if (previousState !== evaluated.next_state) {
      const reverse = await this.deps.relationRepo.getRelation(toAgentId, fromAgentId)
      const txResult = await this.deps.relationRepo.persistStateChangeTx({
        relation_input: relationInput,
        domain_event_template: buildRelationStateChangedEventTemplate({
          from_agent_id: fromAgentId,
          to_agent_id: toAgentId,
          previous_state: previousState,
          next_state: evaluated.next_state,
          reverse_state_before: reverse?.state ?? null,
          next_relation_version: (existing?.version ?? 0) + 1,
          source: {
            trigger: context.trigger,
            relation_event_id: context.relation_event_id ?? null,
          },
          scores: {
            relation_score: evaluated.relation_score,
            interaction_score: evaluated.interaction_score,
            persona_score: evaluated.persona_score,
            safety_score: evaluated.safety_score,
          },
        }),
      })
      next = txResult.relation
      changed = txResult.domain_event_status === 'created'
      if (txResult.domain_event_status === 'created') {
        emittedEvent = txResult.domain_event
      }
      if (txResult.domain_event_status === 'created' && txResult.applied) {
        this.metrics.markStateTransition()
        if (next.state === 'blocked') {
          this.metrics.markBlock()
        }
      }
    } else {
      next = await this.deps.relationRepo.upsertRelation(relationInput)
      changed = true
    }

    await this.refreshPairHints(fromAgentId, toAgentId)
    if (emittedEvent) {
      this.emitPostCommitStateChange({
        event: emittedEvent,
        previous_state: previousState,
        next_state: next.state,
        relation_id: next.id,
        from_agent_id: fromAgentId,
        to_agent_id: toAgentId,
      })
    }
    return changed
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
    const [fromConfig, toConfig] = await Promise.all([
      this.getSafeAgentConfig(fromAgentId),
      this.getSafeAgentConfig(toAgentId),
    ])

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

  private async getSafeAgentConfig(agentId: string): Promise<Record<string, unknown>> {
    try {
      return this.deps.agentService.getLatestConfig(agentId)?.config_json ?? {}
    } catch {
      try {
        return (await this.deps.agentService.getLatestConfigPersisted(agentId))?.config_json ?? {}
      } catch {
        return {}
      }
    }
  }

  private async computeSafetyScore(fromAgentId: string, toAgentId: string): Promise<number> {
    let from = this.deps.agentRepo.findById(fromAgentId)
    let to = this.deps.agentRepo.findById(toAgentId)
    if ((!from || !to) && this.deps.agentRepo.refreshPersisted) {
      await this.deps.agentRepo.refreshPersisted()
      from = from ?? this.deps.agentRepo.findById(fromAgentId)
      to = to ?? this.deps.agentRepo.findById(toAgentId)
    }
    if (!from || !to) return 0.2

    if (from.status === 'BANNED' || to.status === 'BANNED') return 0
    if (from.status === 'QUARANTINED' || to.status === 'QUARANTINED') return 0.2
    return 1
  }

  private async isCapacityAllowed(fromAgentId: string, existing: AgentRelation | null): Promise<boolean> {
    if (existing) return true

    const activeCount = await this.deps.relationRepo.countOutgoingByStates(fromAgentId, ACTIVE_RELATION_STATES)
    return activeCount < RELATION_CAPACITY
  }

  private async refreshPairHints(fromAgentId: string, toAgentId: string): Promise<{
    forward: AgentRelation | null
    reverse: AgentRelation | null
  }> {
    const [forward, reverse] = await Promise.all([
      this.deps.relationRepo.getRelation(fromAgentId, toAgentId),
      this.deps.relationRepo.getRelation(toAgentId, fromAgentId),
    ])

    this.setHint(fromAgentId, toAgentId, resolveHint(forward?.state, reverse?.state))
    this.setHint(toAgentId, fromAgentId, resolveHint(reverse?.state, forward?.state))
    return { forward, reverse }
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

  private getThreadTurnDeps(): PublicStageThreadTurnDeps | null {
    if (!this.deps.publicStageThreadRepo || !this.deps.publicStageTurnRepo) {
      return null
    }

    return {
      publicStageThreadRepo: this.deps.publicStageThreadRepo,
      publicStageTurnRepo: this.deps.publicStageTurnRepo,
    }
  }

  private pairKey(fromAgentId: string, toAgentId: string): string {
    return `${fromAgentId}:${toAgentId}`
  }

  private emitPostCommitStateChange(input: {
    event: DomainEvent
    from_agent_id: string
    to_agent_id: string
    previous_state: RelationState | null
    next_state: RelationState
    relation_id: string
  }): void {
    if (this.deps.onDomainEventCreated) {
      Promise.resolve(this.deps.onDomainEventCreated(input.event)).catch((hookError) => {
        console.error('[RelationService] domain-event hook failed:', hookError)
      })
    }

    if (this.deps.onStateChanged) {
      Promise.resolve(this.deps.onStateChanged({
        from_agent_id: input.from_agent_id,
        to_agent_id: input.to_agent_id,
        previous_state: input.previous_state,
        next_state: input.next_state,
        relation_id: input.relation_id,
      })).catch((hookError) => {
        console.error('[RelationService] state-change hook failed:', hookError)
      })
    }
  }
}

function resolveHint(selfState?: RelationState, reverseState?: RelationState): PairRelationHint {
  if (selfState === 'blocked' || reverseState === 'blocked') return 'blocked'
  if (selfState === 'effective' && reverseState === 'effective') return 'friend'
  if (selfState === 'effective') return 'following'
  if (reverseState === 'effective') return 'follower'
  return 'none'
}

function applyRelationPolicyToPairStats(
  stats: RelationPairStats,
  policy: { pos_multiplier: number; neg_multiplier: number },
): RelationPairStats {
  const pos = Math.max(0.8, policy.pos_multiplier)
  const neg = Math.max(0.8, policy.neg_multiplier)
  return {
    ...stats,
    co_presence_count: Math.round(stats.co_presence_count * pos),
    reciprocal_reply_count: Math.round(stats.reciprocal_reply_count * pos),
    interaction_count_7d: Math.round(stats.interaction_count_7d * pos),
    warning_count_24h: Math.round(stats.warning_count_24h * neg),
    warning_count_7d: Math.round(stats.warning_count_7d * neg),
    severe_count_7d: Math.round(stats.severe_count_7d * Math.max(1, neg * 0.5)),
  }
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
