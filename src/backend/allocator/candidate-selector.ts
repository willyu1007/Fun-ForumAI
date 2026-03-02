import type {
  CandidateSelector,
  EventPayload,
  AgentCandidate,
  ScoredCandidate,
  DegradationState,
  GraphRelevanceProvider,
  CastingDirectorPolicy,
  CastingDirectorCommunityConfig,
} from './types.js'
import type { AllocatorConfig } from './config.js'
import { deriveTopicKey } from './ppr-topic-key.js'

const PPR_SCORE_SCALE = 2

export interface DefaultCandidateSelectorDeps {
  graphRelevanceProvider?: GraphRelevanceProvider
  castingDirectorPolicy?: CastingDirectorPolicy
  pprEnabled?: boolean
  directorEnabled?: boolean
  resolveCommunityDirectorConfig?: (communityId: string) => CastingDirectorCommunityConfig | undefined
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
  constructor(
    private readonly cfg: AllocatorConfig,
    private readonly deps: DefaultCandidateSelectorDeps = {},
  ) {}

  select(
    event: EventPayload,
    candidates: AgentCandidate[],
    quota: number,
    degradation: DegradationState,
  ): ScoredCandidate[] {
    if (quota <= 0) return []

    const eventTags = this.extractTags(event)
    const topicKey = deriveTopicKey(event.tags)
    const now = Date.now()
    const pprSnapshot = this.deps.pprEnabled && this.deps.graphRelevanceProvider
      ? this.deps.graphRelevanceProvider.getSnapshot({
          source_agent_id: event.author_agent_id,
          community_id: event.community_id,
          topic_key: topicKey,
          now: new Date(now),
        })
      : []
    const pprScoreByAgent = new Map(
      pprSnapshot.map((row) => [row.candidate_agent_id, row.ppr_score] as const),
    )

    const scored: ScoredCandidate[] = []

    for (const c of candidates) {
      const reasons: string[] = []

      if (c.status !== 'active') {
        continue
      }
      if (c.agent_id === event.author_agent_id) {
        continue
      }
      if (c.actions_last_hour >= this.cfg.maxActionsPerHour) {
        continue
      }
      if (c.tokens_last_day >= this.cfg.maxTokensPerDay) {
        continue
      }
      if (c.last_action_at) {
        const elapsed = (now - new Date(c.last_action_at).getTime()) / 1000
        if (elapsed < this.cfg.cooldownSeconds) {
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
        reasons.push('community_member')
      }

      if (event.post_id && c.recent_thread_post_ids.includes(event.post_id)) {
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

    if (!this.deps.directorEnabled || quota <= 2 || !this.deps.castingDirectorPolicy) {
      return topScored
    }

    return this.deps.castingDirectorPolicy.select({
      event,
      scored,
      quota,
      community_config: this.deps.resolveCommunityDirectorConfig?.(event.community_id),
    })
  }

  private extractTags(event: EventPayload): Set<string> {
    if (Array.isArray(event.tags)) {
      return new Set(event.tags.filter((tag): tag is string => typeof tag === 'string'))
    }
    return new Set()
  }
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
