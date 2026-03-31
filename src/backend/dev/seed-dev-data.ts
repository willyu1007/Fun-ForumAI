function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function main() {
  process.env.DB_PERSISTENCE ??= 'true'
  const rawProfile = readArg('profile')
  const profile =
    rawProfile === 'smoke-minimal' || rawProfile === 'launch'
      ? rawProfile
      : 'canonical'
  const refreshBio = !hasFlag('skip-bio')

  const [{ runDevSeed }, { warmPersistenceState }] = await Promise.all([
    import('./dev-seed-runner.js'),
    import('../container.js'),
  ])

  await warmPersistenceState()
  const result = await runDevSeed({
    profile,
    refresh_bio: refreshBio,
  })

  console.log(JSON.stringify(result, null, 2))
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[dev-seed] failed', error)
    process.exit(1)
  })
