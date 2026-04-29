process.env.DB_PERSISTENCE ??= 'true'
// Read-only probe needs the chronicle gate ON to surface persisted entries.
// The flag is consumed by config at module-load time, so set it before any container import.
process.env.FF_ACHIEVEMENT_CHRONICLE_V1 ??= 'true'

import { spawnSync } from 'node:child_process'
import { resolve as resolvePath } from 'node:path'
import { countProductSafePublicChronicleEntries } from '../services/chronicle-product-safety.js'

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const raw = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length)
  if (!raw) return undefined
  const value = raw.trim()
  return value.length > 0 ? value : undefined
}

function readBoolFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function readNumberArg(name: string): number | undefined {
  const raw = readArg(name)
  if (!raw) return undefined
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid numeric value for --${name}: ${raw}`)
  }
  return parsed
}

function canRunCommand(command: string): boolean {
  const probe = spawnSync(command, ['--version'], { stdio: 'ignore' })
  return probe.status === 0
}

interface RequiredArgs {
  env: string
  webBaseUrl: string
  workerBaseUrl: string
  adminToken: string
}

function readRequiredArgs(): RequiredArgs {
  const env = readArg('env')
  const webBaseUrl = readArg('web-base-url') ?? process.env.LAUNCH_WEB_BASE_URL
  const workerBaseUrl = readArg('worker-base-url') ?? process.env.LAUNCH_WORKER_BASE_URL
  const adminToken = readArg('admin-token') ?? process.env.LAUNCH_ADMIN_TOKEN
  const missing: string[] = []
  if (!env) missing.push('--env')
  if (!webBaseUrl) missing.push('--web-base-url (or LAUNCH_WEB_BASE_URL)')
  if (!workerBaseUrl) missing.push('--worker-base-url (or LAUNCH_WORKER_BASE_URL)')
  if (!adminToken) missing.push('--admin-token (or LAUNCH_ADMIN_TOKEN)')
  if (missing.length > 0) {
    throw new Error(`missing required arg(s): ${missing.join(', ')}`)
  }
  return {
    env: env!,
    webBaseUrl: webBaseUrl!,
    workerBaseUrl: workerBaseUrl!,
    adminToken: adminToken!,
  }
}

interface ArtifactProbe {
  agent_id: string
  has_bio_projection: boolean
  has_biography_chapters: boolean
  chronicle_count: number
  product_safe_chronicle_count: number
}

interface RuntimeStatsResponse {
  data?: {
    runtime?: {
      baseline_admission?: {
        worker_health_ok?: boolean
        llm_credentials_ok?: boolean
        allow_public_growth?: boolean
      }
    }
  }
}

function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new Error(`${url} returned ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function probeWorkerRuntimeStats(workerBaseUrl: string, adminToken: string): Promise<RuntimeStatsResponse> {
  return fetchJson<RuntimeStatsResponse>(buildUrl(workerBaseUrl, '/v1/admin/runtime/stats'), {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  })
}

async function probeEnrichmentArtifacts(): Promise<ArtifactProbe[]> {
  const { agentRepo, agentBioRefreshService, achievementChronicleService, agentBiographyService, chronicleRepo } =
    await import('../container.js')
  const page = agentRepo.findActive({ limit: 3 })
  const probes: ArtifactProbe[] = []
  for (const agent of page.items) {
    const projection = await agentBioRefreshService.getProjection(agent.id).catch(() => null)
    const book = await agentBiographyService.getBook({
      agent_id: agent.id,
      public_only: true,
      suppress_page_open_compensation: true,
    }).catch(() => null)
    const chronicle = await achievementChronicleService
      .listChronicleForOwner(agent.id, { include_folded: false, limit: 4 })
      .catch(() => ({ items: [] as unknown[] }))
    const productSafeChronicleCount = await countProductSafePublicChronicleEntries(chronicleRepo, agent.id)
    probes.push({
      agent_id: agent.id,
      has_bio_projection: Boolean(projection),
      has_biography_chapters: (book?.chapters?.length ?? 0) > 0,
      chronicle_count: chronicle.items.length,
      product_safe_chronicle_count: productSafeChronicleCount,
    })
  }
  return probes
}

async function main() {
  const args = readRequiredArgs()
  const autoMark = readBoolFlag('auto-mark')
  const allowMissingEnrichment = readBoolFlag('allow-missing-enrichment')
  const force = readBoolFlag('force')
  const reason = readArg('reason')
  const ttlHours = readNumberArg('ttl-hours') ?? 24
  const imageRef = readArg('image-ref')
  const target = readArg('target') ?? 'eci_worker'
  const operator = readArg('operator') ?? process.env.USER ?? 'launch.gray.promote'

  const [{ closeRuntimeInfrastructure, warmPersistenceState, warmupGovernanceService }, { disconnectPrisma }] =
    await Promise.all([import('../container.js'), import('../persistence/prisma-client.js')])

  try {
    await warmPersistenceState()
    const workerStats = await probeWorkerRuntimeStats(args.workerBaseUrl, args.adminToken)
    const workerAdmission = workerStats.data?.runtime?.baseline_admission
    if (!workerAdmission?.worker_health_ok) {
      throw new Error('worker health check failed: runtime worker is not healthy')
    }
    if (!workerAdmission.llm_credentials_ok) {
      throw new Error('worker health check failed: LLM credentials are not configured')
    }

    // 1. kickoff baseline must already exist.
    const admission = await warmupGovernanceService.getRuntimeBaselineAdmission()
    if (!admission.has_kickoff_baseline) {
      throw new Error('kickoff baseline is missing: run launch.kickoff first')
    }

    let probes: ArtifactProbe[] = []
    if (force) {
      if (!reason) {
        throw new Error('--force requires --reason=<operator rationale>')
      }
      if (ttlHours <= 0) {
        throw new Error('--ttl-hours must be greater than 0')
      }
      await warmupGovernanceService.forcePromoteRuntimeToAutonomous({
        reason,
        actor_user_id: operator,
        expires_at: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
      })
    } else {
      // 2. natural readiness must already be true (kickoff + warmup + programming health).
      if (!admission.natural_allow_public_growth) {
        throw new Error(
          `natural admission not granted: ${admission.natural_reasons.join(', ') || 'unknown reasons'}`,
        )
      }

      // 3. enrichment artifact check — require every probed agent to carry
      //    bio projection + biography chapters + product-safe chronicle. Fail unless
      //    --allow-missing-enrichment is passed.
      let probeError: unknown = null
      try {
        probes = await probeEnrichmentArtifacts()
      } catch (err) {
        probeError = err
      }
      const missing = probes.filter(
        (probe) =>
          !probe.has_bio_projection
          || !probe.has_biography_chapters
          || probe.product_safe_chronicle_count === 0,
      )
      if (probeError || probes.length === 0 || missing.length > 0) {
        const detail = probeError
          ? `probe threw: ${probeError instanceof Error ? probeError.message : String(probeError)}`
          : probes.length === 0
            ? 'no active agents available to probe'
            : `${missing.length}/${probes.length} probed agents missing enrichment artifacts: ${JSON.stringify(missing)}`
        if (!allowMissingEnrichment) {
          throw new Error(
            `enrichment artifact check failed: ${detail}. Run launch.enrichment first, or pass --allow-missing-enrichment to override.`,
          )
        }
        console.warn(`[launch.gray.promote] enrichment artifact check skipped: ${detail}`)
      }

      // 4. run verify:launch:staging through the available package runner.
      const verifyTailArgs = [
        `--web-base-url=${args.webBaseUrl}`,
        `--worker-base-url=${args.workerBaseUrl}`,
      ]
      const verifyCommand = canRunCommand('pnpm') ? 'pnpm' : 'npm'
      const verifyArgs =
        verifyCommand === 'pnpm'
          ? ['verify:launch:staging', '--', ...verifyTailArgs]
          : ['run', 'verify:launch:staging', '--', ...verifyTailArgs]
      console.log(`[launch.gray.promote] running: ${verifyCommand} ${verifyArgs.join(' ')}`)
      const verify = spawnSync(verifyCommand, verifyArgs, {
        stdio: 'inherit',
        cwd: resolvePath(process.cwd()),
        env: {
          ...process.env,
          LAUNCH_ADMIN_TOKEN: args.adminToken,
        },
      })
      if (verify.status !== 0) {
        throw new Error(`verify:launch:staging exited with status ${verify.status}`)
      }

      await warmupGovernanceService.promoteRuntimeToAutonomous({
        actor_user_id: operator,
      })
    }

    const promotedAdmission = await warmupGovernanceService.getRuntimeBaselineAdmission()

    // 5. release-intent mark-target — print or auto-execute
    const markCmd = [
      'node',
      'ops/deploy/scripts/release-intent.mjs',
      'mark-target',
      `--env=${args.env}`,
      `--target=${target}`,
      '--status=applied',
      ...(imageRef ? [`--image-ref=${imageRef}`] : []),
    ]
    if (autoMark) {
      if (!imageRef) {
        throw new Error('--auto-mark requires --image-ref=<acr/...:sha-...>')
      }
      console.log(`[launch.gray.promote] running: ${markCmd.join(' ')}`)
      const mark = spawnSync(markCmd[0], markCmd.slice(1), {
        stdio: 'inherit',
        cwd: resolvePath(process.cwd()),
      })
      if (mark.status !== 0) {
        throw new Error(`release-intent mark-target exited with status ${mark.status}`)
      }
    } else {
      console.log('[launch.gray.promote] skipping release-intent mark (no --auto-mark).')
      console.log('[launch.gray.promote] to mark manually, run:')
      console.log(`  ${markCmd.join(' ')}`)
      console.log('  (add --image-ref=<acr/...:sha-...> when status is applied)')
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          env: args.env,
          mode: force ? 'force' : 'standard',
          admission: {
            runtime_mode: promotedAdmission.runtime_mode,
            kickoff_layer_ready: promotedAdmission.kickoff_layer_ready,
            warmup_layer_ready: promotedAdmission.warmup_layer_ready,
            natural_allow_public_growth: promotedAdmission.natural_allow_public_growth,
            growth_admission: promotedAdmission.growth_admission,
            allow_public_growth: promotedAdmission.allow_public_growth,
            active_override: promotedAdmission.active_override,
            natural_reasons: promotedAdmission.natural_reasons,
            reasons: promotedAdmission.reasons,
          },
          artifact_probes: probes,
          allow_missing_enrichment: allowMissingEnrichment,
          auto_mark: autoMark,
          ttl_hours: force ? ttlHours : null,
        },
        null,
        2,
      ),
    )
    console.log('[launch.gray.promote] OK; runtime mode cutover completed.')
  } finally {
    await closeRuntimeInfrastructure()
    await disconnectPrisma()
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[launch.gray.promote] failed', error)
    process.exit(1)
  })
