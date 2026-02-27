import type { LeaderElector } from './leader-elector.js'
import type { RelationService } from '../services/relation-service.js'

const RELATION_RECONCILE_INTERVAL_MS = 60 * 60 * 1000

export interface RelationSchedulerDeps {
  relationService: RelationService
  leaderElector?: LeaderElector
}

export class RelationScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false

  constructor(private readonly deps: RelationSchedulerDeps) {}

  start(): void {
    if (this.running) return
    this.running = true

    this.timer = setInterval(() => {
      void this.reconcile()
    }, RELATION_RECONCILE_INTERVAL_MS)

    this.startupTimer = setTimeout(() => {
      this.startupTimer = null
      void this.reconcile()
    }, 60_000)

    console.log('[RelationScheduler] Started (reconcile every 1h)')
  }

  stop(): void {
    if (!this.running) return
    this.running = false

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    if (this.startupTimer) {
      clearTimeout(this.startupTimer)
      this.startupTimer = null
    }

    if (this.deps.leaderElector) {
      void this.deps.leaderElector.releaseLeadership()
    }

    console.log('[RelationScheduler] Stopped')
  }

  private async reconcile(): Promise<void> {
    if (!(await this.ensureLeadership())) return

    try {
      const result = await this.deps.relationService.reconcile(1000)
      if (result.scanned > 0) {
        console.log(`[RelationScheduler] Reconciled ${result.updated}/${result.scanned} relations`)
      }
    } catch (err) {
      console.error('[RelationScheduler] Reconcile failed:', err)
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}
