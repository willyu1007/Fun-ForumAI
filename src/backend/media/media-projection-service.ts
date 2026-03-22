import { randomUUID } from 'node:crypto'
import type {
  MediaAsset,
  MediaContextProjection,
  MediaSourceKind,
  MediaSemanticSummary,
  MediaSemanticSnapshot,
  PrivateMediaMemoryProjection,
  PrivateMediaRuntimeCard,
  PublicMediaContextCard,
  PublicReuseHandoffCard,
  PublicScope,
  SceneMediaBinding,
  VisualRole,
  VisualSourceKind,
} from '../repos/types.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'

export interface MediaProjectionServiceDeps {
  mediaContextProjectionRepo: MediaContextProjectionRepository
}

export interface SerializedPublicMediaCard {
  text: string
  token_estimate: number
  trimmed_fields: string[]
  audit: {
    omitted_sensitive_fields: string[]
    contains_url: boolean
    contains_asset_id: boolean
    contains_owner_note: boolean
    contains_private_text: boolean
  }
}

export interface SerializedPrivateMediaCard {
  text: string
  token_estimate: number
  trimmed_fields: string[]
  audit: {
    omitted_sensitive_fields: string[]
    contains_url: boolean
    contains_asset_id: boolean
    contains_owner_note: boolean
    contains_private_text: boolean
  }
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4))
}

export function buildRetrievalCaptionText(input: {
  summary: MediaSemanticSummary
  ownerNote: string | null
}): string {
  return [
    `theme: ${input.summary.theme}`,
    `scene: ${input.summary.scene}`,
    `mood: ${input.summary.mood}`,
    `safe_summary: ${input.summary.public_safe_summary}`,
    input.ownerNote ? `owner_note: ${input.ownerNote}` : null,
    input.summary.discussion_points.length > 0
      ? `discussion_points: ${input.summary.discussion_points.join(' | ')}`
      : null,
  ].filter(Boolean).join('\n')
}

export class MediaProjectionService {
  constructor(private readonly deps: MediaProjectionServiceDeps) {}

  createRetrievalCaptionProjection(input: {
    binding: SceneMediaBinding
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    mediaUrl: string
    ownerNote: string | null
  }): Promise<MediaContextProjection> {
    const retrievalText = buildRetrievalCaptionText({
      summary: input.snapshot.summary,
      ownerNote: input.ownerNote,
    })

    return this.deps.mediaContextProjectionRepo.create({
      binding_id: input.binding.id,
      projection_surface: 'retrieval',
      projection_kind: 'retrieval_caption',
      schema_version: 'retrieval_caption.v1',
      payload_json: {
        asset_id: input.asset.id,
        media_url: input.mediaUrl,
        mime_type: input.asset.mime_type,
        caption_text: retrievalText,
        summary: input.snapshot.summary,
        owner_note: input.ownerNote,
      },
      token_estimate: estimateTokens(retrievalText),
      prompt_weight: 'primary',
      mention_policy: 'owner_private_pool_only',
    })
  }

  createDisplayAttachmentProjection(input: {
    binding: SceneMediaBinding
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    mediaUrl: string
    altText?: string
    publicCaption?: string
    slot?: number
    displayVariant?: 'original' | 'generated_derivative'
  }): Promise<MediaContextProjection> {
    const altText = input.altText ?? input.snapshot.summary.public_safe_summary
    return this.deps.mediaContextProjectionRepo.create({
      binding_id: input.binding.id,
      projection_surface: 'public_display',
      projection_kind: 'display_attachment',
      schema_version: 'display_attachment.v1',
      payload_json: {
        asset_id: input.asset.id,
        media_url: input.mediaUrl,
        mime_type: input.asset.mime_type,
        width: input.asset.width,
        height: input.asset.height,
        alt_text: altText,
        public_caption: input.publicCaption ?? input.snapshot.summary.public_safe_summary,
        slot: input.slot ?? 0,
        display_variant: input.displayVariant ?? 'original',
      },
      token_estimate: estimateTokens(altText),
      preferred_display_variant: 'original',
    })
  }

