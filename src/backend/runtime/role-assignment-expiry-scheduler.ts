import type { LeaderElector } from './leader-elector.js'
import type { RoleAssignmentService } from '../services/role-assignment-service.js'

export interface RoleAssignmentExpirySchedulerDeps {
  service: Pick<RoleAssignmentService, 'processDueExpirations'>
  leaderElector?: LeaderElector
}

export interface RoleAssignmentExpirySchedulerConfig {
  intervalMs?: number
  startupDelayMs?: number
  batchLimit?: number
}

const DEFAULT_INTERVAL_MS = 30_000
const DEFAULT_STARTUP_DELAY_MS = 5_000
const DEFAULT_BATCH_LIMIT = 100

export class RoleAssignmentExpiryScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ticking = false

  private readonly intervalMs: number
  private readonly startupDelayMs: number
  private readonly batchLimit: number

  constructor(
    private readonly deps: RoleAssignmentExpirySchedulerDeps,
    cfg: RoleAssignmentExpirySchedulerConfig = {},
  ) {
    this.intervalMs = cfg.intervalMs ?? DEFAULT_INTERVAL_MS
    this.startupDelayMs = cfg.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS
    this.batchLimit = cfg.batchLimit ?? DEFAULT_BATCH_LIMIT
  }

  start(): void {
    if (this.running) return
    this.running = true

    this.timer = setInterval(() => {
      void this.tick()
    }, this.intervalMs)

    this.startupTimer = setTimeout(() => {
      this.startupTimer = null
      void this.tick()
    }, this.startupDelayMs)

    console.log(`[RoleAssignmentExpiryScheduler] Started (scan every ${Math.round(this.intervalMs / 1000)}s)`)
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

    console.log('[RoleAssignmentExpiryScheduler] Stopped')
  }

  get isRunning(): boolean {
    return this.running
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      if (!(await this.ensureLeadership())) return
      const result = await this.deps.service.processDueExpirations({
        now: new Date(),
        limit: this.batchLimit,
      })
      if (result.processed > 0) {
        console.log(`[RoleAssignmentExpiryScheduler] processed=${result.processed}`)
      }
    } catch (err) {
      console.error('[RoleAssignmentExpiryScheduler] tick failed:', err)
    } finally {
      this.ticking = false
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}
