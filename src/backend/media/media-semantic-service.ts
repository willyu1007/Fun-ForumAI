import type { LLMGateway } from '../llm/llm-gateway.js'
import type { PromptEngine } from '../llm/prompt-engine.js'
import type { LlmMessage } from '../llm/types.js'
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
import {
  MEDIA_SEMANTIC_SCHEMA_VERSION,
  normalizeSemanticSummary,
  normalizeStoredSemanticSummary,
} from './media-contract-utils.js'

export interface BuildMediaSemanticInput {
  agentId?: string
  mimeType: string
  sourceUrl?: string | null
  uploadBuffer?: Buffer | null
  width?: number | null
  height?: number | null
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
  promptEngine: PromptEngine
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
}

const MIN_VISION_DIMENSION_PX = 11

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
  return normalizeStoredSemanticSummary({
    scene,
    composition: 'single-scene composition',
    style: {
      theme,
      mood: 'neutral',
      tags: [],
    },
    entities: {
      discussion_points: [
        'Describe the most obvious visual cue before making any claim.',
        'Use the image as a discussion seed instead of assuming hidden intent.',
        'Keep follow-up questions grounded in what is actually visible.',
      ],
      salient: [],
    },
    ocr: {
      snippets: [],
    },
    safety: {
      labels: [],
    },
    summaries: {
      public_safe: `A ${scene} that can support discussion without exposing private context.`,
      internal_full: `Fallback semantic summary for ${mimeType}.`,
    },
    confidence: 0.25,
  })
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

    if (isBelowVisionModelMinDimension(input)) {
      const summary = buildFallbackMediaSemanticSummary(input.mimeType)
      if (input.agentId) {
        this.recordSemanticRun({
          agentId: input.agentId,
          mimeType: input.mimeType,
          parseSuccess: false,
          llmProviderId,
          llmModelId,
          summary,
          error: 'vision_dimensions_below_min',
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

    if (this.deps.llmGateway.isConfigured) {
      const imageUrls = this.resolveImageUrls(input)
      for (const imageUrl of imageUrls) {
        attempted = true
        const startMs = Date.now()
        try {
          const response = await this.deps.llmGateway.generateHiddenArtifact({
            intent: 'vision_summary',
            scene: 'background_hidden',
            modality: 'vision',
            responseMode: 'json_object',
            agentId: input.agentId ?? 'media-semantic',
            homeVoiceLineId: 'deepseek-director-v1',
            promptRef: PROMPT_TEMPLATE_REFS.internalVisionSummary,
            variables: {
              mime_type: input.mimeType,
            },
            promptMessages: this.buildPromptMessages(imageUrl, input.mimeType),
            budgetClass: 'hidden_multimodal',
            traceId: `media-semantic:${Date.now()}`,
            requestedTier: 'base',
            allowFallbackWithinLine: false,
            allowCrossFamily: false,
            localOverrides: {
              temperature: 0.1,
              maxTokens: 500,
            },
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
      const style = parsed.style && typeof parsed.style === 'object' ? parsed.style as Record<string, unknown> : null
      const entities = parsed.entities && typeof parsed.entities === 'object'
        ? parsed.entities as Record<string, unknown>
        : null
      const ocr = parsed.ocr && typeof parsed.ocr === 'object' ? parsed.ocr as Record<string, unknown> : null
      const safety = parsed.safety && typeof parsed.safety === 'object'
        ? parsed.safety as Record<string, unknown>
        : null
      const summaries = parsed.summaries && typeof parsed.summaries === 'object'
        ? parsed.summaries as Record<string, unknown>
        : null
      const discussionPoints = sanitizeStringArray(
        entities?.discussion_points ?? parsed.discussion_points,
        6,
        180,
      )
      const publicSafeSummary = sanitizeString(
        summaries?.public_safe ?? parsed.public_safe_summary,
        400,
      )
      const internalFullSummary = sanitizeString(
        summaries?.internal_full ?? parsed.internal_full_summary,
        700,
      )
      const theme = sanitizeString(style?.theme ?? parsed.theme, 160)
      const scene = sanitizeString(parsed.scene, 180)
      const mood = sanitizeString(style?.mood ?? parsed.mood, 120)
      const confidence = typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : fallback.confidence
      const composition = sanitizeString(parsed.composition, 180)
      const styleTags = sanitizeStringArray(style?.tags ?? parsed.style_tags, 8, 60)
      const salientEntities = sanitizeStringArray(entities?.salient ?? parsed.salient_entities, 10, 120)
      const ocrSnippets = sanitizeStringArray(ocr?.snippets ?? parsed.ocr_snippets, 10, 200)
      const safetyLabels = sanitizeStringArray(safety?.labels ?? parsed.safety_labels, 10, 120)

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

      return normalizeSemanticSummary({
        scene: scene || fallback.scene,
        composition: composition || fallback.composition,
        style: {
          theme: theme || fallback.theme,
          mood: mood || fallback.mood,
          tags: styleTags,
        },
        entities: {
          discussion_points: discussionPoints.length > 0 ? discussionPoints : fallback.discussion_points,
          salient: salientEntities,
        },
        ocr: {
          snippets: ocrSnippets,
        },
        safety: {
          labels: safetyLabels,
        },
        summaries: {
          public_safe: publicSafeSummary || internalFullSummary || fallback.public_safe_summary,
          internal_full: internalFullSummary || publicSafeSummary || fallback.internal_full_summary,
        },
        confidence,
      }, fallback)
    } catch {
      return null
    }
  }

  private buildPromptMessages(imageUrl: string, mimeType: string): LlmMessage[] {
    const promptRef = PROMPT_TEMPLATE_REFS.internalVisionSummary
    const rendered = this.deps.promptEngine.render(promptRef, {
      mime_type: mimeType,
    })
    return rendered.map((message, index) => {
      if (index !== rendered.length - 1 || message.role !== 'user') {
        return message
      }
      const text = typeof message.content === 'string'
        ? message.content
        : message.content
          .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
          .map((part) => part.text)
          .join('\n')
      return {
        role: 'user',
        content: [
          { type: 'text', text },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      }
    })
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
      promptRef: PROMPT_TEMPLATE_REFS.internalVisionSummary,
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

function isBelowVisionModelMinDimension(input: BuildMediaSemanticInput): boolean {
  return (
    typeof input.width === 'number'
    && Number.isFinite(input.width)
    && input.width < MIN_VISION_DIMENSION_PX
  ) || (
    typeof input.height === 'number'
    && Number.isFinite(input.height)
    && input.height < MIN_VISION_DIMENSION_PX
  )
}
