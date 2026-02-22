import type { LlmClientConfig, LlmMessage, LlmProvider, LlmResponse } from './types.js'
import { OpenAICompatibleProvider } from './providers/openai-compatible.js'

const providers = new Map<string, LlmProvider>()
providers.set('openai-compatible', new OpenAICompatibleProvider())

export class LlmClient {
  constructor(private readonly cfg: LlmClientConfig) {
    if (!cfg.provider.api_key) {
      console.warn('[LlmClient] LLM_API_KEY is not set — LLM calls will fail')
    }
  }

  /**
   * Send a chat completion request.
   * Falls back to configured defaults for model / max_tokens / temperature.
   */
  async chat(opts: {
    messages: LlmMessage[]
    model?: string
    max_tokens?: number
    temperature?: number
    stop?: string[]
  }): Promise<LlmResponse> {
    const provider = providers.get(this.cfg.provider.provider_id)
    if (!provider) {
      throw new Error(`Unknown LLM provider: ${this.cfg.provider.provider_id}`)
    }

    const start = Date.now()

    const response = await provider.chat(
      {
        model: opts.model ?? this.cfg.defaults.model,
        messages: opts.messages,
        max_tokens: opts.max_tokens ?? this.cfg.defaults.max_tokens,
        temperature: opts.temperature ?? this.cfg.defaults.temperature,
        stop: opts.stop,
      },
      this.cfg.provider,
    )

    const latencyMs = Date.now() - start
    console.log(
      `[LlmClient] model=${response.model} tokens=${response.usage.total_tokens} latency=${latencyMs}ms`,
    )

    return response
  }

  get isConfigured(): boolean {
    return !!this.cfg.provider.api_key
  }
}
