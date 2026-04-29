#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../..')
const PROFILE_DIR = resolve(ROOT, 'ops/packaging/build-profiles')

export const REQUIRED_LAUNCH_FRONTEND_CAPABILITIES = [
  'guidance',
  'global_highlights',
  'audience_aftershow_web',
  'audience_zone',
  'aftershow',
  'role_assignment',
  'home_programming',
  'programming_ops',
  'multimodal_agent_media',
]

const BUILD_ENV_FLAG_DEFINITIONS = [
  {
    envName: 'VITE_FF_CHATROOM_STAGING_HOLD_V1',
    proofKey: 'chatroom_staging_hold',
  },
]

function parseArgs(args) {
  const result = {}
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index]
    if (!current.startsWith('--')) continue
    const key = current.slice(2)
    const next = args[index + 1]
    if (next && !next.startsWith('--')) {
      result[key] = next
      index += 1
      continue
    }
    result[key] = true
  }
  return result
}

function assertProfileShape(profile, profileId) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error(`Invalid frontend build profile "${profileId}": expected an object`)
  }
  if (profile.version !== 1) {
    throw new Error(`Invalid frontend build profile "${profileId}": version must be 1`)
  }
  if (typeof profile.profile !== 'string' || profile.profile.trim().length === 0) {
    throw new Error(`Invalid frontend build profile "${profileId}": profile is required`)
  }
  if (typeof profile.target !== 'string' || profile.target.trim().length === 0) {
    throw new Error(`Invalid frontend build profile "${profileId}": target is required`)
  }

  const frontendCapabilities = profile.frontend_capabilities
  if (
    !frontendCapabilities ||
    typeof frontendCapabilities !== 'object' ||
    Array.isArray(frontendCapabilities)
  ) {
    throw new Error(
      `Invalid frontend build profile "${profileId}": frontend_capabilities is required`,
    )
  }

  for (const key of REQUIRED_LAUNCH_FRONTEND_CAPABILITIES) {
    if (typeof frontendCapabilities[key] !== 'boolean') {
      throw new Error(`Invalid frontend build profile "${profileId}": ${key} must be a boolean`)
    }
  }

  for (const [key, value] of Object.entries(frontendCapabilities)) {
    if (!/^[a-z0-9_]+$/.test(key)) {
      throw new Error(
        `Invalid frontend build profile "${profileId}": ${key} must use snake_case capability keys`,
      )
    }
    if (typeof value !== 'boolean') {
      throw new Error(`Invalid frontend build profile "${profileId}": ${key} must be a boolean`)
    }
  }
}

export function getFrontendBuildProfilePath(profileId) {
  return resolve(PROFILE_DIR, `${profileId}.json`)
}

export function loadFrontendBuildProfile(profileId) {
  const pathname = getFrontendBuildProfilePath(profileId)
  if (!existsSync(pathname)) {
    throw new Error(`Frontend build profile not found: ${profileId}`)
  }

  const parsed = JSON.parse(readFileSync(pathname, 'utf8'))
  assertProfileShape(parsed, profileId)
  return parsed
}

export function buildFrontendCapabilityProof(profile) {
  const buildEnvFlags = Object.fromEntries(
    BUILD_ENV_FLAG_DEFINITIONS.flatMap(({ envName, proofKey }) => {
      const rawValue = process.env[envName]
      if (rawValue !== 'true' && rawValue !== 'false') {
        return []
      }
      return [[proofKey, rawValue === 'true']]
    }),
  )

  return {
    version: 1,
    profile: profile.profile,
    target: profile.target,
    description: profile.description ?? '',
    frontend_capabilities: profile.frontend_capabilities,
    build_env_flags: buildEnvFlags,
  }
}

export function toDockerBuildArgs(profile) {
  return [['FRONTEND_BUILD_PROFILE', profile.profile]]
}

export function writeFrontendCapabilityProof(profileId, outPath) {
  const profile = loadFrontendBuildProfile(profileId)
  const proof = buildFrontendCapabilityProof(profile)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8')
  return proof
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const profileId = typeof args.profile === 'string' ? args.profile : ''
  const out = typeof args.out === 'string' ? args.out : ''

  if (!profileId || !out) {
    console.error(
      'Usage: node ops/packaging/scripts/frontend-build-profile.mjs --profile <id> --out <path>',
    )
    return 1
  }

  writeFrontendCapabilityProof(profileId, resolve(ROOT, out))
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code))
}
