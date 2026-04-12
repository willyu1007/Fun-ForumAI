import type {
  CandidateSelector,
  EventPayload,
  AgentCandidate,
  ScoredCandidate,
  DegradationState,
  GraphRelevanceProvider,
  CastingDirectorPolicy,
  CastingDirectorCommunityConfig,
  ForumAttentionInputBundle,
  ForumAttentionHint,
  ForumBaselineFallbackReason,
  ForumSelectionPath,
} from './types.js'
import type { AllocatorConfig } from './config.js'
import { deriveTopicKey } from './ppr-topic-key.js'
import { runtimeFeatureMetrics } from '../runtime/runtime-feature-metrics.js'
import type { AttentionOpportunityBroker } from '../services/attention-opportunity-broker.js'
import type { RecallPolicyService } from '../services/recall-policy-service.js'
import type { AttentionOpportunity } from '../../shared/forum-orchestration.js'

const PPR_SCORE_SCALE = 2

export interface DefaultCandidateSelectorDeps {
  graphRelevanceProvider?: GraphRelevanceProvider
  castingDirectorPolicy?: CastingDirectorPolicy
  pprEnabled?: boolean
  directorEnabled?: boolean
  directorV2Enabled?: boolean
  resolveCommunityDirectorConfig?: (communityId: string) => CastingDirectorCommunityConfig | undefined
  attentionOpportunityBroker?: Pick<AttentionOpportunityBroker, 'discover' | 'discoverFromEvent'>
  recallPolicyService?: Pick<RecallPolicyService, 'evaluate'>
  resolveAttentionInputBundle?: (event: EventPayload) => Promise<ForumAttentionInputBundle | null>
  forumOrchestrationFlags?: {
    shadow: boolean
    selectionCutover: boolean
  }
}

/**
 * Rules-based candidate selection (MVP).
 *
 * Pipeline:
 *   1. Hard filters  (status, author-self, cooldown, budget)
 *   2. Scoring       (tag overlap, community membership, thread dedup penalty, noise)
 *   3. Sort + take   top-K where K = quota
 */
export class DefaultCandidateSelector implements CandidateSelector {
  private readonly threadSelectionHistory = new Map<string, Array<{ agent_id: string; at: number }>>()

  constructor(
    private readonly cfg: AllocatorConfig,
    private readonly deps: DefaultCandidateSelectorDeps = {},
  ) {}

