import type { LlmProvider, LlmProviderConfig, LlmRequest, LlmResponse } from '../types.js'

interface OpenAIChatResponse {
  id: string
  choices: Array<{
    index: number
    message: { role: string; content: string }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
}

/**
 * OpenAI-compatible provider.
 * Works with OpenAI, Qwen (DashScope), DeepSeek, Kimi (Moonshot),
 * MiniMax, Ollama, vLLM, and any other OpenAI-format API.
 */
export class OpenAICompatibleProvider implements LlmProvider {
  readonly id = 'openai-compatible'

  async chat(request: LlmRequest, config: LlmProviderConfig): Promise<LlmResponse> {
    const url = `${config.base_url.replace(/\/+$/, '')}/chat/completions`

    const body = normalizeOpenAICompatibleBody({
      request,
      providerId: config.provider_id,
    })

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= config.max_retries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await sleep(delay)
      }

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), config.timeout_ms)

        const res = await fetch(url, {
          method: 'POST',
          headers: buildHeaders(config),
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        clearTimeout(timer)

        if (!res.ok) {
          const errBody = await res.text().catch(() => '')
          const err = new Error(`LLM API ${res.status}: ${errBody.slice(0, 500)}`)
          if (res.status >= 500 || res.status === 429) {
            lastError = err
            continue
          }
          throw err
        }

        const data = (await res.json()) as OpenAIChatResponse

        const choice = data.choices?.[0]
        if (!choice) {
          throw new Error('LLM API returned no choices')
        }

        return {
          content: choice.message.content ?? '',
          usage: {
            prompt_tokens: data.usage?.prompt_tokens ?? 0,
            completion_tokens: data.usage?.completion_tokens ?? 0,
            total_tokens: data.usage?.total_tokens ?? 0,
          },
          model: data.model,
          finish_reason: choice.finish_reason,
          meta: {
            attempts: attempt + 1,
          },
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          lastError = new Error(`LLM API timeout after ${config.timeout_ms}ms`)
          continue
        }
        if (attempt < config.max_retries && isRetryable(err)) {
          lastError = err as Error
          continue
        }
        throw err
      }
    }

    throw lastError ?? new Error('LLM API call failed after retries')
  }
}

function normalizeOpenAICompatibleBody(input: {
  request: LlmRequest
  providerId: string
}): Record<string, unknown> {
  const {
    request,
    providerId,
  } = input

  const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens,
      ...(request.response_mode === 'json_object'
        ? { response_format: { type: 'json_object' } }
        : {}),
    }

  // Moonshot K2-family models reject caller-specified temperatures other than
  // their fixed server-side values. We run them in the default thinking mode,
  // so normalize to the accepted 1.0 instead of leaking policy temperatures.
  if (providerId === 'moonshot-openai' && isMoonshotFixedTemperatureModel(request.model)) {
    body.temperature = 1
    return body
  }

  body.temperature = request.temperature
  return body
}

function isMoonshotFixedTemperatureModel(modelId: string): boolean {
  return /^kimi-k2([.-]|$)/.test(modelId)
}

function buildHeaders(config: LlmProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (!config.api_key) {
    return headers
  }
  switch (config.auth_strategy) {
    case 'x_api_key':
      headers['x-api-key'] = config.api_key
      break
    case 'custom':
      headers.Authorization = config.api_key
      break
    case 'bearer_api_key':
    default:
      headers.Authorization = `Bearer ${config.api_key}`
      break
  }
  return headers
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('ECONNRESET') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('fetch failed')
  }
  return false
}