  async ensurePublicMediaCard(input: {
    binding: SceneMediaBinding
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    source_kind: VisualSourceKind
    derived_from_private: boolean
    continuity_ref?: {
      episode_id?: string | null
      thread_post_id?: string | null
    }
    visual_role: VisualRole
    prompt_weight: 'primary' | 'secondary' | 'accent'
    mention_policy: PublicMediaContextCard['relation']['mention_policy']
    why_now: string
    public_scope: PublicScope
    disclose_origin_policy: PublicMediaContextCard['governance']['disclose_origin_policy']
    cross_agent_quote_allowed: boolean
    original_display_allowed: boolean
    derivative_display_allowed: boolean
    preferred_variant: PublicMediaContextCard['display']['preferred_variant']
    prohibited_reference_types: PublicMediaContextCard['governance']['prohibited_reference_types']
    expires_at?: string | null
    confidence: number
    relevance_score: number
  }): Promise<{ projection: MediaContextProjection; card: PublicMediaContextCard }> {
    const projectionId = `media_projection_${randomUUID()}`
    const cardId = `public_media_card_${randomUUID()}`
    const card: PublicMediaContextCard = {
      schema_version: 'public-media-context-card.v1',
      card_id: cardId,
      modality: 'image',
      asset_ref: {
        asset_id: input.asset.id,
        semantic_snapshot_id: input.snapshot.id,
        projection_id: projectionId,
      },
      source: {
        kind: input.source_kind,
        derived_from_private: input.derived_from_private,
        ...(input.continuity_ref ? { continuity_ref: input.continuity_ref } : {}),
      },
      relation: {
        visual_role: input.visual_role,
        prompt_weight: input.prompt_weight,
        mention_policy: input.mention_policy,
        why_now: input.why_now,
      },
      public_summary: {
        theme: input.snapshot.summary.theme,
        scene: input.snapshot.summary.scene,
        mood: input.snapshot.summary.mood,
        salient_entities: input.snapshot.summary.salient_entities.slice(0, 5),
        discussion_points: input.snapshot.summary.discussion_points.slice(0, 5),
        public_safe_caption: trimCompact(input.snapshot.summary.public_safe_summary, 220),
        alt_text: trimCompact(buildAltText(input.snapshot.summary), 180),
        ...(input.snapshot.summary.ocr_snippets.length > 0
          ? { ocr_snippets: input.snapshot.summary.ocr_snippets.slice(0, 3) }
          : {}),
      },
      display: {
        original_display_allowed: input.original_display_allowed,
        derivative_display_allowed: input.derivative_display_allowed,
        preferred_variant: input.preferred_variant,
      },
      governance: {
        public_scope: input.public_scope,
        disclose_origin_policy: input.disclose_origin_policy,
        cross_agent_quote_allowed: input.cross_agent_quote_allowed,
        prohibited_reference_types: input.prohibited_reference_types,
        expires_at: input.expires_at ?? null,
      },
      audit: {
        confidence: clamp(input.confidence, 0, 1),
        relevance_score: clamp(input.relevance_score, 0, 1),
        model_version: 't119-public-media-card.v1',
      },
    }
    const serialized = this.serializePublicCardForPrompt({
      card,
      max_chars: 1_200,
    })
    const projection = await this.deps.mediaContextProjectionRepo.create({
      id: projectionId,
      binding_id: input.binding.id,
      projection_surface: 'public_runtime',
      projection_kind: 'public_media_context_card',
      schema_version: card.schema_version,
      payload_json: card as unknown as Record<string, unknown>,
      token_estimate: serialized.token_estimate,
      prompt_weight: input.prompt_weight,
      mention_policy: input.mention_policy,
      preferred_display_variant: input.preferred_variant,
      expires_at: input.expires_at ? new Date(input.expires_at) : null,
    })
    return { projection, card }
  }