  async select(
    event: EventPayload,
    candidates: AgentCandidate[],
    quota: number,
    degradation: DegradationState,
  ): Promise<ScoredCandidate[]> {
    if (quota <= 0) return []

    const eventTags = this.extractTags(event)
    const topicKey = deriveTopicKey(event.tags)
    const now = Date.now()
    const communityDirectorConfig = this.deps.resolveCommunityDirectorConfig?.(event.community_id)
    const runtimeGate = communityDirectorConfig?.runtime ?? {
      cooldown_seconds: this.cfg.cooldownSeconds,
      max_actions_per_hour: this.cfg.maxActionsPerHour,
      max_tokens_per_day: this.cfg.maxTokensPerDay,
      thread_max_agents: this.cfg.defaultThreadMaxAgents,
    }
    const sourceAgentId = event.author_agent_id
    const pprSnapshot = this.deps.pprEnabled && this.deps.graphRelevanceProvider
      && sourceAgentId
      ? this.deps.graphRelevanceProvider.getSnapshot({
          source_agent_id: sourceAgentId,
          community_id: event.community_id,
          topic_key: topicKey,
          now: new Date(now),
        })
      : []
    if (this.deps.pprEnabled) {
      runtimeFeatureMetrics.recordPpr(pprSnapshot.length > 0)
    }
    const pprScoreByAgent = new Map(
      pprSnapshot.map((row) => [row.candidate_agent_id, row.ppr_score] as const),
    )

    const scored: ScoredCandidate[] = []

    for (const c of candidates) {
      const reasons: string[] = []

      if (c.status !== 'active') {
        continue
      }
      if (sourceAgentId && c.agent_id === sourceAgentId) {
        continue
      }
      if (c.actions_last_hour >= runtimeGate.max_actions_per_hour) {
        continue
      }
      if (c.tokens_last_day >= runtimeGate.max_tokens_per_day) {
        continue
      }
      if (c.last_action_at) {
        const elapsed = (now - new Date(c.last_action_at).getTime()) / 1000
        if (elapsed < runtimeGate.cooldown_seconds) {
          continue
        }
      }

      let score = 0

      const tagOverlap = c.tags.filter((t) => eventTags.has(t)).length
      score += tagOverlap * 2
      if (tagOverlap > 0) reasons.push(`tag_overlap=${tagOverlap}`)

      const isMember = c.community_ids.includes(event.community_id)
      if (isMember) {
        score += 3
        reasons.push('community_member(explicit)')
      }

      if (event.post_id && c.recent_thread_post_ids.includes(event.post_id)) {
        if (c.recent_thread_post_ids.length >= runtimeGate.thread_max_agents) {
          continue
        }
        score -= 1
        reasons.push('thread_repeat_penalty')
      }

      if (c.stats_hint) {
        const participation = clamp(c.stats_hint.participation_multiplier, 0, 2)
        score *= participation
        reasons.push(`stats_participation=${participation.toFixed(2)}`)

        const controversy = clamp(toNumber(event.controversy_score), 0, 1)
        if (controversy > 0) {
          const appetite = clamp(c.stats_hint.controversy_appetite, 0, 1)
          score += (appetite - 0.5) * controversy * 2
          reasons.push(`stats_controversy=${appetite.toFixed(2)}`)
        }
      }

      if (degradation.level === 'normal') {
        const noiseScale = clamp(c.stats_hint?.exploration_noise_scale ?? 0.5, 0.2, 0.9)
        score += Math.random() * noiseScale
        reasons.push('exploration_noise')
      }

      if (this.deps.pprEnabled && pprScoreByAgent.size > 0) {
        const pprScore = pprScoreByAgent.get(c.agent_id)
        if (typeof pprScore === 'number' && Number.isFinite(pprScore) && pprScore > 0) {
          const pprBonus = clamp(pprScore * PPR_SCORE_SCALE, 0, PPR_SCORE_SCALE)
          score += pprBonus
          reasons.push(`ppr_bonus=${pprBonus.toFixed(3)}`)
        }
      }

      if (c.relation_hint_to_author) {
        if (c.relation_hint_to_author === 'blocked') {
          continue
        }

        const relationBonus = relationHintBonus(c.relation_hint_to_author)
        const normalizedBase = clamp01(score / 10)
        score = clamp01(normalizedBase * 0.8 + relationBonus * 0.2) * 10
        reasons.push(`relation_hint=${c.relation_hint_to_author}`)
      }

      scored.push({ agent_id: c.agent_id, score, reasons })
    }

    scored.sort((a, b) => b.score - a.score)
    const topScored = scored.slice(0, quota)

    let directorCandidates = this.deps.directorV2Enabled
      ? this.applyDirectorGuards(event, scored, now, communityDirectorConfig)
      : scored
    directorCandidates = await this.applyForumOrchestration({
      event,
      quota,
      candidates: directorCandidates,
      legacyTop: topScored,
    })

    const selected = this.deps.directorEnabled && quota > 2 && this.deps.castingDirectorPolicy
      ? this.deps.castingDirectorPolicy.select({
          event,
          scored: directorCandidates,
          quota,
          community_config: communityDirectorConfig,
        })
      : directorCandidates.slice(0, quota)

    if (this.deps.directorEnabled && quota > 2 && this.deps.castingDirectorPolicy) {
      const roleReasons = selected
        .flatMap((item) => item.reasons)
        .filter((reason) => reason.startsWith('director_role='))
      runtimeFeatureMetrics.recordDirectorRoles(roleReasons)
    }

    if (this.deps.directorV2Enabled && event.post_id) {
      this.recordThreadSelections(event.post_id, selected, now)
    }

    return selected
  }

