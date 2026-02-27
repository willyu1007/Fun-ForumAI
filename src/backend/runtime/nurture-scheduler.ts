import type { LeaderElector } from './leader-elector.js'
import type { NurtureOrchestrator } from '../services/nurture-orchestrator.js'

const NURTURE_RECONCILE_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

export interface NurtureSchedulerDeps {
  orchestrator: NurtureOrchestrator
  leaderElector?: LeaderElector
}

export class NurtureScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(private readonly deps: NurtureSchedulerDeps) {}

  start(): void {
    if (this.running) return
    this.running = true

    this.timer = setInterval(
      () => void this.reconcile(),
      NURTURE_RECONCILE_INTERVAL_MS,
    )

    setTimeout(() => void this.reconcile(), 60_000)

    console.log('[NurtureScheduler] Started (reconcile every 6h)')
  }

  stop(): void {
    if (!this.running) return
    this.running = false

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    if (this.deps.leaderElector) {
      void this.deps.leaderElector.releaseLeadership()
    }

    console.log('[NurtureScheduler] Stopped')
  }

  private async reconcile(): Promise<void> {
    if (!(await this.ensureLeadership())) return

    try {
      const result = await this.deps.orchestrator.reconcileActiveAgents(1000)
      if (result.scanned > 0) {
        console.log(`[NurtureScheduler] Reconciled ${result.reconciled}/${result.scanned} active agents`)
      }
    } catch (err) {
      console.error('[NurtureScheduler] Reconcile failed:', err)
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}
