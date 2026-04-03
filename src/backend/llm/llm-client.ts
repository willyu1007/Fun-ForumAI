import type {
  LlmChatOptions,
  LlmClientConfig,
  LlmProvider,
  LlmProviderConfig,
  LlmResponse,
} from './types.js'
import { OpenAICompatibleProvider } from './providers/openai-compatible.js'

const providers = new Map<string, LlmProvider>()
providers.set('openai_compatible', new OpenAICompatibleProvider())

export class LlmClient {
  constructor(private readonly cfg: LlmClientConfig) {}

  /**
   * Send a chat completion request.
   * Provider identity and endpoint are request-owned so runtime routing stays
   * with the execution plan instead of process env.
   */
  async chat(opts: LlmChatOptions): Promise<LlmResponse> {
    const providerConfig: LlmProviderConfig = {
      ...opts.provider,
      timeout_ms: opts.provider.timeout_ms ?? this.cfg.defaults.timeout_ms,
      max_retries: opts.provider.max_retries ?? this.cfg.defaults.max_retries,
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
        model: opts.model,
        messages: opts.messages,
        max_tokens: opts.max_tokens ?? this.cfg.defaults.max_tokens,
        temperature: opts.temperature ?? this.cfg.defaults.temperature,
        stop: opts.stop,
        response_mode: opts.response_mode,
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
    return providers.size > 0
  }
}

function resolveProviderKey(config: LlmProviderConfig): string {
  if (config.gateway_kind) {
    return config.gateway_kind
  }
  if (config.provider_id === 'openai-compatible' || config.provider_id.endsWith('-openai')) {
    return 'openai_compatible'
  }
  return config.provider_id
}
