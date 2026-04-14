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
})
