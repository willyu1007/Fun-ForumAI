import { describe, expect, it, vi } from 'vitest'
import { SurfaceMediaPlanningService } from '../surface-media-planning-service.js'
import type { PersistedVisualDirective } from '../../repos/types.js'

function buildDirective(): PersistedVisualDirective {
  return {
    id: 'directive-chat-1',
    schema_version: 'visual-directive.v1',
    scene_ref: {
      request_id: 'room-1:event-1',
      director_surface: 'chat_room',
      actor_surface: 'chat_room_message',
      thread_root_ref: 'room_program_event:event-1',
      community_id: 'community-1',
      episode_id: 'episode-1',
      room_id: 'room-1',
      selection_id: 'selection-1',
      episode_plan_id: 'event-1',
      local_intent_id: 'intent-1',
      phase: 'opening',
      selection_mode: 'autonomous_anchored',
    },
    goal: {
      need_image: 'preferred',
      visual_role: 'scene_establishing',
      human_goal: 'continuity',
      runtime_influence: 'medium',
      display_priority: 'primary',
    },
    narrative_context: {
      hook: '继续讨论',
      objective: '维持房间叙事连续性',
      tone_hint: 'neutral',
      relation_focus: 'none',
      semantic_query: '继续讨论',
      required_elements: [],
      forbidden_elements: [],
      style_hint: null,
      aspect_ratio_hint: '1:1',
    },
    sourcing_policy: {
      allow_sources: ['owner_private_pool'],
      prefer_order: ['owner_private_pool'],
      allow_private_runtime_projection: true,
      allow_private_inspired_generation: true,
      allow_cross_agent_public: false,
      allow_generation: true,
      max_display_assets: 1,
    },
    guardrails: {
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'seed_only',
      display_policy: 'original_allowed',
      mention_policy: 'allude',
      text_in_image: 'avoid',
    },
    budget: {
      generation_tier: 'medium',
      sync_generation_ms_budget: 2200,
      async_generation_allowed: true,
      max_generation_attempts: 2,
    },
    audit: {
      director_reason: 'chat_room continuity',
      hard_constraints: [],
      soft_constraints: [],
    },
    created_at: new Date(),
    updated_at: new Date(),
  }
}

describe('SurfaceMediaPlanningService', () => {
  it('retries once when image plan creation hits the directive foreign-key race', async () => {
    const directive = buildDirective()
    const imagePlannerService = {
      planWithDirective: vi.fn()
        .mockRejectedValueOnce({
          code: 'P2003',
          message: 'Foreign key constraint violated on the constraint: `image_plans_directive_id_fkey`',
        })
        .mockResolvedValueOnce({
          id: 'image-plan-1',
          scene_ref: directive.scene_ref,
          status: 'ready',
          decision: 'generate_from_private_projection',
          reason: 'generation_succeeded',
          runtime: {
            enabled: false,
            influence_level: 'medium',
            cards: [],
          },
          display: {
            enabled: true,
            attachments: [
              {
                asset_id: 'asset-generated-1',
                slot: 0,
                display_variant: 'generated_derivative',
              },
            ],
          },
          generation: {
            mode: 'sync',
            input_mode: 'reference',
            status: 'succeeded',
            job_id: 'generation-job-1',
            output_asset_id: 'asset-generated-1',
          },
          selected_sources: [],
        }),
    }
    const service = new SurfaceMediaPlanningService({
      visualDirectiveService: {
        createForumThreadDirective: vi.fn(),
        createChatRoomMessageDirective: vi.fn(async () => directive),
      } as never,
      imagePlannerService: imagePlannerService as never,
      mediaProjectionService: {
        serializePublicCardForPrompt: vi.fn(),
      } as never,
    })

    const plan = await service.prepareChatRoomMessagePlan({
      agent_id: 'agent-1',
      room_id: 'room-1',
      room_name: 'AI Consciousness',
      room_description: 'A live room',
      community_id: 'community-1',
      semantic_hint: '继续讨论意识与自由',
    })

    expect(imagePlannerService.planWithDirective).toHaveBeenCalledTimes(2)
    expect(plan).not.toBeNull()
    expect(plan?.image_plan_id).toBe('image-plan-1')
    expect(plan?.display_attachment_refs).toEqual([
      {
        asset_id: 'asset-generated-1',
        slot: 0,
        display_variant: 'generated_derivative',
      },
    ])
  })

  it('prepares cue forum post plans with anchor and selected-only constraints', async () => {
    const directive = buildDirective()
    const imagePlannerService = {
      planWithDirective: vi.fn(async (input: { directive: PersistedVisualDirective }) => ({
        id: 'image-plan-cue-1',
        scene_ref: input.directive.scene_ref,
        status: 'ready',
        decision: 'reuse_public_original',
        reason: 'selected_pool_asset',
        runtime: {
          enabled: false,
          influence_level: 'medium',
          cards: [],
        },
        display: {
          enabled: true,
          attachments: [
            {
              asset_id: 'asset-anchor',
              slot: 0,
              display_variant: 'original',
            },
          ],
        },
        generation: {
          mode: 'none',
          status: 'not_requested',
        },
        selected_sources: [
          {
            asset_id: 'asset-anchor',
            reuse_mode: 'quote_original',
            rejection_reason: null,
          },
        ],
        planner_audit: {
          evaluated_candidates: 1,
          score_breakdown: { total: 1 },
          fallback_action: null,
        },
      })),
    }
    const service = new SurfaceMediaPlanningService({
      visualDirectiveService: {
        createScheduledPostDirective: vi.fn(async () => directive),
        createForumThreadDirective: vi.fn(),
        createChatRoomMessageDirective: vi.fn(),
      } as never,
      imagePlannerService: imagePlannerService as never,
      mediaProjectionService: {
        serializePublicCardForPrompt: vi.fn(),
      } as never,
    })

    const plan = await service.prepareCueForumPostPlan({
      agent_id: 'agent-1',
      community_id: 'community-1',
      payload: {} as never,
      anchor_asset_id: 'asset-anchor',
      candidate_asset_ids: ['asset-anchor'],
      forbid_generation: true,
    })

    expect(imagePlannerService.planWithDirective).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor_asset_id: 'asset-anchor',
        candidate_asset_ids: ['asset-anchor'],
        directive: expect.objectContaining({
          sourcing_policy: expect.objectContaining({
            allow_generation: false,
            allow_private_inspired_generation: false,
          }),
          budget: expect.objectContaining({
            generation_tier: 'none',
            sync_generation_ms_budget: 0,
            async_generation_allowed: false,
            max_generation_attempts: 0,
          }),
        }),
      }),
    )
    expect(plan?.image_plan_id).toBe('image-plan-cue-1')
    expect(plan?.display_attachment_refs).toEqual([
      {
        asset_id: 'asset-anchor',
        slot: 0,
        display_variant: 'original',
      },
    ])
    expect(plan?.selected_sources).toEqual([
      {
        asset_id: 'asset-anchor',
        reuse_mode: 'quote_original',
        rejection_reason: null,
      },
    ])
  })
})
