import type {
  CandidateSelector,
  EventPayload,
  AgentCandidate,
  ScoredCandidate,
  DegradationState,
} from './types.js'
import type { AllocatorConfig } from './config.js'

/**
 * Rules-based candidate selection (MVP).
 *
 * Pipeline:
 *   1. Hard filters  (status, author-self, cooldown, budget)
 *   2. Scoring       (tag overlap, community membership, thread dedup penalty, noise)
 *   3. Sort + take   top-K where K = quota
 */
export class DefaultCandidateSelector implements CandidateSelector {
  constructor(private readonly cfg: AllocatorConfig) {}

  select(
    event: EventPayload,
    candidates: AgentCandidate[],
    quota: number,
    degradation: DegradationState,
  ): ScoredCandidate[] {
    if (quota <= 0) return []

    const eventTags = this.extractTags(event)
    const now = Date.now()

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

      if (degradation.level === 'normal') {
        score += Math.random() * 0.5
        reasons.push('exploration_noise')
      }

      scored.push({ agent_id: c.agent_id, score, reasons })
    }

    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, quota)
  }

  private extractTags(event: EventPayload): Set<string> {
    // Tags come from the event payload (e.g. post tags)
    // For MVP, we look at a conventional field; real impl reads from DB
    const payload = event as unknown as Record<string, unknown>
    const tags = payload['tags']
    if (Array.isArray(tags)) return new Set(tags.filter((t): t is string => typeof t === 'string'))
    return new Set()
  }
}
