import type {
  EffectiveParticipationContract,
  EvidenceWindowContext,
  MemoryRef,
  PerceivedEvidenceEntry,
  PerceivedContextSlice,
  PostSemanticCapsule,
  RuntimeContextEnvelope,
  ThreadCapsule,
} from '../../shared/forum-orchestration.js'
import { FORUM_RUNTIME_CONTEXT_ENVELOPE_SCHEMA_VERSION as RUNTIME_CONTEXT_ENVELOPE_SCHEMA_VERSION } from '../../shared/forum-orchestration.js'

export class RuntimeContextAssembler {
  build(input: {
    post_capsule: PostSemanticCapsule
    thread_capsule: ThreadCapsule | null
    perceived_slice: PerceivedContextSlice | null
    post_title: string
    post_body_excerpt: string
    post_author: {
      actor_type: 'agent' | 'human'
      actor_id: string
      display_name: string
    }
    community_id: string
    participation_contract: EffectiveParticipationContract | null
    evidence_window_turns?: PerceivedEvidenceEntry[]
    memory_refs?: MemoryRef[]
  }): RuntimeContextEnvelope {
    const builtAt = new Date().toISOString()
    const evidenceWindow: EvidenceWindowContext | null = input.thread_capsule
      ? {
          anchor_turn_id: input.perceived_slice?.actual_anchor_turn_id ?? input.perceived_slice?.focus_turn_id ?? null,
          window_strategy: input.perceived_slice?.actual_anchor_turn_id ? 'AROUND_ANCHOR' : 'SALIENT_ONLY',
          turns: input.evidence_window_turns ?? [],
        }
      : null

    return {
      schema_version: RUNTIME_CONTEXT_ENVELOPE_SCHEMA_VERSION,
      envelope_id: `runtime:${input.post_capsule.post_id}:${input.thread_capsule?.thread_id ?? 'post'}:${builtAt}`,
      post_id: input.post_capsule.post_id,
      thread_id: input.thread_capsule?.thread_id ?? null,
      built_from_slice_id: input.perceived_slice?.slice_id ?? null,
      foundation_skeleton: {
        post: {
          post_id: input.post_capsule.post_id,
          title: input.post_title,
          body_excerpt: input.post_body_excerpt,
          author: input.post_author,
          community_id: input.community_id,
        },
        participation_contract: {
          audience_lane_enabled: input.participation_contract?.audience_lane_enabled ?? false,
          stage_open_reply_enabled:
            input.participation_contract?.stage_thread_entry_enabled
            || input.participation_contract?.stage_turn_reply_enabled
            || false,
          identity_policy: null,
        },
        route_snapshot: input.thread_capsule?.route_handoff ?? null,
      },
      post_situation: {
        flow_phase: input.post_capsule.flow_phase,
        premise: input.post_capsule.premise,
        current_tension: input.post_capsule.current_tension,
        open_questions: input.post_capsule.open_questions,
        start_here_thread_ids: input.post_capsule.start_thread_ids,
        must_read_turn_ids: input.post_capsule.must_read_turn_ids,
      },
      focus_thread: input.thread_capsule
        ? {
            thread_id: input.thread_capsule.thread_id,
            role: input.thread_capsule.role,
            summary: input.thread_capsule.summary,
            unresolved_points: input.thread_capsule.unresolved_points,
            thread_state: input.thread_capsule.lifecycle.thread_state,
            active_route: input.thread_capsule.route_handoff,
            salient_turn_ids: input.thread_capsule.salient_turn_ids,
          }
        : null,
      evidence_window: evidenceWindow,
      memory_refs: input.memory_refs ?? [],
      built_at: builtAt,
      post_capsule: input.post_capsule,
      thread_capsule: input.thread_capsule,
      perceived_slice: input.perceived_slice,
    }
  }
}
