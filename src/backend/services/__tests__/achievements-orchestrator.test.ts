import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryAchievementRepository } from '../../repos/achievement-repository.js'
import { InMemoryChronicleRepository } from '../../repos/chronicle-repository.js'
import { InMemoryAgentSignalLogRepository } from '../../repos/agent-signal-log-repository.js'
import { AchievementChronicleService } from '../achievement-chronicle-service.js'
import { AchievementsOrchestrator } from '../achievements-orchestrator.js'
import { config } from '../../lib/config.js'
import { ACHIEVEMENT_DEFINITIONS_V1 } from '../achievements/definitions.js'

describe('AchievementsOrchestrator', () => {
  const features = config.launch.capabilities as unknown as Record<string, boolean>
  const originalChronicle = features.achievementChronicleV1
  const originalPublic = features.achievementPublicHighlights
  const originalSignalLog = features.signalLogV1

  beforeEach(() => {
    features.achievementChronicleV1 = true
    features.achievementPublicHighlights = true
    features.signalLogV1 = false
  })

  afterEach(() => {
    features.achievementChronicleV1 = originalChronicle
    features.achievementPublicHighlights = originalPublic
    features.signalLogV1 = originalSignalLog
  })

  it('grants only once for same code+tier (idempotent)', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A1' })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    const orchestrator = new AchievementsOrchestrator({
      agentRepo,
      achievementRepo,
      chronicleRepo,
      chronicleService,
    })

    await orchestrator.processSignal({
      kind: 'forum_post',
      agent_id: agent.id,
      dedup_key: 'post:p1',
      evidence: [{ kind: 'post', ref_id: 'p1' }],
      metadata: { community_id: 'community-1' },
    })

    await orchestrator.processSignal({
      kind: 'forum_post',
      agent_id: agent.id,
      dedup_key: 'post:p1',
      evidence: [{ kind: 'post', ref_id: 'p1' }],
      metadata: { community_id: 'community-1' },
    })

    const achievements = await achievementRepo.findByAgent(agent.id, { limit: 50 })
    const forumTier1 = achievements.items.filter((item) => item.code === 'forum_post_crafter' && item.tier === 1)
    expect(forumTier1).toHaveLength(1)
  })

  it('supports independent grants for the same achievement code across community scopes', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A1-scope' })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    const orchestrator = new AchievementsOrchestrator({
      agentRepo,
      achievementRepo,
      chronicleRepo,
      chronicleService,
    })

    await orchestrator.processSignal({
      kind: 'forum_post',
      agent_id: agent.id,
      dedup_key: 'post:scope-c1',
      evidence: [{ kind: 'post', ref_id: 'scope-c1' }],
      metadata: { community_id: 'community-1' },
    })

    await orchestrator.processSignal({
      kind: 'forum_post',
      agent_id: agent.id,
      dedup_key: 'post:scope-c2',
      evidence: [{ kind: 'post', ref_id: 'scope-c2' }],
      metadata: { community_id: 'community-2' },
    })

    const achievements = await achievementRepo.findByAgent(agent.id, { limit: 50 })
    const forumTier1 = achievements.items.filter((item) => item.code === 'forum_post_crafter' && item.tier === 1)
    expect(forumTier1).toHaveLength(2)
    expect(new Set(forumTier1.map((item) => item.scope_key))).toEqual(new Set(['community-1', 'community-2']))
  })

  it('downgrades visibility to OWNER_ONLY when evidence policy is not satisfied', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A2' })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    const orchestrator = new AchievementsOrchestrator({
      agentRepo,
      achievementRepo,
      chronicleRepo,
      chronicleService,
    })

    await orchestrator.processSignal({
      kind: 'forum_post',
      agent_id: agent.id,
      dedup_key: 'post:p2',
      evidence: [{ kind: 'activity', ref_id: 'p2' }],
      metadata: { community_id: 'community-1' },
    })

    const achievements = await achievementRepo.findByAgent(agent.id, { limit: 50 })
    const forumTier1 = achievements.items.find((item) => item.code === 'forum_post_crafter' && item.tier === 1)
    expect(forumTier1).toBeTruthy()
    expect(forumTier1?.visibility).toBe('OWNER_ONLY')
  })

  it('respects cooldown window before granting next tier for private digest achievements', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A4' })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    const orchestrator = new AchievementsOrchestrator({
      agentRepo,
      achievementRepo,
      chronicleRepo,
      chronicleService,
    })

    const start = new Date('2026-03-01T00:00:00.000Z')
    for (let i = 0; i < 5; i += 1) {
      await orchestrator.processSignal({
        kind: 'private_digest',
        agent_id: agent.id,
        dedup_key: `digest:${i}`,
        evidence: [{ kind: 'private_digest', ref_id: `session-${i}` }],
        occurred_at: new Date(start.getTime() + i * 5 * 60 * 1000),
      })
    }

    const beforeCooldown = await achievementRepo.findByAgent(agent.id, { limit: 50 })
    const digestTier1 = beforeCooldown.items.find(
      (item) => item.code === 'private_digest_keeper' && item.tier === 1,
    )
    const digestTier2Before = beforeCooldown.items.find(
      (item) => item.code === 'private_digest_keeper' && item.tier === 2,
    )

    expect(digestTier1).toBeTruthy()
    expect(digestTier2Before).toBeFalsy()

    await orchestrator.processSignal({
      kind: 'private_digest',
      agent_id: agent.id,
      dedup_key: 'digest:after-cooldown',
      evidence: [{ kind: 'private_digest', ref_id: 'session-after-cooldown' }],
      occurred_at: new Date('2026-03-01T06:30:00.000Z'),
    })

    const afterCooldown = await achievementRepo.findByAgent(agent.id, { limit: 50 })
    const digestTier2After = afterCooldown.items.find(
      (item) => item.code === 'private_digest_keeper' && item.tier === 2,
    )

    expect(digestTier2After).toBeTruthy()
  })

  it('applies owner density cap (<=10/day) with folded_count', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A3' })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    for (let i = 0; i < 12; i += 1) {
      await chronicleService.recordChronicle({
        agent_id: agent.id,
        visibility: 'OWNER_ONLY',
        type: 'HIGHLIGHT',
        title: `Entry ${i}`,
        summary: `Summary ${i}`,
        importance_score: 0.2 + i / 100,
        evidence: [{ kind: 'chronicle', ref_id: `entry-${i}` }],
        occurred_at: new Date('2026-03-01T08:00:00.000Z'),
      })
    }

    const result = await chronicleService.listChronicleForOwner(agent.id, { limit: 30 })
    expect(result.items.length).toBeLessThanOrEqual(10)
    expect(result.folded_count).toBe(2)
  })

  it('keeps batch achievements public when required evidence kinds are present', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A5' })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    const orchestrator = new AchievementsOrchestrator({
      agentRepo,
      achievementRepo,
      chronicleRepo,
      chronicleService,
    })

    const now = new Date('2026-03-01T08:00:00.000Z')
    await chronicleRepo.create({
      agent_id: agent.id,
      visibility: 'PUBLIC',
      type: 'HIGHLIGHT',
      title: 'Global Chronicle Signal',
      summary: '一条全局公共 chronicle，用于点亮 daily spotlight。',
      importance_score: 0.88,
      evidence: [{ kind: 'chronicle', ref_id: 'global-chronicle' }],
      tags: ['signal:forum_post'],
      scope: 'global',
      scope_key: '__global__',
      occurred_at: now,
    })
    await chronicleRepo.create({
      agent_id: agent.id,
      visibility: 'PUBLIC',
      type: 'HIGHLIGHT',
      title: 'Aftershow Signal',
      summary: '另一条全局公共 chronicle，用于点亮 aftershow 场景桶。',
      importance_score: 0.91,
      evidence: [{ kind: 'aftershow', ref_id: 'aftershow-1' }],
      tags: ['signal:aftershow_published'],
      scope: 'global',
      scope_key: '__global__',
      occurred_at: now,
    })
    await orchestrator.runDailyBatch(now)
    await orchestrator.runWeeklyBatch(now)

    const achievements = await achievementRepo.findByAgent(agent.id, { limit: 50 })
    const dailySpotlight = achievements.items.find(
      (item) => item.code === 'chronicle_spotlight' && item.tier === 1,
    )
    const weeklyCrossScene = achievements.items.find(
      (item) => item.code === 'cross_scene_actor' && item.tier === 1,
    )

    expect(dailySpotlight).toBeTruthy()
    expect(dailySpotlight?.visibility).toBe('PUBLIC')
    expect(weeklyCrossScene).toBeTruthy()
    expect(weeklyCrossScene?.visibility).toBe('PUBLIC')
  })

  it('ships launch definitions with 45 achievement rows', () => {
    expect(ACHIEVEMENT_DEFINITIONS_V1).toHaveLength(45)
    expect(ACHIEVEMENT_DEFINITIONS_V1.some((item) => item.code === 'highlight_headliner')).toBe(true)
    expect(ACHIEVEMENT_DEFINITIONS_V1.some((item) => item.code === 'aftershow_recapper')).toBe(true)
    expect(ACHIEVEMENT_DEFINITIONS_V1.some((item) => item.code === 'storyline_driver')).toBe(true)
    expect(ACHIEVEMENT_DEFINITIONS_V1.some((item) => item.code === 'proactive_confidant')).toBe(true)
  })

  it('counts only stage-preserving governance for governance_steadfast', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: '治理样本' })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })
    const orchestrator = new AchievementsOrchestrator({
      agentRepo,
      achievementRepo,
      chronicleRepo,
      chronicleService,
    })

    await orchestrator.processGovernanceResult({
      target_agent_id: agent.id,
      target_type: 'agent',
      action: 'limit_agent',
      source_ref_id: 'agent-1',
      admin_user_id: 'admin-1',
      result_success: true,
      new_visibility: null,
      new_state: null,
    })
    await orchestrator.processGovernanceResult({
      target_agent_id: agent.id,
      target_type: 'post',
      action: 'approve',
      source_ref_id: 'post-1',
      admin_user_id: 'admin-1',
      result_success: true,
      new_visibility: 'PUBLIC',
      new_state: 'APPROVED',
    })

    const achievements = await achievementRepo.findByAgent(agent.id, { limit: 50 })
    const governanceTier1 = achievements.items.find((item) => item.code === 'governance_steadfast' && item.tier === 1)

    expect(governanceTier1).toBeTruthy()
    expect(achievements.items.filter((item) => item.code === 'governance_steadfast')).toHaveLength(1)
  })

  it('does not grant launch home badges from post-time editorial intent anymore', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'Intent Agent' })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })
    const orchestrator = new AchievementsOrchestrator({
      agentRepo,
      achievementRepo,
      chronicleRepo,
      chronicleService,
    })

    await orchestrator.processDomainEvent({
      id: 'evt-post-created-1',
      event_type: 'POST_CREATED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: 'community-1',
      post_id: 'post-1',
      room_id: null,
      actor_type: 'agent',
      actor_id: agent.id,
      cause_event_id: null,
      correlation_id: null,
      payload_json: {
        author_agent_id: agent.id,
        post_id: 'post-1',
        community_id: 'community-1',
        public_scene: {
          launch_programming: {
            editorial_intent: {
              primary_shelf_id: 'must_watch_today',
              content_kind: 'highlight_hero',
            },
            storyline: {
              id: 'story-1',
            },
          },
          episode_brief: {
            episode_id: 'story-1',
          },
        },
      },
      idempotency_key: null,
      created_at: new Date('2026-04-07T08:00:00.000Z'),
    })

    const achievements = await achievementRepo.findByAgent(agent.id, { limit: 50 })
    expect(achievements.items.find((item) => item.code === 'forum_post_crafter' && item.tier === 1)).toBeTruthy()
    expect(achievements.items.find((item) => item.code === 'highlight_headliner')).toBeFalsy()
    expect(achievements.items.find((item) => item.code === 'storyline_driver')).toBeFalsy()
  })

  it('grants launch home badges from HOME_EDITORIAL_SHELF_PUBLISHED events with canonical metadata', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'Home Agent' })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })
    const orchestrator = new AchievementsOrchestrator({
      agentRepo,
      achievementRepo,
      chronicleRepo,
      chronicleService,
    })

    await orchestrator.processDomainEvent({
      id: 'evt-home-highlight-1',
      event_type: 'HOME_EDITORIAL_SHELF_PUBLISHED',
      plane: 'RUNTIME',
      schema_version: 'v1',
      community_id: 'community-1',
      post_id: 'post-highlight-1',
      room_id: null,
      actor_type: 'system',
      actor_id: 'home-programming-snapshot',
      cause_event_id: null,
      correlation_id: 'home-snapshot:2026-04-07',
      payload_json: {
        snapshot_date: '2026-04-07',
        generated_at: '2026-04-07T08:00:00.000Z',
        source_mode: 'editorial_baseline',
        shelf_id: 'must_watch_today',
        post_id: 'post-highlight-1',
        author_agent_id: agent.id,
        community_id: 'community-1',
        storyline_id: 'story-1',
        content_kind: 'highlight_hero',
        surface_kind: 'highlight_card',
        card_mode: 'cover',
        thumbnail_policy: 'required',
        hero_reason: '今日高光',
        next_jump_target: '/posts/post-highlight-1',
      },
      idempotency_key: 'home-shelf:2026-04-07:must_watch_today:post-highlight-1',
      created_at: new Date('2026-04-07T08:00:00.000Z'),
    })
    await orchestrator.processDomainEvent({
      id: 'evt-home-story-1',
      event_type: 'HOME_EDITORIAL_SHELF_PUBLISHED',
      plane: 'RUNTIME',
      schema_version: 'v1',
      community_id: 'community-1',
      post_id: 'post-story-1',
      room_id: null,
      actor_type: 'system',
      actor_id: 'home-programming-snapshot',
      cause_event_id: null,
      correlation_id: 'home-snapshot:2026-04-07',
      payload_json: {
        snapshot_date: '2026-04-07',
        generated_at: '2026-04-07T08:00:00.000Z',
        source_mode: 'editorial_baseline',
        shelf_id: 'continue_storyline',
        post_id: 'post-story-1',
        author_agent_id: agent.id,
        community_id: 'community-1',
        storyline_id: 'story-2',
        content_kind: 'aftershow_recap',
        surface_kind: 'aftershow_card',
        card_mode: 'compact',
        thumbnail_policy: 'optional',
        hero_reason: null,
        next_jump_target: '/posts/post-story-1',
      },
      idempotency_key: 'home-shelf:2026-04-07:continue_storyline:post-story-1',
      created_at: new Date('2026-04-07T08:05:00.000Z'),
    })

    const achievements = await achievementRepo.findByAgent(agent.id, { limit: 50 })
    const highlightTier1 = achievements.items.find((item) => item.code === 'highlight_headliner' && item.tier === 1)
    const storylineTier1 = achievements.items.find((item) => item.code === 'storyline_driver' && item.tier === 1)

    expect(highlightTier1).toBeTruthy()
    expect(highlightTier1?.award_context).toMatchObject({
      trigger_kind: 'home_editorial_shelf_published',
    })
    expect(highlightTier1?.signal_context).toMatchObject({
      source_event_id: 'evt-home-highlight-1',
      shelf_id: 'must_watch_today',
      content_kind: 'highlight_hero',
      storyline_id: 'story-1',
      dedup_key: 'highlight:post-highlight-1:must_watch_today',
    })
    expect(highlightTier1?.scope).toBe('global')
    expect(highlightTier1?.scope_key).toBe('__global__')
    expect(storylineTier1).toBeTruthy()
    expect(storylineTier1?.award_context).toMatchObject({
      trigger_kind: 'home_editorial_shelf_published',
    })
    expect(storylineTier1?.signal_context).toMatchObject({
      source_event_id: 'evt-home-story-1',
      shelf_id: 'continue_storyline',
      content_kind: 'aftershow_recap',
      storyline_id: 'story-2',
      dedup_key: 'storyline:post-story-1:continue_storyline',
    })
    expect(storylineTier1?.scope).toBe('global')
    expect(storylineTier1?.scope_key).toBe('__global__')
  })

  it('grants aftershow and proactive launch families through dedicated success hooks', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'Launch Agent' })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })
    const orchestrator = new AchievementsOrchestrator({
      agentRepo,
      achievementRepo,
      chronicleRepo,
      chronicleService,
    })

    await orchestrator.processAftershowPublished({
      agent_id: agent.id,
      community_id: 'community-1',
      post_id: 'post-aftershow-1',
      artifact_id: 'artifact-1',
      publish_shape: 'aftershow_block',
    })
    await orchestrator.processProactiveSessionSuccess({
      agent_id: agent.id,
      session_id: 'session-1',
      human_message_id: 'message-human-1',
      opening_message_id: 'message-agent-1',
    })

    const achievements = await achievementRepo.findByAgent(agent.id, { limit: 50 })
    expect(achievements.items.find((item) => item.code === 'aftershow_recapper' && item.tier === 1)).toBeTruthy()
    const proactiveTier1 = achievements.items.find((item) => item.code === 'proactive_confidant' && item.tier === 1)
    expect(proactiveTier1).toBeTruthy()
    expect(proactiveTier1?.visibility).toBe('OWNER_ONLY')
  })

  it('dual-writes signal logs and forces signal chronicle owner-only when signal log v1 is enabled', async () => {
    features.signalLogV1 = true

    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()
    const signalLogRepo = new InMemoryAgentSignalLogRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A6' })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    const orchestrator = new AchievementsOrchestrator({
      agentRepo,
      achievementRepo,
      chronicleRepo,
      signalLogRepo,
      chronicleService,
    })

    await orchestrator.processSignal({
      kind: 'forum_post',
      agent_id: agent.id,
      dedup_key: 'post:signal-log',
      evidence: [{ kind: 'post', ref_id: 'post:signal-log' }],
      metadata: { community_id: 'community-1' },
    })

    const signalMetrics = await signalLogRepo.getMetrics(agent.id, {
      signalKinds: ['forum_post'],
    })
    expect(signalMetrics.signal_counts.forum_post).toBe(1)

    const chronicle = await chronicleRepo.findByAgent(agent.id, {
      limit: 20,
      visibility: ['PUBLIC'],
    })
    expect(chronicle.items.every((item) => !item.tags.includes('signal:forum_post'))).toBe(true)
  })
})
