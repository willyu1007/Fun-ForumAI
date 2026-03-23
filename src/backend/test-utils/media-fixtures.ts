import type { MediaSemanticSummary, SceneMediaBinding } from '../repos/types.js'
import { normalizeStoredSemanticSummary } from '../media/media-contract-utils.js'

export function buildMediaSemanticSummary(
  overrides: Partial<MediaSemanticSummary> = {},
): MediaSemanticSummary {
  const {
    scene,
    composition,
    style,
    entities,
    ocr,
    safety,
    summaries,
    confidence,
    theme,
    mood,
    style_tags,
    discussion_points,
    salient_entities,
    ocr_snippets,
    safety_labels,
    public_safe_summary,
    internal_full_summary,
  } = overrides
  return normalizeStoredSemanticSummary({
    scene: scene ?? 'static visual scene',
    composition: composition ?? 'single-scene composition',
    style: {
      theme: style?.theme ?? theme ?? 'visual discussion material',
      mood: style?.mood ?? mood ?? 'neutral',
      tags: style?.tags ?? style_tags ?? [],
    },
    entities: {
      discussion_points: entities?.discussion_points ?? discussion_points ?? ['Describe the visible cue.'],
      salient: entities?.salient ?? salient_entities ?? [],
    },
    ocr: {
      snippets: ocr?.snippets ?? ocr_snippets ?? [],
    },
    safety: {
      labels: safety?.labels ?? safety_labels ?? [],
    },
    summaries: {
      public_safe:
        summaries?.public_safe
        ?? public_safe_summary
        ?? 'A visual media asset that can support public discussion.',
      internal_full:
        summaries?.internal_full
        ?? internal_full_summary
        ?? 'A visual media asset available for media reasoning.',
    },
    confidence: confidence ?? 0.8,
  })
}

export function buildSceneMediaBinding(
  overrides: Partial<SceneMediaBinding> = {},
): SceneMediaBinding {
  return {
    id: 'binding-1',
    scene_type: 'forum_post',
    scene_id: 'scene-1',
    thread_root_ref: null,
    asset_id: 'asset-1',
    semantic_snapshot_id: 'snapshot-1',
    source_scene_type: null,
    source_scene_id: null,
    binding_role: 'primary',
    relation_to_scene: 'selected_for_post',
    binding_note_text: null,
    display_policy: 'original_allowed',
    created_by_type: 'system',
    created_by_id: 'system',
    created_at: new Date(),
    ...overrides,
  }
}
