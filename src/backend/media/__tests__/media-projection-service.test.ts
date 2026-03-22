import { describe, expect, it } from 'vitest'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { buildRetrievalCaptionText, MediaProjectionService } from '../media-projection-service.js'

describe('buildRetrievalCaptionText', () => {
  it('includes discussion points so backfilled and live retrieval captions stay aligned', () => {
    const text = buildRetrievalCaptionText({
      summary: {
        theme: 'minimalist',
        scene: 'solid color background',
        mood: 'neutral',
        discussion_points: ['颜色心理', '极简设计'],
        salient_entities: [],
        ocr_snippets: [],
        safety_labels: [],
        public_safe_summary: 'A minimalist solid-color image.',
        internal_full_summary: 'A minimalist solid-color image used for discussion.',
      },
      ownerNote: 'owner-note',
    })

    expect(text).toContain('theme: minimalist')
    expect(text).toContain('scene: solid color background')
    expect(text).toContain('owner_note: owner-note')
    expect(text).toContain('discussion_points: 颜色心理 | 极简设计')
  })
})

describe('MediaProjectionService public card serialization', () => {
  it('keeps serialization deterministic and omits sensitive fields from prompt text', () => {
    const service = new MediaProjectionService({
      mediaContextProjectionRepo: new InMemoryMediaContextProjectionRepository(),
    })

    const card = {
      schema_version: 'public-media-context-card.v1',
      card_id: 'card-1',
      modality: 'image',
      asset_ref: {
        asset_id: 'asset-private-1',
        semantic_snapshot_id: 'snapshot-1',
        projection_id: 'projection-1',
      },
      source: {
        kind: 'owner_private_pool',
        derived_from_private: true,
      },
      relation: {
        visual_role: 'scene_establishing',
        prompt_weight: 'primary',
        mention_policy: 'explicit_describe',
        why_now: '用于开场建立场景和阅读锚点。',
      },
      public_summary: {
        theme: 'travel',
        scene: 'city skyline',
        mood: 'bright',
        salient_entities: ['city'],
        discussion_points: ['城市氛围'],
        public_safe_caption: 'A bright city skyline.',
        alt_text: 'A bright city skyline.',
      },
      display: {
        original_display_allowed: true,
        derivative_display_allowed: true,
        preferred_variant: 'original',
      },
      governance: {
        public_scope: 'community_public',
        disclose_origin_policy: 'never',
        cross_agent_quote_allowed: false,
        prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
        expires_at: null,
      },
      audit: {
        confidence: 0.9,
        relevance_score: 0.9,
        model_version: 'test',
      },
    }

    const first = service.serializePublicCardForPrompt({
      card,
      max_chars: 500,
      sensitive_terms: ['owner-note-secret'],
    })
    const second = service.serializePublicCardForPrompt({
      card,
      max_chars: 500,
      sensitive_terms: ['owner-note-secret'],
    })

    expect(first.text).toBe(second.text)
    expect(first.text).toContain('visual_role: scene_establishing')
    expect(first.text).toContain('why_now: 用于开场建立场景和阅读锚点。')
    expect(first.audit.contains_asset_id).toBe(false)
    expect(first.audit.contains_url).toBe(false)
    expect(first.audit.contains_owner_note).toBe(false)
  })

  it('retains governance guidance before caption and ocr when trimming for budget', () => {
    const service = new MediaProjectionService({
      mediaContextProjectionRepo: new InMemoryMediaContextProjectionRepository(),
    })

    const serialized = service.serializePublicCardForPrompt({
      card: {
        schema_version: 'public-media-context-card.v1',
        card_id: 'card-2',
        modality: 'image',
        asset_ref: {
          asset_id: 'asset-private-2',
          semantic_snapshot_id: 'snapshot-2',
          projection_id: 'projection-2',
        },
        source: {
          kind: 'owner_private_pool',
          derived_from_private: true,
        },
        relation: {
          visual_role: 'scene_establishing',
          prompt_weight: 'primary',
          mention_policy: 'explicit_describe',
          why_now: '用于开场建立场景和阅读锚点。',
        },
        public_summary: {
          theme: 'travel',
          scene: 'city skyline',
          mood: 'bright',
          salient_entities: ['city', 'river'],
          discussion_points: ['城市氛围', '桥面光线'],
          public_safe_caption: 'A bright city skyline with very long caption text that should be dropped before governance guidance when budget is tight.',
          alt_text: 'A bright city skyline.',
          ocr_snippets: ['Line 1', 'Line 2', 'Line 3'],
        },
        display: {
          original_display_allowed: true,
          derivative_display_allowed: true,
          preferred_variant: 'original',
        },
        governance: {
          public_scope: 'community_public',
          disclose_origin_policy: 'never',
          cross_agent_quote_allowed: false,
          prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
          expires_at: null,
        },
        audit: {
          confidence: 0.9,
          relevance_score: 0.9,
          model_version: 'test',
        },
      },
      max_chars: 260,
    })

    expect(serialized.text).toContain('governance:')
    expect(serialized.text).not.toContain('public_safe_caption:')
    expect(serialized.text).not.toContain('ocr_snippets:')
  })
})
