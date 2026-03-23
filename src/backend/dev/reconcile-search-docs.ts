import { searchProjectionService, warmPersistenceState } from '../container.js'

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function main() {
  await warmPersistenceState()

  const scope = readArg('scope') ?? 'all'
  const dryRun = hasFlag('dry-run')

  if (scope === 'agent') {
    const agentId = readArg('agent-id')
    if (!agentId) {
      throw new Error('agent scope requires --agent-id=<agent-id>')
    }
    const result = await searchProjectionService.reconcileAgent(agentId, {
      dry_run: dryRun,
      reason: 'cli',
    })
    console.log('[search-docs] agent reconcile complete', result)
    return
  }

  if (scope !== 'all') {
    throw new Error('scope must be one of: all, agent')
  }

  const result = await searchProjectionService.reconcileAll({
    dry_run: dryRun,
    reason: 'cli',
  })
  console.log('[search-docs] reconcile complete', result)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[search-docs] reconcile failed', error)
    process.exit(1)
  })
