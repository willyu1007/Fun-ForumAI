import { describe, expect, it, vi } from 'vitest'
import { MediaSemanticService } from '../media-semantic-service.js'

function buildGatewayResponse(content: string) {
  return {
    content,
    messages: [],
    usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
    finishReason: 'stop',
    latencyMs: 20,
    platformRetryCount: 0,
    renderDecision: {
      voiceLineId: 'deepseek-director-v1',
      tier: 'base',
      profileId: 'deepseek-director-vision-summary-base',
      providerId: 'dashscope-openai',
      modelId: 'qwen-vl-plus',
      region: 'cn-beijing',
      endpointId: 'dashscope-cn-beijing',
      fallbackLevel: 'none',
      reasons: [],
      promptTemplateId: 'internal-vision-summary',
      promptVersion: 2,
    },
    promptRef: { id: 'internal-vision-summary', version: 2 },
    warnings: [],
  }
}

describe('MediaSemanticService', () => {
  const promptEngine = {
    render: vi.fn(() => [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]),
  } as never

  it('lets hidden semantic extraction resolve the vision model through gateway routing', async () => {
    const generateHiddenArtifact = vi.fn(async () => buildGatewayResponse(JSON.stringify({
      theme: 'theme',
      scene: 'scene',
      mood: 'calm',
      discussion_points: ['point'],
      salient_entities: ['entity'],
      ocr_snippets: [],
      safety_labels: [],
      public_safe_summary: 'safe summary',
      internal_full_summary: 'full summary',
    })))

    const service = new MediaSemanticService({
      llmGateway: {
        isConfigured: true,
        generateHiddenArtifact,
      } as never,
      promptEngine,
      agentRepo: {} as never,
      agentConfigRepo: {} as never,
      eventRepo: {} as never,
      agentRunRepo: {} as never,
    })

    await service.extract({
      mimeType: 'image/png',
      uploadBuffer: Buffer.from([1, 2, 3]),
    })

    const request = (
      vi.mocked(generateHiddenArtifact).mock.calls.at(0) as [Record<string, unknown>] | undefined
    )?.[0]
    expect(request).toBeDefined()
    expect('preferredModelId' in (request ?? {})).toBe(false)
  })

  it('inlines upload bytes even for large images before falling back to remote URLs', async () => {
    const generateHiddenArtifact = vi.fn(async () => buildGatewayResponse(JSON.stringify({
      theme: 'theme',
      scene: 'scene',
      mood: 'focused',
      discussion_points: ['point'],
      salient_entities: [],
      ocr_snippets: [],
      safety_labels: [],
      public_safe_summary: 'safe summary',
      internal_full_summary: 'full summary',
    })))

    const service = new MediaSemanticService({
      llmGateway: {
        isConfigured: true,
        generateHiddenArtifact,
      } as never,
      promptEngine,
      agentRepo: {} as never,
      agentConfigRepo: {} as never,
      eventRepo: {} as never,
      agentRunRepo: {} as never,
    })

    await service.extract({
      mimeType: 'image/png',
      uploadBuffer: Buffer.alloc(2_000_000, 7),
      sourceUrl: 'https://example.com/fallback.png',
    })

    const request = (
      generateHiddenArtifact as unknown as {
        mock: {
          calls: Array<[{
            promptMessages?: Array<{
              content?: Array<{
                type?: string
                image_url?: {
                  url?: string
                }
              }>
            }>
          }]>
        }
      }
    ).mock.calls[0]?.[0] as {
      promptMessages?: Array<{
        content?: Array<{
          type?: string
          image_url?: {
            url?: string
          }
        }>
      }>
    } | undefined
    const imageMessage = request?.promptMessages?.[1]?.content?.[1]
    expect(imageMessage?.type).toBe('image_url')
    expect(imageMessage?.image_url?.url).toMatch(/^data:image\/png;base64,/)
  })

  it('accepts sparse but structured multimodal JSON and fills missing required fields', async () => {
    const generateHiddenArtifact = vi.fn(async () => buildGatewayResponse(JSON.stringify({
      theme: '',
      scene: '',
      mood: '',
      discussion_points: [],
      salient_entities: [],
      ocr_snippets: [],
      safety_labels: [],
      public_safe_summary: 'The image is entirely red with no discernible content.',
      internal_full_summary: 'The image consists of a solid red color with no visible elements.',
    })))

    const service = new MediaSemanticService({
      llmGateway: {
        isConfigured: true,
        generateHiddenArtifact,
      } as never,
      promptEngine,
      agentRepo: {} as never,
      agentConfigRepo: {} as never,
      eventRepo: {} as never,
      agentRunRepo: {} as never,
    })

    const result = await service.extract({
      mimeType: 'image/png',
      uploadBuffer: Buffer.from([1, 2, 3]),
    })

    expect(result.extraction_status).toBe('completed')
    expect(result.quality_grade).toBe('rich')
    expect(result.summary.theme).toBe('visual discussion material')
    expect(result.summary.scene).toBe('static visual scene')
    expect(result.summary.public_safe_summary).toBe('The image is entirely red with no discernible content.')
  })

  it('skips the vision model and falls back immediately when dimensions are below provider minimums', async () => {
    const generateHiddenArtifact = vi.fn()

    const service = new MediaSemanticService({
      llmGateway: {
        isConfigured: true,
        generateHiddenArtifact,
      } as never,
      promptEngine,
      agentRepo: {} as never,
      agentConfigRepo: {} as never,
      eventRepo: {} as never,
      agentRunRepo: {} as never,
    })

    const result = await service.extract({
      mimeType: 'image/png',
      uploadBuffer: Buffer.from([1, 2, 3]),
      width: 1,
      height: 1,
    })

    expect(generateHiddenArtifact).not.toHaveBeenCalled()
    expect(result.extraction_status).toBe('fallback')
    expect(result.summary.scene).toBe('static visual scene')
  })
})
