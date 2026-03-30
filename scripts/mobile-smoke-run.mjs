#!/usr/bin/env node

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { getMobileAppRoot, getRepoRoot, loadLocalEnv } from './mobile-env.mjs'
import {
  METRO_PORT,
  MOBILE_APP_ID,
  assertBackendReachable,
  ensureDir,
  getAppBackendBaseUrl,
  parseCommonFixtureArgs,
  readJson,
  resolveFixturePath,
  sleep,
} from './mobile-smoke-lib.mjs'

const platform = process.argv[2]
if (platform !== 'ios' && platform !== 'android') {
  console.error('Usage: node scripts/mobile-smoke-run.mjs <ios|android> [--run-id <id> | --fixture <path>]')
  process.exit(1)
}

loadLocalEnv()

const fixtureArgs = parseCommonFixtureArgs(process.argv.slice(3))
const fixturePath = resolveFixturePath(fixtureArgs)
const fixture = readJson(fixturePath)
const runRoot = path.dirname(fixturePath)
const platformDir = ensureDir(path.join(runRoot, platform))
const metroLogPath = path.join(platformDir, 'metro.log')
const maestroLogPath = path.join(platformDir, 'maestro.log')
const maestroDebugDir = ensureDir(path.join(platformDir, 'debug-output'))
const flowPath = path.join(getRepoRoot(), 'apps/mobile/.maestro', platform, 'smoke.yaml')
const appBaseUrl = getAppBackendBaseUrl(platform)

function resolveMaestroExecutable() {
  const preferred = process.env.MAESTRO_BIN?.trim()
  if (preferred) {
    return preferred
  }

  const fallback = path.join(process.env.HOME ?? '', '.maestro', 'bin', 'maestro')
  if (fallback && fs.existsSync(fallback)) {
    return fallback
  }

  return 'maestro'
}

const maestroExecutable = resolveMaestroExecutable()

function resolveJavaHome() {
  const configured = process.env.JAVA_HOME?.trim()
  if (configured && fs.existsSync(configured)) {
    return configured
  }

  const candidates = [
    '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
    '/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

function getMaestroEnv() {
  const javaHome = resolveJavaHome()
  if (!javaHome) {
    return process.env
  }

  return {
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${path.join(javaHome, 'bin')}:${process.env.PATH ?? ''}`,
  }
}

function exec(command, args) {
  return execFileSync(command, args, {
    cwd: getRepoRoot(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

async function isMetroRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${METRO_PORT}/status`, {
      headers: { Accept: 'text/plain' },
    })
    const body = await response.text()
    return response.ok && body.includes('packager-status:running')
  } catch {
    return false
  }
}

async function waitForMetro(timeoutMs = 60_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await isMetroRunning()) {
      return
    }
    await sleep(1_000)
  }
  throw new Error(`Metro did not become ready on port ${METRO_PORT} within ${timeoutMs}ms.`)
}

function assertMaestroInstalled() {
  const result = spawnSync(maestroExecutable, ['--version'], {
    cwd: getRepoRoot(),
    encoding: 'utf8',
    env: getMaestroEnv(),
  })
  if (result.error || result.status !== 0) {
    throw new Error('Maestro CLI is not installed. Install it before running mobile:smoke:ios/android.')
  }
}

function assertIosReady() {
  const booted = exec('xcrun', ['simctl', 'list', 'devices', 'booted'])
  if (!booted.includes('Booted')) {
    throw new Error('No booted iOS simulator found.')
  }
  exec('xcrun', ['simctl', 'get_app_container', 'booted', MOBILE_APP_ID, 'data'])
}

function assertAndroidReady() {
  const state = exec('adb', ['get-state'])
  if (!state.includes('device')) {
    throw new Error('No booted Android emulator found.')
  }
  const pathResult = exec('adb', ['shell', 'pm', 'path', MOBILE_APP_ID])
  if (!pathResult.includes('package:')) {
    throw new Error(`${MOBILE_APP_ID} is not installed on the booted Android emulator.`)
  }
}

function assertPlatformReady() {
  if (platform === 'ios') {
    assertIosReady()
    return
  }
  assertAndroidReady()
}

