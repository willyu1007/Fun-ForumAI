import type { UsageLedgerEntry } from './gateway-contract.js'

export interface UsageLedgerRepository {
  insert(entry: UsageLedgerEntry): Promise<void>
  listRecent(limit?: number): Promise<UsageLedgerEntry[]>
  listByAgent(agentId: string, limit?: number): Promise<UsageLedgerEntry[]>
  sumCostByAgent(agentId: string, since: Date): Promise<number>
  sumCostByBillingClass(billingClass: string, since: Date): Promise<number>
}

export class UsageLedgerWriter {
  private readonly buffer: UsageLedgerEntry[] = []
  private repo: UsageLedgerRepository | null = null

  setRepository(repo: UsageLedgerRepository): void {
    this.repo = repo
  }

  write(entry: UsageLedgerEntry): void {
    this.buffer.push(entry)
    if (this.repo) {
      this.repo.insert(entry).catch((err) => {
        console.error('[LlmUsageLedger] persist failed:', err)
      })
    }
    console.info('[LlmUsageLedger]', JSON.stringify(entry))
  }

  list(): UsageLedgerEntry[] {
    return [...this.buffer]
  }

  clear(): void {
    this.buffer.length = 0
  }
}

export class InMemoryUsageLedgerRepository implements UsageLedgerRepository {
  private readonly entries: UsageLedgerEntry[] = []

  async insert(entry: UsageLedgerEntry): Promise<void> {
    this.entries.push(entry)
  }

  async listRecent(limit = 100): Promise<UsageLedgerEntry[]> {
    return [...this.entries]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
  }

  async listByAgent(agentId: string, limit = 100): Promise<UsageLedgerEntry[]> {
    return this.entries
      .filter((e) => e.agent_id === agentId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
  }

  async sumCostByAgent(agentId: string, since: Date): Promise<number> {
    const sinceStr = since.toISOString()
    return this.entries
      .filter((e) => e.agent_id === agentId && e.created_at >= sinceStr && e.success)
      .reduce((sum, e) => sum + (e.actual_cost_cny ?? 0), 0)
  }

  async sumCostByBillingClass(billingClass: string, since: Date): Promise<number> {
    const sinceStr = since.toISOString()
    return this.entries
      .filter((e) => e.billing_class === billingClass && e.created_at >= sinceStr && e.success)
      .reduce((sum, e) => sum + (e.actual_cost_cny ?? 0), 0)
  }
}
