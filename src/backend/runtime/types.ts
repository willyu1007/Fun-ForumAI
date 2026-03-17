import type { AllocationResult, EventPayload, SelectedAgent } from '../allocator/types.js'
import type { LlmTokenUsage } from '../llm/types.js'
import type { PublicSceneWritePayload } from '../services/public-scene-runtime.js'
import type { PersonaRuntimeEnvelope } from './persona-runtime-types.js'

// Legacy prompt invocation scene names. These are not the same contract as
// director_surface / actor_surface / private_surface introduced by T-094.
export type PromptScene =
  | 'forum_post'
  | 'forum_comment'
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
}

export interface AgentPersona {
  name: string
  style: string
  interests: string[]
  language: string
}

export interface PromptLayers {
  layer1_traits?: string
  layer2_style?: string
  layer3_instructions?: string
  layer_community?: string
  layer_relationship?: string
  layer_showrunner?: string
  layer4_overrides?: string
  layer5_memory?: string
  layer6_privacy?: string
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

export interface PromptComposeAudit {
  version: 'v1' | 'v2'
  scene: PromptScene
  includedLayerIds: string[]
  tokenEstimates: Record<string, number>
  lintWarnings: string[]
  trimReasons: string[]
  requestEnvelope?: PromptRequestEnvelope
  localLayerEnvelope?: PromptLocalLayerEnvelope
  budgetDecision?: PromptBudgetDecision
  provenance?: {
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
      runtime_memory_bucket_target?: number
      runtime_memory_token_ceiling?: number
      runtime_memory_tier_applied?: PromptMemoryTier
      owner_budget_divergence_reason?: string | null
      server_cap_sources?: PromptAuditServerCapSource[]
      rewrite_cause?: string | null
    }
  }
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
  comments?: Array<{
    id: string
    body: string
    author_agent_id: string
    author_name: string
  }>
  targetComment?: {
    id: string
    body: string
    author_agent_id: string
    author_name: string
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
  layers?: PromptLayers
  promptScene?: PromptScene
  runtimeEnvelope?: PersonaRuntimeEnvelope | null
  prompt_audit?: PromptComposeAudit
  public_scene?: PublicSceneWritePayload & {
    continuity_source: 'selector' | 'comment_sidecar' | 'post_sidecar' | 'event_replay'
  }
  skip_reason?: string
}

export interface WriteInstruction {
  action: 'create_post' | 'create_comment' | 'create_message'
  community_id: string
  post_id?: string
  parent_comment_id?: string
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
  media_asset_id?: string
  media_url?: string
  media_mime_type?: string
  public_scene?: PublicSceneWritePayload
  audit_metadata?: Record<string, unknown>
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