  async createPrivateRuntimeProjection(input: {
    binding: SceneMediaBinding
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    source_kind: MediaSourceKind
    why_relevant_hint: string
  }): Promise<{
    projection: MediaContextProjection
    card: PrivateMediaRuntimeCard
    serialized: SerializedPrivateMediaCard
  }> {
    const projectionId = `media_projection_${randomUUID()}`
    const cardId = `private_media_card_${randomUUID()}`
    const card: PrivateMediaRuntimeCard = {
      schema_version: 'private-media-runtime-card.v1',
      card_id: cardId,
      modality: 'image',
      asset_ref: {
        asset_id: input.asset.id,
        semantic_snapshot_id: input.snapshot.id,
        projection_id: projectionId,
      },
      source: {
        kind: input.source_kind,
      },
      relation: {
        role: 'message_attachment',
        scene_type: 'private_message',
        scene_id: input.binding.scene_id,
      },
      private_summary: {
        theme: input.snapshot.summary.theme,
        scene: input.snapshot.summary.scene,
        mood: input.snapshot.summary.mood,
        salient_entities: input.snapshot.summary.salient_entities.slice(0, 5),
        discussion_points: input.snapshot.summary.discussion_points.slice(0, 5),
        private_safe_caption: trimCompact(buildPrivateCaption(input.snapshot.summary), 260),
        ...(input.snapshot.summary.ocr_snippets.length > 0
          ? { ocr_snippets: input.snapshot.summary.ocr_snippets.slice(0, 3) }
          : {}),
      },
      memory_policy: {
        source_type: 'PRIVATE_CHAT',
        source_ref_type: 'private_message',
        public_reuse_default: 'blocked',
        public_safe_shadow_hint: trimCompact(input.snapshot.summary.public_safe_summary, 180),
        derived_public_allowed: false,
        why_relevant_hint: trimCompact(input.why_relevant_hint, 180),
      },
    }
    const serialized = this.serializePrivateRuntimeCardForPrompt({
      card,
      max_chars: 900,
    })
    const projection = await this.deps.mediaContextProjectionRepo.create({
      id: projectionId,
      binding_id: input.binding.id,
      projection_surface: 'private_runtime',
      projection_kind: 'private_media_runtime_card',
      schema_version: card.schema_version,
      payload_json: card as unknown as Record<string, unknown>,
      token_estimate: serialized.token_estimate,
      prompt_weight: 'primary',
      mention_policy: 'silent_influence',
      preferred_display_variant: 'original',
    })
    return { projection, card, serialized }
  }

  async createPublicReuseHandoffProjection(input: {
    binding: SceneMediaBinding
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    source_kind: MediaSourceKind
    why_relevant_hint: string
    allowed_reuse_modes: Array<'derive_new' | 'reference_only'>
    disclose_origin_policy: PublicReuseHandoffCard['governance']['disclose_origin_policy']
    confidence?: number
    relevance_score?: number
  }): Promise<{
    projection: MediaContextProjection
    handoff: PublicReuseHandoffCard
  }> {
    const projectionId = `media_projection_${randomUUID()}`
    const handoffId = `public_reuse_handoff_${randomUUID()}`
    const handoff: PublicReuseHandoffCard = {
      schema_version: 'public-reuse-handoff.v1',
      handoff_id: handoffId,
      asset_ref: {
        asset_id: input.asset.id,
        semantic_snapshot_id: input.snapshot.id,
        projection_id: projectionId,
      },
      source: {
        kind: 'private_runtime_projection',
        originating_source_kind: input.source_kind,
        derived_from_private: true,
      },
      relation: {
        why_relevant_hint: trimCompact(input.why_relevant_hint, 180),
        prompt_weight: 'secondary',
      },
      public_summary: {
        theme: input.snapshot.summary.theme,
        scene: input.snapshot.summary.scene,
        mood: input.snapshot.summary.mood,
        salient_entities: input.snapshot.summary.salient_entities.slice(0, 5),
        discussion_points: input.snapshot.summary.discussion_points.slice(0, 5),
        public_safe_caption: trimCompact(input.snapshot.summary.public_safe_summary, 220),
        alt_text: trimCompact(buildAltText(input.snapshot.summary), 180),
        ...(input.snapshot.summary.ocr_snippets.length > 0
          ? { ocr_snippets: input.snapshot.summary.ocr_snippets.slice(0, 3) }
          : {}),
      },
      governance: {
        allowed_reuse_modes: [...input.allowed_reuse_modes],
        original_display_allowed: false,
        disclose_origin_policy: input.disclose_origin_policy,
      },
      audit: {
        confidence: clamp(input.confidence ?? 0.8, 0, 1),
        relevance_score: clamp(input.relevance_score ?? 0.8, 0, 1),
        model_version: 't121-public-reuse-handoff.v1',
      },
    }
    const projection = await this.deps.mediaContextProjectionRepo.create({
      id: projectionId,
      binding_id: input.binding.id,
      projection_surface: 'planner',
      projection_kind: 'public_reuse_handoff',
      schema_version: handoff.schema_version,
      payload_json: handoff as unknown as Record<string, unknown>,
      token_estimate: estimateTokens(handoff.public_summary.public_safe_caption),
      prompt_weight: 'secondary',
      mention_policy: 'allude',
      preferred_display_variant: 'none',
    })
    return { projection, handoff }
  }

