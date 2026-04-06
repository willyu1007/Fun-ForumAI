import type {
  LlmChatOptions,
  LlmClientConfig,
  LlmProvider,
  LlmProviderConfig,
  LlmRequest,
  LlmResponse,
} from './types.js'
import { OpenAICompatibleProvider } from './providers/openai-compatible.js'

interface LlmAdapter {
  readonly id: string
  chat(request: LlmRequest, input: {
    provider: LlmProviderConfig
    providerRuntimeRegistry: ProviderRuntimeRegistry
  }): Promise<LlmResponse>
}

class ProviderRuntimeRegistry {
  constructor(private readonly providers: Map<string, LlmProvider>) {}

  resolve(config: LlmProviderConfig): LlmProvider {
    const providerKey = resolveProviderKey(config)
    const provider = this.providers.get(providerKey)
    if (!provider) {
      throw new Error(
        `Unknown LLM provider runtime: provider_id=${config.provider_id}, gateway_kind=${config.gateway_kind ?? 'unset'}`,
      )
    }
    return provider
  }

  get size(): number {
    return this.providers.size
  }
}

class OpenAIChatCompletionsAdapter implements LlmAdapter {
  readonly id = 'openai-chat-completions-v1'

  async chat(request: LlmRequest, input: {
    provider: LlmProviderConfig
    providerRuntimeRegistry: ProviderRuntimeRegistry
  }): Promise<LlmResponse> {
    const providerRuntime = input.providerRuntimeRegistry.resolve(input.provider)
    return providerRuntime.chat(request, input.provider)
  }
}

const providerRuntimes = new Map<string, LlmProvider>()
providerRuntimes.set('openai_compatible', new OpenAICompatibleProvider())

const adapterRuntimes = new Map<string, LlmAdapter>()
adapterRuntimes.set('openai-chat-completions-v1', new OpenAIChatCompletionsAdapter())

export class LlmClient {
  private readonly providerRuntimeRegistry = new ProviderRuntimeRegistry(providerRuntimes)

  constructor(private readonly cfg: LlmClientConfig) {}

  /**
   * Send a chat completion request.
   * Adapter selection is request-owned so gateway planning remains the source
   * of truth, while adapters own provider-runtime execution details.
   */
  async chat(opts: LlmChatOptions): Promise<LlmResponse> {
    const providerConfig: LlmProviderConfig = {
      ...opts.provider,
      timeout_ms: opts.provider.timeout_ms ?? this.cfg.defaults.timeout_ms,
      max_retries: opts.provider.max_retries ?? this.cfg.defaults.max_retries,
    }
    const adapterId = opts.adapter_id ?? defaultAdapterIdForProvider(providerConfig)
    const adapter = adapterRuntimes.get(adapterId)
    if (!adapter) {
      throw new Error(`Unknown LLM adapter runtime: adapter_id=${adapterId}`)
    }

    const start = Date.now()

    const response = await adapter.chat(
      {
        model: opts.model,
        messages: opts.messages,
        max_tokens: opts.max_tokens ?? this.cfg.defaults.max_tokens,
        temperature: opts.temperature ?? this.cfg.defaults.temperature,
        stop: opts.stop,
        response_mode: opts.response_mode,
      },
      {
        provider: providerConfig,
        providerRuntimeRegistry: this.providerRuntimeRegistry,
      },
    )

    const latencyMs = Date.now() - start
    console.log(
      `[LlmClient] adapter=${adapterId} provider=${providerConfig.provider_id} model=${response.model} tokens=${response.usage.total_tokens} latency=${latencyMs}ms`,
    )

    return {
      ...response,
      provider_id: providerConfig.provider_id,
    }
  }

  get isConfigured(): boolean {
    return this.providerRuntimeRegistry.size > 0 && adapterRuntimes.size > 0
  }
}

function defaultAdapterIdForProvider(config: LlmProviderConfig): string {
  const providerKey = resolveProviderKey(config)
  if (providerKey === 'openai_compatible') {
    return 'openai-chat-completions-v1'
  }
  return config.provider_id
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
