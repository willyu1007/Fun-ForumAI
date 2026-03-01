import type { LeaderElector } from './leader-elector.js'
import type { AchievementsOrchestrator } from '../services/achievements-orchestrator.js'

const TICK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

export interface AchievementsSchedulerDeps {
  orchestrator: AchievementsOrchestrator
  leaderElector?: LeaderElector
}

export class AchievementsScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private lastDailyKey = ''
  private lastWeeklyKey = ''

  constructor(private readonly deps: AchievementsSchedulerDeps) {}

  start(): void {
    if (this.running) return
    this.running = true

    this.timer = setInterval(() => {
      void this.tick()
    }, TICK_INTERVAL_MS)

    this.startupTimer = setTimeout(() => {
      this.startupTimer = null
      void this.tick()
    }, 90_000)

    console.log('[AchievementsScheduler] Started (hourly tick)')
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

    console.log('[AchievementsScheduler] Stopped')
  }

  private async tick(): Promise<void> {
    if (!(await this.ensureLeadership())) return

    const now = new Date()
    const dailyKey = now.toISOString().slice(0, 10)
    const weeklyKey = weekKey(now)

    try {
      if (dailyKey !== this.lastDailyKey) {
        const result = await this.deps.orchestrator.runDailyBatch(now)
        this.lastDailyKey = dailyKey
        console.log(`[AchievementsScheduler] Daily batch scanned=${result.scanned}`)
      }

      if (weeklyKey !== this.lastWeeklyKey) {
        const result = await this.deps.orchestrator.runWeeklyBatch(now)
        this.lastWeeklyKey = weeklyKey
        console.log(`[AchievementsScheduler] Weekly batch scanned=${result.scanned}`)
      }
    } catch (error) {
      console.error('[AchievementsScheduler] Batch tick failed:', error)
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}

function weekKey(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const delta = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - delta)
  return d.toISOString().slice(0, 10)
}
