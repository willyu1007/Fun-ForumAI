import type { AgentBioRefreshService } from './agent-bio-refresh-service.js'
import type { AchievementsOrchestrator } from './achievements-orchestrator.js'
import type { SearchProjectionService } from './search-projection-service.js'
import type { AgentBiographyService } from './agent-biography-service.js'
import type { WarmupGovernanceService } from './warmup-governance-service.js'
import type { AftershowService } from './aftershow-service.js'
import type { ForumReadService, PostWithMeta } from './forum-read-service.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { ChronicleRepository } from '../repos/chronicle-repository.js'
import { countProductSafePublicChronicleEntries } from './chronicle-product-safety.js'
import {
  readAftershowExportBias,
  readContentKind,
  readStorylineState,
} from '../../shared/semantic-taxonomy.js'

export interface LaunchEnrichmentServiceDeps {
  agentRepo: AgentRepository
  chronicleRepo: ChronicleRepository
  agentBioRefreshService: Pick<AgentBioRefreshService, 'processMajorRefreshSweep'>
  achievementsOrchestrator: Pick<AchievementsOrchestrator, 'runDailyBatch' | 'runWeeklyBatch'>
  searchProjectionService: Pick<SearchProjectionService, 'refreshAgent'>
  agentBiographyService: Pick<AgentBiographyService, 'compileAgent'>
  warmupGovernanceService: Pick<WarmupGovernanceService, 'getRuntimeBaselineAdmission'>
  forumReadService: Pick<ForumReadService, 'getFeed'>
  aftershowService: Pick<AftershowService, 'getLatestByPost' | 'trigger'>
}

export interface PreflightResult {
  warmup_batch_id: string
  warmup_layer_ready: boolean
  kickoff_layer_ready: boolean
  active_agent_count: number
}

export interface BioStepResult {
  scanned: number
  refreshed: number
  skipped: number
  duration_ms: number
}

export interface ChronicleStepResult {
  daily_scanned: number
  daily_emitted: number
  daily_skipped_without_product_activity: number
  weekly_scanned: number
  weekly_emitted: number
  weekly_skipped_without_product_activity: number
  product_safe_ready: number
  product_safe_missing_agent_ids: string[]
  duration_ms: number
}

export interface AftershowStepResult {
  scanned: number
  published: number
  skipped_existing: number
  errors: Array<{ post_id: string; message: string }>
  duration_ms: number
}

export interface ProjectionStepResult {
  scanned: number
  refreshed: number
  errors: Array<{ agent_id: string; message: string }>
  duration_ms: number
}

export interface BiographyStepResult {
  scanned: number
  ok: number
  warn_zero_chapter: string[]
  warn_over_three_chapter: Array<{ agent_id: string; chapter_count: number }>
  errors: Array<{ agent_id: string; message: string }>
  duration_ms: number
}

export interface RunOptions {
  force?: boolean
}

export interface EnrichmentReport {
  ok: boolean
  duration_ms: number
  preflight: PreflightResult
  bio: BioStepResult
  chronicle: ChronicleStepResult
  aftershow: AftershowStepResult
  projection: ProjectionStepResult
  biography: BiographyStepResult
  warnings: string[]
}

const PAGE_SIZE = 200
const SOFT_CHAPTER_HIGH = 3
const AFTERSHOW_CANDIDATE_LIMIT = 8
const READY_AFTERSHOW_EXPORT_BIAS = 0.6

export class LaunchEnrichmentService {
  constructor(private readonly deps: LaunchEnrichmentServiceDeps) {}

  async runAll(now: Date = new Date(), opts: RunOptions = {}): Promise<EnrichmentReport> {
    const started = Date.now()
    const warnings: string[] = []
    const force = opts.force === true

    const preflight = await this.preflight()
    const bio = await this.refreshAllBios(preflight.active_agent_count, now, { force })
    const chronicle = await this.materializeChronicles(now)
    const aftershow = await this.materializeAftershow(now)
    const projection = await this.refreshAllPublicProjections()
    const biography = await this.compileAllBiographies(now, { force })

    if (biography.warn_zero_chapter.length > 0) {
      warnings.push(
        `biography: ${biography.warn_zero_chapter.length} agent(s) produced 0 chapters: ${biography.warn_zero_chapter.join(', ')}`,
      )
    }
    if (biography.warn_over_three_chapter.length > 0) {
      const sample = biography.warn_over_three_chapter
        .slice(0, 5)
        .map((item) => `${item.agent_id}=${item.chapter_count}`)
        .join(', ')
      warnings.push(
        `biography: ${biography.warn_over_three_chapter.length} agent(s) exceeded ${SOFT_CHAPTER_HIGH} chapters (sample: ${sample})`,
      )
    }

    return {
      ok: true,
      duration_ms: Date.now() - started,
      preflight,
      bio,
      chronicle,
      aftershow,
      projection,
      biography,
      warnings,
    }
  }

