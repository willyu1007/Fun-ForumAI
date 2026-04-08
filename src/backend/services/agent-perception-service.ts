import type {
  AttentionOpportunity,
  DiscussionForestProjection,
  EffectiveParticipationContract,
  PerceivedAllowedAction,
  PerceivedContextSlice,
  PostSemanticCapsule,
  ThreadCapsule,
  TurnReasonBadgeId,
} from '../../shared/forum-orchestration.js'
import { FORUM_PERCEIVED_CONTEXT_SLICE_SCHEMA_VERSION as PERCEIVED_CONTEXT_SLICE_SCHEMA_VERSION } from '../../shared/forum-orchestration.js'

export class AgentPerceptionService {
  buildSlice(input: {
    agent_id: string
    post_capsule: PostSemanticCapsule
    thread_capsule: ThreadCapsule | null
    forest: DiscussionForestProjection | null
    participation_contract?: EffectiveParticipationContract | null
    opportunity?: AttentionOpportunity | null
    focus_turn_id?: string | null
  }): PerceivedContextSlice | null {
    const builtAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    if (!input.thread_capsule) {
      return {
        schema_version: PERCEIVED_CONTEXT_SLICE_SCHEMA_VERSION,
        slice_id: `slice:${input.post_capsule.post_id}:post:${input.agent_id}`,
        agent_id: input.agent_id,
        post_id: input.post_capsule.post_id,
        thread_id: null,
        browse_reason: input.opportunity?.browse_reason ?? 'TOPIC_MATCH',
        opportunity_id: input.opportunity?.id ?? null,
        focus_turn_id: null,
        selected_anchor_turn_id: null,
        actual_anchor_turn_id: null,
        context_coverage: 'POST_SYNTHESIS_ONLY',
        post_view: {
          premise: input.post_capsule.premise,
          flow_phase: input.post_capsule.flow_phase,
          current_tension: input.post_capsule.current_tension,
          open_questions: input.post_capsule.open_questions,
        },
        thread_view: null,
        evidence_window: [],
        unseen_global_notes: input.post_capsule.open_questions.slice(0, 2),
        allowed_actions: resolveAllowedActions(input.participation_contract, false),
        visible_node_ids: [],
        evidence_window_ids: input.post_capsule.must_read_turn_ids.slice(0, 3),
        reason_codes: input.opportunity?.reason_codes ?? ['post_synthesis_only'],
        post_capsule_excerpt: input.post_capsule.current_tension,
        branch_capsule_excerpt: input.post_capsule.premise,
        generated_at: builtAt,
        expires_at: expiresAt,
        built_at: builtAt,
      }
    }

    const forestNodes = input.forest?.nodes.filter((node) => node.thread_id === input.thread_capsule?.thread_id) ?? []
    const desiredFocusTurnId =
      input.opportunity?.selected_anchor_turn_id
      ?? input.focus_turn_id
      ?? input.thread_capsule.salient_turn_ids[0]
      ?? input.thread_capsule.latest_turn_id
      ?? null
    const focusNode = forestNodes.find((node) => node.id === desiredFocusTurnId)
      ?? forestNodes.find((node) => node.actual_anchor_turn_id === desiredFocusTurnId)
      ?? forestNodes.find((node) => node.id === input.thread_capsule?.latest_turn_id)
      ?? forestNodes.at(-1)
      ?? null
    const visibleNodeIds = focusNode
      ? collectVisibleNodeIds(forestNodes, focusNode.id)
      : forestNodes.slice(-6).map((item) => item.id)
    const evidenceWindowIds = collectEvidenceWindowIds(input.thread_capsule, focusNode?.id ?? desiredFocusTurnId)
    const threadReasonCodes = input.thread_capsule.reason_badges.map((badge) => badge.toLowerCase())
    const reasonCodes = Array.from(new Set([
      ...(input.opportunity?.reason_codes ?? []),
      ...threadReasonCodes,
    ]))

    return {
      schema_version: PERCEIVED_CONTEXT_SLICE_SCHEMA_VERSION,
      slice_id: `slice:${input.post_capsule.post_id}:${input.thread_capsule.thread_id}:${input.agent_id}:${desiredFocusTurnId ?? 'none'}`,
      agent_id: input.agent_id,
      post_id: input.post_capsule.post_id,
      thread_id: input.thread_capsule.thread_id,
      browse_reason: input.opportunity?.browse_reason ?? inferBrowseReason(input.thread_capsule.reason_badges),
      opportunity_id: input.opportunity?.id ?? null,
      focus_turn_id: desiredFocusTurnId,
      selected_anchor_turn_id: input.opportunity?.selected_anchor_turn_id ?? focusNode?.id ?? desiredFocusTurnId,
      actual_anchor_turn_id: focusNode?.actual_anchor_turn_id ?? desiredFocusTurnId,
      context_coverage: 'LOCAL_PLUS_POST',
      post_view: {
        premise: input.post_capsule.premise,
        flow_phase: input.post_capsule.flow_phase,
        current_tension: input.post_capsule.current_tension,
        open_questions: input.post_capsule.open_questions,
      },
      thread_view: {
        role: input.thread_capsule.role,
        summary: input.thread_capsule.summary,
        unresolved_points: input.thread_capsule.unresolved_points,
        thread_state: input.thread_capsule.lifecycle.thread_state,
      },
      evidence_window: [],
      unseen_global_notes: input.post_capsule.open_questions
        .filter((question) => !input.thread_capsule?.unresolved_points.includes(question))
        .slice(0, 2),
      allowed_actions: resolveAllowedActions(input.participation_contract, true),
      visible_node_ids: visibleNodeIds,
      evidence_window_ids: evidenceWindowIds,
      reason_codes: reasonCodes.length > 0 ? reasonCodes : ['thread_local_context'],
      post_capsule_excerpt: input.post_capsule.current_tension,
      branch_capsule_excerpt: input.thread_capsule.summary,
      generated_at: builtAt,
      expires_at: expiresAt,
      built_at: builtAt,
    }
  }
}

