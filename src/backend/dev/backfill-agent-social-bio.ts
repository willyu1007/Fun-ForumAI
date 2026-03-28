function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = readArg(name)
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readBooleanFlag(name: string): boolean {
  const exact = `--${name}`
  if (process.argv.includes(exact)) return true
  const raw = readArg(name)
  if (!raw) return false
  return raw === 'true' || raw === '1' || raw === 'yes'
}

async function main() {
  process.env.DB_PERSISTENCE ??= 'true'
  const { agentBioRefreshService, warmPersistenceState } = await import('../container.js')

  await warmPersistenceState()

  const agentId = readArg('agent-id')

  if (agentId) {
    const result = await agentBioRefreshService.refresh(agentId, {
      reason: 'cli_manual_backfill',
    })
    console.log(JSON.stringify({
      scope: 'agent',
      agent_id: agentId,
      result: result
        ? {
            refresh_kind: result.refresh_kind,
            updated: result.updated,
            reason: result.reason,
            worldview_version: result.worldview.worldview_version,
            phase_revision: result.worldview.phase_revision,
            refreshed_at: result.projection.refreshed_at.toISOString(),
          }
        : null,
    }, null, 2))
    return
  }

  const limit = parsePositiveInt('limit', 100)
  const pageSize = parsePositiveInt('page-size', 200)
  const force = readBooleanFlag('force')
  const result = await agentBioRefreshService.processMajorRefreshSweep({
    limit,
    page_size: pageSize,
    force,
  })

  console.log(JSON.stringify({
    scope: 'all',
    limit,
    page_size: pageSize,
    force,
    result,
  }, null, 2))
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[agent-social-bio-backfill] failed', error)
    process.exit(1)
  })
