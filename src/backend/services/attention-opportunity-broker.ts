import type {
  AttentionOpportunity,
  AttentionOpportunitySource,
  DiscussionForestProjection,
  PostSemanticCapsule,
} from '../../shared/forum-orchestration.js'
import type { EventPayload, ScoredCandidate } from '../allocator/types.js'

export class AttentionOpportunityBroker {
  discoverFromEvent(input: {
    event: EventPayload
    scored_candidates?: ScoredCandidate[]
  }): AttentionOpportunity[] {
    const source = input.event.target_author_agent_id
      ? 'DIRECT_CHALLENGE'
      : (input.event.thread_participants?.length ?? 0) >= 4
        ? 'AUDIENCE_SPIKE'
        : input.event.chain_depth > 0
          ? 'REVIVE_OLD_BRANCH'
          : 'NEW_TURN'

    const priorityAgentIds = input.event.target_author_agent_id
      ? [input.event.target_author_agent_id]
      : (input.event.thread_participants ?? []).slice(0, 2)

    const suppressedAgentIds = (input.scored_candidates ?? [])
      .filter((candidate) => priorityAgentIds.length > 0 && !priorityAgentIds.includes(candidate.agent_id))
      .map((candidate) => candidate.agent_id)

    return [{
      id: `opp:${input.event.event_id}:${source.toLowerCase()}`,
      source,
      post_id: input.event.post_id ?? 'unknown',
      thread_id: input.event.thread_id ?? null,
      turn_id: input.event.turn_id ?? null,
      target_agent_ids: input.event.thread_participants ?? [],
      priority_agent_ids: priorityAgentIds,
      suppressed_agent_ids: suppressedAgentIds,
      reason_codes: [source.toLowerCase()],
      evidence_turn_ids: [input.event.turn_id].filter((item): item is string => Boolean(item)),
    }]
  }

  discover(input: {
    event: EventPayload
    post_capsule: PostSemanticCapsule
    forest?: DiscussionForestProjection | null
    scored_candidates?: ScoredCandidate[]
  }): AttentionOpportunity[] {
    const opportunities: AttentionOpportunity[] = []
    const latestThread = input.post_capsule.thread_capsules.find((item) =>
      item.thread_id === input.event.thread_id)
      ?? input.post_capsule.thread_capsules[0]
      ?? null

    if (!latestThread) {
      return opportunities
    }

    const reasonCodes: string[] = []
    let source: AttentionOpportunitySource = 'NEW_TURN'
    const priorityAgentIds = new Set<string>()
    const suppressedAgentIds = new Set<string>()
    const evidenceTurnIds = latestThread.semantic_marks.slice(-3).map((item) => item.turn_id)

    if (latestThread.reason_badges.includes('RETURNED_TO_BRANCH')) {
      source = 'REVIVE_OLD_BRANCH'
      reasonCodes.push('revive_old_branch')
      latestThread.participant_ids.slice(0, 2).forEach((item) => priorityAgentIds.add(item))
    }
    if (latestThread.reason_badges.includes('MENTIONED')) {
      source = 'DIRECT_CHALLENGE'
      reasonCodes.push('direct_challenge')
      latestThread.participant_ids.slice(0, 2).forEach((item) => priorityAgentIds.add(item))
    }
    if ((latestThread.audience_signals?.message_count ?? 0) >= 3) {
      source = 'AUDIENCE_SPIKE'
      reasonCodes.push('audience_spike')
    }

    if (!reasonCodes.length) {
      reasonCodes.push('new_turn')
    }

    for (const candidate of input.scored_candidates ?? []) {
      if (latestThread.participant_ids.includes(candidate.agent_id) && latestThread.participant_count >= 3) {
        continue
      }
      suppressedAgentIds.add(candidate.agent_id)
    }

    opportunities.push({
      id: `opp:${input.event.event_id}:${source.toLowerCase()}`,
      source,
      post_id: input.post_capsule.post_id,
      thread_id: latestThread.thread_id,
      turn_id: input.event.turn_id ?? latestThread.latest_turn_id,
      target_agent_ids: latestThread.participant_ids,
      priority_agent_ids: Array.from(priorityAgentIds),
      suppressed_agent_ids: Array.from(suppressedAgentIds),
      reason_codes: reasonCodes,
      evidence_turn_ids: evidenceTurnIds,
    })

    return opportunities
  }
}
