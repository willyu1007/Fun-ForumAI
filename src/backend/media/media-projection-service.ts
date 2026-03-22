import type {
  MediaAsset,
  MediaContextProjection,
  MediaSemanticSummary,
  MediaSemanticSnapshot,
  SceneMediaBinding,
} from '../repos/types.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'

export interface MediaProjectionServiceDeps {
  mediaContextProjectionRepo: MediaContextProjectionRepository
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
  }): Promise<MediaContextProjection> {
    const altText = input.snapshot.summary.public_safe_summary
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
      },
      token_estimate: estimateTokens(altText),
      preferred_display_variant: 'original',
    })
  }
}
