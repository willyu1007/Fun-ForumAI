import type { LeaderElector } from './leader-elector.js'
import type { CommunityConfigService } from '../services/community-config-service.js'

export interface CommunityConfigSchedulerDeps {
  service: Pick<CommunityConfigService, 'processDueScheduled'>
  leaderElector?: LeaderElector
}

export interface CommunityConfigSchedulerConfig {
  intervalMs?: number
  startupDelayMs?: number
  batchLimit?: number
  maxRetries?: number
  backoffBaseMs?: number
  backoffMaxMs?: number
}

const DEFAULT_INTERVAL_MS = 30_000
const DEFAULT_STARTUP_DELAY_MS = 5_000
const DEFAULT_BATCH_LIMIT = 20
const DEFAULT_MAX_RETRIES = 5
const DEFAULT_BACKOFF_BASE_MS = 30_000
const DEFAULT_BACKOFF_MAX_MS = 15 * 60_000

export class CommunityConfigScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ticking = false

  private readonly intervalMs: number
  private readonly startupDelayMs: number
  private readonly batchLimit: number
  private readonly maxRetries: number
  private readonly backoffBaseMs: number
  private readonly backoffMaxMs: number

  constructor(
    private readonly deps: CommunityConfigSchedulerDeps,
    cfg: CommunityConfigSchedulerConfig = {},
  ) {
    this.intervalMs = cfg.intervalMs ?? DEFAULT_INTERVAL_MS
    this.startupDelayMs = cfg.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS
    this.batchLimit = cfg.batchLimit ?? DEFAULT_BATCH_LIMIT
    this.maxRetries = cfg.maxRetries ?? DEFAULT_MAX_RETRIES
    this.backoffBaseMs = cfg.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS
    this.backoffMaxMs = cfg.backoffMaxMs ?? DEFAULT_BACKOFF_MAX_MS
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

    console.log(`[CommunityConfigScheduler] Started (scan every ${Math.round(this.intervalMs / 1000)}s)`)
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

    console.log('[CommunityConfigScheduler] Stopped')
  }

  get isRunning(): boolean {
    return this.running
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      if (!(await this.ensureLeadership())) return
      const result = await this.deps.service.processDueScheduled({
        limit: this.batchLimit,
        max_retries: this.maxRetries,
        backoff_base_ms: this.backoffBaseMs,
        backoff_max_ms: this.backoffMaxMs,
      })
      if (result.processed > 0 || result.failed > 0) {
        console.log(
          `[CommunityConfigScheduler] processed=${result.processed} failed=${result.failed} exhausted=${result.exhausted}`,
        )
      }
    } catch (err) {
      console.error('[CommunityConfigScheduler] tick failed:', err)
    } finally {
      this.ticking = false
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}
