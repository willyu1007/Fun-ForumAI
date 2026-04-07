import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vitestEntrypoint = path.join(rootDir, 'node_modules', 'vitest', 'vitest.mjs')
const vitestArgs = process.argv.slice(2)
const result = spawnSync(process.execPath, [vitestEntrypoint, ...vitestArgs], {
  cwd: rootDir,
  env: process.env,
  stdio: 'inherit',
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
