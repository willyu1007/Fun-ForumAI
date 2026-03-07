#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { getMobileAppRoot, loadLocalEnv, requireEnv } from './mobile-env.mjs'

const platform = process.argv[2]
if (platform !== 'ios' && platform !== 'android') {
  console.error('Usage: node scripts/mobile-eas-build.mjs <ios|android> [extra eas args...]')
  process.exit(1)
}

loadLocalEnv()

try {
  const projectId = requireEnv('EXPO_EAS_PROJECT_ID')
  console.log(`EXPO_EAS_PROJECT_ID detected: ${projectId}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  console.error('Set it in .env.local or your shell before running mobile:devbuild:* commands.')
  process.exit(1)
}

const profile = platform === 'ios' ? 'development-ios-simulator' : 'development-android'
const extraArgs = process.argv.slice(3).filter((arg) => arg !== '--')
const result = spawnSync(
  'pnpm',
  ['exec', 'eas', 'build', '--profile', profile, '--platform', platform, ...extraArgs],
  {
    cwd: getMobileAppRoot(),
    env: process.env,
    stdio: 'inherit',
  },
)

if (typeof result.status === 'number') {
  process.exit(result.status)
}

console.error(result.error ?? 'mobile EAS build failed')
process.exit(1)
