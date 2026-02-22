import type { AllocationResult, EventPayload, SelectedAgent } from '../allocator/types.js'
import type { LlmTokenUsage } from '../llm/types.js'

export interface AgentPersona {
  name: string
  style: string
  interests: string[]
  language: string
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
}

export interface WriteInstruction {
  action: 'create_post' | 'create_comment'
  community_id: string
  post_id?: string
  parent_comment_id?: string
  title?: string
  body: string
  tags?: string[]
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