  private async applyForumOrchestration(input: {
    event: EventPayload
    quota: number
    candidates: ScoredCandidate[]
    legacyTop: ScoredCandidate[]
  }): Promise<ScoredCandidate[]> {
    if (!isForumSelectionEvent(input.event)) {
      return input.candidates
    }

    if (!this.deps.attentionOpportunityBroker || !this.deps.recallPolicyService) {
      runtimeFeatureMetrics.recordForumSelectionPath('legacy_baseline')
      return annotateCandidatesWithAttentionHint(input.candidates, {
        opportunity: null,
        selection_path: 'legacy_baseline',
        fallback_reason: null,
      })
    }

    try {
      const attentionBundle = input.event.post_id
        ? await this.deps.resolveAttentionInputBundle?.(input.event) ?? null
        : null
      const selectionEnabled = Boolean(attentionBundle?.effective_orchestration_policy?.cutover.selection_enabled)
      const selectionCutover =
        Boolean(this.deps.forumOrchestrationFlags?.selectionCutover)
        && selectionEnabled
      const opportunities = attentionBundle
        ? this.deps.attentionOpportunityBroker.discover({
            event: input.event,
            post_capsule: attentionBundle.post_capsule,
            thread_capsule: attentionBundle.thread_capsule,
            forest: attentionBundle.forest,
            effective_orchestration_policy: attentionBundle.effective_orchestration_policy,
            watch_telemetry_snapshot: attentionBundle.watch_telemetry_snapshot,
            scored_candidates: input.candidates,
          })
        : this.deps.attentionOpportunityBroker.discoverFromEvent({
            event: input.event,
            scored_candidates: input.candidates,
          })
      const [opportunity] = opportunities
      if (!opportunity) {
        const selectionPath: ForumSelectionPath = selectionCutover
          ? 'selection_no_opportunity_baseline'
          : 'selection_cutover_disabled_baseline'
        runtimeFeatureMetrics.recordForumSelectionPath(selectionPath)
        return annotateCandidatesWithAttentionHint(input.candidates, {
          opportunity: null,
          selection_path: selectionPath,
          fallback_reason: null,
        })
      }

      const boosted = input.candidates.map((candidate) => {
        if (!opportunity.priority_agent_ids.includes(candidate.agent_id)) {
          return candidate
        }
        return {
          ...candidate,
          score: candidate.score + 1.25,
          reasons: [...candidate.reasons, `attention_opportunity=${opportunity.source.toLowerCase()}`],
        }
      })
      const evaluation = await this.deps.recallPolicyService.evaluate({
        event: input.event,
        opportunity,
        candidates: boosted,
        policy: attentionBundle?.effective_orchestration_policy ?? null,
      })
      const granted = annotateCandidatesWithAttentionHint(evaluation.granted, {
        opportunity,
        selection_path: selectionCutover
          ? 'selection_cutover_granted'
          : 'selection_cutover_disabled_baseline',
        fallback_reason: null,
      })
      const shadowEnabled =
        this.deps.forumOrchestrationFlags?.shadow
        || Boolean(attentionBundle?.effective_orchestration_policy?.compare_debug.shadow_enabled)
      const recordMetrics = attentionBundle?.effective_orchestration_policy?.compare_debug.record_metrics ?? true

      if (recordMetrics) {
        runtimeFeatureMetrics.recordForumOrchestrationSelection({
          late_entry_ratio: opportunity.post_attention_state?.late_entry_share_recent ?? 0,
          dominant_thread_share: opportunity.post_attention_state?.dominant_thread_share ?? 0,
          branch_entropy: opportunity.post_attention_state?.branch_entropy ?? 0,
          duel_risk: opportunity.post_attention_state?.duel_risk ?? 0,
          newcomer_share: opportunity.post_attention_state?.newcomer_share_recent ?? 0,
          recall_diversity: granted.length > 0
            ? new Set(granted.map((candidate) => candidate.agent_id)).size / granted.length
            : 0,
          same_pair_exchange_rate: evaluation.decisions.length > 0
            ? evaluation.decisions.filter((decision) => decision.suppression_reason === 'pair_window_cap').length / evaluation.decisions.length
            : 0,
          selection_cutover: selectionCutover,
        })
      }

      if (shadowEnabled) {
        runtimeFeatureMetrics.recordForumOrchestrationShadow(overlapRatio(
          input.legacyTop.slice(0, input.quota).map((candidate) => candidate.agent_id),
          granted.slice(0, input.quota).map((candidate) => candidate.agent_id),
        ))
      }

      if (!selectionCutover) {
        runtimeFeatureMetrics.recordForumSelectionPath('selection_cutover_disabled_baseline')
        return annotateCandidatesWithAttentionHint(input.candidates, {
          opportunity,
          selection_path: 'selection_cutover_disabled_baseline',
          fallback_reason: null,
        })
      }
      if (granted.length > 0) {
        runtimeFeatureMetrics.recordForumSelectionPath('selection_cutover_granted')
        return granted
      }
      if (attentionBundle?.effective_orchestration_policy?.cutover.fallback_to_baseline ?? true) {
        return this.returnForumSelectionFallback({
          event: input.event,
          candidates: input.candidates,
          opportunity,
          fallback_reason: 'allocator_empty_granted_fallback',
        })
      }
      return []
    } catch {
      if (this.deps.forumOrchestrationFlags?.selectionCutover || this.deps.forumOrchestrationFlags?.shadow) {
        return this.returnForumSelectionFallback({
          event: input.event,
          candidates: input.candidates,
          opportunity: null,
          fallback_reason: 'allocator_selection_fallback',
        })
      }
      return input.candidates
    }
  }

