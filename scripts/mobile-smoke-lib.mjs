#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { getRepoRoot, loadLocalEnv } from './mobile-env.mjs'

export const MOBILE_APP_ID = 'ai.funforum.app'
export const METRO_PORT = 8081
export const FEED_POST_TITLE = '欢迎来到自由讨论区！'
export const SMOKE_ROOT = path.join(getRepoRoot(), '.ai/.tmp/mobile-smoke')
const LATEST_FIXTURE_POINTER = path.join(SMOKE_ROOT, 'latest.json')

loadLocalEnv()

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
  return dirPath
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function getSmokeRunDir(runId) {
  return path.join(SMOKE_ROOT, runId)
}

export function getLocalBackendPort() {
  const raw = process.env.PORT?.trim()
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed
  }
  return 4000
}

function normalizeUrl(raw) {
  return raw.replace(/\/$/, '')
}

function normalizeHostSideUrl(raw) {
  const url = new URL(raw)
  if (url.hostname === '10.0.2.2' || url.hostname === 'localhost') {
    url.hostname = '127.0.0.1'
  }
  return normalizeUrl(url.toString())
}

export function getHostBackendBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL?.trim()
  if (explicit) {
    return normalizeHostSideUrl(explicit)
  }

  return `http://127.0.0.1:${getLocalBackendPort()}`
}

export function getAppBackendBaseUrl(platform) {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL?.trim()
  if (explicit) {
    return normalizeUrl(explicit)
  }

  const host = platform === 'android' ? '10.0.2.2' : '127.0.0.1'
  return `http://${host}:${getLocalBackendPort()}`
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : options.body,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && payload.error && typeof payload.error === 'object' && 'message' in payload.error
      ? String(payload.error.message)
      : `${response.status} ${response.statusText}`
    throw new Error(`${options.method ?? 'GET'} ${url} failed: ${message}`)
  }

  return payload
}

export async function assertBackendReachable(baseUrl) {
  const response = await fetch(`${normalizeUrl(baseUrl)}/health`, {
    headers: { Accept: 'application/json' },
  }).catch((error) => {
    throw new Error(`backend unreachable at ${baseUrl}: ${error instanceof Error ? error.message : String(error)}`)
  })

  if (!response.ok) {
    throw new Error(`backend health check failed at ${baseUrl} with status ${response.status}`)
  }
}

export function createRunId() {
  return `mobile-smoke-${Date.now()}`
}

export function writeLatestFixturePointer(runId, fixturePath) {
  writeJson(LATEST_FIXTURE_POINTER, {
    run_id: runId,
    fixture_path: fixturePath,
    updated_at: new Date().toISOString(),
  })
}

export function resolveFixturePath(input = {}) {
  if (input.fixturePath) {
    return path.resolve(input.fixturePath)
  }

  if (input.runId) {
    return path.join(getSmokeRunDir(input.runId), 'fixture.json')
  }

  if (fs.existsSync(LATEST_FIXTURE_POINTER)) {
    const pointer = readJson(LATEST_FIXTURE_POINTER)
    if (pointer.fixture_path && fs.existsSync(pointer.fixture_path)) {
      return pointer.fixture_path
    }
  }

  if (!fs.existsSync(SMOKE_ROOT)) {
    throw new Error('No mobile smoke fixture found. Run pnpm mobile:smoke:prepare first.')
  }

  const candidates = fs.readdirSync(SMOKE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse()

  for (const runId of candidates) {
    const fixturePath = path.join(getSmokeRunDir(runId), 'fixture.json')
    if (fs.existsSync(fixturePath)) {
      return fixturePath
    }
  }

  throw new Error('No mobile smoke fixture found. Run pnpm mobile:smoke:prepare first.')
}

export function parseCommonFixtureArgs(argv) {
  let fixturePath = null
  let runId = null

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--fixture') {
      fixturePath = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (token === '--run-id') {
      runId = argv[index + 1] ?? null
      index += 1
      continue
    }
  }

  return { fixturePath, runId }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function sanitizeRunId(value) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '-')
}
