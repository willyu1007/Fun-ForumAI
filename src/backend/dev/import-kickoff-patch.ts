import { readFile } from 'node:fs/promises'
import { parse as parseYaml } from 'yaml'
import { resolveKickoffPatchPackPath } from '../launch/kickoff-workflow.js'
import { ValidationError } from '../lib/errors.js'
import { kickoffAuthoringPatchSchema } from '../validation/kickoff-schemas.js'
import type { KickoffProfileId } from '../../shared/kickoff-workflow.js'

function readFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function readStringArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const value = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length)
  return value?.trim() ? value.trim() : undefined
}

async function loadPatch(input: { patchPackId: string; patchPath?: string }) {
  const resolvedPath = input.patchPath
    ? input.patchPath
    : resolveKickoffPatchPackPath(input.patchPackId)

  if (!resolvedPath) {
    throw new ValidationError(`Unknown kickoff patch pack: ${input.patchPackId}`)
  }

  const raw = await readFile(resolvedPath, 'utf8')
  return {
    path: resolvedPath,
    patch: kickoffAuthoringPatchSchema.parse(parseYaml(raw)),
  }
}

async function main() {
  process.env.DB_PERSISTENCE ??= 'true'

  const patchPackId = readStringArg('patch-pack-id')
  const patchPath = readStringArg('patch-path')
  const profileId = (readStringArg('profile-id') ??
    'local-llm-assisted-candidate') as KickoffProfileId
  const dryRun = !readFlag('apply')
  const debug = readFlag('debug')

  if (!patchPackId && !patchPath) {
    throw new ValidationError(
      'Kickoff patch import now requires an explicit --patch-pack-id=<id> or --patch-path=<path>.',
    )
  }

  const loaded = await loadPatch({
    patchPackId: patchPackId ?? '__unused__',
    patchPath,
  })

  const [
    { KickoffPatchImportService },
    {
      agentRepo,
      aftershowService,
      communityRepo,
      forumWriteService,
      kickoffRunArtifactService,
      kickoffRuntimeReadinessService,
      mediaAssetControlService,
      postMediaRepo,
      postRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
      searchProjectionService,
      warmPersistenceState,
      warmupGovernanceRepo,
      warmupGovernanceService,
    },
  ] = await Promise.all([
    import('../services/kickoff-patch-import-service.js'),
    import('../container.js'),
  ])

  await warmPersistenceState()

  if (debug) {
    const repoSuites = await warmupGovernanceRepo.listSuites()
    console.log(
      JSON.stringify(
        {
          database_url: process.env.DATABASE_URL ?? null,
          patch_pack_id: patchPackId ?? null,
          patch_path: patchPath ?? null,
          repo_suite_count: repoSuites.length,
          repo_suites: repoSuites.map((suite) => ({
            id: suite.id,
            state: suite.state,
            suite_label: suite.suite_label,
          })),
        },
        null,
        2,
      ),
    )
  }

  const importService = new KickoffPatchImportService({
    warmupGovernanceService: {
      listSuites: async () => {
        const suites = await warmupGovernanceRepo.listSuites()
        return Promise.all(
          suites.map(async (suite) => {
            const detail = await warmupGovernanceService.getSuiteDetail(suite.id)
            return {
              id: detail.id,
              state: detail.state,
              suite_label: detail.suite_label,
            }
          }),
        )
      },
      getSuiteDetail: warmupGovernanceService.getSuiteDetail.bind(warmupGovernanceService),
      getRuntimeBaselineAdmission:
        warmupGovernanceService.getRuntimeBaselineAdmission.bind(warmupGovernanceService),
    },
    warmupGovernanceRepo,
    communityRepo,
    agentRepo,
    postRepo,
    publicStageThreadRepo,
    publicStageTurnRepo,
    postMediaRepo,
    forumWriteService,
    mediaAssetControlService,
    aftershowService,
    searchProjectionService,
    runtimeReadinessService: kickoffRuntimeReadinessService,
    runArtifactService: kickoffRunArtifactService,
  })

  const report = await importService.importPatch({
    dry_run: dryRun,
    patch_pack_id: patchPackId ?? null,
    patch: loaded.patch,
    profile_id: profileId,
  })

  console.log(
    JSON.stringify(
      {
        patch_pack_id: patchPackId,
        patch_path: loaded.path,
        dry_run: report.report_meta.dry_run,
        run_id: report.report_meta.run_id,
        suite_id: report.resolved_context.suite_id,
        suite_label: report.resolved_context.suite_label,
        failed_phase: report.failure_phase,
        summary_after_import: report.summary_after_import,
        activation_readiness: report.readiness_snapshot.activation_readiness,
        recommended_next_actions: report.recommended_next_actions,
        artifact_dir: report.observability.artifact_dir,
      },
      null,
      2,
    ),
  )
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[kickoff:import:patch] failed', error)
    process.exit(1)
  })
