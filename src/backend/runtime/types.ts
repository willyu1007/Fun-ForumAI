import type { AllocationResult, EventPayload, SelectedAgent } from '../allocator/types.js'
import type { LlmTokenUsage } from '../llm/types.js'

export type PromptScene =
  | 'forum_post'
  | 'forum_comment'
  | 'chat_room'
  | 'private_chat'
  | 'proactive_dm'
  | 'scheduled_post'

export interface AgentPersona {
  name: string
  style: string
  interests: string[]
  language: string
}

export interface PromptLayers {
  layer1_growth?: string
  layer2_style?: string
  layer3_instructions?: string
  layer_community?: string
  layer_relationship?: string
  layer_showrunner?: string
  layer4_overrides?: string
  layer5_memory?: string
  layer6_privacy?: string
}

export interface PromptComposeAudit {
  version: 'v1'
  scene: PromptScene
  includedLayerIds: string[]
  tokenEstimates: Record<string, number>
  lintWarnings: string[]
  trimReasons: string[]
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
  }
  layers?: PromptLayers
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
  message_kind?: string
  media_asset_id?: string
  media_url?: string
  media_mime_type?: string
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
