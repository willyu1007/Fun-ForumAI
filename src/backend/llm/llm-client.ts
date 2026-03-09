import type { LlmChatOptions, LlmClientConfig, LlmProvider, LlmResponse } from './types.js'
import { OpenAICompatibleProvider } from './providers/openai-compatible.js'

const providers = new Map<string, LlmProvider>()
providers.set('openai-compatible', new OpenAICompatibleProvider())
providers.set('dashscope-openai', new OpenAICompatibleProvider())
providers.set('zai-openai', new OpenAICompatibleProvider())
providers.set('deepseek-openai', new OpenAICompatibleProvider())

export class LlmClient {
  constructor(private readonly cfg: LlmClientConfig) {
    if (!cfg.provider.api_key) {
      console.warn('[LlmClient] LLM_API_KEY is not set — LLM calls will fail')
    }
  }

  /**
   * Send a chat completion request.
   * Falls back to configured defaults for model / max_tokens / temperature.
   * These defaults are a bootstrap compatibility path, not a visible-generation
   * authority once gateway routing profiles land.
   */
  async chat(opts: LlmChatOptions): Promise<LlmResponse> {
    const providerConfig = {
      ...this.cfg.provider,
      ...opts.provider,
    }

    const provider = providers.get(providerConfig.provider_id)
    if (!provider) {
      throw new Error(`Unknown LLM provider: ${providerConfig.provider_id}`)
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
      providerConfig,
    )

    const latencyMs = Date.now() - start
    console.log(
      `[LlmClient] provider=${providerConfig.provider_id} model=${response.model} tokens=${response.usage.total_tokens} latency=${latencyMs}ms`,
    )

    return {
      ...response,
      provider_id: providerConfig.provider_id,
    }
  }

  get isConfigured(): boolean {
    return !!this.cfg.provider.api_key
  }
}
