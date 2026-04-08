import type {
  AttentionOpportunity,
  AttentionOpportunitySource,
  DiscussionForestProjection,
  EffectiveOrchestrationPolicy,
  PostSemanticCapsule,
  ThreadCapsule,
} from '../../shared/forum-orchestration.js'
import type { AttentionTelemetrySnapshot, EventPayload, ScoredCandidate } from '../allocator/types.js'

export class AttentionOpportunityBroker {
  discoverFromEvent(input: {
    event: EventPayload
    scored_candidates?: ScoredCandidate[]
  }): AttentionOpportunity[] {
    const source = resolveFallbackSource(input.event)
    return [this.buildOpportunity({
      event: input.event,
      source,
      post_capsule: null,
      post_id: input.event.post_id ?? 'unknown',
      thread: null,
      policy: null,
      telemetry: null,
    })]
  }

  discover(input: {
    event: EventPayload
    post_capsule: PostSemanticCapsule
    thread_capsule?: ThreadCapsule | null
    forest?: DiscussionForestProjection | null
    effective_orchestration_policy?: EffectiveOrchestrationPolicy | null
    watch_telemetry_snapshot?: AttentionTelemetrySnapshot | null
    scored_candidates?: ScoredCandidate[]
  }): AttentionOpportunity[] {
    const thread = input.thread_capsule
      ?? input.post_capsule.thread_capsules.find((item) => item.thread_id === input.event.thread_id)
      ?? input.post_capsule.thread_capsules[0]
      ?? null
    const source = resolveSource({
      event: input.event,
      thread,
      telemetry: input.watch_telemetry_snapshot ?? null,
    })

    if (source === 'OWNER_PULL') {
      return []
    }

    return [this.buildOpportunity({
      event: input.event,
      source,
      post_capsule: input.post_capsule,
      post_id: input.post_capsule.post_id,
      thread,
      policy: input.effective_orchestration_policy ?? null,
      telemetry: input.watch_telemetry_snapshot ?? null,
    })]
  }

  private buildOpportunity(input: {
    event: EventPayload
    source: AttentionOpportunitySource
    post_capsule: PostSemanticCapsule | null
    post_id: string
    thread: ThreadCapsule | null
    policy: EffectiveOrchestrationPolicy | null
    telemetry: AttentionTelemetrySnapshot | null
  }): AttentionOpportunity {
    const targetAgentIds = input.thread?.participant_ids ?? input.event.thread_participants ?? []
    const priorityAgentIds = resolvePriorityAgentIds(input.event, input.thread, input.source)
    const selectedAnchorTurnId =
      input.event.turn_id
      ?? input.thread?.latest_turn_id
      ?? input.thread?.salient_turn_ids[0]
      ?? null
    const telemetryPressure = readAudienceTelemetryPressure(
      input.telemetry,
      input.post_id,
      input.thread?.thread_id ?? input.event.thread_id ?? null,
    )

    return {
      id: `opp:${input.event.event_id}:${input.source.toLowerCase()}`,
      source: input.source,
      browse_reason: mapBrowseReason(input.source),
      profile: input.policy?.profile ?? 'ambient_roaming',
      post_id: input.post_id,
      thread_id: input.thread?.thread_id ?? input.event.thread_id ?? null,
      turn_id: input.event.turn_id ?? input.thread?.latest_turn_id ?? null,
      selected_anchor_turn_id: selectedAnchorTurnId,
      target_agent_ids: targetAgentIds,
      priority_agent_ids: priorityAgentIds,
      suppressed_agent_ids: [],
      reason_codes: buildReasonCodes(input.source, input.thread, telemetryPressure),
      evidence_turn_ids: [
        input.event.turn_id,
        input.thread?.latest_turn_id,
        ...input.thread?.salient_turn_ids.slice(0, 2) ?? [],
      ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index),
      post_attention_state: buildPostAttentionState(
        input.post_id,
        input.thread,
        input.policy,
        input.post_capsule,
      ),
      thread_attention_state: input.thread
        ? buildThreadAttentionState(input.thread, telemetryPressure)
        : null,
    }
  }
}

function resolveFallbackSource(event: EventPayload): AttentionOpportunitySource {
  if (event.target_author_agent_id) return 'DIRECT_CHALLENGE'
  if ((event.thread_participants?.length ?? 0) >= 4) return 'AUDIENCE_SPIKE'
  if (event.chain_depth > 0) return 'REVIVE_OLD_BRANCH'
  return 'NEW_TURN'
}

