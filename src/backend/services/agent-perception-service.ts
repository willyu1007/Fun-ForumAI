import type {
  DiscussionForestProjection,
  PerceivedContextSlice,
  PostSemanticCapsule,
  ThreadCapsule,
} from '../../shared/forum-orchestration.js'
import { FORUM_PERCEIVED_CONTEXT_SLICE_SCHEMA_VERSION as PERCEIVED_CONTEXT_SLICE_SCHEMA_VERSION } from '../../shared/forum-orchestration.js'

export class AgentPerceptionService {
  buildSlice(input: {
    post_capsule: PostSemanticCapsule
    thread_capsule: ThreadCapsule | null
    forest: DiscussionForestProjection | null
    focus_turn_id?: string | null
  }): PerceivedContextSlice | null {
    if (!input.thread_capsule) {
      return null
    }

    const builtAt = new Date().toISOString()
    const forestNodes = input.forest?.nodes.filter((node) => node.thread_id === input.thread_capsule?.thread_id) ?? []
    const focusNode = forestNodes.find((node) => node.id === input.focus_turn_id)
      ?? forestNodes.find((node) => node.id === input.thread_capsule?.latest_turn_id)
      ?? forestNodes.at(-1)
      ?? null
    const focusTurnId = input.focus_turn_id
      ?? input.thread_capsule.salient_turn_ids[0]
      ?? input.thread_capsule.latest_turn_id
      ?? null
    const visibleNodeIds = forestNodes.length > 0
      ? forestNodes.slice(-6).map((item) => item.id)
      : [
          input.thread_capsule.thread_id,
          ...input.thread_capsule.salient_turn_ids.slice(0, 5),
        ]

    return {
      schema_version: PERCEIVED_CONTEXT_SLICE_SCHEMA_VERSION,
      slice_id: `slice:${input.post_capsule.post_id}:${input.thread_capsule.thread_id}:${focusTurnId ?? 'none'}`,
      post_id: input.post_capsule.post_id,
      thread_id: input.thread_capsule.thread_id,
      focus_turn_id: focusTurnId,
      actual_anchor_turn_id: focusNode?.actual_anchor_turn_id ?? null,
      visible_node_ids: visibleNodeIds,
      evidence_window_ids: input.thread_capsule.salient_turn_ids.slice(0, 3),
      reason_codes: input.thread_capsule.reason_badges.map((item) => item.toLowerCase()),
      post_capsule_excerpt: input.post_capsule.current_tension,
      branch_capsule_excerpt: input.thread_capsule.summary,
      built_at: builtAt,
    }
  }
}