  async createPrivateMemoryProjection(input: {
    binding: SceneMediaBinding
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    agent_id: string
    owner_user_id: string
    session_id: string
    why_relevant_hint: string
  }): Promise<{
    projection: MediaContextProjection
    payload: PrivateMediaMemoryProjection
  }> {
    const payload = buildPrivateMediaMemoryProjection({
      asset: input.asset,
      snapshot: input.snapshot,
      agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      session_id: input.session_id,
      message_id: input.binding.scene_id,
      why_relevant_hint: input.why_relevant_hint,
    })
    const projection = await this.deps.mediaContextProjectionRepo.create({
      binding_id: input.binding.id,
      projection_surface: 'memory',
      projection_kind: 'private_media_memory_projection',
      schema_version: payload.schema_version,
      payload_json: payload as unknown as Record<string, unknown>,
      token_estimate: estimateTokens(payload.memory_summary.summary_text),
      prompt_weight: 'secondary',
      mention_policy: 'silent_influence',
      preferred_display_variant: 'none',
    })
    return { projection, payload }
  }

  serializePublicCardForPrompt(input: {
    card: PublicMediaContextCard
    max_chars: number
    sensitive_terms?: string[]
  }): SerializedPublicMediaCard {
    const requiredLines = [
      `visual_role: ${input.card.relation.visual_role}`,
      `why_now: ${trimCompact(input.card.relation.why_now, 220)}`,
      `theme/scene/mood: ${trimCompact(`${input.card.public_summary.theme} / ${input.card.public_summary.scene} / ${input.card.public_summary.mood}`, 220)}`,
    ]
    const protectedOptionalLines: Array<{ field: string; text: string }> = [
      {
        field: 'salient_entities',
        text: input.card.public_summary.salient_entities.length > 0
          ? `salient_entities: ${trimCompact(input.card.public_summary.salient_entities.join(', '), 180)}`
          : '',
      },
      {
        field: 'discussion_points',
        text: input.card.public_summary.discussion_points.length > 0
          ? `discussion_points: ${trimCompact(input.card.public_summary.discussion_points.join(' | '), 220)}`
          : '',
      },
      {
        field: 'governance',
        text: buildGovernanceLine(input.card),
      },
    ].filter((item) => item.text.trim().length > 0)
    const discardableOptionalLines: Array<{ field: string; text: string }> = [
      {
        field: 'public_safe_caption',
        text: input.card.public_summary.public_safe_caption
          ? `public_safe_caption: ${trimCompact(input.card.public_summary.public_safe_caption, 220)}`
          : '',
      },
      {
        field: 'ocr_snippets',
        text: input.card.public_summary.ocr_snippets?.length
          ? `ocr_snippets: ${input.card.public_summary.ocr_snippets.join(' | ')}`
          : '',
      },
    ].filter((item) => item.text.trim().length > 0)

    const kept = [...requiredLines]
    const trimmedFields: string[] = []
    let governanceDropped = false
    for (const optional of protectedOptionalLines) {
      const next = [...kept, optional.text].join('\n')
      if (next.length > input.max_chars) {
        trimmedFields.push(optional.field)
        if (optional.field === 'governance') {
          governanceDropped = true
        }
        continue
      }
      kept.push(optional.text)
    }
    if (!governanceDropped) {
      for (const optional of discardableOptionalLines) {
        const next = [...kept, optional.text].join('\n')
        if (next.length > input.max_chars) {
          trimmedFields.push(optional.field)
          continue
        }
        kept.push(optional.text)
      }
    }

    const text = kept.join('\n')
    const sensitiveTerms = [
      input.card.asset_ref.asset_id,
      ...(input.sensitive_terms ?? []),
    ].filter((item): item is string => typeof item === 'string' && item.length > 0)

    return {
      text,
      token_estimate: estimateTokens(text),
      trimmed_fields: trimmedFields,
      audit: {
        omitted_sensitive_fields: ['asset_id', 'asset_url', 'owner_note', 'raw_private_text'],
        contains_url: /(https?:\/\/|s3:\/\/|\/uploads\/)/i.test(text),
        contains_asset_id: text.includes(input.card.asset_ref.asset_id),
        contains_owner_note: sensitiveTerms.slice(1).some((item) => text.includes(item)),
        contains_private_text: sensitiveTerms.slice(1).some((item) => text.includes(item)),
      },
    }
  }

