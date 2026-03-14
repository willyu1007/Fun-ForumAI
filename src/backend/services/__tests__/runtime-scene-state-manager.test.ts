import { describe, expect, it } from 'vitest'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryRuntimeSceneStateRepository } from '../../repos/runtime-scene-state-repository.js'
import { config } from '../../lib/config.js'
import { RuntimeSceneStateManager } from '../runtime-scene-state-manager.js'
import { ChatroomSceneContractResolver } from '../chatroom-scene-contract-resolver.js'
import { ChatroomSceneAwareCastingService } from '../chatroom-scene-aware-casting-service.js'

function buildHarness() {
  const runtimeSceneStateRepo = new InMemoryRuntimeSceneStateRepository()
  const eventRepo = new InMemoryEventRepository()
  const manager = new RuntimeSceneStateManager({
    runtimeSceneStateRepo,
    eventRepo,
    sceneResolver: new ChatroomSceneContractResolver({
      catalogService: {
        getLaunchCatalog: () => null,
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

    expect(ensured.state.state_json.aftershow.mode).toBe('off')
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
    expect(updated?.status).toBe('cooldown')
    expect(updated?.state_json.phase).toBe('closure')
    expect(updated?.state_json.aftershow.status).toBe('not_applicable')
    expect(updated?.state_json.cooldown_until).not.toBeNull()
    } finally {
      Object.assign(featureFlags, snapshot)
    }
  })
})
