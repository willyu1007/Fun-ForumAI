import { describe, expect, it } from 'vitest'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryRuntimeSceneStateRepository } from '../../repos/runtime-scene-state-repository.js'
import { config } from '../../lib/config.js'
import { RuntimeSceneStateManager } from '../runtime-scene-state-manager.js'
import { ChatroomSceneContractResolver } from '../chatroom-scene-contract-resolver.js'
import { ChatroomSceneAwareCastingService } from '../chatroom-scene-aware-casting-service.js'
import { DEFAULT_STAGE_SPEC_V1 } from '../../stage/index.js'

function buildHarness() {
  const runtimeSceneStateRepo = new InMemoryRuntimeSceneStateRepository()
  const eventRepo = new InMemoryEventRepository()
  const manager = new RuntimeSceneStateManager({
    runtimeSceneStateRepo,
    eventRepo,
    sceneResolver: new ChatroomSceneContractResolver({
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
            actor_surfaces: ['forum_post', 'forum_thread', 'chat_room'],
            private_surfaces: ['private_chat', 'proactive_dm'],
          },
        }),
      } as never,
    }),
    sceneAwareCastingService: new ChatroomSceneAwareCastingService(),
  })

  const startedAt = new Date('2026-03-13T00:00:00.000Z')
  const room = {
    id: 'room-1',
    name: 'Runtime Room',
    slug: 'runtime-room',
    description: '围绕 runtime contract 对齐',
    community_id: null,
    created_by_agent_id: 'agent-1',
    max_agents: 4,
    tick_interval_base: 20_000,
    status: 'active' as const,
    last_message_at: startedAt,
    created_at: startedAt,
    updated_at: startedAt,
  }
  const program = {
    id: 'program-1',
    room_id: room.id,
    enabled: true,
    scene_type: 'TALK_SHOW' as const,
    pacing_preset: 'balanced',
    target_cast_min: 2,
    target_cast_max: 4,
    callback_window: 18,
    recap_every_turns: 10,
    max_consecutive_turns: 1,
    idle_cue_after_ms: 30_000,
    allow_wandering: true,
    director_policy_json: {},
    wander_policy_json: {
      enabled: false,
      entry_cooldown_ms: 180_000,
      max_parallel_rooms: 2,
      min_discoverability_score: 0.25,
    },
    discoverability_tags: [],
    discoverability_short_hook: null,
    discoverability_default_view: 'live',
    created_at: startedAt,
    updated_at: startedAt,
  }
  const episode = {
    id: 'episode-1',
    room_id: room.id,
    program_id: program.id,
    status: 'ACTIVE' as const,
    summary_text: '',
    unresolved_question: null,
    callback_bank_json: [],
    energy: 0.2,
    tension: 0.1,
    turn_count: 1,
    message_count: 1,
    started_at: startedAt,
    ended_at: null,
    created_at: startedAt,
    updated_at: startedAt,
  }
  const members = [
    {
      room_id: room.id,
      member_id: 'agent-1',
      member_type: 'agent' as const,
      display_name: 'Host',
      join_source: 'creator' as const,
      personal_tick_interval: 20_000,
      messages_this_hour: 0,
      last_spoke_at: startedAt,
      role_hint: null,
      wander_eligible: true,
      spotlight_weight: 1.2,
      suppressed_until: null,
      joined_at: startedAt,
    },
    {
      room_id: room.id,
      member_id: 'agent-2',
      member_type: 'agent' as const,
      display_name: 'Foil',
      join_source: 'creator' as const,
      personal_tick_interval: 20_000,
      messages_this_hour: 0,
      last_spoke_at: startedAt,
      role_hint: null,
      wander_eligible: true,
      spotlight_weight: 1,
      suppressed_until: null,
      joined_at: startedAt,
    },
  ]
  const cast = [
    {
      agent_id: 'agent-1',
      name: 'Host',
      role: 'HOST' as const,
      chemistry_score: 0.9,
      spotlight_weight: 1.2,
      last_spoke_at: startedAt,
      role_hint: null,
      wander_eligible: true,
      suppressed_until: null,
      member_spotlight_weight: 1.2,
      projection: null,
    },
    {
      agent_id: 'agent-2',
      name: 'Foil',
      role: 'FOIL' as const,
      chemistry_score: 0.8,
      spotlight_weight: 1,
      last_spoke_at: startedAt,
      role_hint: null,
      wander_eligible: true,
      suppressed_until: null,
      member_spotlight_weight: 1,
      projection: null,
    },
  ]

  return {
    manager,
    runtimeSceneStateRepo,
    eventRepo,
    room,
    program,
    episode,
    members,
    cast,
  }
}

