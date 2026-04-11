import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import { ArkSeedreamGateway } from '../ark-seedream-gateway.js'
import { compileMediaGenerationSpec } from '../media-generation-compiler.js'

describe('ArkSeedreamGateway', () => {
  const originalMediaGeneration = { ...config.mediaGeneration }
  const originalFeatureFlags = {
    mediaGenerationV1: config.launch.capabilities.mediaGenerationV1,
  }

  afterEach(() => {
    Object.assign(config.mediaGeneration, originalMediaGeneration)
    Object.assign(config.launch.capabilities, originalFeatureFlags)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('calls the Ark image endpoint with the expected model and request body', async () => {
    Object.assign(config.launch.capabilities, {
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
    const compiledPrompt = compileMediaGenerationSpec({
      spec: {
        intent: 'reference_derive',
        subject_anchors: ['city skyline'],
        scene_constraints: ['city skyline'],
        style_constraints: ['cinematic'],
        negative_constraints: [],
        source_projections: ['projection-1'],
        output_policy: {
          aspect_ratio_hint: '16:9',
          public_safe_only: true,
          derivative_display_only: true,
        },
      },
      style_hint: 'cinematic',
    })
    const result = await gateway.generate({
      compiled_prompt: compiledPrompt,
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
    expect(body.prompt).toContain('scene_constraints: city skyline')
    expect(body.prompt).toContain('style_hint: cinematic')

    expect(result).toEqual({
      image_url: 'https://cdn.example.com/generated.png',
      mime_type: 'image/png',
    })
  })
})
