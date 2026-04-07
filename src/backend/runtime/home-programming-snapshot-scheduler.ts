import type { LeaderElector } from './leader-elector.js'
import type { HomeProgrammingSnapshotService } from '../services/home-programming-snapshot-service.js'

export interface HomeProgrammingSnapshotSchedulerDeps {
  service: Pick<HomeProgrammingSnapshotService, 'captureSnapshot'>
  leaderElector?: LeaderElector
}

export interface HomeProgrammingSnapshotSchedulerConfig {
  intervalMs?: number
  startupDelayMs?: number
}

const DEFAULT_INTERVAL_MS = 15 * 60_000
const DEFAULT_STARTUP_DELAY_MS = 60_000

export class HomeProgrammingSnapshotScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ticking = false
  private readonly intervalMs: number
  private readonly startupDelayMs: number

  constructor(
    private readonly deps: HomeProgrammingSnapshotSchedulerDeps,
    config: HomeProgrammingSnapshotSchedulerConfig = {},
  ) {
    this.intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS
    this.startupDelayMs = config.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS
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

    console.log(
      `[HomeProgrammingSnapshotScheduler] Started (scan every ${Math.round(this.intervalMs / 1000)}s)`,
    )
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

    console.log('[HomeProgrammingSnapshotScheduler] Stopped')
  }

  get isRunning(): boolean {
    return this.running
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      if (!(await this.ensureLeadership())) return

      const result = await this.deps.service.captureSnapshot({ now: new Date() })
      if (result.created_count > 0 || result.deduped_count > 0) {
        console.log(
          `[HomeProgrammingSnapshotScheduler] snapshot_date=${result.snapshot_date} scanned=${result.scanned_count} created=${result.created_count} deduped=${result.deduped_count}`,
        )
      }
    } catch (error) {
      console.error('[HomeProgrammingSnapshotScheduler] tick failed:', error)
    } finally {
      this.ticking = false
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}
