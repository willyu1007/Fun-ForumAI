import type {
  AchievementRepository,
  ChronicleRepository,
  AgentStageTierSnapshot,
  AgentStageTier,
} from '../repos/index.js'
import type { AgentStageTierSnapshotRepository } from '../repos/agent-stage-tier-snapshot-repository.js'
import { computeAgentStageTier } from '../stage/agent-stage-tier.js'
import { STAGE_TIER_ORDER } from '../stage/stage-spec.js'

const PAGE_SIZE = 200
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export interface AgentStageTierServiceDeps {
  achievementRepo: AchievementRepository
  chronicleRepo: ChronicleRepository
  snapshotRepo: AgentStageTierSnapshotRepository
}

export class AgentStageTierService {
  constructor(private readonly deps: AgentStageTierServiceDeps) {}

  async recompute(agentId: string): Promise<AgentStageTierSnapshot> {
    const achievements = await this.fetchAllAchievements(agentId)
    const chronicle = await this.fetchChronicle30d(agentId)
    const computed = computeAgentStageTier({
      achievements,
      chronicleLast30d: chronicle,
    })

    return this.deps.snapshotRepo.upsert({
      agent_id: agentId,
      tier: computed.tier,
      score: computed.score,
      achievement_points: computed.achievement_points,
      chronicle_points: computed.chronicle_points,
      trust_penalty: computed.trust_penalty,
      reasoning: computed.reasoning,
      computed_at: new Date(),
    })
  }

  async getSnapshot(agentId: string, opts?: { recomputeIfMissing?: boolean }): Promise<AgentStageTierSnapshot> {
    const existing = this.deps.snapshotRepo.findLatestByAgent(agentId)
    if (existing) return existing

    if (opts?.recomputeIfMissing === false) {
      return {
        id: `tier-default:${agentId}`,
        agent_id: agentId,
        tier: 'T1',
        score: 0,
        achievement_points: 0,
        chronicle_points: 0,
        trust_penalty: 0,
        reasoning: {
          fallback: 'missing_snapshot',
        },
        computed_at: new Date(0),
        updated_at: new Date(0),
      }
    }

    return this.recompute(agentId)
  }

  getLatestSnapshot(agentId: string): AgentStageTierSnapshot | null {
    return this.deps.snapshotRepo.findLatestByAgent(agentId)
  }

  getLatestSnapshotMap(agentIds: string[]): Map<string, AgentStageTierSnapshot> {
    return this.deps.snapshotRepo.findLatestByAgents(agentIds)
  }

  tierMeets(actualTier: AgentStageTier, minTier: AgentStageTier): boolean {
    return STAGE_TIER_ORDER[actualTier] >= STAGE_TIER_ORDER[minTier]
  }

  private async fetchAllAchievements(agentId: string) {
    const all: Awaited<ReturnType<AchievementRepository['findByAgent']>>['items'] = []
    let cursor: string | undefined

    while (true) {
      const page = await this.deps.achievementRepo.findByAgent(agentId, {
        cursor,
        limit: PAGE_SIZE,
      })
      all.push(...page.items)
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return all
  }

  private async fetchChronicle30d(agentId: string) {
    const since = new Date(Date.now() - THIRTY_DAYS_MS)
    const all: Awaited<ReturnType<ChronicleRepository['findByAgent']>>['items'] = []
    let cursor: string | undefined

    while (true) {
      const page = await this.deps.chronicleRepo.findByAgent(agentId, {
        cursor,
        limit: PAGE_SIZE,
        from: since,
      })
      all.push(...page.items)
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return all
  }
}
