import { afterEach, describe, expect, it, vi } from 'vitest'
import { LlmClient } from '../llm-client.js'

describe('LlmClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('routes provider calls through the configured gateway kind', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'ok',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 8,
            total_tokens: 20,
          },
          model: 'kimi-k2-0905-preview',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new LlmClient({
      provider: {
        provider_id: 'dashscope-openai',
        gateway_kind: 'openai_compatible',
        base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        api_key: '',
        timeout_ms: 30_000,
        max_retries: 0,
      },
      defaults: {
        model: 'qwen-plus-character',
        max_tokens: 512,
        temperature: 0.7,
      },
    })

    const response = await client.chat({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'kimi-k2-0905-preview',
      provider: {
        provider_id: 'moonshot-openai',
        gateway_kind: 'openai_compatible',
        base_url: 'https://api.moonshot.cn/v1',
        api_key: 'moonshot-secret',
        timeout_ms: 30_000,
        max_retries: 0,
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.moonshot.cn/v1/chat/completions')
    expect(response.provider_id).toBe('moonshot-openai')
    expect(response.model).toBe('kimi-k2-0905-preview')
  })
})
