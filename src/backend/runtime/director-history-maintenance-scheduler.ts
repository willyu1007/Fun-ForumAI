import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import type { LeaderElector } from './leader-elector.js'

export interface DirectorHistoryMaintenanceSchedulerDeps {
  leaderElector?: LeaderElector
}

export interface DirectorHistoryMaintenanceSchedulerConfig {
  intervalMs?: number
  startupDelayMs?: number
  retentionDays?: number
  batchLimit?: number
  launchPath?: string
}

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000
const DEFAULT_STARTUP_DELAY_MS = 60_000
const DEFAULT_RETENTION_DAYS = 90
const DEFAULT_BATCH_LIMIT = 500

export class DirectorHistoryMaintenanceScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ticking = false

  private readonly intervalMs: number
  private readonly startupDelayMs: number
  private readonly retentionDays: number
  private readonly batchLimit: number
  private readonly launchPath: string

  constructor(
    private readonly deps: DirectorHistoryMaintenanceSchedulerDeps,
    cfg: DirectorHistoryMaintenanceSchedulerConfig = {},
  ) {
    this.intervalMs = cfg.intervalMs ?? DEFAULT_INTERVAL_MS
    this.startupDelayMs = cfg.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS
    this.retentionDays = cfg.retentionDays ?? DEFAULT_RETENTION_DAYS
    this.batchLimit = cfg.batchLimit ?? DEFAULT_BATCH_LIMIT
    this.launchPath = cfg.launchPath ?? resolve(process.cwd(), 'docs/stage-templates/dist/launch.json')
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

    console.log(`[DirectorHistoryMaintenanceScheduler] Started (run every ${Math.round(this.intervalMs / 1000)}s)`)
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

    console.log('[DirectorHistoryMaintenanceScheduler] Stopped')
  }

  get isRunning(): boolean {
    return this.running
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      if (!(await this.ensureLeadership())) return

      const scriptPath = resolve(process.cwd(), 'scripts/director-history-maintenance.mjs')
      const child = spawn(process.execPath, [
        scriptPath,
        'run-daily',
        '--launch-path',
        this.launchPath,
        '--retention-days',
        String(this.retentionDays),
        '--batch-limit',
        String(this.batchLimit),
      ], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      const code = await new Promise((resolveCode, reject) => {
        child.on('error', reject)
        child.on('close', resolveCode)
      })

      if (code !== 0) {
        throw new Error(`maintenance script exited with code ${code}\n${stderr || stdout}`.trim())
      }
      if (stdout.trim()) {
        console.log(`[DirectorHistoryMaintenanceScheduler] ${stdout.trim()}`)
      }
    } catch (err) {
      console.error('[DirectorHistoryMaintenanceScheduler] tick failed:', err)
    } finally {
      this.ticking = false
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}