describe('RuntimeSceneStateManager', () => {
  it('creates chatroom runtime authority and records turn planning audit', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const snapshot = { ...featureFlags }
    featureFlags.directorRuntimeStateV1 = true

    try {
    const harness = buildHarness()
    const ensured = await harness.manager.ensureChatroomState({
      room: harness.room,
      program: harness.program,
      episode: harness.episode,
      cast: harness.cast,
      members: harness.members,
      recentMessages: [],
    })

    expect(ensured.state.state_json.aftershow.mode).toBe('threshold')
    expect(ensured.state.state_json.audit.source).toBe('binding')
    expect(ensured.state.state_json.cast.active_agent_ids).toContain('agent-1')
    expect(ensured.state.state_json.cast.slot_audit.target_active_count).toBeGreaterThan(0)
    expect(ensured.state.state_json.cast.suppressed_agent_ids).toEqual([])
    expect(harness.eventRepo.findByIdempotencyKey(`DIRECTOR_EPISODE_STARTED:${harness.room.id}:${harness.episode.id}:${ensured.state.runtime_scene_id}`)).not.toBeNull()

    await harness.manager.handleSignal({
      type: 'turn_planned',
      room_id: harness.room.id,
      episode_id: harness.episode.id,
      cue_type: 'ADVANCE',
      program_event_id: 'event-1',
      local_intent_id: 'local-intent-1',
    })

    const updated = await harness.runtimeSceneStateRepo.findByEpisodeId(harness.episode.id)
    expect(updated?.state_json.audit.latest_program_event_id).toBe('event-1')
    expect(updated?.state_json.audit.latest_local_intent_id).toBe('local-intent-1')
    } finally {
      Object.assign(featureFlags, snapshot)
    }
  })

  it('closes into cooldown when a close cue executes', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const snapshot = { ...featureFlags }
    featureFlags.directorRuntimeStateV1 = true

    try {
    const harness = buildHarness()
    await harness.manager.ensureChatroomState({
      room: harness.room,
      program: harness.program,
      episode: harness.episode,
      cast: harness.cast,
      members: harness.members,
      recentMessages: [],
    })

    await harness.manager.handleSignal({
      type: 'turn_executed',
      room_id: harness.room.id,
      episode_id: harness.episode.id,
      cue_type: 'CLOSE',
      program_event_id: 'event-close-1',
      local_intent_id: 'local-intent-close-1',
      speaker_agent_id: 'agent-1',
      body: '这一拍先收住，别把房间直接关了。',
    })

    const updated = await harness.runtimeSceneStateRepo.findByEpisodeId(harness.episode.id)
    expect(updated?.status).toBe('closed')
    expect(updated?.state_json.phase).toBe('closure')
    expect(updated?.state_json.aftershow.status).toBe('due')
    expect(updated?.state_json.cooldown_until).toBeNull()
    } finally {
      Object.assign(featureFlags, snapshot)
    }
  })

  it('marks aftershow-enabled scenes as closed and due instead of forcing cooldown', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const snapshot = { ...featureFlags }
    featureFlags.directorRuntimeStateV1 = true

    try {
      const runtimeSceneStateRepo = new InMemoryRuntimeSceneStateRepository()
      const eventRepo = new InMemoryEventRepository()
      const manager = new RuntimeSceneStateManager({
        runtimeSceneStateRepo,
        eventRepo,
        sceneResolver: {
          resolve: () => ({
            template: {
              template_id: 'chatroom-template-1',
              template_version: 'v2',
              name: 'Chatroom Template',
              category: 'show',
              lifecycle_status: 'core_active',
              stage_spec: DEFAULT_STAGE_SPEC_V1,
              director: {
                applicable_surfaces: ['chat_room'],
                scene_goal: {
                  viewer_goal: '把房间继续推成一档节目',
                  growth_goal: '推动台上化学反应',
                },
                casting_recipe: {
                  quota: 3,
                  ratio: {
                    core: 2,
                    contrast: 1,
                    wildcard: 1,
                  },
                  wildcard_cap: 1,
                  must_have_roles: ['HOST'],
                  avoid_pairs: [],
                  relationship_objectives: ['bridge'],
                },
                beat_plan: {
                  phases: ['opening', 'escalation', 'pivot', 'closure'],
                  optional_beats: [],
                },
                fatigue_policy: {
                  cooldown_hours: 1,
                  repeat_penalty: 0.6,
                  max_runs_per_day: 4,
                },
                closing_policy: {
                  ttl_hours: 4,
                  min_turns: 3,
                  message_threshold: 4,
                  aftershow_mode: 'threshold',
                },
                hot_topic_policy: {
                  injection_mode: 'overlay_only',
                  sensitive_topic_mode: 'standard',
                },
                autonomy_policy: {
                  allow_autonomous_mutation: false,
                  require_pool_match_before_create: false,
                },
              },
            },
            binding: {
              binding_id: 'chatroom-binding-1',
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
            },
            source: 'binding',
            selection_mode: 'pool_guided',
          }),
        } as never,
        sceneAwareCastingService: new ChatroomSceneAwareCastingService(),
      })

      const harness = buildHarness()
      const ensured = await manager.ensureChatroomState({
        room: harness.room,
        program: harness.program,
        episode: harness.episode,
        cast: harness.cast,
        members: harness.members,
        recentMessages: [],
      })
      expect(ensured.state.state_json.aftershow.mode).toBe('threshold')
      expect(ensured.state.state_json.aftershow.status).toBe('pending')
      expect(ensured.state.state_json.audit.source).toBe('binding')

      await manager.handleSignal({
        type: 'turn_executed',
        room_id: harness.room.id,
        episode_id: harness.episode.id,
        cue_type: 'CLOSE',
        program_event_id: 'event-close-aftershow-1',
        local_intent_id: 'local-intent-aftershow-1',
        speaker_agent_id: 'agent-1',
        body: '这拍先收住，后面进 aftershow。',
      })

      const updated = await runtimeSceneStateRepo.findByEpisodeId(harness.episode.id)
      expect(updated?.status).toBe('closed')
      expect(updated?.state_json.aftershow.mode).toBe('threshold')
      expect(updated?.state_json.aftershow.status).toBe('due')
      expect(updated?.state_json.cooldown_until).toBeNull()
    } finally {
      Object.assign(featureFlags, snapshot)
    }
  })
})
