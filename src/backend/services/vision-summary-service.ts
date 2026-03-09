import type { LLMGateway } from '../llm/llm-gateway.js'
import type { AgentInclinationVisionSummary } from '../repos/types.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'

export interface BuildVisionSummaryInput {
  mimeType: string
  ownerNote?: string | null
  sourceUrl?: string | null
  uploadBuffer?: Buffer | null
}

export class VisionSummaryService {
  constructor(private readonly llmGateway: LLMGateway) {}

  async build(input: BuildVisionSummaryInput): Promise<AgentInclinationVisionSummary> {
    try {
      if (this.llmGateway.isConfigured) {
        const imageUrl = this.resolveImageUrl(input)
        if (imageUrl) {
          const prompt = this.composePrompt(input.ownerNote, input.mimeType)
          const response = await this.llmGateway.generateHiddenArtifact({
            intent: 'vision_summary',
            scene: 'background_hidden',
            agentId: 'vision-summary',
            homeVoiceLineId: 'deepseek-director-v1',
            promptRef: PROMPT_TEMPLATE_REFS.internalVisionSummary,
            variables: {
              owner_note: input.ownerNote?.trim() || '（无）',
              mime_type: input.mimeType,
            },
            promptMessages: [
              {
                role: 'system',
                content: [
                  { type: 'text', text: '你是一个图像内容摘要助手。只输出 JSON。' },
                ],
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: imageUrl } },
                ],
              },
            ],
            budgetClass: 'hidden_multimodal',
            traceId: `vision-summary:${Date.now()}`,
            requestedTier: 'base',
            allowFallbackWithinLine: false,
            allowCrossFamily: false,
            temperature: 0.2,
            maxTokens: 300,
          })
          const parsed = this.tryParse(response.content)
          if (parsed) return parsed
        }
      }
    } catch (err) {
      console.warn('[VisionSummaryService] vision summary fallback:', err)
    }

    return this.fallback(input)
  }

  private resolveImageUrl(input: BuildVisionSummaryInput): string | null {
    if (input.sourceUrl) return input.sourceUrl
    if (!input.uploadBuffer || input.uploadBuffer.byteLength > 1_500_000) return null
    const base64 = input.uploadBuffer.toString('base64')
    return `data:${input.mimeType};base64,${base64}`
  }

  private composePrompt(ownerNote: string | null | undefined, mimeType: string): string {
    return [
      '请基于图片内容给出结构化摘要，字段固定为：',
      '{"theme":"", "scene":"", "mood":"", "discussion_points":["","",""]}',
      '要求：discussion_points 给 3-5 条短句；保持中性，不捏造细节。',
      `owner_note: ${ownerNote?.trim() || '（无）'}`,
      `mime_type: ${mimeType}`,
    ].join('\n')
  }

  private tryParse(content: string): AgentInclinationVisionSummary | null {
    const first = content.indexOf('{')
    const last = content.lastIndexOf('}')
    if (first < 0 || last <= first) return null
    const body = content.slice(first, last + 1)
    try {
      const parsed = JSON.parse(body) as Partial<AgentInclinationVisionSummary>
      const points = Array.isArray(parsed.discussion_points)
        ? parsed.discussion_points.filter((item): item is string => typeof item === 'string').slice(0, 5)
        : []
      if (!parsed.theme || !parsed.scene || !parsed.mood || points.length === 0) return null
      return {
        theme: String(parsed.theme).slice(0, 120),
        scene: String(parsed.scene).slice(0, 120),
        mood: String(parsed.mood).slice(0, 120),
        discussion_points: points.map((item) => item.slice(0, 160)),
      }
    } catch {
      return null
    }
  }

  private fallback(input: BuildVisionSummaryInput): AgentInclinationVisionSummary {
    const note = input.ownerNote?.trim() || ''
    const mood = /开心|搞笑|有趣|meme|fun|lol/i.test(note) ? '轻松活跃'
      : /严肃|批判|风险|担忧|critical|serious/i.test(note) ? '审慎克制'
      : '中性'
    const scene = input.mimeType === 'image/gif' ? '动图/表情包场景' : '图片讨论场景'
    const theme = note ? note.slice(0, 80) : '围绕视觉素材延展讨论'

    const points = note
      ? [
          '围绕 owner 给出的线索提炼一个清晰观点',
          '从图片可能引发的争议或共鸣角度切入',
          '引导其他 agent 从不同立场参与讨论',
        ]
      : [
          '先描述素材带来的直观感受，再提出问题',
          '从社区近期话题中寻找可衔接的讨论角度',
          '避免空泛赞美，输出可讨论的具体观点',
        ]

    return {
      theme,
      scene,
      mood,
      discussion_points: points,
    }
  }
}
