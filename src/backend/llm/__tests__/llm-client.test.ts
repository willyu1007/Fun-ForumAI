import { afterEach, describe, expect, it, vi } from 'vitest'
import { LlmClient } from '../llm-client.js'

describe('LlmClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('routes provider calls through the selected adapter runtime', async () => {
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
          model: 'kimi-k2.5',
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

    const client = new LlmClient()

    const response = await client.chat({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'kimi-k2.5',
      max_tokens: 512,
      temperature: 0.7,
      adapter_id: 'openai-chat-completions-v1',
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
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'kimi-k2.5',
      temperature: 1,
    })
    expect(response.provider_id).toBe('moonshot-openai')
    expect(response.model).toBe('kimi-k2.5')
  })

  it('preserves caller temperature for non-moonshot providers', async () => {
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
            prompt_tokens: 10,
            completion_tokens: 7,
            total_tokens: 17,
          },
          model: 'qwen3.5-plus',
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

    const client = new LlmClient()

    await client.chat({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'qwen3.5-plus',
      max_tokens: 512,
      temperature: 0.7,
      adapter_id: 'openai-chat-completions-v1',
      provider: {
        provider_id: 'dashscope-openai',
        gateway_kind: 'openai_compatible',
        base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        api_key: 'dashscope-secret',
        timeout_ms: 30_000,
        max_retries: 0,
      },
    })

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'qwen3.5-plus',
      temperature: 0.7,
    })
  })

  it('routes Kimi Coding Plan model to the coding endpoint', async () => {
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
          model: 'kimi-for-coding',
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

    const client = new LlmClient()

    await client.chat({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'kimi-for-coding',
      max_tokens: 512,
      temperature: 0.7,
      adapter_id: 'openai-chat-completions-v1',
      provider: {
        provider_id: 'kimi-coding-openai',
        gateway_kind: 'openai_compatible',
        base_url: 'https://api.kimi.com/coding/v1',
        api_key: 'kimi-coding-secret',
        timeout_ms: 30_000,
        max_retries: 0,
      },
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.kimi.com/coding/v1/chat/completions')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'kimi-for-coding',
      temperature: 0.7,
    })
  })

  it('disables thinking for DeepSeek V4 flash content lanes', async () => {
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
            prompt_tokens: 10,
            completion_tokens: 7,
            total_tokens: 17,
          },
          model: 'deepseek-v4-flash',
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

    const client = new LlmClient()

    await client.chat({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'deepseek-v4-flash',
      max_tokens: 512,
      temperature: 0.7,
      adapter_id: 'openai-chat-completions-v1',
      provider: {
        provider_id: 'deepseek-openai',
        gateway_kind: 'openai_compatible',
        base_url: 'https://api.deepseek.com',
        api_key: 'deepseek-secret',
        timeout_ms: 30_000,
        max_retries: 0,
      },
    })

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'deepseek-v4-flash',
      temperature: 0.7,
      thinking: { type: 'disabled' },
    })
  })

  it('enables max-effort thinking for DeepSeek V4 pro director lanes', async () => {
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
            prompt_tokens: 10,
            completion_tokens: 7,
            total_tokens: 17,
          },
          model: 'deepseek-v4-pro',
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

    const client = new LlmClient()

    await client.chat({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'deepseek-v4-pro',
      max_tokens: 512,
      temperature: 0.7,
      adapter_id: 'openai-chat-completions-v1',
      provider: {
        provider_id: 'deepseek-openai',
        gateway_kind: 'openai_compatible',
        base_url: 'https://api.deepseek.com',
        api_key: 'deepseek-secret',
        timeout_ms: 30_000,
        max_retries: 0,
      },
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({
      model: 'deepseek-v4-pro',
      reasoning_effort: 'max',
      thinking: { type: 'enabled' },
    })
    expect(body).not.toHaveProperty('temperature')
  })

  it('rejects provider runtimes that are not implemented by the client', async () => {
    const client = new LlmClient()

    await expect(client.chat({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'kimi-k2.5',
      max_tokens: 512,
      temperature: 0.7,
      adapter_id: 'openai-chat-completions-v1',
      provider: {
        provider_id: 'future-native-provider',
        gateway_kind: 'native' as never,
        base_url: 'https://example.invalid/v1',
        api_key: 'secret',
        timeout_ms: 30_000,
        max_retries: 0,
      },
    })).rejects.toThrow('Unsupported LLM provider runtime')
  })
})
