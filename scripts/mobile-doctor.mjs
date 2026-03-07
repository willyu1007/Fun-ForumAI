#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import process from 'node:process'

function check(label, fn) {
  try {
    const detail = fn()
    console.log(`[PASS] ${label}${detail ? ` — ${detail}` : ''}`)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[FAIL] ${label} — ${message}`)
    return false
  }
}

function exec(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

function listAvailableIosDevices() {
  const raw = exec('xcrun', ['simctl', 'list', 'devices', 'available'])
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== '== Devices ==')

  if (lines.length === 0) {
    throw new Error('no available iOS simulator devices')
  }

  return `${lines.length} available device entries`
}

function listAndroidAvds() {
  const emulator = spawnSync('emulator', ['-list-avds'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  if (emulator.error) {
    throw emulator.error
  }
  if (emulator.status !== 0) {
    throw new Error(emulator.stderr.trim() || 'failed to list Android AVDs')
  }

  const avds = emulator.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (avds.length === 0) {
    throw new Error('no Android AVDs configured')
  }

  return `${avds.length} configured AVD(s)`
}

const checks = [
  check('Node.js available', () => process.version),
  check('pnpm available', () => exec('pnpm', ['--version'])),
  check('EAS CLI available', () => exec('pnpm', ['exec', 'eas', '--version'])),
  check('Expo CLI available', () => exec('pnpm', ['--dir', 'apps/mobile', 'exec', 'expo', '--version'])),
  check('iOS simulator tooling', listAvailableIosDevices),
  check('Android adb available', () => exec('adb', ['version']).split('\n')[0]),
  check('Android AVD availability', listAndroidAvds),
]

if (checks.every(Boolean)) {
  console.log('mobile:doctor passed')
  process.exit(0)
}

console.error('mobile:doctor failed')
process.exit(1)