function resolveSource(input: {
  event: EventPayload
  thread: ThreadCapsule | null
  telemetry: AttentionTelemetrySnapshot | null
}): AttentionOpportunitySource {
  if (input.event.target_author_agent_id || input.thread?.reason_badges.includes('MENTIONED')) {
    return 'DIRECT_CHALLENGE'
  }

  const telemetryPressure = readAudienceTelemetryPressure(
    input.telemetry,
    input.thread?.post_id ?? input.event.post_id ?? 'unknown',
    input.thread?.thread_id ?? input.event.thread_id ?? null,
  )
  const audienceSignalCount =
    (input.thread?.audience_signals?.message_count ?? 0)
    + (input.thread?.audience_signals?.highlighted_message_count ?? 0)
  if (audienceSignalCount >= 3 || telemetryPressure >= 3) {
    return 'AUDIENCE_SPIKE'
  }

  if (input.event.chain_depth > 0 || input.thread?.reason_badges.includes('RETURNED_TO_BRANCH')) {
    return 'REVIVE_OLD_BRANCH'
  }

  return 'NEW_TURN'
}

function resolvePriorityAgentIds(
  event: EventPayload,
  thread: ThreadCapsule | null,
  source: AttentionOpportunitySource,
): string[] {
  if (source === 'DIRECT_CHALLENGE' && event.target_author_agent_id) {
    return [event.target_author_agent_id]
  }
  if (source === 'AUDIENCE_SPIKE') {
    return thread?.participant_ids.slice(0, 2) ?? []
  }
  if (source === 'REVIVE_OLD_BRANCH') {
    return thread?.participant_ids.slice(0, 1) ?? []
  }
  return []
}

function buildReasonCodes(
  source: AttentionOpportunitySource,
  thread: ThreadCapsule | null,
  telemetryPressure: number,
): string[] {
  const reasonCodes = new Set<string>([source.toLowerCase()])
  for (const badge of thread?.reason_badges ?? []) {
    reasonCodes.add(badge.toLowerCase())
  }
  if (telemetryPressure > 0) {
    reasonCodes.add('viewer_attention')
  }
  return Array.from(reasonCodes)
}

function mapBrowseReason(source: AttentionOpportunitySource): AttentionOpportunity['browse_reason'] {
  switch (source) {
    case 'DIRECT_CHALLENGE':
      return 'DIRECT_CHALLENGE'
    case 'AUDIENCE_SPIKE':
      return 'AUDIENCE_HEAT'
    case 'REVIVE_OLD_BRANCH':
      return 'REVIVE'
    case 'OWNER_PULL':
      return 'OWNER_PULL'
    case 'NEW_TURN':
    default:
      return 'TOPIC_MATCH'
  }
}

function buildPostAttentionState(
  postId: string,
  thread: ThreadCapsule | null,
  policy: EffectiveOrchestrationPolicy | null,
  postCapsule?: PostSemanticCapsule,
): AttentionOpportunity['post_attention_state'] {
  if (!thread) {
    return {
      dominant_thread_share: 0,
      branch_entropy: 0,
      duel_risk: 0,
      newcomer_share_recent: policy?.recall_control.newcomer_min_share ?? 0,
      late_entry_share_recent: policy?.recall_control.late_entry_min_share ?? 0,
    }
  }

  const totalTurns = Math.max(
    postCapsule?.thread_capsules.reduce((sum, item) => sum + item.turn_count, 0) ?? thread.turn_count,
    1,
  )
  const newcomerBadges = thread.semantic_marks.filter((mark) => mark.joined_late).length
  const audienceBadges = thread.semantic_marks.filter((mark) => mark.audience_pushed).length

  return {
    dominant_thread_share: Math.min(1, thread.turn_count / totalTurns),
    branch_entropy: Math.min(1, thread.participant_count / 6),
    duel_risk: thread.participant_count <= 2 ? 1 : Math.min(1, 2 / thread.participant_count),
    newcomer_share_recent: newcomerBadges / totalTurns,
    late_entry_share_recent: audienceBadges / totalTurns,
  }
}

function buildThreadAttentionState(
  thread: ThreadCapsule,
  telemetryPressure: number,
): AttentionOpportunity['thread_attention_state'] {
  return {
    contention_score: thread.role === 'COUNTERPOINT' ? 0.85 : Math.min(1, thread.participant_count / 4),
    unresolved_score: Math.min(1, thread.unresolved_points.length / 4),
    audience_pull_score: Math.min(1, ((thread.audience_signals?.message_count ?? 0) + telemetryPressure) / 6),
    saturation_score: thread.lifecycle.reply_budget.limit > 0
      ? 1 - Math.max(0, thread.lifecycle.reply_budget.remaining / thread.lifecycle.reply_budget.limit)
      : 0,
    pair_loop_risk: thread.participant_count <= 2 ? 0.8 : 0.2,
    recall_budget_remaining: thread.lifecycle.reply_budget.remaining_turns,
  }
}

function readAudienceTelemetryPressure(
  telemetry: AttentionTelemetrySnapshot | null,
  postId: string,
  threadId: string | null,
): number {
  if (!telemetry) return 0
  return telemetry.recent.filter((entry) =>
    entry.post_id === postId
    && (!threadId || !entry.thread_id || entry.thread_id === threadId)
    && (
      entry.event_type === 'guide_click'
      || entry.event_type === 'node_focus'
      || entry.event_type === 'branch_expand'
    )).length
}