  private returnForumSelectionFallback(input: {
    event: EventPayload
    candidates: ScoredCandidate[]
    opportunity: AttentionOpportunity | null
    fallback_reason: ForumBaselineFallbackReason
  }): ScoredCandidate[] {
    runtimeFeatureMetrics.recordForumBaselineFallback({
      stage: 'allocator',
      selection_path: 'selection_fallback_baseline',
      fallback_reason: input.fallback_reason,
      event_type: input.event.event_type,
      post_id: input.event.post_id ?? null,
      thread_id: input.event.thread_id ?? null,
      opportunity_id: input.opportunity?.id ?? null,
    })
    return annotateCandidatesWithAttentionHint(input.candidates, {
      opportunity: input.opportunity,
      selection_path: 'selection_fallback_baseline',
      fallback_reason: input.fallback_reason,
    })
  }

  private extractTags(event: EventPayload): Set<string> {
    if (Array.isArray(event.tags)) {
      return new Set(event.tags.filter((tag): tag is string => typeof tag === 'string'))
    }
    return new Set()
  }

  private applyDirectorGuards(
    event: EventPayload,
    scored: ScoredCandidate[],
    now: number,
    communityConfig?: CastingDirectorCommunityConfig,
  ): ScoredCandidate[] {
    if (!event.post_id) return scored

    const guard = communityConfig?.guard ?? {
      contrast_min_relevance_ratio: 0.45,
      wildcard_min_relevance_ratio: 0.35,
      min_abs_score: 0.8,
      thread_window: 6,
      thread_max_agent_occurrences: 2,
      thread_cooldown_seconds: 600,
    }

    const history = this.getThreadHistory(event.post_id, now)
    const recent = history.slice(-guard.thread_window)
    const counts = new Map<string, number>()
    for (const item of recent) {
      counts.set(item.agent_id, (counts.get(item.agent_id) ?? 0) + 1)
    }

    const lastSpokeAt = new Map<string, number>()
    for (const item of history) {
      lastSpokeAt.set(item.agent_id, Math.max(lastSpokeAt.get(item.agent_id) ?? 0, item.at))
    }

    const filtered: ScoredCandidate[] = []
    for (const candidate of scored) {
      const selectedInRecent = counts.get(candidate.agent_id) ?? 0
      if (selectedInRecent >= guard.thread_max_agent_occurrences) {
        runtimeFeatureMetrics.recordDirectorGuardRejection()
        continue
      }

      const lastAt = lastSpokeAt.get(candidate.agent_id)
      if (lastAt && now - lastAt < guard.thread_cooldown_seconds * 1000) {
        runtimeFeatureMetrics.recordDirectorGuardRejection()
        continue
      }

      filtered.push(candidate)
    }

    return filtered.length > 0 ? filtered : scored
  }

