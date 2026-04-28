import { randomUUID } from 'node:crypto'
import { config } from '../lib/config.js'
import type { LLMGateway } from '../llm/llm-gateway.js'
import type {
  GlobalHighlightsPayload,
  GlobalHighlightsService,
} from './global-highlights-service.js'
import type { HomeProgrammingPayload, HomeProgrammingService } from './home-programming-service.js'
import type { ForumReadService } from './forum-read-service.js'
import type { SearchService } from './search-service.js'
import type { PostRepository } from '../repos/index.js'
import type { SearchProjectionService } from './search-projection-service.js'
import type { PostScheduler } from '../runtime/post-scheduler.js'
import type {
  KickoffBaselineDetail,
  RuntimeBaselineAdmission,
  WarmupGovernanceService,
} from './warmup-governance-service.js'
import {
  createVerifierDiagnosis,
  mapActivationReasonToDiagnosis,
  mapBaselineReasonToDiagnosis,
  sortDiagnoses,
} from './warmup-verifier-diagnosis.js'
import { WarmupRunArtifactService } from './warmup-run-artifact-service.js'
import type {
  WarmupProbeContextInput,
  WarmupVerifierDiagnosis,
  WarmupVerifierFailureLogEntry,
  WarmupVerifierGovernanceDrill,
  WarmupVerifierProbeManifest,
  WarmupVerifierRunDetail,
  WarmupVerifierRunStatus,
  WarmupVerifierSurfaceAudit,
  WarmupVerifierSurfaceAuditStage,
  WarmupVerifierSurfaceCheckpoint,
} from '../../shared/warmup-verifier.js'

type FeedPayload = Awaited<ReturnType<ForumReadService['getFeed']>>
type SearchPayload = Awaited<ReturnType<SearchService['search']>>

export interface WarmupClosureVerifierServiceDeps {
  artifactService: WarmupRunArtifactService
  warmupGovernanceService: Pick<
    WarmupGovernanceService,
    'getRuntimeBaselineAdmission' | 'getKickoffDetail'
  >
  postScheduler: Pick<PostScheduler, 'forcePost'>
  postRepo: Pick<
    PostRepository,
    'findById' | 'findByGovernanceBatches' | 'updateContent' | 'updateModerationMetadata'
  >
  forumReadService: Pick<ForumReadService, 'getFeed'>
  searchService: Pick<SearchService, 'search'>
  homeProgrammingService: Pick<HomeProgrammingService, 'getHome'>
  globalHighlightsService: Pick<GlobalHighlightsService, 'collectToday'>
  searchProjectionService?: Pick<SearchProjectionService, 'refreshPost'> | null
  runtimeLoop: { isRunning: boolean }
  llmGateway: Pick<LLMGateway, 'isConfigured'>
}

interface SurfaceAuditContext {
  probe_post_id: string
  probe_community_id: string | null
  probe_token: string
  baseline_post_ids: Set<string>
  feed_expectation: 'probe_visible' | 'probe_hidden'
  search_expectation: 'probe_visible' | 'probe_hidden'
  stage: WarmupVerifierSurfaceAuditStage['stage']
}

export class WarmupClosureVerifierService {
  constructor(private readonly deps: WarmupClosureVerifierServiceDeps) {}

