import type { LeaderElector } from './leader-elector.js'
import type { PprSnapshotRepository, CreatePprSnapshotInput } from '../repos/index.js'
import type { SnapshotGraphRelevanceProvider } from '../allocator/graph-relevance-provider.js'
import { PprSnapshotBuilder } from '../services/ppr/ppr-snapshot-builder.js'
import { config } from '../lib/config.js'

const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000
const DEFAULT_BACKFILL_DAYS = 30
const DEFAULT_INCREMENTAL_DAYS = 7
const DEFAULT_FULL_BACKFILL_INTERVAL_MS = 24 * 60 * 60 * 1000

export interface PprRefreshSchedulerDeps {
  repository: PprSnapshotRepository
  provider: SnapshotGraphRelevanceProvider
  builder: PprSnapshotBuilder
  leaderElector?: LeaderElector
}

export interface PprRefreshSchedulerConfig {
  refreshIntervalMs?: number
  backfillDays?: number
  topKPerContext?: number
  incrementalDays?: number
  fullBackfillIntervalMs?: number
}

export class PprRefreshScheduler {
  private running = false
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private inflight = false

  private readonly refreshIntervalMs: number
  private readonly backfillDays: number
  private readonly topKPerContext: number
  private readonly incrementalDays: number
  private readonly fullBackfillIntervalMs: number
  private lastFullBackfillAt = 0

  constructor(
    private readonly deps: PprRefreshSchedulerDeps,
    cfg: PprRefreshSchedulerConfig = {},
  ) {
    this.refreshIntervalMs = cfg.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS
    this.backfillDays = cfg.backfillDays ?? DEFAULT_BACKFILL_DAYS
    this.topKPerContext = cfg.topKPerContext ?? 40
    this.incrementalDays = cfg.incrementalDays ?? DEFAULT_INCREMENTAL_DAYS
    this.fullBackfillIntervalMs = cfg.fullBackfillIntervalMs ?? DEFAULT_FULL_BACKFILL_INTERVAL_MS
  }

  start(): void {
    if (this.running) return
    this.running = true

    this.timer = setInterval(() => {
      void this.runRefresh('scheduled-refresh')
    }, this.refreshIntervalMs)

    this.startupTimer = setTimeout(() => {
      this.startupTimer = null
      void this.bootstrap()
    }, 45_000)

    console.log(`[PprRefreshScheduler] Started (refresh every ${Math.round(this.refreshIntervalMs / 1000)}s)`)
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

    console.log('[PprRefreshScheduler] Stopped')
  }

  async runBackfillOnce(): Promise<void> {
    await this.recompute('ppr-backfill', true)
  }

  async runRefresh(label = 'manual-refresh'): Promise<void> {
    await this.recompute(`ppr-refresh:${label}`)
  }

  private async bootstrap(): Promise<void> {
    if (!(await this.ensureLeadership())) return

    try {
      const existing = await this.deps.repository.listUnexpired({ limit: 1 })
      if (existing.length === 0) {
        await this.runBackfillOnce()
      }
      await this.runRefresh('startup')
    } catch (err) {
      console.error('[PprRefreshScheduler] bootstrap failed:', err)
    }
  }

  private async recompute(jobLabel: string, forceFullBackfill = false): Promise<void> {
    if (this.inflight) return
    if (!(await this.ensureLeadership())) return

    this.inflight = true
    const startedAt = Date.now()

    try {
      const now = new Date()
      const v2Enabled = config.launch.capabilities.pprRefreshV2
      const shouldFullBackfill = forceFullBackfill
        || !v2Enabled
        || this.lastFullBackfillAt === 0
        || (now.getTime() - this.lastFullBackfillAt) >= this.fullBackfillIntervalMs

      const windowDays = shouldFullBackfill ? this.backfillDays : this.incrementalDays
      const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
      const sourceAgentIds = v2Enabled && !shouldFullBackfill
        ? await this.deps.builder.collectActiveSourceAgentIds(since)
        : undefined

      const snapshotsBySource = await this.deps.builder.buildSnapshots({
        since,
        now,
        alpha: 0.85,
        maxIterations: 20,
        topKPerContext: this.topKPerContext,
        refreshTtlMs: this.refreshIntervalMs * 2,
        sourceAgentIds,
      })

      let sourceCount = 0
      let rowCount = 0

      for (const [sourceAgentId, rows] of snapshotsBySource) {
        await this.deps.repository.replaceSourceSnapshots(sourceAgentId, rows)
        this.deps.provider.replaceSourceSnapshots(sourceAgentId, toProviderRows(rows))
        sourceCount += 1
        rowCount += rows.length
      }

      const purged = await this.deps.repository.purgeExpired(now)
      if (shouldFullBackfill) {
        this.lastFullBackfillAt = now.getTime()
      }
      const elapsedMs = Date.now() - startedAt
      console.log(
        `[PprRefreshScheduler] ${jobLabel} done mode=${shouldFullBackfill ? 'full' : 'incremental'} window_days=${windowDays} source_agents=${sourceCount} rows=${rowCount} purged=${purged} elapsed_ms=${elapsedMs}`,
      )
    } catch (err) {
      console.error(`[PprRefreshScheduler] ${jobLabel} failed:`, err)
    } finally {
      this.inflight = false
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}

function toProviderRows(entries: CreatePprSnapshotInput[]) {
  return entries.map((entry) => ({
    source_agent_id: entry.source_agent_id,
    candidate_agent_id: entry.candidate_agent_id,
    community_id: entry.community_id,
    topic_key: entry.topic_key,
    ppr_score: entry.ppr_score,
    rank: entry.rank,
    computed_at: entry.computed_at,
    expires_at: entry.expires_at,
  }))
}