  async preflight(): Promise<PreflightResult> {
    const admission = await this.deps.warmupGovernanceService.getRuntimeBaselineAdmission()
    if (!admission.warmup_layer_ready || !admission.warmup_batch_id) {
      throw new Error(
        `enrichment preflight failed: warmup not active yet (reasons: ${admission.reasons.join(', ') || 'unknown'})`,
      )
    }
    if (!admission.kickoff_layer_ready) {
      throw new Error(
        `enrichment preflight failed: kickoff not active (reasons: ${admission.reasons.join(', ') || 'unknown'})`,
      )
    }
    const activeAgentCount = this.countActiveAgents()
    if (activeAgentCount === 0) {
      throw new Error('enrichment preflight failed: no active agents found')
    }
    return {
      warmup_batch_id: admission.warmup_batch_id,
      warmup_layer_ready: admission.warmup_layer_ready,
      kickoff_layer_ready: admission.kickoff_layer_ready,
      active_agent_count: activeAgentCount,
    }
  }

  async refreshAllBios(
    activeAgentCount: number,
    now: Date = new Date(),
    opts: RunOptions = {},
  ): Promise<BioStepResult> {
    const started = Date.now()
    const result = await this.deps.agentBioRefreshService.processMajorRefreshSweep({
      now,
      limit: activeAgentCount,
      page_size: PAGE_SIZE,
      force: opts.force === true,
    })
    return { ...result, duration_ms: Date.now() - started }
  }

  async materializeChronicles(now: Date = new Date()): Promise<ChronicleStepResult> {
    const started = Date.now()
    const daily = await this.deps.achievementsOrchestrator.runDailyBatch(now)
    const weekly = await this.deps.achievementsOrchestrator.runWeeklyBatch(now)
    const proof = await this.collectProductSafeChronicleProof()
    if (proof.missing.length > 0) {
      throw new Error(
        `enrichment chronicle proof failed: ${proof.missing.length}/${proof.scanned} active agent(s) lack product-safe public chronicle: ${proof.missing.slice(0, 10).join(', ')}`,
      )
    }
    return {
      daily_scanned: daily.scanned,
      daily_emitted: daily.emitted ?? 0,
      daily_skipped_without_product_activity: daily.skipped_without_product_activity ?? 0,
      weekly_scanned: weekly.scanned,
      weekly_emitted: weekly.emitted ?? 0,
      weekly_skipped_without_product_activity: weekly.skipped_without_product_activity ?? 0,
      product_safe_ready: proof.ready,
      product_safe_missing_agent_ids: proof.missing,
      duration_ms: Date.now() - started,
    }
  }

