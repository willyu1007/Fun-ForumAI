import type {
  BrowseReason,
  DiscussionForestProjection,
  EffectiveOrchestrationPolicy,
  EffectiveParticipationContract,
  PostAttentionState,
  PostSemanticCapsule,
  ThreadAttentionState,
  ThreadCapsule,
} from '../../shared/forum-orchestration.js'
import type { GovernanceGenerationMode } from '../repos/types/warmup-governance.js'

// ─── Event types ─────────────────────────────────────────────

export type DomainEventType =
  | 'NewPostCreated'
  | 'ThreadOpened'
  | 'ThreadTurnAdded'
  | 'NewMessageCreated'
  | 'VoteCast'
  | 'RoomTick'

export interface EventPayload {
  event_id: string
  event_type: DomainEventType
  idempotency_key: string
  chain_depth: number
  community_id: string
  post_id?: string
  room_id?: string
  author_agent_id?: string
  author_actor_type?: 'agent' | 'human' | 'system'
  author_user_id?: string
  tags?: string[]
  thread_id?: string
  turn_id?: string
  target_type?: 'POST' | 'THREAD' | 'TURN' | 'MESSAGE'
  target_id?: string
  target_author_agent_id?: string
  direction?: 'UP' | 'DOWN' | 'NEUTRAL'
  thread_participants?: string[]
  controversy_score?: number
  governance_batch_id?: string
  generation_mode?: GovernanceGenerationMode
  created_at: string
}

// ─── Quota context ───────────────────────────────────────────

export interface QuotaContext {
  event_type: DomainEventType
  community_id: string
  post_id?: string
  thread_id?: string
  room_id?: string
}

export interface QuotaLimits {
  global_max: number
  community_max: number
  thread_max: number
  event_base: number
}

// ─── Agent / Candidate ──────────────────────────────────────

export interface AgentCandidate {
  agent_id: string
  status: 'active' | 'limited' | 'quarantined' | 'banned'
  tags: string[]
  community_ids: string[]
  actions_last_hour: number
  tokens_last_day: number
  last_action_at: string | null
  recent_thread_post_ids: string[]
  stats_hint?: {
    participation_multiplier: number
    exploration_noise_scale: number
    controversy_appetite: number
    p_wander: number
  }
  relation_hint_to_author?: 'none' | 'following' | 'follower' | 'friend' | 'blocked'
}

export interface ScoredCandidate {
  agent_id: string
  score: number
  reasons: string[]
  opportunity_id?: string
  browse_reason?: BrowseReason
  selected_anchor_turn_id?: string | null
  forum_attention_hint?: ForumAttentionHint | null
}

export const FORUM_SELECTION_PATH_IDS = [
  'legacy_baseline',
  'selection_cutover_disabled_baseline',
  'selection_no_opportunity_baseline',
  'selection_cutover_granted',
  'selection_fallback_baseline',
] as const

export type ForumSelectionPath = (typeof FORUM_SELECTION_PATH_IDS)[number]

export const FORUM_BASELINE_FALLBACK_REASON_IDS = [
  'allocator_selection_fallback',
  'allocator_empty_granted_fallback',
  'executor_call1_infra_fallback',
  'audience_scope_excluded_baseline_fallback',
  'runtime_context_preview_fallback',
] as const

export type ForumBaselineFallbackReason =
  (typeof FORUM_BASELINE_FALLBACK_REASON_IDS)[number]

export const FORUM_ROAMING_NO_WRITE_REASON_IDS = [
  'decision_failed',
  'candidate_missing',
  'candidate_expired',
  'candidate_invalid',
  'target_invalid',
  'observe_only',
  'no_viable_candidates',
  'audience_scope_excluded',
] as const

export type ForumRoamingNoWriteReason =
  (typeof FORUM_ROAMING_NO_WRITE_REASON_IDS)[number]

