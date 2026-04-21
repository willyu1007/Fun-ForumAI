import type { LeaderElector } from './leader-elector.js'
import type { AgentBiographyService } from '../services/agent-biography-service.js'

export interface AgentBiographyCompileSchedulerDeps {
  service: Pick<AgentBiographyService, 'processDirtySweep'>
  leaderElector?: LeaderElector
}

export interface AgentBiographyCompileSchedulerConfig {
  intervalMs?: number
  startupDelayMs?: number
  limit?: number
}

const DEFAULT_INTERVAL_MS = 60 * 60_000
const DEFAULT_STARTUP_DELAY_MS = 45_000
const DEFAULT_LIMIT = 50

export class AgentBiographyCompileScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ticking = false

  private readonly intervalMs: number
  private readonly startupDelayMs: number
  private readonly limit: number

  constructor(
    private readonly deps: AgentBiographyCompileSchedulerDeps,
    cfg: AgentBiographyCompileSchedulerConfig = {},
  ) {
    this.intervalMs = cfg.intervalMs ?? DEFAULT_INTERVAL_MS
    this.startupDelayMs = cfg.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS
    this.limit = cfg.limit ?? DEFAULT_LIMIT
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
    console.log('[AgentBiographyCompileScheduler] Started (hourly dirty sweep)')
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
    console.log('[AgentBiographyCompileScheduler] Stopped')
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      if (!(await this.ensureLeadership())) return
      const result = await this.deps.service.processDirtySweep({
        now: new Date(),
        limit: this.limit,
      })
      if (result.refreshed > 0) {
        console.log(
          `[AgentBiographyCompileScheduler] scanned=${result.scanned} refreshed=${result.refreshed} skipped=${result.skipped}`,
        )
      }
    } catch (error) {
      console.error('[AgentBiographyCompileScheduler] tick failed:', error)
    } finally {
      this.ticking = false
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}
