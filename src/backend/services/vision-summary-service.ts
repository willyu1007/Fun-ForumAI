import type { LlmClient } from '../llm/llm-client.js'
import type { AgentRepository, AgentConfigRepository } from '../repos/agent-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { AgentInclinationVisionSummary } from '../repos/types.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  recordPersonaObservation,
} from '../runtime/persona-observation.js'

export interface BuildVisionSummaryInput {
  agentId?: string
  mimeType: string
  ownerNote?: string | null
  sourceUrl?: string | null
  uploadBuffer?: Buffer | null
}

export interface VisionSummaryServiceDeps {
  llmClient: LlmClient
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
}

export class VisionSummaryService {
  constructor(private readonly deps: VisionSummaryServiceDeps) {}

  async build(input: BuildVisionSummaryInput): Promise<AgentInclinationVisionSummary> {
    let attempted = false
    let latencyMs: number | undefined
    let usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined
    let llmProviderId: string | undefined
    let llmModelId: string | undefined
    let parseSuccess = false
    let error: string | undefined

    try {
      if (this.deps.llmClient.isConfigured) {
        const imageUrl = this.resolveImageUrl(input)
        if (imageUrl) {
          const prompt = this.composePrompt(input.ownerNote, input.mimeType)
          attempted = true
          const startMs = Date.now()
          const response = await this.deps.llmClient.chat({
            messages: [
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
            temperature: 0.2,
            max_tokens: 300,
          })
          latencyMs = Date.now() - startMs
          usage = response.usage
          llmProviderId = response.provider_id
          llmModelId = response.model
          const parsed = this.tryParse(response.content)
          parseSuccess = Boolean(parsed)
          const summary = parsed ?? this.fallback(input)
          if (input.agentId) {
            this.recordVisionRun({
              agentId: input.agentId,
              summary,
              mimeType: input.mimeType,
              sourceKind: input.sourceUrl ? 'url' : 'upload',
              usage,
              latencyMs,
              parseSuccess,
              llmProviderId,
              llmModelId,
            })
          }
          return summary
        }
      }
    } catch (err) {
      console.warn('[VisionSummaryService] vision summary fallback:', err)
      attempted = true
      error = err instanceof Error ? err.message : 'vision_summary_failed'
    }

    const summary = this.fallback(input)
    if (attempted && input.agentId) {
      this.recordVisionRun({
        agentId: input.agentId,
        summary,
        mimeType: input.mimeType,
        sourceKind: input.sourceUrl ? 'url' : 'upload',
        usage,
        latencyMs,
        parseSuccess,
        llmProviderId,
        llmModelId,
        error,
      })
    }
    return summary
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

  private recordVisionRun(input: {
    agentId: string
    summary: AgentInclinationVisionSummary
    mimeType: string
    sourceKind: 'url' | 'upload'
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    latencyMs?: number
    parseSuccess: boolean
    llmProviderId?: string
    llmModelId?: string
    error?: string
  }): void {
    const agent = this.deps.agentRepo.findById(input.agentId)
    if (!agent) {
      return
    }

    const latestConfig = this.deps.agentConfigRepo.findLatest(input.agentId)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    const observation = buildPersonaObservation({
      sourceCallsiteId: 'vision-summary',
      scene: 'background_hidden',
      intent: 'vision_summary',
      visibility: 'hidden',
      coverageStatus: 'hidden_partial',
      personaSeedCode: resolved.summary.persona_seed_code,
      homeVoiceLineId: resolved.summary.home_voice_line_id,
      routingVoiceLineId: 'deepseek-director-v1',
      promptRef: { id: 'internal-vision-summary', version: 1 },
      requestedTier: 'base',
      resolvedTier: 'base',
      usage: input.usage,
      latencyMs: input.latencyMs,
      parseSuccess: input.parseSuccess,
      llmProviderId: input.llmProviderId,
      llmModelId: input.llmModelId,
      error: input.error ?? null,
    })

    try {
      const event = this.deps.eventRepo.create({
        event_type: 'VISION_SUMMARY_GENERATED',
        plane: 'RUNTIME',
        actor_type: 'agent',
        actor_id: input.agentId,
        correlation_id: `vision-summary:${input.agentId}:${Date.now()}`,
        payload_json: {
          agent_id: input.agentId,
          mime_type: input.mimeType,
          source_kind: input.sourceKind,
        },
      })

      this.deps.agentRunRepo.create({
        agent_id: input.agentId,
        trigger_event_id: event.id,
        input_digest: `vision_summary|mime:${input.mimeType}|source:${input.sourceKind}`,
        output_json: attachPersonaObservation(
          {
            mime_type: input.mimeType,
            source_kind: input.sourceKind,
            theme: input.summary.theme,
            discussion_points_count: input.summary.discussion_points.length,
          },
          observation,
        ),
        token_cost: input.usage?.total_tokens ?? 0,
        latency_ms: input.latencyMs ?? 0,
      })
      recordPersonaObservation(observation)
    } catch (err) {
      console.error('[VisionSummaryService] AgentRun record failed:', err)
    }
  }
}
