import { describe, expect, it, vi } from 'vitest'
import { compileMediaGenerationSpec } from '../media-generation-compiler.js'
import {
  FallbackMediaGenerationGateway,
  MEDIA_GENERATION_FALLBACK_ROUTE_PROVIDER_ID,
} from '../fallback-media-generation-gateway.js'
import {
  MediaGenerationGatewayError,
  type MediaGenerationGateway,
} from '../media-generation-gateway.js'

function buildInput() {
  return {
    compiled_prompt: compileMediaGenerationSpec({
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
    }),
    trace_id: 'trace-fallback-1',
  }
}

function buildGatewayStub(input: {
  providerId: string
  modelName: string
  isConfigured?: boolean
  generate: MediaGenerationGateway['generate']
}): MediaGenerationGateway {
  return {
    providerId: input.providerId,
    modelName: input.modelName,
    isConfigured: input.isConfigured ?? true,
    generate: input.generate,
  }
}

describe('FallbackMediaGenerationGateway', () => {
  it('is configured when only the fallback provider is configured', async () => {
    const primary = buildGatewayStub({
      providerId: 'ark-seedream',
      modelName: 'doubao-seedream-5-0-lite-260128',
      isConfigured: false,
      generate: vi.fn(async () => {
        throw new MediaGenerationGatewayError('primary_not_configured', {
          provider_id: 'ark-seedream',
          model_name: 'doubao-seedream-5-0-lite-260128',
        })
      }),
    })
    const fallback = buildGatewayStub({
      providerId: 'dashscope-qwen-image',
      modelName: 'qwen-image-2.0',
      isConfigured: true,
      generate: vi.fn(async () => ({
        image_url: 'https://cdn.example.com/fallback-only.png',
        mime_type: 'image/png',
        provider_id: 'dashscope-qwen-image',
        model_name: 'qwen-image-2.0',
      })),
    })
    const gateway = new FallbackMediaGenerationGateway({ primary, fallback })

    expect(gateway.isConfigured).toBe(true)

    const result = await gateway.generate(buildInput())

    expect(result).toMatchObject({
      image_url: 'https://cdn.example.com/fallback-only.png',
      provider_request_summary: {
        route: 'fallback',
        selected_provider_id: 'dashscope-qwen-image',
        selected_model_name: 'qwen-image-2.0',
      },
    })
  })

  it('preserves the composed primary summary instead of overwriting it with the inner gateway summary', async () => {
    const primary = buildGatewayStub({
      providerId: 'ark-seedream',
      modelName: 'doubao-seedream-5-0-lite-260128',
      generate: vi.fn(async () => ({
        image_url: 'https://cdn.example.com/primary.png',
        mime_type: 'image/png',
        provider_id: 'ark-seedream',
        model_name: 'doubao-seedream-5-0-lite-260128',
        provider_request_summary: {
          route: 'primary_direct',
          attempts: [
            {
              provider_id: 'ark-seedream',
              model_name: 'doubao-seedream-5-0-lite-260128',
              outcome: 'succeeded',
            },
          ],
          upstream_request_id: 'ark-req-1',
        },
      })),
    })
    const fallback = buildGatewayStub({
      providerId: 'dashscope-qwen-image',
      modelName: 'qwen-image-2.0',
      generate: vi.fn(async () => {
        throw new Error('fallback should not run')
      }),
    })
    const gateway = new FallbackMediaGenerationGateway({ primary, fallback })

    expect(gateway.providerId).toBe(MEDIA_GENERATION_FALLBACK_ROUTE_PROVIDER_ID)

    const result = await gateway.generate(buildInput())

    expect(fallback.generate).not.toHaveBeenCalled()
    expect(result.provider_request_summary).toMatchObject({
      route: 'primary',
      selected_provider_id: 'ark-seedream',
      selected_model_name: 'doubao-seedream-5-0-lite-260128',
      upstream_request_id: 'ark-req-1',
    })
    expect(result.provider_request_summary?.attempts).toEqual([
      {
        provider_id: 'ark-seedream',
        model_name: 'doubao-seedream-5-0-lite-260128',
        outcome: 'succeeded',
      },
    ])
  })

  it('keeps both attempts when the fallback provider succeeds', async () => {
    const primary = buildGatewayStub({
      providerId: 'ark-seedream',
      modelName: 'doubao-seedream-5-0-lite-260128',
      generate: vi.fn(async () => {
        throw new MediaGenerationGatewayError('seedream_generation_failed', {
          provider_id: 'ark-seedream',
          model_name: 'doubao-seedream-5-0-lite-260128',
          provider_request_summary: {
            route: 'primary_direct',
            attempts: [
              {
                provider_id: 'ark-seedream',
                model_name: 'doubao-seedream-5-0-lite-260128',
                outcome: 'failed',
                error_message: 'seedream_generation_failed',
              },
            ],
            upstream_request_id: 'ark-req-2',
          },
        })
      }),
    })
    const fallback = buildGatewayStub({
      providerId: 'dashscope-qwen-image',
      modelName: 'qwen-image-2.0',
      generate: vi.fn(async () => ({
        image_url: 'https://cdn.example.com/fallback.png',
        mime_type: 'image/png',
        provider_id: 'dashscope-qwen-image',
        model_name: 'qwen-image-2.0',
        provider_request_summary: {
          route: 'fallback_direct',
          attempts: [
            {
              provider_id: 'dashscope-qwen-image',
              model_name: 'qwen-image-2.0',
              outcome: 'succeeded',
            },
          ],
          fallback_request_id: 'dash-req-1',
        },
      })),
    })
    const gateway = new FallbackMediaGenerationGateway({ primary, fallback })

    const result = await gateway.generate(buildInput())

    expect(result.provider_request_summary).toMatchObject({
      route: 'fallback',
      selected_provider_id: 'dashscope-qwen-image',
      selected_model_name: 'qwen-image-2.0',
      fallback_request_id: 'dash-req-1',
    })
    expect(result.provider_request_summary?.attempts).toEqual([
      {
        provider_id: 'ark-seedream',
        model_name: 'doubao-seedream-5-0-lite-260128',
        outcome: 'failed',
        error_message: 'seedream_generation_failed',
      },
      {
        provider_id: 'dashscope-qwen-image',
        model_name: 'qwen-image-2.0',
        outcome: 'succeeded',
      },
    ])
  })

  it('surfaces both failed attempts when the fallback provider also fails', async () => {
    const primary = buildGatewayStub({
      providerId: 'ark-seedream',
      modelName: 'doubao-seedream-5-0-lite-260128',
      generate: vi.fn(async () => {
        throw new MediaGenerationGatewayError('seedream_generation_failed', {
          provider_id: 'ark-seedream',
          model_name: 'doubao-seedream-5-0-lite-260128',
        })
      }),
    })
    const fallback = buildGatewayStub({
      providerId: 'dashscope-qwen-image',
      modelName: 'qwen-image-2.0',
      generate: vi.fn(async () => {
        throw new MediaGenerationGatewayError('qwen_image_generation_failed', {
          provider_id: 'dashscope-qwen-image',
          model_name: 'qwen-image-2.0',
        })
      }),
    })
    const gateway = new FallbackMediaGenerationGateway({ primary, fallback })

    await expect(gateway.generate(buildInput())).rejects.toMatchObject({
      name: 'MediaGenerationGatewayError',
      provider_id: 'dashscope-qwen-image',
      model_name: 'qwen-image-2.0',
      provider_request_summary: {
        route: 'fallback_exhausted',
        selected_provider_id: null,
        selected_model_name: null,
        attempts: [
          {
            provider_id: 'ark-seedream',
            model_name: 'doubao-seedream-5-0-lite-260128',
            outcome: 'failed',
            error_message: 'seedream_generation_failed',
          },
          {
            provider_id: 'dashscope-qwen-image',
            model_name: 'qwen-image-2.0',
            outcome: 'failed',
            error_message: 'qwen_image_generation_failed',
          },
        ],
      },
    })
  })
})
