// ─── LLM request / response ─────────────────────────────────

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmRequest {
  model: string
  messages: LlmMessage[]
  max_tokens?: number
  temperature?: number
  stop?: string[]
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
}

// ─── Provider abstraction ───────────────────────────────────

export interface LlmProviderConfig {
  provider_id: string
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