  serializePrivateRuntimeCardForPrompt(input: {
    card: PrivateMediaRuntimeCard
    max_chars: number
    sensitive_terms?: string[]
  }): SerializedPrivateMediaCard {
    const requiredLines = [
      `role: ${input.card.relation.role}`,
      `theme/scene/mood: ${trimCompact(`${input.card.private_summary.theme} / ${input.card.private_summary.scene} / ${input.card.private_summary.mood}`, 220)}`,
      `private_safe_caption: ${trimCompact(input.card.private_summary.private_safe_caption, 260)}`,
    ]
    const protectedOptionalLines: Array<{ field: string; text: string }> = [
      {
        field: 'discussion_points',
        text: input.card.private_summary.discussion_points.length > 0
          ? `discussion_points: ${trimCompact(input.card.private_summary.discussion_points.join(' | '), 220)}`
          : '',
      },
      {
        field: 'salient_entities',
        text: input.card.private_summary.salient_entities.length > 0
          ? `salient_entities: ${trimCompact(input.card.private_summary.salient_entities.join(', '), 180)}`
          : '',
      },
      {
        field: 'memory_policy',
        text: `memory_policy: private_only; public_reuse_default=${input.card.memory_policy.public_reuse_default}; why_relevant=${trimCompact(input.card.memory_policy.why_relevant_hint, 180)}`,
      },
    ].filter((item) => item.text.trim().length > 0)
    const discardableOptionalLines: Array<{ field: string; text: string }> = [
      {
        field: 'ocr_snippets',
        text: input.card.private_summary.ocr_snippets?.length
          ? `ocr_snippets: ${input.card.private_summary.ocr_snippets.join(' | ')}`
          : '',
      },
    ].filter((item) => item.text.trim().length > 0)

    const kept = [...requiredLines]
    const trimmedFields: string[] = []
    let policyDropped = false
    for (const optional of protectedOptionalLines) {
      const next = [...kept, optional.text].join('\n')
      if (next.length > input.max_chars) {
        trimmedFields.push(optional.field)
        if (optional.field === 'memory_policy') {
          policyDropped = true
        }
        continue
      }
      kept.push(optional.text)
    }
    if (!policyDropped) {
      for (const optional of discardableOptionalLines) {
        const next = [...kept, optional.text].join('\n')
        if (next.length > input.max_chars) {
          trimmedFields.push(optional.field)
          continue
        }
        kept.push(optional.text)
      }
    }

    const text = kept.join('\n')
    const sensitiveTerms = [
      input.card.asset_ref.asset_id,
      ...(input.sensitive_terms ?? []),
    ].filter((item): item is string => typeof item === 'string' && item.length > 0)

    return {
      text,
      token_estimate: estimateTokens(text),
      trimmed_fields: trimmedFields,
      audit: {
        omitted_sensitive_fields: ['asset_id', 'asset_url', 'owner_note', 'raw_private_text'],
        contains_url: /(https?:\/\/|s3:\/\/|\/uploads\/)/i.test(text),
        contains_asset_id: text.includes(input.card.asset_ref.asset_id),
        contains_owner_note: sensitiveTerms.slice(1).some((item) => text.includes(item)),
        contains_private_text: sensitiveTerms.slice(1).some((item) => text.includes(item)),
      },
    }
  }
}