export interface ForumAttentionHint {
  opportunity_id: string | null
  browse_reason: BrowseReason | null
  selected_anchor_turn_id: string | null
  target_thread_id: string | null
  target_agent_ids: string[]
  priority_agent_ids: string[]
  evidence_turn_ids: string[]
  reason_codes: string[]
  post_attention_state: PostAttentionState | null
  thread_attention_state: ThreadAttentionState | null
  selection_path: ForumSelectionPath
  fallback_reason: ForumBaselineFallbackReason | null
}

export interface GraphRelevanceSnapshot {
  candidate_agent_id: string
  ppr_score: number
  rank: number
  computed_at: Date
  expires_at: Date
}

export interface GraphRelevanceProvider {
  getSnapshot(input: {
    source_agent_id: string
    community_id: string
    topic_key: string
    now?: Date
  }): GraphRelevanceSnapshot[]
}

export interface CastingDirectorCommunityConfig {
  ratio: {
    core: number
    contrast: number
    wildcard: number
  }
  wildcard_cap?: number
  guard?: {
    contrast_min_relevance_ratio: number
    wildcard_min_relevance_ratio: number
    min_abs_score: number
    thread_window: number
    thread_max_agent_occurrences: number
    thread_cooldown_seconds: number
  }
  runtime?: {
    cooldown_seconds: number
    max_actions_per_hour: number
    max_tokens_per_day: number
    thread_max_agents: number
  }
}

export interface CastingDirectorPolicyInput {
  event: EventPayload
  scored: ScoredCandidate[]
  quota: number
  community_config?: CastingDirectorCommunityConfig
}

export interface CastingDirectorPolicy {
  select(input: CastingDirectorPolicyInput): ScoredCandidate[]
}

// ─── Allocation result ──────────────────────────────────────

export interface AllocationResult {
  event_id: string
  quota_applied: number
  degradation_level: DegradationLevel
  agents: SelectedAgent[]
  skipped_reasons: Record<string, string>
}

export interface SelectedAgent {
  agent_id: string
  score: number
  priority: number
  opportunity_id?: string
  browse_reason?: BrowseReason
  selected_anchor_turn_id?: string | null
  forum_attention_hint?: ForumAttentionHint | null
}

// ─── Degradation ────────────────────────────────────────────

export type DegradationLevel = 'normal' | 'moderate' | 'critical'

export interface DegradationState {
  level: DegradationLevel
  queue_lag_seconds: number
  factor: number
}

// ─── Admission ──────────────────────────────────────────────

export type AdmissionVerdict =
  | { admitted: true }
  | { admitted: false; reason: string }

// ─── Pipeline stage contracts ───────────────────────────────

export interface AdmissionGate {
  check(event: EventPayload): AdmissionVerdict
  markSeen(idempotency_key: string): void
}

export interface QuotaCalculator {
  calculate(ctx: QuotaContext, degradation: DegradationState): number
}

export interface CandidateSelector {
  select(
    event: EventPayload,
    candidates: AgentCandidate[],
    quota: number,
    degradation: DegradationState,
  ): Promise<ScoredCandidate[]>
}

export interface AllocationLock {
  tryAcquire(event_id: string, agent_id: string): boolean
  release(event_id: string, agent_id: string): void
}

export interface DegradationMonitor {
  getState(): DegradationState
  reportLag(lag_seconds: number): void
  reset(): void
}

export interface AgentRepository {
  getCandidates(community_id: string, author_agent_id?: string, post_id?: string): AgentCandidate[]
}

export interface AttentionTelemetrySnapshot {
  recent: Array<{
    event_type: string
    post_id: string
    thread_id?: string
    turn_id?: string
  }>
  counters: Record<string, number>
}

export interface ForumAttentionInputBundle {
  post_capsule: PostSemanticCapsule
  thread_capsule: ThreadCapsule | null
  forest: DiscussionForestProjection
  participation_contract: EffectiveParticipationContract | null
  effective_orchestration_policy: EffectiveOrchestrationPolicy | null
  watch_telemetry_snapshot: AttentionTelemetrySnapshot | null
}
