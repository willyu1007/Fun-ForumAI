process.env.DB_PERSISTENCE ??= 'true'

async function main() {
  const [{ agentCommunityMembershipService, agentConfigRepo, agentRepo, communityRepo, warmPersistenceState }, { bootstrapLaunchRosterMemberships }] = await Promise.all([
    import('../container.js'),
    import('../launch/launch-membership-bootstrap.js'),
  ])

  await warmPersistenceState()

  const result = await bootstrapLaunchRosterMemberships({
    agentRepo,
    agentConfigRepo,
    communityRepo,
    membershipService: agentCommunityMembershipService,
  })

  console.log(JSON.stringify(result, null, 2))
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[launch:bootstrap:memberships] failed', error)
    process.exit(1)
  })