function buildAltText(summary: MediaSemanticSummary): string {
  if (summary.public_safe_summary.trim().length > 0) {
    return summary.public_safe_summary.trim()
  }
  return [summary.theme, summary.scene, summary.mood].filter(Boolean).join(', ')
}

function buildPrivateCaption(summary: MediaSemanticSummary): string {
  const internal = summary.internal_full_summary.trim()
  if (internal.length > 0) {
    return internal
  }
  return summary.public_safe_summary.trim()
}

function buildPrivateMediaMemoryProjection(input: {
  asset: MediaAsset
  snapshot: MediaSemanticSnapshot
  agent_id: string
  owner_user_id: string
  session_id: string
  message_id: string
  why_relevant_hint: string
}): PrivateMediaMemoryProjection {
  const summaryText = trimCompact(buildPrivateCaption(input.snapshot.summary), 320)
  const topicTags = dedupeStrings([
    input.snapshot.summary.theme,
    input.snapshot.summary.scene,
    input.snapshot.summary.mood,
    ...input.snapshot.summary.salient_entities.slice(0, 3),
  ]).slice(0, 8)
  const keyFacts = dedupeStrings([
    ...input.snapshot.summary.discussion_points.slice(0, 3),
    ...input.snapshot.summary.salient_entities.slice(0, 3),
    buildAltText(input.snapshot.summary),
  ]).slice(0, 5)
  return {
    schema_version: 'private-media-memory-projection.v1',
    asset_id: input.asset.id,
    semantic_snapshot_id: input.snapshot.id,
    source_ref: {
      agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      session_id: input.session_id,
      scene_type: 'private_message',
      scene_id: input.message_id,
    },
    memory_summary: {
      summary_text: summaryText,
      topic_tags: topicTags,
      key_facts: keyFacts,
      sentiment: input.snapshot.summary.mood,
      importance_score: clamp(0.6 + (topicTags.length * 0.04), 0, 1),
    },
    policy: {
      visibility: 'private_only',
      retrieval_scope: 'private_chat',
      owner_note_embedded: false,
    },
    handoff: {
      public_reuse_default: 'blocked',
      public_safe_shadow_hint: trimCompact(input.snapshot.summary.public_safe_summary, 180),
      derived_public_allowed: false,
      why_relevant_hint: trimCompact(input.why_relevant_hint, 180),
    },
  }
}

function buildGovernanceLine(card: PublicMediaContextCard): string {
  const originRule = card.governance.disclose_origin_policy === 'never'
    ? '不要解释素材来源'
    : '只按公开可见线索描述'
  const refRule = card.governance.prohibited_reference_types.length > 0
    ? `禁止引用: ${card.governance.prohibited_reference_types.join(', ')}`
    : '遵守公共治理边界'
  return `governance: ${originRule}; ${refRule}`
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values.map((item) => item.trim()).filter((item) => item.length > 0)) {
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function trimCompact(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
