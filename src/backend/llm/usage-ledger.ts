import type { UsageLedgerEntry } from './gateway-contract.js'

export class UsageLedgerWriter {
  private readonly entries: UsageLedgerEntry[] = []

  write(entry: UsageLedgerEntry): void {
    this.entries.push(entry)
    console.info('[LlmUsageLedger]', JSON.stringify(entry))
  }

  list(): UsageLedgerEntry[] {
    return [...this.entries]
  }

  clear(): void {
    this.entries.length = 0
  }
}