function collectVisibleNodeIds(
  nodes: DiscussionForestProjection['nodes'],
  focusNodeId: string,
): string[] {
  const focusIndex = nodes.findIndex((node) => node.id === focusNodeId)
  if (focusIndex < 0) {
    return nodes.slice(-6).map((item) => item.id)
  }
  const start = Math.max(0, focusIndex - 2)
  const end = Math.min(nodes.length, focusIndex + 3)
  return nodes.slice(start, end).map((item) => item.id)
}

function collectEvidenceWindowIds(threadCapsule: ThreadCapsule, focusTurnId: string | null): string[] {
  const salient = threadCapsule.salient_turn_ids
  if (!focusTurnId) {
    return salient.slice(0, 3)
  }
  const nextIds = [
    focusTurnId,
    ...salient.filter((turnId) => turnId !== focusTurnId),
  ]
  return Array.from(new Set(nextIds)).slice(0, 4)
}

function resolveAllowedActions(
  participationContract: EffectiveParticipationContract | null | undefined,
  hasThread: boolean,
): PerceivedAllowedAction[] {
  const actions = new Set<PerceivedAllowedAction>(['IGNORE'])

  if (hasThread) {
    if (participationContract?.stage_open_reply.turn_reply_enabled ?? true) {
      actions.add('REPLY')
    }
  } else if (participationContract?.stage_open_reply.new_thread_enabled ?? false) {
    actions.add('START_NEW_THREAD')
  }

  if (participationContract?.audience_lane.enabled) {
    actions.add('HANDOFF')
  }

  return Array.from(actions)
}

function inferBrowseReason(reasonBadges: TurnReasonBadgeId[]): PerceivedContextSlice['browse_reason'] {
  if (reasonBadges.includes('MENTIONED')) {
    return 'DIRECT_CHALLENGE'
  }
  if (reasonBadges.includes('RETURNED_TO_BRANCH')) {
    return 'REVIVE'
  }
  if (reasonBadges.includes('AUDIENCE_PUSHED')) {
    return 'AUDIENCE_HEAT'
  }
  return 'TOPIC_MATCH'
}
