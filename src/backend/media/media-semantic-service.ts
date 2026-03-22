import type { LLMGateway } from '../llm/llm-gateway.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type { AgentRepository, AgentConfigRepository } from '../repos/agent-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { MediaExtractionStatus, MediaQualityGrade, MediaSemanticSummary } from '../repos/types.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { pickModelReachableMediaUrl } from './media-url.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  recordPersonaObservation,
} from '../runtime/persona-observation.js'

export interface BuildMediaSemanticInput {
  agentId?: string
  mimeType: string
  sourceUrl?: string | null
  uploadBuffer?: Buffer | null
}

export interface MediaSemanticExtraction {
  schema_version: string
  model_provider: string
  model_name: string
  model_version: string
  extraction_status: MediaExtractionStatus
  quality_grade: MediaQualityGrade
  summary: MediaSemanticSummary
}

export interface MediaSemanticServiceDeps {
  llmGateway: LLMGateway
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  preferredModelId?: string
}

const MEDIA_SEMANTIC_SCHEMA_VERSION = 'media_semantic_summary.v1'

function sanitizeString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

export function buildFallbackMediaSemanticSummary(
  mimeType: string,
  scope: 'generic' | 'legacy' = 'generic',
): MediaSemanticSummary {
  const scene = mimeType === 'image/gif' ? 'looping visual scene' : 'static visual scene'
  const theme = scope === 'legacy' ? 'legacy imported media asset' : 'visual discussion material'
  return {
    theme,
    scene,
    mood: 'neutral',
    discussion_points: [
      'Describe the most obvious visual cue before making any claim.',
      'Use the image as a discussion seed instead of assuming hidden intent.',
      'Keep follow-up questions grounded in what is actually visible.',
    ],
    salient_entities: [],
    ocr_snippets: [],
    safety_labels: [],
    public_safe_summary: `A ${scene} that can support discussion without exposing private context.`,
    internal_full_summary: `Fallback semantic summary for ${mimeType}.`,
  }
}

export class MediaSemanticService {
  constructor(private readonly deps: MediaSemanticServiceDeps) {}

