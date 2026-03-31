import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeDir = path.join(rootDir, '.ai', '.tmp', 'node-runtime')
const localStorageFile = path.join(runtimeDir, 'localstorage.json')

mkdirSync(runtimeDir, { recursive: true })

const localStorageFlag = `--localstorage-file=${localStorageFile}`
const existingNodeOptions = process.env.NODE_OPTIONS?.trim() ?? ''
const hasLocalStorageFlag = existingNodeOptions
  .split(/\s+/)
  .some((token) => token.startsWith('--localstorage-file='))

const nodeOptions = hasLocalStorageFlag
  ? existingNodeOptions
  : [existingNodeOptions, localStorageFlag].filter(Boolean).join(' ')

const vitestArgs = process.argv.slice(2)
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const result = spawnSync(command, ['exec', 'vitest', ...vitestArgs], {
  cwd: rootDir,
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  stdio: 'inherit',
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
