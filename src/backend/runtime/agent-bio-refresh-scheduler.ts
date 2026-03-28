import type { LeaderElector } from './leader-elector.js'
import type { AgentBioRefreshService } from '../services/agent-bio-refresh-service.js'

export interface AgentBioRefreshSchedulerDeps {
  service: Pick<AgentBioRefreshService, 'processMajorRefreshSweep'>
  leaderElector?: LeaderElector
}

export interface AgentBioRefreshSchedulerConfig {
  intervalMs?: number
  startupDelayMs?: number
  limit?: number
}

const DEFAULT_INTERVAL_MS = 60 * 60_000
const DEFAULT_STARTUP_DELAY_MS = 30_000
const DEFAULT_LIMIT = 50

export class AgentBioRefreshScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ticking = false

  private readonly intervalMs: number
  private readonly startupDelayMs: number
  private readonly limit: number

  constructor(
    private readonly deps: AgentBioRefreshSchedulerDeps,
    cfg: AgentBioRefreshSchedulerConfig = {},
  ) {
    this.intervalMs = cfg.intervalMs ?? DEFAULT_INTERVAL_MS
    this.startupDelayMs = cfg.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS
    this.limit = cfg.limit ?? DEFAULT_LIMIT
  }

  get isRunning(): boolean {
    return this.running
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
    console.log('[AgentBioRefreshScheduler] Started (hourly major-refresh sweep)')
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
    console.log('[AgentBioRefreshScheduler] Stopped')
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      if (!(await this.ensureLeadership())) return
      const result = await this.deps.service.processMajorRefreshSweep({
        now: new Date(),
        limit: this.limit,
      })
      if (result.refreshed > 0) {
        console.log(
          `[AgentBioRefreshScheduler] scanned=${result.scanned} refreshed=${result.refreshed} skipped=${result.skipped}`,
        )
      }
    } catch (error) {
      console.error('[AgentBioRefreshScheduler] tick failed:', error)
    } finally {
      this.ticking = false
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}