function getTargetDeviceId() {
  if (platform === 'ios') {
    const raw = exec('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'])
    const parsed = JSON.parse(raw)
    const devices = Object.values(parsed.devices ?? {}).flat()
    const booted = devices.find((device) => device.state === 'Booted')
    if (!booted?.udid) {
      throw new Error('Unable to resolve booted iOS simulator UDID.')
    }
    return booted.udid
  }

  const lines = exec('adb', ['devices'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('\tdevice'))
  const deviceId = lines[0]?.split('\t')[0]
  if (!deviceId) {
    throw new Error('Unable to resolve booted Android emulator device id.')
  }
  return deviceId
}

function createLoggedProcess(command, args, env, logPath, cwd = getRepoRoot()) {
  const stream = fs.createWriteStream(logPath, { flags: 'a' })
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => {
    stream.write(chunk)
    process.stdout.write(chunk)
  })
  child.stderr.on('data', (chunk) => {
    stream.write(chunk)
    process.stderr.write(chunk)
  })

  child.on('close', () => {
    stream.end()
  })

  return child
}

async function startMetro() {
  if (await isMetroRunning()) {
    throw new Error(`Metro is already running on port ${METRO_PORT}. Stop it first so mobile:smoke:${platform} can own the session.`)
  }

  const env = {
    ...process.env,
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_API_BASE_URL: appBaseUrl,
  }

  const args = [
    'exec',
    'expo',
    'start',
    '--dev-client',
    '--localhost',
    '--port',
    String(METRO_PORT),
    '--clear',
    platform === 'ios' ? '--ios' : '--android',
  ]

  const child = createLoggedProcess('pnpm', args, env, metroLogPath, getMobileAppRoot())
  await waitForMetro()
  await sleep(5_000)
  return child
}

function stopMetro(child) {
  if (!child || child.killed) return
  child.kill('SIGTERM')
}

async function normalizeAndroidRuntime() {
  if (platform !== 'android') {
    return
  }

  try {
    exec('adb', ['shell', 'input', 'keyevent', '4'])
  } catch {
    // If the dev-client overlay is not open, keep going.
  }

  await sleep(1_000)

  try {
    exec('adb', ['shell', 'monkey', '-p', MOBILE_APP_ID, '-c', 'android.intent.category.LAUNCHER', '1'])
  } catch (error) {
    throw new Error(
      `Unable to foreground Android dev build: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }

  await sleep(2_000)
}

function runMaestro() {
  const deviceId = getTargetDeviceId()
  const envPairs = [
    `SMOKE_EMAIL=${fixture.user.email}`,
    `SMOKE_PASSWORD=${fixture.user.password}`,
    `SMOKE_AGENT_NAME=${fixture.agent.display_name}`,
    `SMOKE_ROOM_NAME=${fixture.room.name}`,
    `SMOKE_PRIVATE_MESSAGE=${fixture.private_message}`,
    `FEED_POST_TITLE=${fixture.feed_post_title}`,
    `FEED_POST_MATCH_TEXT=${fixture.feed_post_match_text ?? fixture.feed_post_title}`,
    `RUN_ID=${fixture.run_id}`,
  ]

  const args = [
    'test',
    flowPath,
    '--platform',
    platform,
    '--device',
    deviceId,
    '--debug-output',
    maestroDebugDir,
    ...envPairs.flatMap((pair) => ['-e', pair]),
  ]

  const result = spawnSync(maestroExecutable, args, {
    cwd: getRepoRoot(),
    encoding: 'utf8',
    env: getMaestroEnv(),
  })

  fs.writeFileSync(
    maestroLogPath,
    `${result.stdout ?? ''}${result.stderr ?? ''}`,
    'utf8',
  )
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`Maestro smoke failed for ${platform}. See ${maestroLogPath}`)
  }
}

async function main() {
  await assertBackendReachable(fixture.backend_base_url)
  assertMaestroInstalled()
  assertPlatformReady()

  let metroChild = null
  try {
    metroChild = await startMetro()
    await normalizeAndroidRuntime()
    runMaestro()
    console.log(`mobile smoke ${platform} passed: ${fixturePath}`)
  } finally {
    stopMetro(metroChild)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
