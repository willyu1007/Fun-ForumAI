process.env.DB_PERSISTENCE ??= 'true'

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
    { closeRuntimeInfrastructure, warmPersistenceState, warmupGovernanceService },
    { disconnectPrisma, getPrismaClient },
    { resetNonGovernedDevSeedPublicFixtures },
  ] =
    await Promise.all([
      import('../container.js'),
      import('../persistence/prisma-client.js'),
      import('./dev-seed-runner.js'),
    ])

  try {
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
    console.error('[launch.kickoff] failed', error)
    process.exit(1)
  })
