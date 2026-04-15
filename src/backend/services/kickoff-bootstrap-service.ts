import { execFileSync } from 'node:child_process'
import type {
  KickoffBootstrapMode,
  KickoffBootstrapResult,
  KickoffProfileId,
} from '../../shared/kickoff-workflow.js'
import { assertSafeDevSeedResetEnvironment } from '../dev/dev-seed-reset.js'
import {
  readKickoffQualityProfile,
  readKickoffWorkflowManifest,
  readKickoffWorkflowProfile,
} from '../launch/kickoff-workflow.js'
import { ValidationError } from '../lib/errors.js'
import { devDataOperationLock } from './dev-data-operation-lock.js'
import type { KickoffRunArtifactService } from './kickoff-run-artifact-service.js'
import type { KickoffRuntimeReadinessService } from './kickoff-runtime-readiness-service.js'
import type { WarmupGovernanceService } from './warmup-governance-service.js'

export class KickoffBootstrapService {
  constructor(
    private readonly deps: {
      warmupGovernanceService: Pick<
        WarmupGovernanceService,
        'createLaunchSuite' | 'reviewSuite' | 'getSuiteDetail'
      >
      runtimeReadinessService: KickoffRuntimeReadinessService
      runArtifactService: KickoffRunArtifactService
      refreshPersistenceState?: (() => Promise<void>) | null
    },
  ) {}

  async bootstrap(input: {
    mode: KickoffBootstrapMode
    suite_label?: string | null
    profile_id: KickoffProfileId
    max_runtime_topup_posts?: number
    reset_before_bootstrap?: boolean
  }): Promise<KickoffBootstrapResult> {
    readKickoffWorkflowManifest()
    readKickoffQualityProfile()
    const profile = readKickoffWorkflowProfile(input.profile_id)
    if (profile.mode !== input.mode) {
      throw new ValidationError(
        `Kickoff bootstrap mode "${input.mode}" does not match profile "${input.profile_id}" mode "${profile.mode}"`,
      )
    }

    const lockToken = devDataOperationLock.acquire({
      kind: 'kickoff_bootstrap',
      label: input.profile_id,
    })

    let failedPhase: string | null = null
    let runId: string | null = null
    try {
      const run = await this.deps.runArtifactService.createRun({
        run_type: 'bootstrap',
        mode: input.mode,
        profile_id: input.profile_id,
        suite_label: input.suite_label ?? null,
      })
      runId = run.run_id
      devDataOperationLock.update(lockToken, { label: run.run_id })

      await this.deps.runArtifactService.writeContextPack(run.run_id, {
        phase: 'bootstrap',
        requested_mode: input.mode,
        profile,
        reset_before_bootstrap:
          input.reset_before_bootstrap ?? profile.bootstrap.reset_before_bootstrap,
      })

      const shouldReset =
        input.reset_before_bootstrap ?? profile.bootstrap.reset_before_bootstrap
      if (shouldReset) {
        failedPhase = 'reset'
        this.resetAndSeedLaunch()
        if (this.deps.refreshPersistenceState) {
          failedPhase = 'rehydrate'
          await this.deps.refreshPersistenceState()
        }
      }

      failedPhase = 'create_suite'
      const launchResult = await this.deps.warmupGovernanceService.createLaunchSuite({
        suite_label: input.suite_label ?? null,
        max_runtime_topup_posts:
          input.max_runtime_topup_posts ?? profile.bootstrap.max_runtime_topup_posts,
      })

      let suiteDetail = await this.deps.warmupGovernanceService.getSuiteDetail(
        launchResult.suite_id,
      )
      if (input.mode === 'active') {
        failedPhase = 'activate'
        const reviewed = await this.deps.warmupGovernanceService.reviewSuite({
          suite_id: launchResult.suite_id,
          decision: 'pass_to_active',
          reason_codes: [],
          note: 'local kickoff bootstrap activation',
          confirm_activation: true,
        })
        suiteDetail = reviewed.suite
      }

      const readiness = await this.deps.runtimeReadinessService.buildForSuite(
        suiteDetail.id,
      )
      await this.deps.runArtifactService.writeReadiness(run.run_id, readiness)
      await this.deps.runArtifactService.writeDiffSummary(
        run.run_id,
        [
          '# Kickoff Bootstrap',
          `- mode: ${input.mode}`,
          `- suite: ${suiteDetail.id}`,
          `- state: ${suiteDetail.state}`,
          `- activation_readiness: ${
            readiness.activation_readiness.ok ? 'ok' : 'blocked'
          }`,
        ].join('\n'),
      )

      const baselineId = suiteDetail.active_baseline?.is_current
        ? suiteDetail.active_baseline.id
        : null
      await this.deps.runArtifactService.recordDataMode({
        mode: input.mode === 'active' ? 'kickoff-active' : 'kickoff-candidate',
        profile: input.profile_id,
        suite_id: suiteDetail.id,
        suite_label: suiteDetail.suite_label,
        baseline_id: baselineId,
      })
      await this.deps.runArtifactService.completeRun(run.run_id, {
        suite_id: suiteDetail.id,
        suite_label: suiteDetail.suite_label,
        kickoff_batch_id: suiteDetail.kickoff_batch_id,
        warmup_batch_id: suiteDetail.warmup_batch_id,
        baseline_id: baselineId,
        failed_phase: null,
      })

      return {
        mode: input.mode,
        suite_id: suiteDetail.id,
        suite_label: suiteDetail.suite_label,
        kickoff_batch_id: suiteDetail.kickoff_batch_id,
        warmup_batch_id: suiteDetail.warmup_batch_id,
        baseline_id: baselineId,
        counts: readiness.quality_state.summary,
        readiness,
        reused_existing_suite: launchResult.reused_existing_suite,
        failed_phase: null,
        run_id: run.run_id,
      }
    } catch (error) {
      if (runId) {
        await this.deps.runArtifactService.writeFailureLog(runId, {
          failed_phase: failedPhase,
          message: error instanceof Error ? error.message : String(error),
        })
        await this.deps.runArtifactService.completeRun(runId, {
          failed_phase: failedPhase,
        })
      }
      throw error
    } finally {
      devDataOperationLock.release(lockToken)
    }
  }

  private resetAndSeedLaunch(): void {
    assertSafeDevSeedResetEnvironment({})
    const env = {
      ...process.env,
      DB_PERSISTENCE: process.env.DB_PERSISTENCE ?? 'true',
    }

    const commands: Array<[string, string[]]> = [
      ['pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force']],
      ['pnpm', ['db:generate']],
      ['pnpm', ['seed', '--', '--profile=launch']],
    ]
    for (const [command, args] of commands) {
      execFileSync(command, args, {
        stdio: 'inherit',
        env,
      })
    }
  }
}
