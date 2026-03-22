import type { LeaderElector } from './leader-elector.js'
import type { MediaLifecycleService } from '../media/media-lifecycle-service.js'

export interface MediaLifecycleWorkerDeps {
  service: Pick<MediaLifecycleService, 'runSweep'>
  leaderElector?: LeaderElector
}

export interface MediaLifecycleWorkerConfig {
  intervalMs?: number
  startupDelayMs?: number
}

const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_STARTUP_DELAY_MS = 5_000

export class MediaLifecycleWorker {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ticking = false
  private readonly intervalMs: number
  private readonly startupDelayMs: number

  constructor(
    private readonly deps: MediaLifecycleWorkerDeps,
    cfg: MediaLifecycleWorkerConfig = {},
  ) {
    this.intervalMs = cfg.intervalMs ?? DEFAULT_INTERVAL_MS
    this.startupDelayMs = cfg.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS
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
    console.log(`[MediaLifecycleWorker] Started (scan every ${Math.round(this.intervalMs / 1000)}s)`)
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
    console.log('[MediaLifecycleWorker] Stopped')
  }

  get isRunning(): boolean {
    return this.running
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      if (!(await this.ensureLeadership())) return
      const result = await this.deps.service.runSweep()
      console.log(
        `[MediaLifecycleWorker] archived=${result.archived_assets} deleted_projections=${result.deleted_projections} snapshot_backfill=${result.snapshot_backfill_attempted}`,
      )
    } catch (err) {
      console.error('[MediaLifecycleWorker] tick failed:', err)
    } finally {
      this.ticking = false
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}
