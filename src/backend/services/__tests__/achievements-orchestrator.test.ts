import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryAchievementRepository } from '../../repos/achievement-repository.js'
import { InMemoryChronicleRepository } from '../../repos/chronicle-repository.js'
import { InMemoryAgentSignalLogRepository } from '../../repos/agent-signal-log-repository.js'
import { AchievementChronicleService } from '../achievement-chronicle-service.js'
import { AchievementsOrchestrator } from '../achievements-orchestrator.js'
import { config } from '../../lib/config.js'

describe('AchievementsOrchestrator', () => {
  const features = config.features as unknown as Record<string, boolean>
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
