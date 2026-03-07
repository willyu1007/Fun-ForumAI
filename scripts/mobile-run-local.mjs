#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { getRepoRoot, loadLocalEnv } from './mobile-env.mjs'

const platform = process.argv[2]
if (platform !== 'ios' && platform !== 'android') {
  console.error('Usage: node scripts/mobile-run-local.mjs <ios|android> [--dry-run] [extra args...]')
  process.exit(1)
}

loadLocalEnv()

const rawArgs = process.argv.slice(3)
const dryRun = rawArgs.includes('--dry-run')
const extraArgs = rawArgs.filter((arg) => arg !== '--dry-run' && arg !== '--')
const defaultApiBaseUrl = platform === 'android'
  ? 'http://10.0.2.2:4000'
  : 'http://127.0.0.1:4000'

const env = {
  ...process.env,
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || defaultApiBaseUrl,
}

const args = [
  '--dir',
  'apps/mobile',
  'exec',
  'expo',
  platform === 'ios' ? 'run:ios' : 'run:android',
  ...extraArgs,
]

if (dryRun) {
  console.log(`EXPO_PUBLIC_API_BASE_URL=${env.EXPO_PUBLIC_API_BASE_URL}`)
  console.log(`pnpm ${args.join(' ')}`)
  process.exit(0)
}

const result = spawnSync('pnpm', args, {
  cwd: getRepoRoot(),
  env,
  stdio: 'inherit',
})

if (typeof result.status === 'number') {
  process.exit(result.status)
}

console.error(result.error ?? 'mobile local run failed')
process.exit(1)
