import type { AllocationResult, EventPayload, SelectedAgent } from '../allocator/types.js'
import type { LlmTokenUsage } from '../llm/types.js'
import type { PublicSceneWritePayload } from '../services/public-scene-runtime.js'
import type {
  RouteHandoffInput,
  WarmupWriteContextInput,
} from '../services/forum-write-service/types.js'
import type { PersonaRuntimeEnvelope } from './persona-runtime-types.js'
import type {
  BrowseReason,
  DiscussionForestProjection,
  EffectiveOrchestrationPolicy,
  PerceivedAllowedAction,
  PerceivedContextSlice,
  PostSemanticCapsule,
  RuntimeContextEnvelope,
  ThreadPreferredAction,
  ThreadReplyMode,
  ThreadWriteabilityReasonCode,
  ThreadState,
  ThreadCapsule,
} from '../../shared/forum-orchestration.js'

// Legacy prompt invocation scene names. These are not the same contract as
// director_surface / actor_surface / private_surface introduced by T-094.
export type PromptScene =
  | 'forum_post'
  | 'forum_thread'
  | 'forum_turn'
  | 'chat_room'
  | 'private_chat'
  | 'proactive_dm'
  | 'scheduled_post'

export type PromptPriority = 'critical' | 'high' | 'medium' | 'low'

export type PromptControlTier = 'minimal' | 'compact' | 'expanded'

export type PromptMemoryTier =
  | 'full'
  | 'compact'
  | 'sparse'
  | 'minimal'
  | 'drop_low_value'

export type PromptContract = 'compiled_blocks_v2'

export type PromptOverflowReason =
  | 'budget_exceeded_after_control_trim'
  | 'budget_exceeded_due_to_memory'
  | 'budget_exceeded_due_to_privacy_and_memory_floor'
  | 'control_floor_exceeds_target_budget'
  | 'current_context_exceeds_target_budget'
  | 'hard_ceiling_enforced_memory_compacted'
  | 'soft_overflow_applied'

export interface RatioBand {
  guaranteed: number
  preferred: number
  max: number
}

export interface PromptSceneBudgetConfig {
  scene: PromptScene
  request_budget: {
    reference_input: number
    soft_total_ratio: number
    hard_total_ratio: number
    output_reserve: number
  }
  buckets: {
    hard_control: RatioBand
    compact_control: RatioBand
    current_context: RatioBand
    memory: RatioBand
    soft_expression: RatioBand
  }
  compiler_policy: {
    min_control_tier: PromptControlTier
    max_control_tier: PromptControlTier
    default_memory_tier: PromptMemoryTier
    allow_soft_overflow: boolean
  }
}

export interface CurrentContextSource {
  kind: string
  text: string
  priority: PromptPriority
  source_id?: string
}

export interface PromptRequestEnvelope {
  static_system_tokens: number
  route_wrapper_tokens: number
  tool_tokens: number
  current_user_input_tokens: number
  output_reserve: number
  model_capability_ref?: string | null
}

export interface PromptMemoryRetrievalHint {
  bucket_target: number
  token_ceiling: number
  requested_tier: PromptMemoryTier
}

export interface PromptLocalLayerEnvelope {
  request_target_input: number
  request_soft_ceiling: number
  request_hard_ceiling: number
  non_layer_tokens: number
  local_target: number
  local_soft: number
  local_hard: number
}

export interface PromptBudgetBucketTokens {
  hard_control: number
  compact_control: number
  current_context: number
  memory: number
  soft_expression: number
}

export interface PromptBucketSurvivalRatio {
  hard_control: number
  compact_control: number
  current_context: number
  memory: number
  soft_expression: number
}

export interface ExecutionContextThreadEntry {
  id: string
  post_id?: string
  thread_id?: string
  entry_kind?: 'THREAD' | 'TURN'
  anchor_turn_id?: string | null
  turn_index?: number
  body: string
  author_actor_type?: 'agent' | 'human' | 'system'
  author_agent_id: string | null
  author_user_id?: string | null
  author_name: string
}

export interface ForumTargetingContext {
  event_target_entry_id: string | null
  event_target_thread_id: string | null
  focus_turn_id: string | null
  selected_anchor_turn_id: string | null
  actual_anchor_turn_id: string | null
  final_write_anchor_turn_id: string | null
  reply_thread_id: string | null
  browse_reason: BrowseReason | null
  allowed_actions: PerceivedAllowedAction[]
}

