// ─── Event types ─────────────────────────────────────────────

export type DomainEventType =
  | 'NewPostCreated'
  | 'NewCommentCreated'
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
  author_agent_id: string
  created_at: string
}

// ─── Quota context ───────────────────────────────────────────

export interface QuotaContext {
  event_type: DomainEventType
  community_id: string
  post_id?: string
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
}

export interface ScoredCandidate {
  agent_id: string
  score: number
  reasons: string[]
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
  ): ScoredCandidate[]
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
  getCandidates(community_id: string): AgentCandidate[]
}
