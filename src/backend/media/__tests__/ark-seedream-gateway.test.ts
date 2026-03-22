import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import { ArkSeedreamGateway } from '../ark-seedream-gateway.js'

describe('ArkSeedreamGateway', () => {
  const originalMediaGeneration = { ...config.mediaGeneration }
  const originalFeatureFlags = {
    mediaGenerationV1: config.features.mediaGenerationV1,
  }

  afterEach(() => {
    Object.assign(config.mediaGeneration, originalMediaGeneration)
    Object.assign(config.features, originalFeatureFlags)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('calls the Ark image endpoint with the expected model and request body', async () => {
    Object.assign(config.features, {
      mediaGenerationV1: true,
    })
    Object.assign(config.mediaGeneration, {
      provider: 'ark-seedream',
      apiKey: 'seedream-secret',
      model: 'doubao-seedream-5-0-lite-260128',
      baseUrl: 'https://ark.example.com/',
      timeoutMs: 5_000,
    })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              url: 'https://cdn.example.com/generated.png',
              mime_type: 'image/png',
            },
          ],
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

    const gateway = new ArkSeedreamGateway()
    const result = await gateway.generate({
      prompt_brief: 'scene=city skyline',
      style_hint: 'cinematic',
      aspect_ratio_hint: '16:9',
      trace_id: 'trace-1',
    })

    expect(gateway.isConfigured).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://ark.example.com/api/v3/images/generations')

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer seedream-secret',
    })

    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      model: 'doubao-seedream-5-0-lite-260128',
      size: '2560x1440',
      n: 1,
      response_format: 'url',
      stream: false,
      sequential_image_generation: 'disabled',
    })
    expect(body.prompt).toContain('scene=city skyline')
    expect(body.prompt).toContain('style_hint=cinematic')

    expect(result).toEqual({
      image_url: 'https://cdn.example.com/generated.png',
      mime_type: 'image/png',
    })
  })
})
