import { searchProjectionService, warmPersistenceState } from '../container.js'

async function main() {
  await warmPersistenceState()
  const result = await searchProjectionService.rebuildAll()
  console.log('[search-docs] rebuild complete', result)
}

main().catch((error) => {
  console.error('[search-docs] rebuild failed', error)
  process.exitCode = 1
})
