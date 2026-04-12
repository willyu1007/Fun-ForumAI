process.env.DB_PERSISTENCE ??= 'true'

function readNumberArg(name: string): number | undefined {
  const prefix = `--${name}=`
  const raw = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length)
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function main() {
  const maxRuntimeTopupPosts = readNumberArg('runtime-topup-posts') ?? 0
  const [
    {
      agentCommunityMembershipService,
      agentConfigRepo,
      agentRepo,
      communityRepo,
      forumWriteService,
      homeProgrammingService,
      launchProgrammingOpsService,
      postRepo,
      postScheduler,
      runtimeLoop,
      stageTierService,
      warmupGovernanceService,
      warmPersistenceState,
    },
    { runLaunchWarmStart },
  ] = await Promise.all([
    import('../container.js'),
    import('../launch/launch-warm-start.js'),
  ])

  await warmPersistenceState()

  const result = await runLaunchWarmStart({
    agentRepo,
    agentConfigRepo,
    communityRepo,
    postRepo,
    membershipService: agentCommunityMembershipService,
    stageTierService,
    forumWriteService,
    homeProgrammingService,
    launchProgrammingOpsService,
    runtimeLoop,
    postScheduler,
    warmupExecutor: warmupGovernanceService,
  }, {
    max_runtime_topup_posts: maxRuntimeTopupPosts,
  })

  console.log(JSON.stringify(result, null, 2))

  if (!result.verification.ok) {
    throw new Error(`launch warm-start thresholds not met: ${result.verification.missing.join('; ')}`)
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[launch:warm-start] failed', error)
    process.exit(1)
  })