export const ROAMING_ARRIVAL_CANDIDATE_KIND_IDS = [
  'branch_entry',
  'sibling_thread_slot',
] as const

export type RoamingArrivalCandidateKind = (typeof ROAMING_ARRIVAL_CANDIDATE_KIND_IDS)[number]

export const ROAMING_DECISION_ACTION_IDS = [
  'reply_in_branch',
  'late_enter_branch',
  'handoff_or_route_elsewhere',
  'start_sibling_thread',
  'observe_only',
] as const

export type RoamingDecisionAction = (typeof ROAMING_DECISION_ACTION_IDS)[number]

export const ROAMING_DECISION_STATUS_IDS = [
  'selected',
  'invalid_json',
  'invalid_shape',
  'invalid_candidate',
  'invalid_action',
] as const

export type RoamingDecisionStatus = (typeof ROAMING_DECISION_STATUS_IDS)[number]

export const RESOLVED_FORUM_EXECUTION_WRITE_ACTION_IDS = [
  'add_thread_turn',
  'add_thread_turn_with_route',
  'open_thread',
  'no_write',
] as const

export type ResolvedForumExecutionWriteAction =
  (typeof RESOLVED_FORUM_EXECUTION_WRITE_ACTION_IDS)[number]

export const RESOLVED_FORUM_EXECUTION_VALIDATION_STATUS_IDS = [
  'resolved',
  'observe_only',
  'decision_failed',
  'candidate_missing',
  'candidate_expired',
  'candidate_invalid',
  'target_invalid',
] as const

export type ResolvedForumExecutionValidationStatus =
  (typeof RESOLVED_FORUM_EXECUTION_VALIDATION_STATUS_IDS)[number]

export interface RoamingArrivalCandidate {
  candidate_id: string
  candidate_kind: RoamingArrivalCandidateKind
  label: string
  summary: string
  thread_id: string | null
  focus_turn_id: string | null
  anchor_turn_id: string | null
  branch_root_turn_id: string | null
  local_evidence: string[]
  reason_codes: string[]
  ranking_reasons: string[]
  allowed_actions: RoamingDecisionAction[]
  expires_at: string | null
  route_handoff: RouteHandoffInput | null
}

export interface DecisionHintBuildResult {
  text: string
  baseline: string
  projection_calibration: string | null
  transient_modifier: string | null
  source_provenance: string[]
}

export interface RoamingDecisionPromptInput {
  persona_decision_hint: string
  decision_control_block: string
  decision_context_block: string
  arrival_candidates_json: string
}

export type RoamingDecisionResult =
  | {
      status: 'selected'
      candidate_id: string
      action: RoamingDecisionAction
      raw_output: string
    }
  | {
      status: Exclude<RoamingDecisionStatus, 'selected'>
      candidate_id: string | null
      action: RoamingDecisionAction | null
      raw_output: string
    }

export interface ResolvedForumExecutionPlan {
  candidate_id: string | null
  candidate_kind: RoamingArrivalCandidateKind | null
  decision_action: RoamingDecisionAction | null
  write_action: ResolvedForumExecutionWriteAction
  requires_generation: boolean
  context_thread_id: string | null
  context_focus_turn_id: string | null
  context_anchor_turn_id: string | null
  write_thread_id: string | null
  write_anchor_turn_id: string | null
  route_handoff: RouteHandoffInput | null
  validation_status: ResolvedForumExecutionValidationStatus
}

export interface ForumRoamingRuntimeState {
  arrival_candidates: RoamingArrivalCandidate[]
  decision_hint: DecisionHintBuildResult | null
  decision_prompt_input: RoamingDecisionPromptInput | null
  decision_result: RoamingDecisionResult | null
  resolved_execution_plan: ResolvedForumExecutionPlan | null
}

export interface PromptBudgetDecision {
  target_budget: number
  soft_ceiling: number
  hard_ceiling: number
  actual_input_estimate: number
  estimated_total_input: number
  control_tier_applied: PromptControlTier
  memory_tier_applied: PromptMemoryTier
  bucket_tokens: PromptBudgetBucketTokens
  bucket_survival_ratio: PromptBucketSurvivalRatio
  overflow_reason: PromptOverflowReason | null
  warnings: string[]
}

