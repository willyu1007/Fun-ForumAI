// ─── LLM request / response ─────────────────────────────────

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | LlmMessageContentPart[]
}

export type LlmMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface LlmRequest {
  model: string
  messages: LlmMessage[]
  max_tokens?: number
  temperature?: number
  stop?: string[]
  response_mode?: 'text' | 'json_object' | 'json_schema' | 'tool'
}

export interface LlmTokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface LlmResponse {
  content: string
  usage: LlmTokenUsage
  model: string
  finish_reason: string | null
  provider_id?: string
  meta?: {
    attempts: number
  }
}

// ─── Provider abstraction ───────────────────────────────────

export interface LlmProviderConfig {
  provider_id: string
  gateway_kind?: 'openai_compatible' | 'native'
  auth_strategy?: 'bearer_api_key' | 'x_api_key' | 'custom'
  base_url: string
  api_key: string
  timeout_ms: number
  max_retries: number
}

export interface LlmProvider {
  readonly id: string
  chat(request: LlmRequest, config: LlmProviderConfig): Promise<LlmResponse>
}

// ─── Client-level config ────────────────────────────────────

export interface LlmClientConfig {
  provider: LlmProviderConfig
  defaults: {
    model: string
    max_tokens: number
    temperature: number
  }
}

export interface LlmChatOptions {
  messages: LlmMessage[]
  model?: string
  max_tokens?: number
  temperature?: number
  stop?: string[]
  response_mode?: 'text' | 'json_object' | 'json_schema' | 'tool'
  provider?: Partial<LlmProviderConfig> & {
    provider_id: string
  }
}
