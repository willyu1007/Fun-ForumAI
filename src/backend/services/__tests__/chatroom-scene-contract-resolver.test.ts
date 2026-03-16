import { describe, expect, it } from 'vitest'
import { ChatroomSceneContractResolver } from '../chatroom-scene-contract-resolver.js'
import { DEFAULT_STAGE_SPEC_V1 } from '../../stage/index.js'

describe('ChatroomSceneContractResolver', () => {
  it('prefers active chat_room bindings from the scene pool catalog', () => {
    const resolver = new ChatroomSceneContractResolver({
      catalogService: {
        getLaunchCatalog: () => ({
          version: 'v2',
          contract_version: 'public_director_contract_v1',
          exported_at: '2026-03-14T00:00:00.000Z',
          templates: [],
          stage_templates: [{
            template_id: 'chatroom-template-1',
            template_version: 'v2',
            name: 'Chatroom Template',
            category: 'show',
            lifecycle_status: 'core_active',
            stage_spec: DEFAULT_STAGE_SPEC_V1,
            director: {
              applicable_surfaces: ['chat_room'],
              scene_goal: {
                viewer_goal: '把房间推成更有看点的一档节目',
                growth_goal: '放大成员之间的舞台化学反应',
              },
              casting_recipe: {
                quota: 3,
                ratio: { core: 2, contrast: 1, wildcard: 0 },
                wildcard_cap: 0,
                must_have_roles: ['HOST', 'FOIL'],
                avoid_pairs: [],
                relationship_objectives: ['challenge'],
              },
              beat_plan: {
                phases: ['opening', 'escalation', 'closure'],
                optional_beats: [],
              },
              fatigue_policy: {
                cooldown_hours: 1,
                repeat_penalty: 0.8,
                max_runs_per_day: 6,
              },
              closing_policy: {
                ttl_hours: 4,
                min_turns: 3,
                message_threshold: 12,
                aftershow_mode: 'threshold',
              },
              hot_topic_policy: {
                injection_mode: 'overlay_only',
                sensitive_topic_mode: 'standard',
              },
              autonomy_policy: {
                allow_autonomous_mutation: false,
                require_pool_match_before_create: true,
              },
            },
          }],
          scene_bindings: [{
            binding_id: 'binding-room-1',
            template_id: 'chatroom-template-1',
            template_version: 'v2',
            binding_type: 'core',
            status: 'active',
            entry_surfaces: ['chat_room'],
            target: {
              surface: 'chat_room',
              room_id: 'room-1',
            },
            lifecycle: {},
            weights: {
              editorial_priority: 8,
              base_weight: 1,
              freshness_bonus: 0,
            },
            activation: {
              time_windows: [],
              allowed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
              trigger_conditions: [],
            },
            governance: {},
            constraints: {},
          }],
          surface_vocabulary: {
            director_surfaces: ['forum', 'scheduled_post', 'chat_room'],
            actor_surfaces: ['forum_post', 'forum_comment', 'chat_room'],
            private_surfaces: ['private_chat', 'proactive_dm'],
          },
        }),
      } as never,
    })

    const resolved = resolver.resolve({
      roomId: 'room-1',
      sceneType: 'TALK_SHOW',
    })

    expect(resolved.source).toBe('binding')
    expect(resolved.binding?.binding_id).toBe('binding-room-1')
    expect(resolved.template.template_id).toBe('chatroom-template-1')
    expect(resolved.selection_mode).toBe('pool_strict')
  })

  it('rejects chatroom resolution when the launch catalog is missing', () => {
    const resolver = new ChatroomSceneContractResolver({
      catalogService: {
        getLaunchCatalog: () => null,
      } as never,
    })

    expect(() => resolver.resolve({
      roomId: 'room-1',
      sceneType: 'TALK_SHOW',
    })).toThrow('missing launch catalog')
  })
})
