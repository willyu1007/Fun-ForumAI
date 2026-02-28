import type { AgentRepository } from '../repos/agent-repository.js'
import type { GrowthEngine, XpSource } from './growth-engine.js'
import type { TraitEngine } from './trait-engine.js'

export const DEFAULT_NURTURE_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000

export interface NurtureTriggerOptions {
  dedup_key?: string
  dedup_window_ms?: number
}

export interface NurtureOrchestratorDeps {
  agentRepo: AgentRepository
  growthEngine: GrowthEngine | null
  traitEngine: TraitEngine | null
}

export class NurtureOrchestrator {
  constructor(private readonly deps: NurtureOrchestratorDeps) {}

  async onContentProduced(
    agentId: string,
    source: XpSource,
    amount = 1,
    opts: NurtureTriggerOptions = {},
  ): Promise<void> {
    if (!this.deps.growthEngine) return

    try {
      if (await this.shouldSkipByDedup(agentId, opts)) return

      await this.deps.growthEngine.awardXP(agentId, source, amount, {
        dedup_key: this.normalizeDedupKey(opts.dedup_key),
      })
      await this.evaluateTraits(agentId)
    } catch (err) {
      console.error('[NurtureOrchestrator] onContentProduced failed:', err)
    }
  }

  async onPrivateDigestCompleted(
    agentId: string,
    messageCount: number,
    opts: NurtureTriggerOptions = {},
  ): Promise<void> {
    if (!this.deps.growthEngine) return

    try {
      if (await this.shouldSkipByDedup(agentId, opts)) return

      await this.deps.growthEngine.awardPrivateChatXP(agentId, messageCount, {
        dedup_key: this.normalizeDedupKey(opts.dedup_key),
      })
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
    let reconciled = 0
    let scanned = 0
    let cursor: string | undefined

    while (scanned < limit) {
      const pageSize = Math.min(limit - scanned, 200)
      const page = this.deps.agentRepo.findActive({ limit: pageSize, cursor })

      for (const agent of page.items) {
        scanned++
        try {
          await this.reconcileAgent(agent.id)
          reconciled++
        } catch {
          // keep processing remaining agents
        }
      }

      if (!page.next_cursor || page.items.length === 0) break
      cursor = page.next_cursor
    }

    return { scanned, reconciled }
  }

  private async evaluateTraits(agentId: string): Promise<void> {
    if (!this.deps.traitEngine || !this.deps.growthEngine) return

    await this.deps.traitEngine.checkAndAssignSystemTraits(agentId)
    const growth = await this.deps.growthEngine.getGrowth(agentId)
    await this.deps.traitEngine.checkAndOfferCandidates(agentId, growth.level)
  }

  private async shouldSkipByDedup(agentId: string, opts: NurtureTriggerOptions): Promise<boolean> {
    const dedupKey = this.normalizeDedupKey(opts.dedup_key)
    if (!dedupKey) return false

    const windowMs = this.resolveWindowMs(opts.dedup_window_ms)
    let hasRecent = false
    try {
      hasRecent = Boolean(await this.deps.growthEngine?.hasRecentXpDedupKey(agentId, dedupKey, windowMs))
    } catch (err) {
      console.warn('[NurtureOrchestrator] dedup check failed, fallback to non-dedup path:', err)
      return false
    }
    if (!hasRecent) return false

    console.debug(`[NurtureOrchestrator] dedup hit: skip nurture update for agent=${agentId}, key=${dedupKey}`)
    return true
  }

  private normalizeDedupKey(raw?: string): string | undefined {
    const normalized = raw?.trim()
    return normalized ? normalized : undefined
  }

  private resolveWindowMs(windowMs?: number): number {
    if (typeof windowMs !== 'number' || Number.isNaN(windowMs) || windowMs <= 0) {
      return DEFAULT_NURTURE_DEDUP_WINDOW_MS
    }
    return windowMs
  }
}
