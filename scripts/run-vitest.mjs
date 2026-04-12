import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vitestEntrypoint = path.join(rootDir, 'node_modules', 'vitest', 'vitest.mjs')
const vitestArgs = process.argv.slice(2)

function runVitest(args) {
  const result = spawnSync(process.execPath, [vitestEntrypoint, ...args], {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  return result.status ?? 1
}

function listPersistentRouteTests() {
  const routesTestDir = path.join(rootDir, 'src', 'backend', 'routes', '__tests__')
  return fs.readdirSync(routesTestDir)
    .filter((entry) => entry.endsWith('.test.ts'))
    .map((entry) => path.join(routesTestDir, entry))
    .filter((absolutePath) => fs.readFileSync(absolutePath, 'utf8').includes("from './e2e-helpers.js'"))
    .map((absolutePath) => path.relative(rootDir, absolutePath))
    .sort()
}

if (vitestArgs.length === 1 && vitestArgs[0] === 'run') {
  const persistentRouteTests = listPersistentRouteTests()
  const parallelArgs = ['run']
  for (const file of persistentRouteTests) {
    parallelArgs.push('--exclude', file)
  }

  const parallelStatus = runVitest(parallelArgs)
  if (parallelStatus !== 0) {
    process.exit(parallelStatus)
  }

  const serialStatus = runVitest(['run', '--maxWorkers=1', ...persistentRouteTests])
  process.exit(serialStatus)
}

process.exit(runVitest(vitestArgs))
