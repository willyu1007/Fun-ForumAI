import type { LeaderElector } from './leader-elector.js'
import type { MediaInjectionWorker } from '../media/media-injection-worker.js'

export interface MediaImportJobWorkerDeps {
  service: Pick<MediaInjectionWorker, 'processNextReadyJob'>
  leaderElector?: LeaderElector
}

export interface MediaImportJobWorkerConfig {
  intervalMs?: number
  startupDelayMs?: number
}

const DEFAULT_INTERVAL_MS = 15_000
const DEFAULT_STARTUP_DELAY_MS = 5_000

export class MediaImportJobWorker {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ticking = false
  private readonly intervalMs: number
  private readonly startupDelayMs: number

  constructor(
    private readonly deps: MediaImportJobWorkerDeps,
    config: MediaImportJobWorkerConfig = {},
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
    console.log(`[MediaImportJobWorker] Started (scan every ${Math.round(this.intervalMs / 1000)}s)`)
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
    console.log('[MediaImportJobWorker] Stopped')
  }

  get isRunning(): boolean {
    return this.running
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      if (!(await this.ensureLeadership())) return
      const job = await this.deps.service.processNextReadyJob()
      if (job) {
        console.log(`[MediaImportJobWorker] processed job=${job.id} status=${job.status}`)
      }
    } catch (error) {
      console.error('[MediaImportJobWorker] tick failed:', error)
    } finally {
      this.ticking = false
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}
