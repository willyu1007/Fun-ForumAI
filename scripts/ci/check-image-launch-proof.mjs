#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REQUIRED_LAUNCH_FRONTEND_CAPABILITIES } from '../../ops/packaging/scripts/frontend-build-profile.mjs'

function parseArgs(argv) {
  const result = {}
  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith('--')) continue
    const key = current.slice(2)
    const next = argv[index + 1]
    if (next && !next.startsWith('--')) {
      result[key] = next
      index += 1
      continue
    }
    result[key] = true
  }
  return result
}

function readRequiredString(name, value) {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  throw new Error(`Missing required --${name}`)
}

function readOptionalBoolean(name, value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined
  }
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`--${name} must be "true" or "false"`)
}

function runDocker(args) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export function validateLaunchImageProof(
  input,
  expectedProfile = 'launch',
  expectedBuildEnvFlags = {},
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('frontend build proof must be a JSON object')
  }
  if (input.profile !== expectedProfile) {
    throw new Error(
      `frontend build proof profile must be "${expectedProfile}", received "${String(input.profile)}"`,
    )
  }
  if (
    !input.frontend_capabilities ||
    typeof input.frontend_capabilities !== 'object' ||
    Array.isArray(input.frontend_capabilities)
  ) {
    throw new Error('frontend build proof must include frontend_capabilities')
  }

  const missingCapabilities = REQUIRED_LAUNCH_FRONTEND_CAPABILITIES.filter(
    (capability) => input.frontend_capabilities[capability] !== true,
  )
  if (missingCapabilities.length > 0) {
    throw new Error(
      `frontend build proof is missing enabled launch capabilities: ${missingCapabilities.join(', ')}`,
    )
  }

  const buildEnvFlags =
    input.build_env_flags && typeof input.build_env_flags === 'object' && !Array.isArray(input.build_env_flags)
      ? input.build_env_flags
      : {}

  for (const [flagName, expectedValue] of Object.entries(expectedBuildEnvFlags)) {
    if (buildEnvFlags[flagName] !== expectedValue) {
      throw new Error(
        `frontend build proof build_env_flags.${flagName} must be ${String(expectedValue)}, received ${String(buildEnvFlags[flagName])}`,
      )
    }
  }

  return {
    profile: input.profile,
    enabled_capabilities: REQUIRED_LAUNCH_FRONTEND_CAPABILITIES.length,
    build_env_flags: buildEnvFlags,
  }
}

function main() {
  const args = parseArgs(process.argv)
  const imageRef = readRequiredString('image-ref', args['image-ref'])
  const expectedProfile =
    typeof args['expected-profile'] === 'string' ? args['expected-profile'].trim() : 'launch'
  const expectedChatroomHold = readOptionalBoolean(
    'expected-chatroom-staging-hold',
    args['expected-chatroom-staging-hold'],
  )

  const raw = runDocker([
    'run',
    '--rm',
    '--entrypoint',
    'sh',
    imageRef,
    '-lc',
    'cat dist/frontend/frontend-build-capabilities.json',
  ])

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `frontend build proof is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }

  const summary = validateLaunchImageProof(parsed, expectedProfile, {
    ...(typeof expectedChatroomHold === 'boolean'
      ? { chatroom_staging_hold: expectedChatroomHold }
      : {}),
  })
  console.log(
    JSON.stringify(
      {
        image_ref: imageRef,
        profile: summary.profile,
        enabled_capabilities: summary.enabled_capabilities,
        build_env_flags: summary.build_env_flags,
      },
      null,
      2,
    ),
  )
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isEntrypoint) {
  try {
    main()
  } catch (error) {
    console.error(
      '[check-image-launch-proof] failed',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}
