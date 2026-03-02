import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryAchievementRepository } from '../../repos/achievement-repository.js'
import { InMemoryChronicleRepository } from '../../repos/chronicle-repository.js'
import { AchievementChronicleService } from '../achievement-chronicle-service.js'
import { config } from '../../lib/config.js'

describe('AchievementChronicleService', () => {
  const features = config.features as unknown as Record<string, boolean>
  const originalChronicle = features.achievementChronicleV1
  const originalPublic = features.achievementPublicHighlights
  const originalSignalPolicy = features.chronicleSignalPolicyV2

  beforeEach(() => {
    features.achievementChronicleV1 = true
    features.achievementPublicHighlights = true
    features.chronicleSignalPolicyV2 = true
  })

  afterEach(() => {
    features.achievementChronicleV1 = originalChronicle
    features.achievementPublicHighlights = originalPublic
    features.chronicleSignalPolicyV2 = originalSignalPolicy
  })

  it('applies public density and returns badges/tagline', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A1' })
    const service = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    await achievementRepo.grant({
      agent_id: agent.id,
      code: 'forum_post_crafter',
      name: 'Forum Post Crafter T1',
      category: 'forum',
      tier: 1,
      visibility: 'PUBLIC',
      evidence: [{ kind: 'post', ref_id: 'p1' }],
    })

    for (let i = 0; i < 5; i += 1) {
      await service.recordChronicle({
        agent_id: agent.id,
        visibility: 'PUBLIC',
        type: 'HIGHLIGHT',
        title: `Title ${i}`,
        summary: `Summary ${i}`,
        importance_score: 0.2 + i / 10,
        evidence: [{ kind: 'chronicle', ref_id: `c-${i}` }],
        occurred_at: new Date('2026-03-01T08:00:00.000Z'),
      })
    }

    const highlights = await service.getPublicHighlights(agent.id)
    expect(highlights.badges.length).toBe(1)
    expect(highlights.top_chronicle.length).toBeLessThanOrEqual(3)
    expect(typeof highlights.tagline === 'string' || highlights.tagline === null).toBe(true)
  })

  it('returns empty owner data when chronicle flag is disabled', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A2' })
    const service = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    features.achievementChronicleV1 = false
    const achievements = await service.listAchievementsForOwner(agent.id, {})
    const chronicle = await service.listChronicleForOwner(agent.id, {})

    expect(achievements.items).toEqual([])
    expect(chronicle.items).toEqual([])
    expect(chronicle.folded_count).toBe(0)
  })

  it('reports folded_count against full dataset instead of current page window', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A3' })
    const service = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    for (let i = 0; i < 20; i += 1) {
      await service.recordChronicle({
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

    const result = await service.listChronicleForOwner(agent.id, { limit: 2 })
    expect(result.items.length).toBeLessThanOrEqual(2)
    expect(result.folded_count).toBe(10)
  })

  it('compresses repeated signal entries in public highlights', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A4' })
    const service = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    for (let i = 0; i < 2; i += 1) {
      await service.recordChronicle({
        agent_id: agent.id,
        visibility: 'PUBLIC',
        type: 'HIGHLIGHT',
        title: `Signal ${i}`,
        summary: `Signal summary ${i}`,
        importance_score: 0.85,
        evidence: [{ kind: 'chronicle', ref_id: `signal-${i}` }],
        tags: ['signal:forum_comment'],
        occurred_at: new Date('2026-03-01T08:00:00.000Z'),
      })
    }

    const highlights = await service.getPublicHighlights(agent.id)
    expect(highlights.top_chronicle.length).toBeGreaterThan(0)
    expect(highlights.top_chronicle[0].summary).toContain('已压缩')
  })
})
