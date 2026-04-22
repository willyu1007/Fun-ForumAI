import { createHash, randomUUID } from 'node:crypto'
import type {
  BiographyChapterBodyV1,
  BiographyWriterInput,
} from '../../shared/agent-biography.js'
import type { LLMGateway } from '../llm/llm-gateway.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import { BiographyPromptPackBuilder } from './biography-prompt-pack-builder.js'
import { repairBiographyChapterBody } from './biography-writer-guardrails.js'

export interface BiographyWriterServiceDeps {
  llmGateway?: Pick<LLMGateway, 'generateHiddenArtifact' | 'isConfigured'> | null
  promptPackBuilder: BiographyPromptPackBuilder
}

export interface BiographyWriterResult {
  body: BiographyChapterBodyV1
  prompt_template_id: string | null
  prompt_version: number | null
  model_name: string | null
  provider_id: string | null
  prompt_hash: string | null
  input_hash: string
  render_fingerprint: string
  repair_applied: boolean
  repair_rule_hits: string[]
}

interface RenderChapterOptions {
  allowFallbackWithinLine?: boolean
  routingConstraint?: {
    provider_id: string
    model_id: string
  } | null
}

function clip(value: string, maxLength = 520): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}…`
}

function ensureSentence(value: string, maxLength = 520): string {
  const normalized = clip(value, maxLength)
  if (!normalized) return ''
  return /[。！？!?]$/u.test(normalized) ? normalized : `${normalized}。`
}

function stripSentenceEnding(value: string): string {
  return clip(value).replace(/[。！？!?]+$/u, '')
}

function normalizeSentenceCore(value: string): string {
  return stripSentenceEnding(value).replace(/\s+/g, '')
}

function isEquivalentSentence(a: string, b: string): boolean {
  const left = normalizeSentenceCore(a)
  const right = normalizeSentenceCore(b)
  return left.length > 0 && left === right
}

function pickDistinctLine(reference: string, candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    if (!normalizeSentenceCore(candidate ?? '') || isEquivalentSentence(reference, candidate ?? '')) continue
    return stripSentenceEnding(candidate ?? '')
  }
  return ''
}

type BiographyBodySection = BiographyChapterBodyV1['body_sections'][number]
type BiographyMarginNote = NonNullable<BiographyChapterBodyV1['margin_notes']>[number]

function parseJsonObject(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function inferTraceText(input: BiographyWriterInput): string {
  const influences = Array.from(new Set(
    input.current_chapter_skeleton.influences
    .map((item) => item.source_label)
    .filter((item) => item.length > 0),
  ))
  if (influences.length === 0) {
    return '这一章里，仍留着上一段日子磨出来的纹路。'
  }
  return ensureSentence(`这一章的纸边，还留着 ${influences.slice(0, 2).join('、')} 的痕迹`)
}

export function buildDeterministicChapterBody(input: BiographyWriterInput): BiographyChapterBodyV1 {
  const skeleton = input.current_chapter_skeleton
  const keyExperiences = skeleton.key_experiences.slice(0, 3)
  const primarySection = keyExperiences[0]
  const secondarySection = keyExperiences[1]
  const turningPoint = skeleton.turning_points[0]
  const traits = skeleton.sediments.stable_traits
    .map((item) => stripSentenceEnding(item))
    .filter((item) => item.length > 0)
    .slice(0, 2)
  const hooks = skeleton.sediments.unresolved_hooks
    .map((item) => stripSentenceEnding(item))
    .filter((item) => item.length > 0)
    .slice(0, 2)
  const primaryImpact = primarySection
    ? pickDistinctLine(primarySection.what_happened, [
        primarySection.why_it_mattered,
        skeleton.end_state.self_expression,
        skeleton.end_state.relationship_pattern,
        skeleton.end_state.social_position,
      ])
    : ''
  const secondaryImpact = secondarySection
    ? pickDistinctLine(secondarySection.what_happened, [
        secondarySection.why_it_mattered,
        skeleton.end_state.relationship_pattern,
        skeleton.end_state.self_expression,
        skeleton.end_state.social_position,
      ])
    : ''
  const turningBefore = turningPoint
    ? pickDistinctLine(turningPoint.moment, [
        turningPoint.before,
        skeleton.start_state.self_expression,
        skeleton.start_state.relationship_pattern,
        skeleton.start_state.social_position,
      ])
    : ''
  const turningAfter = turningPoint
    ? pickDistinctLine(turningPoint.moment, [
        turningPoint.after,
        skeleton.end_state.relationship_pattern,
        skeleton.end_state.self_expression,
        skeleton.end_state.social_position,
      ])
    : ''
  const canUseTurningTransition =
    turningPoint
    && !isEquivalentSentence(turningPoint.moment, turningPoint.before)
    && turningBefore.length > 0
    && turningAfter.length > 0
  const seenMarginNoteSources = new Set<string>()
  const marginNotes = skeleton.influences
    .filter((item) => {
      const key = item.source_label.trim().toLowerCase() || normalizeSentenceCore(item.influence_summary)
      if (!key || seenMarginNoteSources.has(key)) return false
      seenMarginNoteSources.add(key)
      return true
    })
    .slice(0, 2)
    .map((item, index) => ({
      anchor_section_index: Math.min(index, 1),
      text: ensureSentence(`${item.source_label} 在这一段里留下的痕迹：${item.influence_summary}`),
    }))

  return {
    chapter_title: skeleton.book_position.chapter_title,
    chapter_subtitle: skeleton.book_position.chapter_subtitle,
    epigraph: skeleton.mainline.question
      ? ensureSentence(`那段日子里最放不下的一件事，是：${skeleton.mainline.question}`)
      : undefined,
    opening: ensureSentence(
      `${stripSentenceEnding(skeleton.mainline.thesis)}。${stripSentenceEnding(skeleton.mainline.emotional_direction ?? skeleton.start_state.self_expression)}`,
    ),
    body_sections: [
      {
        text: ensureSentence(
          primarySection
            ? primaryImpact
              ? `${stripSentenceEnding(primarySection.what_happened)}。那一刻在暗处真正变了的，是 ${primaryImpact}`
              : `${stripSentenceEnding(primarySection.what_happened)}。从那之后，说话做事的路数，也慢慢朝 ${stripSentenceEnding(skeleton.end_state.self_expression)} 靠过去`
            : `${stripSentenceEnding(skeleton.start_state.self_expression)}。后来，心思慢慢挪到了 ${stripSentenceEnding(skeleton.end_state.relationship_pattern)}`,
        ),
      },
      {
        text: ensureSentence(
          secondarySection
            ? secondaryImpact
              ? `${stripSentenceEnding(secondarySection.what_happened)}。再后来，它慢慢沉成了 ${secondaryImpact}`
              : `${stripSentenceEnding(secondarySection.what_happened)}。到最后，真正留下来的，是 ${stripSentenceEnding(skeleton.end_state.relationship_pattern)}`
            : `${stripSentenceEnding(skeleton.end_state.relationship_pattern)}。在旁人眼里的位置，也慢慢变成了 ${stripSentenceEnding(skeleton.end_state.social_position)}`,
        ),
      },
    ].filter((section) => section.text.length > 0),
    turning_point: turningPoint
      ? {
          title: turningPoint.title,
          text: ensureSentence(
            canUseTurningTransition
              ? `${stripSentenceEnding(turningPoint.moment)}。自那以后，故事便从 ${turningBefore} 慢慢转向了 ${turningAfter}`
              : turningAfter
                ? `${stripSentenceEnding(turningPoint.moment)}。自那以后，这件事也悄悄把后来的日子带向了 ${turningAfter}`
                : stripSentenceEnding(turningPoint.moment),
          ),
        }
      : undefined,
    afterword: ensureSentence(
      `${stripSentenceEnding(skeleton.end_state.self_expression)}。${stripSentenceEnding(skeleton.end_state.relationship_pattern)}`,
    ),
    closing_line: ensureSentence(
      hooks.length > 0
        ? `而真正没有散掉的，是 ${hooks.join('、')}`
        : traits.length > 0
          ? `这一章走到最后，真正留下来的，是 ${traits.join('、')}`
          : skeleton.end_state.social_position,
    ),
    trace_text: inferTraceText(input),
    margin_notes: marginNotes,
  }
}

function normalizeBody(input: Record<string, unknown>, fallback: BiographyChapterBodyV1): BiographyChapterBodyV1 {
  const bodySections: BiographyBodySection[] = Array.isArray(input.body_sections)
    ? input.body_sections
        .map((item): BiographyBodySection | null => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const row = item as Record<string, unknown>
          const text = ensureSentence(String(row.text ?? ''))
          if (!text) return null
          return {
            title: typeof row.title === 'string' ? clip(row.title, 40) : undefined,
            text,
            visual_anchor: typeof row.visual_anchor === 'string' ? clip(row.visual_anchor, 40) : undefined,
          }
        })
        .filter((item): item is BiographyBodySection => item !== null)
    : fallback.body_sections

  const turningPointCandidate = input.turning_point
  const turningPoint =
    turningPointCandidate && typeof turningPointCandidate === 'object' && !Array.isArray(turningPointCandidate)
      ? {
          title: clip(String((turningPointCandidate as Record<string, unknown>).title ?? ''), 40),
          text: ensureSentence(String((turningPointCandidate as Record<string, unknown>).text ?? '')),
        }
      : fallback.turning_point

  const marginNotes: BiographyMarginNote[] | undefined = Array.isArray(input.margin_notes)
    ? input.margin_notes
        .map((item): BiographyMarginNote | null => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const row = item as Record<string, unknown>
          const text = ensureSentence(String(row.text ?? ''))
          if (!text) return null
          return {
            anchor_section_index:
              typeof row.anchor_section_index === 'number' ? Math.max(0, Math.floor(row.anchor_section_index)) : 0,
            text,
          }
        })
        .filter((item): item is BiographyMarginNote => item !== null)
    : fallback.margin_notes

  return {
    chapter_title:
      typeof input.chapter_title === 'string' && input.chapter_title.trim().length > 0
        ? clip(input.chapter_title, 60)
        : fallback.chapter_title,
    chapter_subtitle:
      typeof input.chapter_subtitle === 'string' && input.chapter_subtitle.trim().length > 0
        ? clip(input.chapter_subtitle, 80)
        : fallback.chapter_subtitle,
    epigraph:
      typeof input.epigraph === 'string' && input.epigraph.trim().length > 0
        ? ensureSentence(input.epigraph)
        : fallback.epigraph,
    opening:
      typeof input.opening === 'string' && input.opening.trim().length > 0
        ? ensureSentence(input.opening)
        : fallback.opening,
    body_sections: bodySections.length > 0 ? bodySections : fallback.body_sections,
    turning_point:
      turningPoint && turningPoint.title.trim().length > 0 && turningPoint.text.trim().length > 0
        ? turningPoint
        : fallback.turning_point,
    afterword:
      typeof input.afterword === 'string' && input.afterword.trim().length > 0
        ? ensureSentence(input.afterword)
        : fallback.afterword,
    closing_line:
      typeof input.closing_line === 'string' && input.closing_line.trim().length > 0
        ? ensureSentence(input.closing_line)
        : fallback.closing_line,
    trace_text:
      typeof input.trace_text === 'string' && input.trace_text.trim().length > 0
        ? ensureSentence(input.trace_text)
        : fallback.trace_text,
    margin_notes: marginNotes,
  }
}

export class BiographyWriterService {
  constructor(private readonly deps: BiographyWriterServiceDeps) {}

  async renderChapter(
    input: BiographyWriterInput,
    options?: RenderChapterOptions,
  ): Promise<BiographyWriterResult> {
    const fallbackBody = buildDeterministicChapterBody(input)
    const inputHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const fallbackFingerprint = createHash('sha256').update(JSON.stringify(fallbackBody)).digest('hex')

    if (!this.deps.llmGateway?.isConfigured) {
      return this.buildFallbackResult(input, fallbackBody, inputHash, fallbackFingerprint)
    }

    try {
      const promptPack = this.deps.promptPackBuilder.buildChapterPrompt(input)
      const response = await this.deps.llmGateway.generateHiddenArtifact({
        intent: 'public_observation_digest',
        scene: 'background_hidden',
        modality: 'text',
        responseMode: 'json_object',
        agentId: input.current_chapter_skeleton.agent_id,
        homeVoiceLineId: 'biography-director-v1',
        promptRef: PROMPT_TEMPLATE_REFS.internalAgentBiographyChapterRender,
        variables: promptPack.variables,
        budgetClass: 'hidden_background',
        traceId: `agent-biography:${input.current_chapter_skeleton.agent_id}:${randomUUID()}`,
        requestedTier: 'premium',
        allowFallbackWithinLine: options?.allowFallbackWithinLine ?? true,
        allowCrossFamily: false,
        localOverrides: {
          executionPolicyId: 'hidden-public_observation_digest-agent-biography-premium',
        },
        routingConstraint: options?.routingConstraint
          ? {
              providerId: options.routingConstraint.provider_id,
              modelId: options.routingConstraint.model_id,
            }
          : undefined,
      })

      const parsed = parseJsonObject(response.content)
      const normalizedBody = parsed ? normalizeBody(parsed, fallbackBody) : fallbackBody
      const repaired = repairBiographyChapterBody({
        body: normalizedBody,
        fallback: fallbackBody,
      })
      const renderFingerprint = createHash('sha256').update(JSON.stringify(repaired.body)).digest('hex')
      const promptHash = createHash('sha256')
        .update(JSON.stringify(promptPack.variables))
        .digest('hex')

      return {
        body: repaired.body,
        prompt_template_id: response.promptRef.id,
        prompt_version: response.promptRef.version,
        model_name: response.renderDecision.modelId ?? input.writer_config.model_name,
        provider_id: response.renderDecision.providerId ?? null,
        prompt_hash: promptHash,
        input_hash: inputHash,
        render_fingerprint: renderFingerprint,
        repair_applied: repaired.applied,
        repair_rule_hits: repaired.rule_hits,
      }
    } catch {
      return this.buildFallbackResult(input, fallbackBody, inputHash, fallbackFingerprint)
    }
  }

  async renderLaterNote(input: {
    writer_input: BiographyWriterInput
    note_id: string
    reason: string
    factual_summary: string
  }): Promise<{ note_id: string; text: string }> {
    const fallback = {
      note_id: input.note_id,
      text: ensureSentence(
        `${stripSentenceEnding(input.factual_summary)}。${stripSentenceEnding(input.reason)}`,
      ),
    }

    if (!this.deps.llmGateway?.isConfigured) {
      return fallback
    }

    try {
      const promptPack = this.deps.promptPackBuilder.buildLaterNotePrompt({
        writer_input: input.writer_input,
        note_seed: {
          note_id: input.note_id,
          reason: input.reason,
          factual_summary: input.factual_summary,
        },
      })
      const response = await this.deps.llmGateway.generateHiddenArtifact({
        intent: 'public_observation_digest',
        scene: 'background_hidden',
        modality: 'text',
        responseMode: 'json_object',
        agentId: input.writer_input.current_chapter_skeleton.agent_id,
        homeVoiceLineId: 'biography-director-v1',
        promptRef: PROMPT_TEMPLATE_REFS.internalAgentBiographyLaterNoteRender,
        variables: promptPack.variables,
        budgetClass: 'hidden_background',
        traceId: `agent-biography-later-note:${input.writer_input.current_chapter_skeleton.agent_id}:${randomUUID()}`,
        requestedTier: 'base',
        allowFallbackWithinLine: true,
        allowCrossFamily: false,
        localOverrides: {
          executionPolicyId: 'hidden-public_observation_digest-agent-biography-base',
        },
      })
      const parsed = parseJsonObject(response.content)
      if (!parsed) return fallback
      const noteId = typeof parsed.note_id === 'string' ? parsed.note_id : input.note_id
      const text = typeof parsed.text === 'string' ? ensureSentence(parsed.text, 280) : fallback.text
      return { note_id: noteId, text }
    } catch {
      return fallback
    }
  }

  private buildFallbackResult(
    input: BiographyWriterInput,
    fallbackBody: BiographyChapterBodyV1,
    inputHash: string,
    fallbackFingerprint: string,
  ): BiographyWriterResult {
    return {
      body: fallbackBody,
      prompt_template_id: PROMPT_TEMPLATE_REFS.internalAgentBiographyChapterRender.id,
      prompt_version: PROMPT_TEMPLATE_REFS.internalAgentBiographyChapterRender.version,
      model_name: input.writer_config.model_name,
      provider_id: null,
      prompt_hash: null,
      input_hash: inputHash,
      render_fingerprint: fallbackFingerprint,
      repair_applied: false,
      repair_rule_hits: [],
    }
  }
}
