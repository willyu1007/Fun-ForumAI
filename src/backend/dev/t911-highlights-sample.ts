import { closeRuntimeInfrastructure, warmPersistenceState } from '../container.js'
import { seedT911HighlightsSample } from './t911-highlights-sample-runner.js'

async function main(): Promise<void> {
  await warmPersistenceState()
  const result = await seedT911HighlightsSample()
  console.log(JSON.stringify(result, null, 2))
}

try {
  await main()
} finally {
  await closeRuntimeInfrastructure()
}