  async materializeAftershow(_now: Date = new Date()): Promise<AftershowStepResult> {
    const started = Date.now()
    const errors: AftershowStepResult['errors'] = []
    let published = 0
    let skippedExisting = 0

    const feed = await this.deps.forumReadService.getFeed({
      sort: 'new',
      limit: 500,
    })
    const candidates = uniquePosts(feed.items)
      .filter((post) => isReadyAftershowCandidate(post))
      .slice(0, AFTERSHOW_CANDIDATE_LIMIT)

    for (const post of candidates) {
      try {
        const existing = await this.deps.aftershowService.getLatestByPost(post.id)
        if (existing.artifact) {
          skippedExisting += 1
          continue
        }
        const result = await this.deps.aftershowService.trigger({
          post_id: post.id,
          triggered_by_user_id: null,
          actor_role: 'admin',
          mode: 'MANUAL',
          force: true,
        })
        if (result.artifact?.status === 'PUBLISHED') {
          published += 1
        } else {
          errors.push({
            post_id: post.id,
            message: `aftershow artifact not published (${result.reason})`,
          })
        }
      } catch (error) {
        errors.push({
          post_id: post.id,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (candidates.length > 0 && published + skippedExisting === 0) {
      throw new Error(
        `enrichment aftershow step failed for all ${candidates.length} candidate post(s); first: ${errors[0]?.post_id ?? 'unknown'}: ${errors[0]?.message ?? 'unknown'}`,
      )
    }

    return {
      scanned: candidates.length,
      published,
      skipped_existing: skippedExisting,
      errors,
      duration_ms: Date.now() - started,
    }
  }

  async refreshAllPublicProjections(): Promise<ProjectionStepResult> {
    const started = Date.now()
    const errors: Array<{ agent_id: string; message: string }> = []
    let scanned = 0
    let refreshed = 0

    for (const agentId of this.iterateActiveAgentIds()) {
      scanned += 1
      try {
        await this.deps.searchProjectionService.refreshAgent(agentId)
        refreshed += 1
      } catch (error) {
        errors.push({
          agent_id: agentId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `enrichment projection step failed for ${errors.length}/${scanned} agent(s); first: ${errors[0].agent_id}: ${errors[0].message}`,
      )
    }

    return { scanned, refreshed, errors, duration_ms: Date.now() - started }
  }

  async compileAllBiographies(
    now: Date = new Date(),
    opts: RunOptions = {},
  ): Promise<BiographyStepResult> {
    const started = Date.now()
    const warnZero: string[] = []
    const warnOverThree: Array<{ agent_id: string; chapter_count: number }> = []
    const errors: Array<{ agent_id: string; message: string }> = []
    let scanned = 0
    let ok = 0
    const force = opts.force === true

    for (const agentId of this.iterateActiveAgentIds()) {
      scanned += 1
      try {
        const view = await this.deps.agentBiographyService.compileAgent(agentId, {
          reason: 'launch_enrichment',
          now,
          force,
        })
        const chapterCount = view?.chapters.length ?? 0
        if (chapterCount === 0) {
          warnZero.push(agentId)
          continue
        }
        if (chapterCount > SOFT_CHAPTER_HIGH) {
          warnOverThree.push({ agent_id: agentId, chapter_count: chapterCount })
        }
        ok += 1
      } catch (error) {
        errors.push({
          agent_id: agentId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `enrichment biography step failed for ${errors.length}/${scanned} agent(s); first: ${errors[0].agent_id}: ${errors[0].message}`,
      )
    }

    return {
      scanned,
      ok,
      warn_zero_chapter: warnZero,
      warn_over_three_chapter: warnOverThree,
      errors,
      duration_ms: Date.now() - started,
    }
  }

  private countActiveAgents(): number {
    let count = 0
    for (const _id of this.iterateActiveAgentIds()) {
      void _id
      count += 1
    }
    return count
  }

  private async collectProductSafeChronicleProof(): Promise<{
    scanned: number
    ready: number
    missing: string[]
  }> {
    const missing: string[] = []
    let scanned = 0
    let ready = 0
    for (const agentId of this.iterateActiveAgentIds()) {
      scanned += 1
      const count = await countProductSafePublicChronicleEntries(this.deps.chronicleRepo, agentId)
      if (count > 0) {
        ready += 1
      } else {
        missing.push(agentId)
      }
    }
    return { scanned, ready, missing }
  }

  private *iterateActiveAgentIds(): IterableIterator<string> {
    let cursor: string | undefined
    while (true) {
      const page = this.deps.agentRepo.findActive({ cursor, limit: PAGE_SIZE })
      if (page.items.length === 0) break
      for (const agent of page.items) yield agent.id
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }
  }
}

function isReadyAftershowCandidate(post: PostWithMeta): boolean {
  const contentKind = readContentKind(post)
  const storylineState = readStorylineState(post)
  const aftershowBias = readAftershowExportBias(post) ?? 0
  return (
    contentKind === 'continuity_callback'
    || storylineState === 'callback'
    || aftershowBias >= READY_AFTERSHOW_EXPORT_BIAS
  )
}

function uniquePosts(posts: PostWithMeta[]): PostWithMeta[] {
  const seen = new Set<string>()
  const out: PostWithMeta[] = []
  for (const post of posts) {
    if (seen.has(post.id)) continue
    seen.add(post.id)
    out.push(post)
  }
  return out
}