  async run(input?: { triggered_by_user_id?: string | null }): Promise<WarmupVerifierRunDetail> {
    const runSummary = await this.deps.artifactService.createRun({
      triggered_by_user_id: input?.triggered_by_user_id ?? null,
    })
    const runId = runSummary.run_id
    const diagnoses: WarmupVerifierDiagnosis[] = []
    let kickoffDetail: KickoffBaselineDetail | null = null
    let admissionBefore: RuntimeBaselineAdmission | null = null
    let admissionAfter: RuntimeBaselineAdmission | null = null
    const surfaceAudit: WarmupVerifierSurfaceAudit = {
      initial: null,
      after_quarantine: null,
      after_restore: null,
      after_cleanup: null,
    }
    const governanceDrill: WarmupVerifierGovernanceDrill = {
      quarantine: null,
      restore: null,
      cleanup: null,
    }
    let probeManifest: WarmupVerifierProbeManifest | null = null
    let failedPhase: WarmupVerifierRunDetail['summary']['failed_phase'] = null

    const recordFailure = async (
      phase: WarmupVerifierFailureLogEntry['phase'],
      message: string,
    ): Promise<void> => {
      const entry: WarmupVerifierFailureLogEntry = {
        phase,
        message,
        at: new Date().toISOString(),
      }
      try {
        await this.deps.artifactService.appendFailure(runId, entry)
      } catch {
        // ignore secondary artifact write failures here; final completion will fail closed
      }
    }

    const addDiagnosis = (diagnosis: WarmupVerifierDiagnosis): void => {
      diagnoses.push(diagnosis)
      if (!failedPhase) {
        failedPhase = diagnosis.phase
      }
    }

    const runOrDiagnose = async <T>(
      operation: () => Promise<T>,
      buildDiagnosis: (message: string) => WarmupVerifierDiagnosis,
    ): Promise<T> => {
      try {
        return await operation()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected_dependency_failure'
        addDiagnosis(buildDiagnosis(message))
        throw error
      }
    }

    try {
      admissionBefore = await runOrDiagnose(
        () => this.deps.warmupGovernanceService.getRuntimeBaselineAdmission(),
        (message) =>
          createVerifierDiagnosis({
            phase: 'kickoff_resolution',
            subsystem: 'warmup_governance',
            code: 'kickoff_resolution.baseline_admission_read_failed',
            summary_zh: `读取 baseline admission 失败：${message}`,
            recommended_next_check:
              '检查 warmup governance service、baseline state 读取路径和运行时依赖。',
            artifact: 'failure-log.json',
            raw_reason: message,
          }),
      )
      if (
        !(await this.tryWriteArtifact(
          'baseline_admission_before',
          () => this.deps.artifactService.writeBaselineAdmissionBefore(runId, admissionBefore),
          diagnoses,
          recordFailure,
        ))
      ) {
        failedPhase ??= 'artifact_persist'
      }

      if (!admissionBefore.kickoff_baseline_id) {
        addDiagnosis(mapBaselineReasonToDiagnosis('no_kickoff_baseline', '$.reasons[0]'))
        throw new Error('missing_kickoff_baseline')
      }
      const activeSuiteId = admissionBefore.kickoff_baseline_id

      const baselineAdmission = admissionBefore
      kickoffDetail = await runOrDiagnose(
        () => this.deps.warmupGovernanceService.getKickoffDetail(activeSuiteId),
        (message) =>
          createVerifierDiagnosis({
            phase: 'kickoff_resolution',
            subsystem: 'warmup_governance',
            code: 'kickoff_resolution.kickoff_detail_read_failed',
            summary_zh: `读取 kickoff baseline 详情失败：${message}`,
            recommended_next_check:
              '检查 kickoff baseline 查询路径、batch 关联和 governance 数据完整性。',
            artifact: 'failure-log.json',
            raw_reason: message,
          }),
      )
      if (
        !(await this.tryWriteArtifact(
          'kickoff_snapshot_before',
          () => this.deps.artifactService.writeKickoffSnapshotBefore(runId, kickoffDetail),
          diagnoses,
          recordFailure,
        ))
      ) {
        failedPhase ??= 'artifact_persist'
      }

      if (!this.deps.runtimeLoop.isRunning) {
        addDiagnosis(
          createVerifierDiagnosis({
            phase: 'baseline_admission',
            subsystem: 'runtime_gate',
            code: 'runtime.worker_not_running',
            summary_zh: 'runtime loop 未运行，warm-up 闭环探针无法执行。',
            recommended_next_check: '检查 worker 进程、runtime start 状态以及调度循环是否已启动。',
            artifact: 'baseline-admission-before.json',
          }),
        )
      }

      if (!this.deps.llmGateway.isConfigured) {
        addDiagnosis(
          createVerifierDiagnosis({
            phase: 'runtime_probe_write',
            subsystem: 'post_scheduler',
            code: 'runtime.llm_not_configured',
            summary_zh: '当前没有可用 LLM 凭证，受控 probe 无法生成。',
            recommended_next_check:
              '检查 worker 的 LLM 凭证装载、provider admission 和 runtime stats。',
            artifact: 'failure-log.json',
          }),
        )
      }

      if (!kickoffDetail.verification.ok) {
        for (const [index, reason] of kickoffDetail.verification.missing.entries()) {
          addDiagnosis(
            mapActivationReasonToDiagnosis(reason, `$.verification.missing[${index}]`),
          )
        }
      }

      for (const [index, reason] of admissionBefore.reasons.entries()) {
        addDiagnosis(mapBaselineReasonToDiagnosis(reason, `$.reasons[${index}]`))
      }

      if (diagnoses.length > 0) {
        throw new Error('precheck_failed')
      }

      const probeToken = randomUUID().slice(0, 8)
      const probeContext: WarmupProbeContextInput = {
        run_id: runId,
        probe_token: probeToken,
        triggered_by: input?.triggered_by_user_id ?? null,
        forced: true,
      }
      const probeResult = await runOrDiagnose(
        () =>
          this.deps.postScheduler.forcePost({
            probe_context: probeContext,
          }),
        (message) =>
          createVerifierDiagnosis({
            phase: 'runtime_probe_write',
            subsystem: 'post_scheduler',
            code: 'runtime.probe_write_exception',
            summary_zh: `受控 probe 调度抛出异常：${message}`,
            recommended_next_check: '检查 PostScheduler、LLM 调用链和 runtime worker 日志。',
            artifact: 'failure-log.json',
            raw_reason: message,
          }),
      )
      if (!probeResult.post_id) {
        addDiagnosis(
          createVerifierDiagnosis({
            phase: 'runtime_probe_write',
            subsystem: 'post_scheduler',
            code: probeResult.error ? 'runtime.probe_write_failed' : 'runtime.probe_not_persisted',
            summary_zh: probeResult.error
              ? `受控 probe 执行失败：${probeResult.error}`
              : '受控 probe 没有写出可持久化的 post。',
            recommended_next_check:
              '检查 PostScheduler 选人选社区、LLM 解析结果和 DataPlaneWriter 写入日志。',
            artifact: 'failure-log.json',
            raw_reason: probeResult.error ?? null,
          }),
        )
        throw new Error('probe_write_failed')
      }

      const probePost = await runOrDiagnose(
        () => this.deps.postRepo.findById(probeResult.post_id!),
        (message) =>
          createVerifierDiagnosis({
            phase: 'runtime_probe_write',
            subsystem: 'forum_write',
            code: 'runtime.probe_post_read_failed',
            summary_zh: `probe 写出后回读失败：${message}`,
            recommended_next_check: '检查 post repository、事务提交与写后回读路径。',
            artifact: 'failure-log.json',
            raw_reason: message,
          }),
      )
      if (!probePost) {
        addDiagnosis(
          createVerifierDiagnosis({
            phase: 'runtime_probe_write',
            subsystem: 'forum_write',
            code: 'runtime.probe_post_missing_after_write',
            summary_zh: 'probe 返回了 post_id，但持久层中找不到对应内容。',
            recommended_next_check:
              '检查 ForumWriteService/DataPlaneWriter 是否出现写后回读不一致。',
            artifact: 'probe-manifest.json',
          }),
        )
        throw new Error('probe_post_missing')
      }

      probeManifest = {
        run_id: runId,
        probe_token: probeToken,
        triggered_by_user_id: input?.triggered_by_user_id ?? null,
        forced: true,
        agent_id: probeResult.agent_id ?? probePost.author_agent_id,
        community_id: probeResult.community_id ?? probePost.community_id,
        post_id: probePost.id,
        title: probePost.title,
        tags: probePost.tags,
        visibility: probePost.visibility,
        state: probePost.state,
        created_at: new Date().toISOString(),
      }
      if (
        !(await this.tryWriteArtifact(
          'probe_manifest',
          () => this.deps.artifactService.writeProbeManifest(runId, probeManifest),
          diagnoses,
          recordFailure,
        ))
      ) {
        failedPhase ??= 'artifact_persist'
      }

      const baselinePostIds = await runOrDiagnose(
        () => this.loadBaselinePostIds(baselineAdmission),
        (message) =>
          createVerifierDiagnosis({
            phase: 'kickoff_resolution',
            subsystem: 'warmup_governance',
            code: 'kickoff_resolution.baseline_posts_resolution_failed',
            summary_zh: `解析 kickoff baseline 内容集合失败：${message}`,
            recommended_next_check:
              '检查 kickoff/warmup batch 到 post 的解析链路和 repository 查询。',
            artifact: 'failure-log.json',
            raw_reason: message,
          }),
      )
      surfaceAudit.initial = await this.auditSurfaces({
        probe_post_id: probePost.id,
        probe_community_id: probePost.community_id,
        probe_token: probeToken,
        baseline_post_ids: baselinePostIds,
        feed_expectation: 'probe_visible',
        search_expectation: 'probe_visible',
        stage: 'initial',
      })
      if (
        !(await this.tryWriteArtifact(
          'surface_audit_initial',
          () => this.deps.artifactService.writeSurfaceAudit(runId, surfaceAudit),
          diagnoses,
          recordFailure,
        ))
      ) {
        failedPhase ??= 'artifact_persist'
      }
      this.collectSurfaceDiagnoses(surfaceAudit.initial, addDiagnosis)
      const originalProbeState = {
        visibility: probePost.visibility,
        state: probePost.state,
        moderation_metadata: probePost.moderation_metadata,
      }

      governanceDrill.quarantine = await this.runGovernanceStep({
        action: 'quarantine',
        mutate: async () => {
          await this.deps.postRepo.updateContent(probePost.id, {
            visibility: 'QUARANTINE',
          })
          await this.deps.searchProjectionService?.refreshPost(probePost.id)
        },
        stage: 'after_quarantine',
        surfaceContext: {
          probe_post_id: probePost.id,
          probe_community_id: probePost.community_id,
          probe_token: probeToken,
          baseline_post_ids: baselinePostIds,
          feed_expectation: 'probe_hidden',
          search_expectation: 'probe_hidden',
          stage: 'after_quarantine',
        },
        surfaceAudit,
        addDiagnosis,
      })

      governanceDrill.restore = await this.runGovernanceStep({
        action: 'restore',
        mutate: async () => {
          await this.deps.postRepo.updateContent(probePost.id, {
            visibility: originalProbeState.visibility,
            state: originalProbeState.state,
          })
          await this.deps.postRepo.updateModerationMetadata(
            probePost.id,
            originalProbeState.moderation_metadata,
          )
          await this.deps.searchProjectionService?.refreshPost(probePost.id)
        },
        stage: 'after_restore',
        surfaceContext: {
          probe_post_id: probePost.id,
          probe_community_id: probePost.community_id,
          probe_token: probeToken,
          baseline_post_ids: baselinePostIds,
          feed_expectation: 'probe_visible',
          search_expectation: 'probe_visible',
          stage: 'after_restore',
        },
        surfaceAudit,
        addDiagnosis,
      })

      governanceDrill.cleanup = await this.cleanupProbeVisibility({
        probePostId: probePost.id,
        probeCommunityId: probePost.community_id,
        probeToken,
        baselinePostIds,
        surfaceAudit,
        addDiagnosis,
      })

      if (
        !(await this.tryWriteArtifact(
          'surface_audit',
          () => this.deps.artifactService.writeSurfaceAudit(runId, surfaceAudit),
          diagnoses,
          recordFailure,
        ))
      ) {
        failedPhase ??= 'artifact_persist'
      }
      if (
        !(await this.tryWriteArtifact(
          'governance_drill',
          () => this.deps.artifactService.writeGovernanceDrill(runId, governanceDrill),
          diagnoses,
          recordFailure,
        ))
      ) {
        failedPhase ??= 'artifact_persist'
      }

      admissionAfter = await runOrDiagnose(
        () => this.deps.warmupGovernanceService.getRuntimeBaselineAdmission(),
        (message) =>
          createVerifierDiagnosis({
            phase: 'kickoff_resolution',
            subsystem: 'warmup_governance',
            code: 'kickoff_resolution.baseline_admission_refresh_failed',
            summary_zh: `回读 baseline admission 失败：${message}`,
            recommended_next_check: '检查 governance read model 是否在 verifier 运行后仍可读取。',
            artifact: 'failure-log.json',
            raw_reason: message,
          }),
      )
      if (
        !(await this.tryWriteArtifact(
          'baseline_admission_after',
          () => this.deps.artifactService.writeBaselineAdmissionAfter(runId, admissionAfter),
          diagnoses,
          recordFailure,
        ))
      ) {
        failedPhase ??= 'artifact_persist'
      }
      const refreshedKickoff = await runOrDiagnose(
        () => this.deps.warmupGovernanceService.getKickoffDetail(activeSuiteId),
        (message) =>
          createVerifierDiagnosis({
            phase: 'kickoff_resolution',
            subsystem: 'warmup_governance',
            code: 'kickoff_resolution.kickoff_detail_refresh_failed',
            summary_zh: `回读 kickoff baseline 详情失败：${message}`,
            recommended_next_check:
              '检查 kickoff baseline read model 在 verifier 运行后的可读性和 batch 关联完整性。',
            artifact: 'failure-log.json',
            raw_reason: message,
          }),
      )
      if (
        !(await this.tryWriteArtifact(
          'kickoff_snapshot_after',
          () => this.deps.artifactService.writeKickoffSnapshotAfter(runId, refreshedKickoff),
          diagnoses,
          recordFailure,
        ))
      ) {
        failedPhase ??= 'artifact_persist'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'warmup_verifier_failed'
      if (!diagnoses.length) {
        addDiagnosis(
          createVerifierDiagnosis({
            phase: failedPhase ?? 'artifact_persist',
            subsystem:
              failedPhase === 'artifact_persist' ? 'artifact_storage' : 'warmup_governance',
            code: `verifier.${message}`,
            summary_zh: `warm-up verifier 运行失败：${message}`,
            recommended_next_check: '检查 failure-log、artifact 写入状态以及 verifier 服务日志。',
            artifact: 'failure-log.json',
            raw_reason: message,
          }),
        )
      }
      await recordFailure(failedPhase ?? 'artifact_persist', message)
    }

    const sortedDiagnoses = sortDiagnoses(diagnoses)
    if (
      !(await this.tryWriteArtifact(
        'kickoff_snapshot_after_fallback',
        () => this.deps.artifactService.writeKickoffSnapshotAfter(runId, kickoffDetail),
        diagnoses,
        recordFailure,
      ))
    ) {
      failedPhase ??= 'artifact_persist'
    }
    if (
      !(await this.tryWriteArtifact(
        'baseline_admission_after_fallback',
        () =>
          this.deps.artifactService.writeBaselineAdmissionAfter(
            runId,
            admissionAfter ?? admissionBefore,
          ),
        diagnoses,
        recordFailure,
      ))
    ) {
      failedPhase ??= 'artifact_persist'
    }
    if (
      !(await this.tryWriteArtifact(
        'probe_manifest_fallback',
        () => this.deps.artifactService.writeProbeManifest(runId, probeManifest),
        diagnoses,
        recordFailure,
      ))
    ) {
      failedPhase ??= 'artifact_persist'
    }
    if (
      !(await this.tryWriteArtifact(
        'surface_audit_fallback',
        () => this.deps.artifactService.writeSurfaceAudit(runId, surfaceAudit),
        diagnoses,
        recordFailure,
      ))
    ) {
      failedPhase ??= 'artifact_persist'
    }
    if (
      !(await this.tryWriteArtifact(
        'governance_drill_fallback',
        () => this.deps.artifactService.writeGovernanceDrill(runId, governanceDrill),
        diagnoses,
        recordFailure,
      ))
    ) {
      failedPhase ??= 'artifact_persist'
    }
    if (
      !(await this.tryWriteArtifact(
        'diagnosis',
        () => this.deps.artifactService.writeDiagnosis(runId, sortedDiagnoses),
        diagnoses,
        recordFailure,
      ))
    ) {
      failedPhase ??= 'artifact_persist'
    }

    const summaryMarkdown = this.buildResultSummary({
      kickoffDetail,
      admissionBefore,
      admissionAfter,
      diagnoses: sortedDiagnoses,
      probeManifest,
      surfaceAudit,
      governanceDrill,
    })
    if (
      !(await this.tryWriteArtifact(
        'result_summary',
        () => this.deps.artifactService.writeResultSummary(runId, summaryMarkdown),
        diagnoses,
        recordFailure,
      ))
    ) {
      failedPhase ??= 'artifact_persist'
    }

    const diagnosisWriteOutcome = await this.persistDiagnoses(runId, diagnoses, recordFailure)
    if (!diagnosisWriteOutcome.ok) {
      failedPhase ??= 'artifact_persist'
    }
    const persistedDetailBeforeFinalize = await this.deps.artifactService.readRun(runId)
    const finalizedDiagnoses = persistedDetailBeforeFinalize?.diagnoses ?? []
    const detail = await this.finalizeRun(runId, {
      kickoffDetail,
      admissionBefore,
      status: failedPhase || finalizedDiagnoses.length > 0 ? 'failed' : 'passed',
      diagnoses: finalizedDiagnoses,
      probeManifest,
      surfaceAudit,
      governanceDrill,
      failedPhase,
    })
    if (!detail) {
      throw new Error(`warmup verifier run ${runId} could not be read back from artifacts`)
    }
    return detail
  }

  async getLatestRun(): Promise<WarmupVerifierRunDetail | null> {
    return this.deps.artifactService.readLatestRun()
  }

  async getRun(runId: string): Promise<WarmupVerifierRunDetail | null> {
    return this.deps.artifactService.readRun(runId)
  }

  private async finalizeRun(
    runId: string,
    input: {
      kickoffDetail: KickoffBaselineDetail | null
      admissionBefore: RuntimeBaselineAdmission | null
      status: Exclude<WarmupVerifierRunStatus, 'running'>
      diagnoses: WarmupVerifierDiagnosis[]
      probeManifest: WarmupVerifierProbeManifest | null
      surfaceAudit: WarmupVerifierSurfaceAudit
      governanceDrill: WarmupVerifierGovernanceDrill
      failedPhase: WarmupVerifierRunDetail['summary']['failed_phase']
    },
  ): Promise<WarmupVerifierRunDetail | null> {
    const summary = await this.deps.artifactService.completeRun(runId, {
      status: input.status,
      failed_phase: input.failedPhase,
      kickoff_baseline_id:
        input.kickoffDetail?.id ?? input.admissionBefore?.kickoff_baseline_id ?? null,
      kickoff_baseline_label: input.kickoffDetail?.baseline_label ?? null,
      kickoff_batch_id: input.admissionBefore?.kickoff_batch_id ?? null,
      warmup_batch_id: input.admissionBefore?.warmup_batch_id ?? null,
      probe_token: input.probeManifest?.probe_token ?? null,
      probe_post_id: input.probeManifest?.post_id ?? null,
      diagnoses: input.diagnoses,
      surface_matrix: this.buildSurfaceMatrix(input.surfaceAudit),
      governance_drill: {
        quarantine_ok: input.governanceDrill.quarantine?.ok ?? null,
        restore_ok: input.governanceDrill.restore?.ok ?? null,
        cleanup_ok: input.governanceDrill.cleanup?.ok ?? null,
      },
    })
    return summary ? this.deps.artifactService.readRun(runId) : null
  }

  private async loadBaselinePostIds(admission: RuntimeBaselineAdmission): Promise<Set<string>> {
    const batchIds = [admission.kickoff_batch_id, admission.warmup_batch_id].filter(
      (value): value is string => Boolean(value),
    )
    const posts = await this.deps.postRepo.findByGovernanceBatches(batchIds)
    return new Set(posts.map((post) => post.id))
  }

  private async auditSurfaces(
    input: SurfaceAuditContext,
  ): Promise<WarmupVerifierSurfaceAuditStage> {
    const [feed, search, home, highlights] = await Promise.all([
      this.readSurfaceCheckpoint({
        surface: 'feed',
        input,
        operation: () =>
          this.deps.forumReadService.getFeed({
            sort: 'new',
            limit: 500,
            ...(input.probe_community_id ? { communityId: input.probe_community_id } : {}),
          }),
        evaluate: (payload) => this.evaluateFeed(payload, input),
      }),
      this.readSurfaceCheckpoint({
        surface: 'search',
        input,
        operation: () =>
          this.deps.searchService.search({
            query: input.probe_token,
            tab: 'posts',
            limit: 20,
          }),
        evaluate: (payload) => this.evaluateSearch(payload, input),
      }),
      this.readSurfaceCheckpoint({
        surface: 'home',
        input,
        operation: () => this.deps.homeProgrammingService.getHome({ viewer: null }),
        evaluate: (payload) => this.evaluateHome(payload, input),
      }),
      this.readSurfaceCheckpoint({
        surface: 'highlights',
        input,
        operation: () => this.deps.globalHighlightsService.collectToday(),
        evaluate: (payload) => this.evaluateHighlights(payload, input),
      }),
    ])
    return {
      stage: input.stage,
      feed,
      search,
      home,
      highlights,
    }
  }

  private async cleanupProbeVisibility(input: {
    probePostId: string
    probeCommunityId: string | null
    probeToken: string
    baselinePostIds: Set<string>
    surfaceAudit: WarmupVerifierSurfaceAudit
    addDiagnosis: (diagnosis: WarmupVerifierDiagnosis) => void
  }): Promise<WarmupVerifierGovernanceDrill['cleanup']> {
    try {
      await this.deps.postRepo.updateContent(input.probePostId, {
        visibility: 'QUARANTINE',
      })
      await this.deps.searchProjectionService?.refreshPost(input.probePostId)
      const cleanupAudit = await this.auditSurfaces({
        probe_post_id: input.probePostId,
        probe_community_id: input.probeCommunityId,
        probe_token: input.probeToken,
        baseline_post_ids: input.baselinePostIds,
        feed_expectation: 'probe_hidden',
        search_expectation: 'probe_hidden',
        stage: 'after_cleanup',
      })
      input.surfaceAudit.after_cleanup = cleanupAudit
      this.collectSurfaceDiagnoses(cleanupAudit, input.addDiagnosis)
      const ok = [
        cleanupAudit.feed,
        cleanupAudit.search,
        cleanupAudit.home,
        cleanupAudit.highlights,
      ].every((checkpoint) => checkpoint.ok)
      if (!ok) {
        input.addDiagnosis(
          createVerifierDiagnosis({
            phase: 'governance_quarantine',
            subsystem: 'warmup_governance',
            code: 'governance.cleanup.surface_check_failed',
            summary_zh: 'verifier 收尾清理后的公共读面检查失败。',
            recommended_next_check:
              '检查 probe 清理回写、search refresh，以及 cleanup 后四个公共读面的最终一致性。',
            artifact: 'governance-drill.json',
            pointer: '$.cleanup',
          }),
        )
      }
      return {
        action: 'cleanup',
        ok,
        detail: ok
          ? 'cleanup succeeded and probe is hidden from public surfaces'
          : 'cleanup completed but one or more surface checks failed',
        checked_at: new Date().toISOString(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'probe_cleanup_failed'
      input.addDiagnosis(
        createVerifierDiagnosis({
          phase: 'governance_quarantine',
          subsystem: 'warmup_governance',
          code: 'governance.cleanup.execution_failed',
          summary_zh: `verifier 收尾清理 probe 失败：${message}`,
          recommended_next_check:
            '检查 probe 清理回写、projection refresh 以及内容可见性是否仍停留在 PUBLIC/GRAY。',
          artifact: 'governance-drill.json',
          raw_reason: message,
        }),
      )
      return {
        action: 'cleanup',
        ok: false,
        detail: message,
        checked_at: new Date().toISOString(),
      }
    }
  }

  private async readSurfaceCheckpoint<T>(input: {
    surface: WarmupVerifierSurfaceCheckpoint['surface']
    operation: () => Promise<T>
    evaluate: (payload: T) => WarmupVerifierSurfaceCheckpoint
    input: SurfaceAuditContext
  }): Promise<WarmupVerifierSurfaceCheckpoint> {
    try {
      return input.evaluate(await input.operation())
    } catch (error) {
      const message = error instanceof Error ? error.message : `${input.surface}_read_failed`
      return this.createSurfaceReadFailureCheckpoint(input.surface, input.input, message)
    }
  }

  private createSurfaceReadFailureCheckpoint(
    surface: WarmupVerifierSurfaceCheckpoint['surface'],
    input: SurfaceAuditContext,
    message: string,
  ): WarmupVerifierSurfaceCheckpoint {
    return {
      surface,
      ok: false,
      expectation:
        surface === 'feed'
          ? input.feed_expectation
          : surface === 'search'
            ? input.search_expectation
            : 'baseline_content_present',
      detail: `${surface} read failed: ${message}`,
      failure_kind: 'read_exception',
      probe_post_id: input.probe_post_id,
      observed_post_ids: [],
      matched_probe: surface === 'feed' || surface === 'search' ? false : undefined,
      baseline_match_count: surface === 'home' || surface === 'highlights' ? 0 : undefined,
      checked_at: new Date().toISOString(),
    }
  }

  private evaluateFeed(
    payload: FeedPayload,
    input: SurfaceAuditContext,
  ): WarmupVerifierSurfaceCheckpoint {
    const allObservedPostIds = payload.items.map((item) => item.id)
    const matchedProbe = allObservedPostIds.includes(input.probe_post_id)
    const observedPostIds = allObservedPostIds.slice(0, 50)
    if (matchedProbe && !observedPostIds.includes(input.probe_post_id)) {
      observedPostIds.push(input.probe_post_id)
    }
    const ok = input.feed_expectation === 'probe_visible' ? matchedProbe : !matchedProbe
    return {
      surface: 'feed',
      ok,
      expectation: input.feed_expectation,
      detail:
        input.feed_expectation === 'probe_visible'
          ? `feed should contain probe post ${input.probe_post_id}`
          : `feed should hide probe post ${input.probe_post_id}`,
      probe_post_id: input.probe_post_id,
      observed_post_ids: observedPostIds,
      matched_probe: matchedProbe,
      checked_at: new Date().toISOString(),
    }
  }

  private evaluateSearch(
    payload: SearchPayload,
    input: SurfaceAuditContext,
  ): WarmupVerifierSurfaceCheckpoint {
    const observedPostIds = payload.items
      .filter(
        (item): item is SearchPayload['items'][number] & { type: 'post' } => item.type === 'post',
      )
      .map((item) => item.id)
    const matchedProbe = observedPostIds.includes(input.probe_post_id)
    const ok = input.search_expectation === 'probe_visible' ? matchedProbe : !matchedProbe
    return {
      surface: 'search',
      ok,
      expectation: input.search_expectation,
      detail:
        input.search_expectation === 'probe_visible'
          ? `search should resolve probe token ${input.probe_token}`
          : `search should hide probe token ${input.probe_token}`,
      probe_post_id: input.probe_post_id,
      observed_post_ids: observedPostIds,
      matched_probe: matchedProbe,
      checked_at: new Date().toISOString(),
    }
  }

  private evaluateHome(
    payload: HomeProgrammingPayload,
    input: SurfaceAuditContext,
  ): WarmupVerifierSurfaceCheckpoint {
    const observedPostIds = payload.shelves.flatMap((shelf) =>
      shelf.items.flatMap((item) =>
        item.item_kind === 'post' || item.item_kind === 'aftershow_recap' ? [item.id] : [],
      ),
    )
    const baselineMatchCount = observedPostIds.filter((postId) =>
      input.baseline_post_ids.has(postId),
    ).length
    const ok = payload.enabled === true && baselineMatchCount > 0
    return {
      surface: 'home',
      ok,
      expectation: 'baseline_content_present',
      detail:
        payload.enabled === true
          ? `home baseline match count=${baselineMatchCount}`
          : 'home programming is disabled',
      probe_post_id: input.probe_post_id,
      observed_post_ids: observedPostIds.slice(0, 30),
      baseline_match_count: baselineMatchCount,
      checked_at: new Date().toISOString(),
    }
  }

  private evaluateHighlights(
    payload: GlobalHighlightsPayload,
    input: SurfaceAuditContext,
  ): WarmupVerifierSurfaceCheckpoint {
    const observedPostIds = [
      ...payload.hot_threads.map((item) => item.id),
      ...payload.controversy.map((item) => item.id),
    ]
    const baselineMatchCount = observedPostIds.filter((postId) =>
      input.baseline_post_ids.has(postId),
    ).length
    const ok = config.launch.capabilities.globalHighlightsV1 === true && baselineMatchCount > 0
    return {
      surface: 'highlights',
      ok,
      expectation: 'baseline_content_present',
      detail:
        config.launch.capabilities.globalHighlightsV1 === true
          ? `highlights baseline match count=${baselineMatchCount}`
          : 'global highlights feature flag is disabled',
      probe_post_id: input.probe_post_id,
      observed_post_ids: observedPostIds.slice(0, 30),
      baseline_match_count: baselineMatchCount,
      checked_at: new Date().toISOString(),
    }
  }

  private collectSurfaceDiagnoses(
    stage: WarmupVerifierSurfaceAuditStage,
    addDiagnosis: (diagnosis: WarmupVerifierDiagnosis) => void,
  ): void {
    const failed = [stage.feed, stage.home, stage.highlights, stage.search].filter(
      (checkpoint) => !checkpoint.ok,
    )
    for (const checkpoint of failed) {
      addDiagnosis(this.createSurfaceDiagnosis(stage.stage, checkpoint))
    }
  }

  private createSurfaceDiagnosis(
    stage: WarmupVerifierSurfaceAuditStage['stage'],
    checkpoint: WarmupVerifierSurfaceCheckpoint,
  ): WarmupVerifierDiagnosis {
    const phaseMap = {
      feed: 'surface_feed',
      home: 'surface_home',
      highlights: 'surface_highlights',
      search: 'surface_search',
    } as const
    const subsystemMap = {
      feed: 'feed_read',
      home: 'home_programming',
      highlights: 'highlights_projection',
      search: 'search_projection',
    } as const
    const codePrefix = stage === 'initial' ? checkpoint.surface : `${stage}.${checkpoint.surface}`
    if (checkpoint.failure_kind === 'read_exception') {
      return createVerifierDiagnosis({
        phase: phaseMap[checkpoint.surface],
        subsystem: subsystemMap[checkpoint.surface],
        code: `surface.${codePrefix}.read_failed`,
        summary_zh: `${checkpoint.surface} 读面读取失败：${checkpoint.detail}`,
        recommended_next_check:
          checkpoint.surface === 'search'
            ? '检查 search projection 查询链路、索引服务和 search API 依赖。'
            : checkpoint.surface === 'feed'
              ? '检查 feed read service、帖子读取链路和排序窗口依赖。'
              : checkpoint.surface === 'home'
                ? '检查 home programming service、shelf 组装依赖和对应 read model。'
                : '检查 highlights 聚合服务、today window 计算和相关依赖查询。',
        artifact: 'surface-audit.json',
        pointer: `$.${stage}.${checkpoint.surface}`,
        raw_reason: checkpoint.detail,
      })
    }
    const summary =
      checkpoint.surface === 'feed' || checkpoint.surface === 'search'
        ? checkpoint.expectation === 'probe_visible'
          ? `${checkpoint.surface} 没有命中刚生成的 probe 内容。`
          : `${checkpoint.surface} 在预期隐藏后仍然能看到 probe 内容。`
        : `${checkpoint.surface} 没有读到当前 kickoff baseline 的有效编排内容。`
    return createVerifierDiagnosis({
      phase: phaseMap[checkpoint.surface],
      subsystem: subsystemMap[checkpoint.surface],
      code: `surface.${codePrefix}.${checkpoint.expectation === 'probe_hidden' ? 'unexpected_visibility' : 'missing_expected_content'}`,
      summary_zh: summary,
      recommended_next_check:
        checkpoint.surface === 'search'
          ? '检查 search projection refresh、搜索索引内容和 query 命中项。'
          : checkpoint.surface === 'feed'
            ? '检查 feed read model、内容 visibility/state 以及排序窗口。'
            : checkpoint.surface === 'home'
              ? '检查 home programming shelves、baseline 内容投影和 enabled 状态。'
              : '检查 highlights 聚合、globalHighlightsV1 开关和热榜选取结果。',
      artifact: 'surface-audit.json',
      pointer: `$.${stage}.${checkpoint.surface}`,
    })
  }

  private async runGovernanceStep(input: {
    action: 'quarantine' | 'restore'
    mutate: () => Promise<void>
    stage: SurfaceAuditContext['stage']
    surfaceContext: SurfaceAuditContext
    surfaceAudit: WarmupVerifierSurfaceAudit
    addDiagnosis: (diagnosis: WarmupVerifierDiagnosis) => void
  }): Promise<WarmupVerifierGovernanceDrill['quarantine']> {
    try {
      await input.mutate()
      const audit = await this.auditSurfaces(input.surfaceContext)
      input.surfaceAudit[input.stage] = audit
      this.collectSurfaceDiagnoses(audit, input.addDiagnosis)
      const ok = [audit.feed, audit.search, audit.home, audit.highlights].every(
        (checkpoint) => checkpoint.ok,
      )
      if (!ok) {
        input.addDiagnosis(
          createVerifierDiagnosis({
            phase: input.action === 'quarantine' ? 'governance_quarantine' : 'governance_restore',
            subsystem: 'warmup_governance',
            code: `governance.${input.action}.surface_check_failed`,
            summary_zh:
              input.action === 'quarantine'
                ? 'probe quarantine 后的可见性检查失败。'
                : 'probe restore 后的可见性恢复检查失败。',
            recommended_next_check:
              '检查内容 visibility/state 回写、projection refresh 和四个公共读面的一致性。',
            artifact: 'governance-drill.json',
            pointer: `$.${input.action}`,
          }),
        )
      }
      return {
        action: input.action,
        ok,
        detail: ok
          ? `${input.action} succeeded and all surface checks passed`
          : `${input.action} completed but one or more surface checks failed`,
        checked_at: new Date().toISOString(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `${input.action}_failed`
      input.addDiagnosis(
        createVerifierDiagnosis({
          phase: input.action === 'quarantine' ? 'governance_quarantine' : 'governance_restore',
          subsystem: 'warmup_governance',
          code: `governance.${input.action}.execution_failed`,
          summary_zh:
            input.action === 'quarantine'
              ? `probe quarantine 执行失败：${message}`
              : `probe restore 执行失败：${message}`,
          recommended_next_check:
            '检查内容回写权限、repo update 路径以及 projection refresh 调用。',
          artifact: 'governance-drill.json',
          raw_reason: message,
        }),
      )
      return {
        action: input.action,
        ok: false,
        detail: message,
        checked_at: new Date().toISOString(),
      }
    }
  }

  private buildSurfaceMatrix(surfaceAudit: WarmupVerifierSurfaceAudit) {
    return {
      feed: surfaceAudit.initial?.feed.ok ?? null,
      home: surfaceAudit.initial?.home.ok ?? null,
      highlights: surfaceAudit.initial?.highlights.ok ?? null,
      search: surfaceAudit.initial?.search.ok ?? null,
    }
  }

  private buildResultSummary(input: {
    kickoffDetail: KickoffBaselineDetail | null
    admissionBefore: RuntimeBaselineAdmission | null
    admissionAfter: RuntimeBaselineAdmission | null
    diagnoses: WarmupVerifierDiagnosis[]
    probeManifest: WarmupVerifierProbeManifest | null
    surfaceAudit: WarmupVerifierSurfaceAudit
    governanceDrill: WarmupVerifierGovernanceDrill
  }): string {
    const lines = [
      '# Warm-up Closure Verifier',
      '',
      `- kickoff baseline: ${input.kickoffDetail?.id ?? 'none'}`,
      `- kickoff baseline admission: ${input.admissionBefore?.kickoff_baseline_id ?? 'none'}`,
      `- probe post: ${input.probeManifest?.post_id ?? 'none'}`,
      `- probe token: ${input.probeManifest?.probe_token ?? 'none'}`,
      `- diagnoses: ${input.diagnoses.length}`,
      `- feed/home/highlights/search: ${[
        input.surfaceAudit.initial?.feed.ok ?? false,
        input.surfaceAudit.initial?.home.ok ?? false,
        input.surfaceAudit.initial?.highlights.ok ?? false,
        input.surfaceAudit.initial?.search.ok ?? false,
      ]
        .map((value) => (value ? 'ok' : 'fail'))
        .join(' / ')}`,
      `- governance quarantine: ${input.governanceDrill.quarantine?.ok === true ? 'ok' : input.governanceDrill.quarantine?.ok === false ? 'fail' : 'n/a'}`,
      `- governance restore: ${input.governanceDrill.restore?.ok === true ? 'ok' : input.governanceDrill.restore?.ok === false ? 'fail' : 'n/a'}`,
      `- governance cleanup: ${input.governanceDrill.cleanup?.ok === true ? 'ok' : input.governanceDrill.cleanup?.ok === false ? 'fail' : 'n/a'}`,
      `- public growth before: ${input.admissionBefore?.allow_public_growth === true ? 'allowed' : 'blocked'}`,
      `- public growth after: ${input.admissionAfter?.allow_public_growth === true ? 'allowed' : 'blocked'}`,
    ]
    if (input.diagnoses[0]) {
      lines.push('', `Top diagnosis: ${input.diagnoses[0].code} ${input.diagnoses[0].summary_zh}`)
    }
    return lines.join('\n')
  }

  private async persistDiagnoses(
    runId: string,
    diagnoses: WarmupVerifierDiagnosis[],
    recordFailure: (
      phase: WarmupVerifierFailureLogEntry['phase'],
      message: string,
    ) => Promise<void>,
  ): Promise<{ ok: boolean }> {
    try {
      await this.deps.artifactService.writeDiagnosis(runId, sortDiagnoses(diagnoses))
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'diagnosis_write_failed'
      await recordFailure('artifact_persist', message)
      return { ok: false }
    }
  }

  private async tryWriteArtifact(
    label: string,
    writer: () => Promise<unknown>,
    diagnoses: WarmupVerifierDiagnosis[],
    recordFailure: (
      phase: WarmupVerifierFailureLogEntry['phase'],
      message: string,
    ) => Promise<void>,
  ): Promise<boolean> {
    try {
      await writer()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : `${label}_write_failed`
      diagnoses.push(
        createVerifierDiagnosis({
          phase: 'artifact_persist',
          subsystem: 'artifact_storage',
          code: `artifact.${label}_write_failed`,
          summary_zh: `artifact 写入失败：${label}`,
          recommended_next_check:
            '检查 .ai/.tmp/warmup-runs 目录权限、磁盘状态和 artifact service 调用栈。',
          artifact: 'failure-log.json',
          raw_reason: message,
        }),
      )
      await recordFailure('artifact_persist', message)
      return false
    }
  }
}
