import type { CredentialPoolEntry } from './gateway-contract.js'

interface PoolAdmissionLease {
  release(): void
}

export class PoolAdmissionController {
  private readonly activeCounts = new Map<string, number>()

  tryAcquire(pool: CredentialPoolEntry): PoolAdmissionLease | null {
    const limit = pool.max_concurrency
    if (!Number.isFinite(limit) || limit === undefined) {
      return { release() {} }
    }

    const current = this.activeCounts.get(pool.credential_id) ?? 0
    if (current >= limit) {
      return null
    }

    this.activeCounts.set(pool.credential_id, current + 1)
    let released = false

    return {
      release: () => {
        if (released) return
        released = true
        const next = (this.activeCounts.get(pool.credential_id) ?? 1) - 1
        if (next <= 0) {
          this.activeCounts.delete(pool.credential_id)
          return
        }
        this.activeCounts.set(pool.credential_id, next)
      },
    }
  }

  getActiveCount(credentialId: string): number {
    return this.activeCounts.get(credentialId) ?? 0
  }
}
