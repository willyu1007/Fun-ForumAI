import { describe, expect, it } from 'vitest'
import { InMemoryVisualDirectiveRepository } from '../../repos/visual-directive-repository.js'
import { VisualDirectiveService } from '../visual-directive-service.js'
import type { PublicSceneWritePayload } from '../../services/public-scene-runtime.js'

function buildScenePayload(): PublicSceneWritePayload {
  return {
    scene_metadata: {
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      scene_template_id: 'stage-theme-01',
      scene_template_version: 'v2',
      scene_binding_id: 'binding-1',
      overlay_id: null,
      episode_id: 'episode-1',
      beat_id: null,
      phase: 'opening',
      selection_mode: 'pool_guided',
      selection_id: 'selection-1',
      episode_plan_id: 'plan-1',
      local_intent_id: 'intent-1',
      started_at: '2026-03-13T00:00:00.000Z',
      expires_at: '2026-03-14T00:00:00.000Z',
    },
    episode_brief: {
      episode_id: 'episode-1',
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      template_id: 'stage-theme-01',
      template_version: 'v2',
      binding_id: 'binding-1',
      phase: 'opening',
      scene_goal: {
        viewer_goal: '推进讨论',
        growth_goal: '增加连贯性',
      },
      casting_directive: {
        must_have_roles: [],
        avoid_pairs: [],
        core_quota: 2,
        contrast_quota: 1,
        wildcard_quota: 1,
      },
      open_loops: [],
      must_hit_points: [],
      avoid_repeat: [],
      close_condition: {
        ttl_hours: 24,
        message_threshold: 12,
        objective: '推进讨论',
      },
      expires_at: '2026-03-14T00:00:00.000Z',
    },
    local_intent: {
      intent_id: 'intent-1',
      delivery_surface: 'forum_post',
      initiative: 'open_topic',
      opinion_policy: 'free_opinion',
      relation_focus: 'none',
      tone_hint: 'neutral',
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'seed_only',
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      target_ref: { kind: 'none' },
      hard_constraints: ['不得改写目标社区'],
      soft_constraints: ['推进讨论'],
    },
    local_intent_block: '## Local Intent\n- episode_id: episode-1',
  }
}

describe('VisualDirectiveService', () => {
  it('produces stable scheduled-post defaults for opening phase', async () => {
    const service = new VisualDirectiveService({
      visualDirectiveRepo: new InMemoryVisualDirectiveRepository(),
    })

    const directive = await service.createScheduledPostDirective({
      community_id: 'community-1',
      payload: buildScenePayload(),
    })

    expect(directive.goal.need_image).toBe('preferred')
    expect(directive.goal.visual_role).toBe('scene_establishing')
    expect(directive.goal.display_priority).toBe('primary')
    expect(directive.sourcing_policy.prefer_order).toEqual([
      'self_public_archive',
      'same_episode_public',
      'private_derived_public',
      'generated_public',
      'same_thread_public',
      'owner_private_pool',
      'private_runtime_projection',
      'community_commons',
      'platform_canonical',
    ])
    expect(directive.guardrails.mention_policy).toBe('explicit_describe')
  })
})
