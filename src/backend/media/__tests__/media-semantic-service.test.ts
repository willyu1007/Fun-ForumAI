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
      modelId: 'qwen-flash-character',
      region: 'cn-beijing',
      endpointId: 'dashscope-cn-beijing',
      fallbackLevel: 'none',
      reasons: [],
      promptTemplateId: 'internal-vision-summary',
      promptVersion: 1,
    },
    promptRef: { id: 'internal-vision-summary', version: 1 },
    warnings: [],
  }
}

describe('MediaSemanticService', () => {
  it('passes the preferred gateway model id into hidden semantic extraction', async () => {
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
      agentRepo: {} as never,
      agentConfigRepo: {} as never,
      eventRepo: {} as never,
      agentRunRepo: {} as never,
      preferredModelId: 'qwen-vl-plus',
    })

    await service.extract({
      mimeType: 'image/png',
      uploadBuffer: Buffer.from([1, 2, 3]),
    })

    expect(generateHiddenArtifact).toHaveBeenCalledWith(expect.objectContaining({
      preferredModelId: 'qwen-vl-plus',
    }))
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
      agentRepo: {} as never,
      agentConfigRepo: {} as never,
      eventRepo: {} as never,
      agentRunRepo: {} as never,
      preferredModelId: 'qwen-vl-plus',
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
      agentRepo: {} as never,
      agentConfigRepo: {} as never,
      eventRepo: {} as never,
      agentRunRepo: {} as never,
      preferredModelId: 'qwen-vl-plus',
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
})
