import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import { DashScopeQwenImageGateway } from '../dashscope-qwen-image-gateway.js'
import { compileMediaGenerationSpec } from '../media-generation-compiler.js'

describe('DashScopeQwenImageGateway', () => {
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

  it('calls the DashScope multimodal generation endpoint with the expected payload', async () => {
    Object.assign(config.launch.capabilities, {
      mediaGenerationV1: true,
    })
    Object.assign(config.mediaGeneration, {
      fallbackProvider: 'dashscope-qwen-image',
      fallbackApiKey: 'dashscope-secret',
      fallbackModel: 'qwen-image-2.0',
      fallbackBaseUrl: 'https://dashscope.example.com/',
      timeoutMs: 5_000,
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: {
            choices: [
              {
                message: {
                  content: [
                    {
                      image: 'https://cdn.example.com/qwen-image.png',
                    },
                  ],
                },
              },
            ],
          },
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

    const gateway = new DashScopeQwenImageGateway()
    const compiledPrompt = compileMediaGenerationSpec({
      spec: {
        intent: 'reference_derive',
        subject_anchors: ['city skyline'],
        scene_constraints: ['city skyline'],
        style_constraints: ['cinematic'],
        negative_constraints: [],
        source_projections: ['projection-1'],
        output_policy: {
          aspect_ratio_hint: '4:5',
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
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://dashscope.example.com/api/v1/services/aigc/multimodal-generation/generation',
    )

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer dashscope-secret',
    })

    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      model: 'qwen-image-2.0',
      parameters: {
        watermark: false,
        prompt_extend: true,
        size: '1792*2240',
      },
    })
    expect(body.input.messages[0].content).toEqual([
      {
        text: expect.stringContaining('scene_constraints: city skyline'),
      },
    ])

    expect(result).toMatchObject({
      image_url: 'https://cdn.example.com/qwen-image.png',
      mime_type: 'image/png',
      provider_id: 'dashscope-qwen-image',
      model_name: 'qwen-image-2.0',
    })
  })

  it('can run as the primary media generation provider from MEDIA_GENERATION_* settings', async () => {
    Object.assign(config.launch.capabilities, {
      mediaGenerationV1: true,
    })
    Object.assign(config.mediaGeneration, {
      provider: 'dashscope-qwen-image',
      apiKey: 'primary-dashscope-secret',
      model: 'qwen-image-2.0',
      baseUrl: 'https://dashscope-primary.example.com',
      timeoutMs: 5_000,
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: {
            images: [
              {
                url: 'https://cdn.example.com/qwen-primary.png',
              },
            ],
          },
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

    const gateway = new DashScopeQwenImageGateway({ role: 'primary' })
    const compiledPrompt = compileMediaGenerationSpec({
      spec: {
        intent: 'scratch_scene',
        subject_anchors: ['desktop workflow'],
        scene_constraints: ['desktop workflow'],
        style_constraints: ['editorial photo'],
        negative_constraints: [],
        source_projections: [],
        output_policy: {
          aspect_ratio_hint: '16:9',
          public_safe_only: true,
          derivative_display_only: false,
        },
      },
      style_hint: 'editorial photo',
    })

    const result = await gateway.generate({
      compiled_prompt: compiledPrompt,
      trace_id: 'trace-primary-qwen',
    })

    expect(gateway.isConfigured).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer primary-dashscope-secret',
    })
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'qwen-image-2.0',
      parameters: {
        size: '2688*1536',
      },
    })
    expect(result).toMatchObject({
      image_url: 'https://cdn.example.com/qwen-primary.png',
      provider_request_summary: {
        route: 'primary_direct',
        selected_provider_id: 'dashscope-qwen-image',
        selected_model_name: 'qwen-image-2.0',
      },
    })
  })
})
