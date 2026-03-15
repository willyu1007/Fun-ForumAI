import type { LlmChatOptions, LlmClientConfig, LlmProvider, LlmResponse } from './types.js'
import { OpenAICompatibleProvider } from './providers/openai-compatible.js'

const providers = new Map<string, LlmProvider>()
providers.set('openai_compatible', new OpenAICompatibleProvider())

export class LlmClient {
  constructor(private readonly cfg: LlmClientConfig) {}

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

    const providerKey = resolveProviderKey(providerConfig)
    const provider = providers.get(providerKey)
    if (!provider) {
      throw new Error(
        `Unknown LLM provider runtime: provider_id=${providerConfig.provider_id}, gateway_kind=${providerConfig.gateway_kind ?? 'unset'}`,
      )
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

function resolveProviderKey(config: LlmClientConfig['provider']): string {
  if (config.gateway_kind) {
    return config.gateway_kind
  }
  if (config.provider_id === 'openai-compatible' || config.provider_id.endsWith('-openai')) {
    return 'openai_compatible'
  }
  return config.provider_id
}
