import type { AgentRepository } from '../repos/agent-repository.js'
import type { GrowthEngine, XpSource } from './growth-engine.js'
import type { TraitEngine } from './trait-engine.js'

export interface NurtureOrchestratorDeps {
  agentRepo: AgentRepository
  growthEngine: GrowthEngine | null
  traitEngine: TraitEngine | null
}

export class NurtureOrchestrator {
  constructor(private readonly deps: NurtureOrchestratorDeps) {}

  async onContentProduced(agentId: string, source: XpSource, amount = 1): Promise<void> {
    if (!this.deps.growthEngine) return

    try {
      await this.deps.growthEngine.awardXP(agentId, source, amount)
      await this.evaluateTraits(agentId)
    } catch (err) {
      console.error('[NurtureOrchestrator] onContentProduced failed:', err)
    }
  }

  async onPrivateDigestCompleted(agentId: string, messageCount: number): Promise<void> {
    if (!this.deps.growthEngine) return

    try {
      await this.deps.growthEngine.awardPrivateChatXP(agentId, messageCount)
      await this.evaluateTraits(agentId)
    } catch (err) {
      console.error('[NurtureOrchestrator] onPrivateDigestCompleted failed:', err)
    }
  }

  async reconcileAgent(agentId: string): Promise<void> {
    if (!this.deps.growthEngine) return

    try {
      await this.evaluateTraits(agentId)
    } catch (err) {
      console.error('[NurtureOrchestrator] reconcileAgent failed:', err)
    }
  }

  async reconcileActiveAgents(limit = 1000): Promise<{ scanned: number; reconciled: number }> {
    const agents = this.deps.agentRepo.findActive({ limit })
    let reconciled = 0

    for (const agent of agents.items) {
      try {
        await this.reconcileAgent(agent.id)
        reconciled += 1
      } catch {
        // keep processing remaining agents
      }
    }

    return { scanned: agents.items.length, reconciled }
  }

  private async evaluateTraits(agentId: string): Promise<void> {
    if (!this.deps.traitEngine || !this.deps.growthEngine) return

    await this.deps.traitEngine.checkAndAssignSystemTraits(agentId)
    const growth = await this.deps.growthEngine.getGrowth(agentId)
    await this.deps.traitEngine.checkAndOfferCandidates(agentId, growth.level)
  }
}
