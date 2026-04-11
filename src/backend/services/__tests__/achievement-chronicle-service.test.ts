import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryAchievementRepository } from '../../repos/achievement-repository.js'
import { InMemoryChronicleRepository } from '../../repos/chronicle-repository.js'
import { AchievementChronicleService } from '../achievement-chronicle-service.js'
import { config } from '../../lib/config.js'

describe('AchievementChronicleService', () => {
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

  it('applies public density and returns semantic author presentation', async () => {
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
      scope: 'global',
      scope_key: '__global__',
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

    const presentation = await service.getPublicAuthorPresentation(agent.id)
    expect(presentation.public_proof?.achievement_badges).toHaveLength(1)
    expect(presentation.top_chronicle.length).toBeLessThanOrEqual(3)
    expect(typeof presentation.public_projection?.tagline === 'string' || presentation.public_projection?.tagline == null).toBe(true)
  })

  it('deduplicates public badges by family code across different scopes', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A1-dedup' })
    const service = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    await achievementRepo.grant({
      agent_id: agent.id,
      code: 'forum_turn_crafter',
      name: 'Forum Turn Crafter T3',
      category: 'forum',
      tier: 3,
      scope: 'global',
      scope_key: '__global__',
      visibility: 'PUBLIC',
      evidence: [{ kind: 'turn', ref_id: 't-global' }],
    })
    await achievementRepo.grant({
      agent_id: agent.id,
      code: 'forum_turn_crafter',
      name: 'Forum Turn Crafter T3',
      category: 'forum',
      tier: 3,
      scope: 'community',
      scope_key: 'community-1',
      visibility: 'PUBLIC',
      evidence: [{ kind: 'turn', ref_id: 't-community' }],
    })
    await achievementRepo.grant({
      agent_id: agent.id,
      code: 'forum_post_crafter',
      name: 'Forum Post Crafter T3',
      category: 'forum',
      tier: 3,
      scope: 'global',
      scope_key: '__global__',
      visibility: 'PUBLIC',
      evidence: [{ kind: 'post', ref_id: 'p-1' }],
    })

    const presentation = await service.getPublicAuthorPresentation(agent.id)
    expect(presentation.public_proof?.achievement_badges).toHaveLength(2)
    const badgeKeys = (presentation.public_proof?.achievement_badges ?? []).map((item) => `${item.code}:${item.level}`)
    expect(new Set(badgeKeys).size).toBe(2)
  })

  it('prioritizes launch headliner families over ordinary forum activity badges', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A1-priority' })
    const service = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    await achievementRepo.grant({
      agent_id: agent.id,
      code: 'forum_post_crafter',
      name: '开场点火-三阶',
      category: 'story_arc',
      tier: 3,
      scope: 'community',
      scope_key: 'community-1',
      visibility: 'PUBLIC',
      evidence: [{ kind: 'post', ref_id: 'post-1' }],
      achieved_at: new Date('2026-03-05T08:00:00.000Z'),
    })
    await achievementRepo.grant({
      agent_id: agent.id,
      code: 'highlight_headliner',
      name: '今日必看-一阶',
      category: 'highlight_arc',
      tier: 1,
      scope: 'global',
      scope_key: '__global__',
      visibility: 'PUBLIC',
      evidence: [
        { kind: 'highlight_projection', ref_id: 'must_watch_today:post-2' },
        { kind: 'post', ref_id: 'post-2' },
      ],
      achieved_at: new Date('2026-03-01T08:00:00.000Z'),
    })

    const presentation = await service.getPublicAuthorPresentation(agent.id)
    expect(presentation.public_proof?.achievement_badges[0]?.code).toBe('highlight_headliner')
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
        tags: ['signal:forum_turn'],
        occurred_at: new Date('2026-03-01T08:00:00.000Z'),
      })
    }

    const presentation = await service.getPublicAuthorPresentation(agent.id)
    expect(presentation.top_chronicle.length).toBeGreaterThan(0)
    expect(presentation.top_chronicle[0].summary).toContain('已压缩')
  })

  it('excludes signal entries from public highlights when signal log v1 is enabled', async () => {
    features.signalLogV1 = true

    const agentRepo = new InMemoryAgentRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()

    const agent = agentRepo.create({ owner_id: 'u1', display_name: 'A5' })
    const service = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })

    await service.recordChronicle({
      agent_id: agent.id,
      visibility: 'PUBLIC',
      type: 'HIGHLIGHT',
      title: 'Signal only',
      summary: 'Signal summary',
      importance_score: 0.9,
      evidence: [{ kind: 'chronicle', ref_id: 'sig-1' }],
      tags: ['signal:forum_post'],
      occurred_at: new Date('2026-03-01T08:00:00.000Z'),
    })

    const presentation = await service.getPublicAuthorPresentation(agent.id)
    expect(presentation.top_chronicle).toEqual([])
  })
})
