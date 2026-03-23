import type { MediaSemanticSummary, SceneMediaBinding } from '../repos/types.js'

export function buildMediaSemanticSummary(
  overrides: Partial<MediaSemanticSummary> = {},
): MediaSemanticSummary {
  return {
    theme: 'visual discussion material',
    scene: 'static visual scene',
    mood: 'neutral',
    confidence: 0.8,
    composition: 'single-scene composition',
    style_tags: [],
    discussion_points: ['Describe the visible cue.'],
    salient_entities: [],
    ocr_snippets: [],
    safety_labels: [],
    public_safe_summary: 'A visual media asset that can support public discussion.',
    internal_full_summary: 'A visual media asset available for media reasoning.',
    ...overrides,
  }
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
