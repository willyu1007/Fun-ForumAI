process.env.DB_PERSISTENCE ??= 'true'

let closeRuntimeInfrastructure: (() => Promise<void>) | null = null
let disconnectPrisma: (() => Promise<void>) | null = null

function readStringArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const raw = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length)
  if (!raw) return undefined
  const value = raw.trim()
  return value.length > 0 ? value : undefined
}

async function main() {
  const baselineLabel = readStringArg('baseline-label')
  const createdByUserId = readStringArg('created-by-user-id')
  const manifestPath = readStringArg('manifest-path')
  const [
    { warmPersistenceState, warmupGovernanceService, closeRuntimeInfrastructure: closeInfra },
    { disconnectPrisma: disconnectDb, getPrismaClient },
    { resetNonGovernedDevSeedPublicFixtures },
  ] =
    await Promise.all([
      import('../container.js'),
      import('../persistence/prisma-client.js'),
      import('./dev-seed-runner.js'),
    ])
  closeRuntimeInfrastructure = closeInfra
  disconnectPrisma = disconnectDb

  await warmPersistenceState()
  await resetNonGovernedDevSeedPublicFixtures(getPrismaClient())

  const result = await warmupGovernanceService.importKickoffBaseline({
    baseline_label: baselineLabel ?? null,
    created_by_user_id: createdByUserId ?? null,
    manifest_path: manifestPath ?? null,
  })

  console.log(JSON.stringify(result, null, 2))

  if (!result.verification.ok) {
    throw new Error(`launch kickoff thresholds not met: ${result.verification.missing.join('; ')}`)
  }
}

main()
  .then(async () => {
    await Promise.allSettled([
      closeRuntimeInfrastructure?.() ?? Promise.resolve(),
      disconnectPrisma?.() ?? Promise.resolve(),
    ])
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('[launch.kickoff] failed', error)
    await Promise.allSettled([
      closeRuntimeInfrastructure?.() ?? Promise.resolve(),
      disconnectPrisma?.() ?? Promise.resolve(),
    ])
    process.exit(1)
  })