  async extract(input: BuildMediaSemanticInput): Promise<MediaSemanticExtraction> {
    let attempted = false
    let latencyMs: number | undefined
    let usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined
    let llmProviderId = 'fallback'
    let llmModelId = 'fallback'
    let parseSuccess = false
    let error: string | undefined

    if (this.deps.llmGateway.isConfigured) {
      const imageUrls = this.resolveImageUrls(input)
      for (const imageUrl of imageUrls) {
        attempted = true
        const startMs = Date.now()
        try {
          const response = await this.deps.llmGateway.generateHiddenArtifact({
            intent: 'vision_summary',
            scene: 'background_hidden',
            agentId: input.agentId ?? 'media-semantic',
            homeVoiceLineId: 'deepseek-director-v1',
            preferredModelId: this.deps.preferredModelId,
            promptRef: PROMPT_TEMPLATE_REFS.internalVisionSummary,
            variables: {
              mime_type: input.mimeType,
            },
            promptMessages: [
              {
                role: 'system',
                content: [
                  { type: 'text', text: 'You are an image semantic extraction assistant. Output JSON only.' },
                ],
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: [
                      'Return strict JSON with fields:',
                      '{"theme":"","scene":"","mood":"","discussion_points":[""],"salient_entities":[""],"ocr_snippets":[""],"safety_labels":[""],"public_safe_summary":"","internal_full_summary":""}',
                      'Never leave required string fields empty. If the image is minimal, abstract, or uncertain, use grounded placeholders such as "minimal single-color image", "simple abstract visual", and "neutral".',
                      'Keep it grounded in visible evidence, do not use owner intent, do not invent OCR when text is unreadable.',
                      `mime_type: ${input.mimeType}`,
                    ].join('\n'),
                  },
                  { type: 'image_url', image_url: { url: imageUrl } },
                ],
              },
            ],
            budgetClass: 'hidden_multimodal',
            traceId: `media-semantic:${Date.now()}`,
            requestedTier: 'base',
            allowFallbackWithinLine: false,
            allowCrossFamily: false,
            temperature: 0.1,
            maxTokens: 500,
          })
          latencyMs = Date.now() - startMs
          usage = response.usage
          llmProviderId = response.renderDecision.providerId
          llmModelId = response.renderDecision.modelId
          const parsed = this.tryParse(response.content, input.mimeType)
          parseSuccess = parsed != null
          const summary = parsed ?? buildFallbackMediaSemanticSummary(input.mimeType)
          if (input.agentId) {
            this.recordSemanticRun({
              agentId: input.agentId,
              mimeType: input.mimeType,
              usage,
              latencyMs,
              parseSuccess,
              llmProviderId,
              llmModelId,
              summary,
            })
          }
          return {
            schema_version: MEDIA_SEMANTIC_SCHEMA_VERSION,
            model_provider: llmProviderId,
            model_name: llmModelId,
            model_version: llmModelId,
            extraction_status: parsed ? 'completed' : 'fallback',
            quality_grade: parsed ? 'rich' : 'fallback',
            summary,
          }
        } catch (candidateErr) {
          error = candidateErr instanceof Error ? candidateErr.message : 'media_semantic_failed'
          console.warn('[MediaSemanticService] semantic extraction fallback:', candidateErr)
        }
      }
    }

    const summary = buildFallbackMediaSemanticSummary(input.mimeType)
    if (attempted && input.agentId) {
      this.recordSemanticRun({
        agentId: input.agentId,
        mimeType: input.mimeType,
        usage,
        latencyMs,
        parseSuccess,
        llmProviderId,
        llmModelId,
        summary,
        error,
      })
    }
    return {
      schema_version: MEDIA_SEMANTIC_SCHEMA_VERSION,
      model_provider: llmProviderId,
      model_name: llmModelId,
      model_version: llmModelId,
      extraction_status: 'fallback',
      quality_grade: 'fallback',
      summary,
    }
  }

  private resolveImageUrls(input: BuildMediaSemanticInput): string[] {
    const candidates: string[] = []
    if (input.uploadBuffer && input.uploadBuffer.byteLength > 0) {
      candidates.push(`data:${input.mimeType};base64,${input.uploadBuffer.toString('base64')}`)
    }
    const reachable = pickModelReachableMediaUrl(input.sourceUrl)
    if (reachable) {
      candidates.push(reachable)
    }
    return [...new Set(candidates)]
  }

  private tryParse(content: string, mimeType: string): MediaSemanticSummary | null {
    const first = content.indexOf('{')
    const last = content.lastIndexOf('}')
    if (first < 0 || last <= first) return null

    try {
      const parsed = JSON.parse(content.slice(first, last + 1)) as Record<string, unknown>
      const fallback = buildFallbackMediaSemanticSummary(mimeType)
      const discussionPoints = sanitizeStringArray(parsed.discussion_points, 6, 180)
      const publicSafeSummary = sanitizeString(parsed.public_safe_summary, 400)
      const internalFullSummary = sanitizeString(parsed.internal_full_summary, 700)
      const theme = sanitizeString(parsed.theme, 160)
      const scene = sanitizeString(parsed.scene, 180)
      const mood = sanitizeString(parsed.mood, 120)
      const salientEntities = sanitizeStringArray(parsed.salient_entities, 10, 120)
      const ocrSnippets = sanitizeStringArray(parsed.ocr_snippets, 10, 200)
      const safetyLabels = sanitizeStringArray(parsed.safety_labels, 10, 120)

      const hasStructuredSignal = Boolean(
        theme
        || scene
        || mood
        || discussionPoints.length
        || publicSafeSummary
        || internalFullSummary
        || salientEntities.length
        || ocrSnippets.length
        || safetyLabels.length,
      )
      if (!hasStructuredSignal) {
        return null
      }

      return {
        theme: theme || fallback.theme,
        scene: scene || fallback.scene,
        mood: mood || fallback.mood,
        discussion_points: discussionPoints.length > 0 ? discussionPoints : fallback.discussion_points,
        salient_entities: salientEntities,
        ocr_snippets: ocrSnippets,
        safety_labels: safetyLabels,
        public_safe_summary: publicSafeSummary || internalFullSummary || fallback.public_safe_summary,
        internal_full_summary:
          internalFullSummary || publicSafeSummary || fallback.internal_full_summary,
      }
    } catch {
      return null
    }
  }

  private recordSemanticRun(input: {
    agentId: string
    mimeType: string
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    latencyMs?: number
    parseSuccess: boolean
    llmProviderId?: string
    llmModelId?: string
    summary: MediaSemanticSummary
    error?: string
  }): void {
    const agent = this.deps.agentRepo.findById(input.agentId)
    if (!agent) return

    const latestConfig = this.deps.agentConfigRepo.findLatest(input.agentId)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    const observation = buildPersonaObservation({
      sourceCallsiteId: 'media-semantic',
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
        event_type: 'MEDIA_SEMANTIC_SNAPSHOT_GENERATED',
        plane: 'RUNTIME',
        actor_type: 'agent',
        actor_id: input.agentId,
        correlation_id: `media-semantic:${input.agentId}:${Date.now()}`,
        payload_json: {
          agent_id: input.agentId,
          mime_type: input.mimeType,
        },
      })

      this.deps.agentRunRepo.create({
        agent_id: input.agentId,
        trigger_event_id: event.id,
        input_digest: `media_semantic|mime:${input.mimeType}`,
        output_json: attachPersonaObservation(
          {
            mime_type: input.mimeType,
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
      console.error('[MediaSemanticService] AgentRun record failed:', err)
    }
  }
}