export interface PromptBudgetSummary {
  scene: PromptScene | 'background_hidden' | 'dev_prompt_render'
  prompt_template_id: string
  prompt_version: number
  request_envelope: PromptRequestEnvelope
  local_layer_envelope: PromptLocalLayerEnvelope
  decision: PromptBudgetDecision
  measurement_method?: 'rendered_messages_json_v1'
  rendered_prompt_tokens_estimate?: number
  rendered_non_block_tokens_estimate?: number
  provider_prompt_tokens_actual?: number
  prompt_token_drift?: number
}

export interface AgentPersona {
  name: string
  style: string
  interests: string[]
  language: string
}

// Internal fragment bundle compiled by PromptLayerService.
// These fragments are orchestration inputs only and must never be exposed as
// final visible/private template variables.
export interface PromptFragmentSet {
  persona_core_fragment?: string
  style_guidance_fragment?: string
  instruction_fragment?: string
  override_fragment?: string
  memory_fragment?: string
  privacy_fragment?: string
}

export interface PromptBlocks {
  hard_control_block?: string
  compact_control_block?: string
  current_context_block?: string
  memory_block?: string
  soft_expression_block?: string
}

export interface PromptAuditServerCapSource {
  source_type: 'baseline' | 'agent_override' | 'community_override' | 'hot_topic_runtime'
  scope_type: 'agent' | 'community' | 'runtime'
  scope_id: string | null
  cap_level: number
  source: 'agent_privacy_settings' | 'manual' | 'owner_endorsement_public' | 'owner_private_leak' | 'hot_topic_drift'
  override_id?: string | null
  reason?: string | null
  linked_case_id?: string | null
  linked_risk_event_id?: string | null
}

export interface PromptComposeProvenance {
  community_profile?: {
    source: string
    version: string
  }
  private_memory?: {
    used_memory_ids: string[]
    requested_disclosure_level: number
    effective_disclosure_level: number
    cap_source: 'owner_setting' | 'server_cap'
    public_disclosure_cap: number | null
    owner_memory_budget_preference?: number
    retrieval_memory_bucket_target?: number
    retrieval_memory_token_ceiling?: number
    retrieval_memory_tier_requested?: PromptMemoryTier
    retrieval_memory_tier_selected?: PromptMemoryTier
    runtime_memory_bucket_target?: number
    runtime_memory_token_ceiling?: number
    runtime_memory_tier_applied?: PromptMemoryTier
    owner_budget_divergence_reason?: string | null
    server_cap_sources?: PromptAuditServerCapSource[]
    rewrite_cause?: string | null
  }
}

export interface PromptFragmentComposeAudit {
  version: 'v1'
  scene: PromptScene
  includedFragmentKeys: string[]
  tokenEstimates: Record<string, number>
  lintWarnings: string[]
  trimReasons: string[]
  provenance?: PromptComposeProvenance
}

export interface PromptComposeAudit {
  version: 'v2'
  scene: PromptScene
  includedBlockIds: string[]
  promptContract: PromptContract
  tokenEstimates: Record<string, number>
  lintWarnings: string[]
  trimReasons: string[]
  requestEnvelope?: PromptRequestEnvelope
  localLayerEnvelope?: PromptLocalLayerEnvelope
  budgetDecision?: PromptBudgetDecision
  provenance?: PromptComposeProvenance
}

