process.env.DB_PERSISTENCE ??= 'true'
// Read-only probe needs the chronicle gate ON to surface persisted entries.
// The flag is consumed by config at module-load time, so set it before any container import.
process.env.FF_ACHIEVEMENT_CHRONICLE_V1 ??= 'true'

import { spawnSync } from 'node:child_process'
import { resolve as resolvePath } from 'node:path'

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
}

async function probeEnrichmentArtifacts(): Promise<ArtifactProbe[]> {
  const { agentRepo, agentBioRefreshService, achievementChronicleService, agentBiographyService } =
    await import('../container.js')
  const page = agentRepo.findActive({ limit: 3 })
  const probes: ArtifactProbe[] = []
  for (const agent of page.items) {
    const projection = await agentBioRefreshService.getProjection(agent.id).catch(() => null)
    const book = await agentBiographyService.getBook({
      agent_id: agent.id,
      suppress_page_open_compensation: true,
    }).catch(() => null)
    const chronicle = await achievementChronicleService
      .listChronicleForOwner(agent.id, { include_folded: false, limit: 4 })
      .catch(() => ({ items: [] as unknown[] }))
    probes.push({
      agent_id: agent.id,
      has_bio_projection: Boolean(projection),
      has_biography_chapters: (book?.chapters?.length ?? 0) > 0,
      chronicle_count: chronicle.items.length,
    })
  }
  return probes
}

async function main() {
  const args = readRequiredArgs()
  const autoMark = readBoolFlag('auto-mark')
  const allowMissingEnrichment = readBoolFlag('allow-missing-enrichment')
  const imageRef = readArg('image-ref')
  const target = readArg('target') ?? 'eci_worker'

  const [{ closeRuntimeInfrastructure, warmPersistenceState, warmupGovernanceService }, { disconnectPrisma }] =
    await Promise.all([import('../container.js'), import('../persistence/prisma-client.js')])

  try {
    await warmPersistenceState()

    // 1. admission must already be true (kickoff + warmup + programming health)
    const admission = await warmupGovernanceService.getRuntimeBaselineAdmission()
    if (!admission.allow_public_growth) {
      throw new Error(
        `admission not granted: ${admission.reasons.join(', ') || 'unknown reasons'}`,
      )
    }

    // 2. enrichment artifact check — require every probed agent to carry
    //    bio projection + biography chapters + chronicle entries. Fail unless
    //    --allow-missing-enrichment is passed.
    let probes: ArtifactProbe[] = []
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
        || probe.chronicle_count === 0,
    )
    if (probeError || probes.length === 0 || missing.length > 0) {
      const detail = probeError
        ? `probe threw: ${probeError instanceof Error ? probeError.message : String(probeError)}`
        : probes.length === 0
          ? 'no active agents available to probe'
          : `${missing.length}/${probes.length} probed agents missing enrichment artifacts: ${JSON.stringify(missing)}`
      if (!allowMissingEnrichment) {
        throw new Error(
          `enrichment artifact check failed: ${detail}. Run \`pnpm launch.enrichment\` first, or pass --allow-missing-enrichment to override.`,
        )
      }
      console.warn(`[launch.gray.promote] enrichment artifact check skipped: ${detail}`)
    }

    // 3. spawn pnpm verify:launch:staging
    const verifyArgs = [
      'verify:launch:staging',
      '--',
      `--web-base-url=${args.webBaseUrl}`,
      `--worker-base-url=${args.workerBaseUrl}`,
    ]
    console.log(`[launch.gray.promote] running: pnpm ${verifyArgs.join(' ')}`)
    const verify = spawnSync('pnpm', verifyArgs, {
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

    // 4. release-intent mark-target — print or auto-execute
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
          admission: {
            kickoff_layer_ready: admission.kickoff_layer_ready,
            warmup_layer_ready: admission.warmup_layer_ready,
            allow_public_growth: admission.allow_public_growth,
          },
          artifact_probes: probes,
          allow_missing_enrichment: allowMissingEnrichment,
          auto_mark: autoMark,
        },
        null,
        2,
      ),
    )
    console.log('[launch.gray.promote] OK; runtime is in normal-operation mode (allow_public_growth=true).')
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
