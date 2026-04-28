process.env.DB_PERSISTENCE ??= 'true'
process.env.FF_ACHIEVEMENT_CHRONICLE_V1 = 'true'
process.env.FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS = 'true'
process.env.FF_AFTERSHOW_V1 = 'true'
process.env.FF_AFTERSHOW_EVENT_PIPELINE_V1 = 'true'

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

type Step = 'all' | 'bio' | 'chronicle' | 'aftershow' | 'projection' | 'biography'

function parseStep(): Step {
  const raw = readArg('step')?.toLowerCase()
  if (!raw || raw === 'all') return 'all'
  if (raw === 'bio' || raw === 'chronicle' || raw === 'aftershow' || raw === 'projection' || raw === 'biography') {
    return raw
  }
  throw new Error(`unknown --step=${raw}; expected one of: all, bio, chronicle, aftershow, projection, biography`)
}

async function main() {
  const step = parseStep()
  const force = readBoolFlag('force')
  const [
    { closeRuntimeInfrastructure, warmPersistenceState, launchEnrichmentService },
    { disconnectPrisma },
  ] = await Promise.all([
    import('../container.js'),
    import('../persistence/prisma-client.js'),
  ])

  try {
    await warmPersistenceState()
    const now = new Date()

    if (step === 'all') {
      const report = await launchEnrichmentService.runAll(now, { force })
      console.log(JSON.stringify({ force, ...report }, null, 2))
    } else if (step === 'bio') {
      const preflight = await launchEnrichmentService.preflight()
      const result = await launchEnrichmentService.refreshAllBios(
        preflight.active_agent_count,
        now,
        { force },
      )
      console.log(JSON.stringify({ step, force, preflight, result }, null, 2))
    } else if (step === 'chronicle') {
      const preflight = await launchEnrichmentService.preflight()
      const result = await launchEnrichmentService.materializeChronicles(now)
      console.log(JSON.stringify({ step, preflight, result }, null, 2))
    } else if (step === 'aftershow') {
      const preflight = await launchEnrichmentService.preflight()
      const result = await launchEnrichmentService.materializeAftershow(now)
      console.log(JSON.stringify({ step, preflight, result }, null, 2))
    } else if (step === 'projection') {
      const preflight = await launchEnrichmentService.preflight()
      const result = await launchEnrichmentService.refreshAllPublicProjections()
      console.log(JSON.stringify({ step, preflight, result }, null, 2))
    } else {
      const preflight = await launchEnrichmentService.preflight()
      const result = await launchEnrichmentService.compileAllBiographies(now, { force })
      console.log(JSON.stringify({ step, force, preflight, result }, null, 2))
    }

    console.log(
      '\n[hint] FF_ACHIEVEMENT_CHRONICLE_V1=true and FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS=true were set IN-PROCESS only.',
    )
    console.log(
      '[hint] FF_AFTERSHOW_V1=true and FF_AFTERSHOW_EVENT_PIPELINE_V1=true were set IN-PROCESS only for promote preflight materialization.',
    )
    console.log(
      '[hint] To keep chronicle / aftershow accumulating in the deployed runtime, add those flags to ops/deploy/env-files/<env>.env before next deploy.',
    )
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
    console.error('[launch.enrichment] failed', error)
    process.exit(1)
  })