  private getThreadHistory(threadId: string, now: number): Array<{ agent_id: string; at: number }> {
    const list = this.threadSelectionHistory.get(threadId) ?? []
    const ttl = 24 * 60 * 60 * 1000
    const filtered = list.filter((item) => now - item.at <= ttl)
    if (filtered.length !== list.length) {
      this.threadSelectionHistory.set(threadId, filtered)
    }
    return filtered
  }

  private recordThreadSelections(threadId: string, selected: ScoredCandidate[], now: number): void {
    const existing = this.getThreadHistory(threadId, now)
    const merged = [
      ...existing,
      ...selected.map((item) => ({ agent_id: item.agent_id, at: now })),
    ]
    const trimmed = merged.slice(-120)
    this.threadSelectionHistory.set(threadId, trimmed)
  }
}

function annotateCandidatesWithAttentionHint(
  candidates: ScoredCandidate[],
  input: {
    opportunity: AttentionOpportunity | null
    selection_path: ForumSelectionPath
    fallback_reason: ForumBaselineFallbackReason | null
  },
): ScoredCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    opportunity_id: input.opportunity?.id,
    browse_reason: input.opportunity?.browse_reason,
    selected_anchor_turn_id: input.opportunity?.selected_anchor_turn_id ?? null,
    forum_attention_hint: buildForumAttentionHint(input.opportunity, {
      selection_path: input.selection_path,
      fallback_reason: input.fallback_reason,
    }),
  }))
}

function buildForumAttentionHint(
  opportunity: AttentionOpportunity | null,
  input: {
    selection_path: ForumSelectionPath
    fallback_reason: ForumBaselineFallbackReason | null
  },
): ForumAttentionHint {
  return {
    opportunity_id: opportunity?.id ?? null,
    browse_reason: opportunity?.browse_reason ?? null,
    selected_anchor_turn_id: opportunity?.selected_anchor_turn_id ?? null,
    target_thread_id: opportunity?.thread_id ?? null,
    target_agent_ids: opportunity?.target_agent_ids ?? [],
    priority_agent_ids: opportunity?.priority_agent_ids ?? [],
    evidence_turn_ids: opportunity?.evidence_turn_ids ?? [],
    reason_codes: opportunity?.reason_codes ?? [],
    post_attention_state: opportunity?.post_attention_state ?? null,
    thread_attention_state: opportunity?.thread_attention_state ?? null,
    selection_path: input.selection_path,
    fallback_reason: input.fallback_reason,
  }
}

function isForumSelectionEvent(event: EventPayload): boolean {
  return event.event_type === 'ThreadOpened' || event.event_type === 'ThreadTurnAdded'
}

function relationHintBonus(hint: 'none' | 'following' | 'follower' | 'friend'): number {
  switch (hint) {
    case 'friend':
      return 0.15
    case 'following':
      return 0.08
    case 'follower':
      return 0.04
    case 'none':
      return 0
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function overlapRatio(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0
  const rightSet = new Set(right)
  const overlap = left.filter((item) => rightSet.has(item)).length
  return overlap / Math.max(left.length, right.length)
}
