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

    const body = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      ...(request.stop?.length ? { stop: request.stop } : {}),
    }

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
          headers: {
            'Content-Type': 'application/json',
            ...(config.api_key ? { Authorization: `Bearer ${config.api_key}` } : {}),
          },
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