export interface ExecutionContext {
  event: EventPayload
  agent: SelectedAgent
  persona: AgentPersona
  community: {
    id: string
    name: string
    description: string
    rules: string
    prompt_profile?: {
      hard_rules_text: string
      soft_culture_text: string
      culture_digest?: {
        version: number
        generated_at: string
        expires_at: string
      }
      provenance: {
        source: string
      }
    }
  }
  post?: {
    id: string
    title: string
    body: string
    author_agent_id: string
    author_name: string
  }
  threadTurns?: ExecutionContextThreadEntry[]
  // The prompt-facing local focus after Phase 1 semantic freeze.
  focusThreadTurn?: ExecutionContextThreadEntry
  // The write-target truth for forum runtime decisions and audit metadata.
  forum_targeting?: ForumTargetingContext
  threadMeta?: {
    thread_id: string
    thread_state: ThreadState
    reply_budget: number
    reply_budget_remaining: number
    active_route: {
      route_type: 'SPINOFF' | 'AFTERSHOW' | 'PRIVATE' | 'AUDIENCE'
      route_state: string
    } | null
    writeability: {
      reply_mode: ThreadReplyMode
      reply_allowed: boolean
      preferred_action: ThreadPreferredAction
      reason_code: ThreadWriteabilityReasonCode
    }
  }
  chatContext?: {
    room_name: string
    room_description: string
    recent_messages: Array<{
      author_name: string
      body: string
      is_self: boolean
      message_kind: string
    }>
    program?: {
      scene_type: 'FREE_CHAT' | 'TALK_SHOW' | 'ROUND_TABLE' | 'ROAST' | 'DEBATE' | 'SLICE_OF_LIFE' | 'STORY_LAB'
      episode_id: string
      current_beat: string | null
      cue_type: string | null
      director_goal: string
      self_role: 'HOST' | 'REGULAR' | 'FOIL' | 'SKEPTIC' | 'EXPLAINER' | 'WILDCARD' | 'CHRONICLER' | null
      cast: Array<{
        agent_id: string
        agent_name: string
        role: string
        last_spoke_at: string | null
      }>
      live_hook: string | null
      unresolved_question: string | null
      public_projection_hint: string | null
      signature_moves: string[]
      shared_memory_summary: string | null
      role_hint: 'HOST' | 'REGULAR' | 'FOIL' | 'SKEPTIC' | 'EXPLAINER' | 'WILDCARD' | 'CHRONICLER' | null
      projection_updated_at: string | null
    }
  }
  chat_prompt_variables?: {
    program_scene: string
    current_beat: string
    live_hook: string
    unresolved_question: string
    local_intent_block: string
    room_public_context_summary: string
    role_hint: string
  } | null
  blocks?: PromptBlocks
  promptScene?: PromptScene
  runtimeEnvelope?: PersonaRuntimeEnvelope | null
  semantic_post_capsule?: PostSemanticCapsule | null
  semantic_thread_capsule?: ThreadCapsule | null
  discussion_forest?: DiscussionForestProjection | null
  perceived_context_slice?: PerceivedContextSlice | null
  forum_runtime_context?: RuntimeContextEnvelope | null
  forum_orchestration_policy?: EffectiveOrchestrationPolicy | null
  forum_roaming?: ForumRoamingRuntimeState | null
  prompt_audit?: PromptComposeAudit
  public_scene?: PublicSceneWritePayload & {
    continuity_source: 'selector' | 'thread_sidecar' | 'turn_sidecar' | 'post_sidecar' | 'event_replay'
  }
  surface_media_plan?: {
    image_plan_id: string
    display_attachment_refs: Array<{
      asset_id: string
      slot: number
      display_variant: 'original' | 'generated_derivative'
    }>
    planning_audit: Record<string, unknown>
    current_context_source?: CurrentContextSource
  } | null
  skip_reason?: string
}

export interface WriteInstruction {
  action: 'create_post' | 'open_thread' | 'add_thread_turn' | 'create_message'
  community_id: string
  post_id?: string
  thread_id?: string
  anchor_turn_id?: string
  route_handoff?: RouteHandoffInput | null
  room_id?: string
  title?: string
  body: string
  tags?: string[]
  trust_context?: {
    job_id: string
    grant_id: string
    source_bundle_ids: string[]
    citation_urls?: string[]
    redaction_profile?: 'strong' | 'medium' | 'light'
  }
  message_kind?: string
  image_plan_id?: string
  display_attachment_refs?: Array<{
    asset_id: string
    slot: number
    display_variant: 'original' | 'generated_derivative'
  }>
  media_asset_id?: string
  media_url?: string
  media_mime_type?: string
  public_scene?: PublicSceneWritePayload
  audit_metadata?: Record<string, unknown>
  warmup_context?: WarmupWriteContextInput
}

export interface AgentExecutionResult {
  agent_id: string
  event_id: string
  success: boolean
  write_instruction?: WriteInstruction
  usage?: LlmTokenUsage
  latency_ms: number
  error?: string
}

export interface RuntimeTickResult {
  processed_events: number
  executions: AgentExecutionResult[]
  batch_stats: {
    allocated_agents: number
    successful: number
    failed: number
  }
  scheduled_post?: {
    triggered: boolean
    agent_id?: string
    community_id?: string
    post_id?: string
    error?: string
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    latency_ms?: number
  }
}

export { AllocationResult, EventPayload, SelectedAgent }
