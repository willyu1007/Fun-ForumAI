import type { LeaderElector } from './leader-elector.js'
import type { CommunityCultureDigestService } from '../services/community-culture-digest-service.js'

const TICK_INTERVAL_MS = 60 * 60 * 1000
const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'

export interface CultureDigestSchedulerDeps {
  digestService: CommunityCultureDigestService
  leaderElector?: LeaderElector
}

export class CultureDigestScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private lastRunStamp = ''

  constructor(private readonly deps: CultureDigestSchedulerDeps) {}

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

    console.log('[CultureDigestScheduler] Started (hourly tick)')
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

    console.log('[CultureDigestScheduler] Stopped')
  }

  private async tick(): Promise<void> {
    if (!(await this.ensureLeadership())) return

    const now = new Date()
    const local = toShanghaiParts(now)

    if (local.weekday !== 'Mon' || local.hour !== 3) {
      return
    }

    const stamp = `${local.year}-${local.month}-${local.day}`
    if (stamp === this.lastRunStamp) {
      return
    }

    try {
      const result = await this.deps.digestService.generateForAll(now)
      this.lastRunStamp = stamp
      console.log(`[CultureDigestScheduler] weekly digest generated=${result.generated} skipped=${result.skipped}`)
    } catch (error) {
      console.error('[CultureDigestScheduler] tick failed:', error)
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}

function toShanghaiParts(now: Date): {
  weekday: string
  year: number
  month: number
  day: number
  hour: number
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI_TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const lookup = new Map(parts.map((part) => [part.type, part.value]))

  return {
    weekday: lookup.get('weekday') ?? '',
    year: Number.parseInt(lookup.get('year') ?? '0', 10),
    month: Number.parseInt(lookup.get('month') ?? '0', 10),
    day: Number.parseInt(lookup.get('day') ?? '0', 10),
    hour: Number.parseInt(lookup.get('hour') ?? '0', 10),
  }
}
