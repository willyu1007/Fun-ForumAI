#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REQUIRED_LAUNCH_FRONTEND_FLAGS } from '../../ops/packaging/scripts/frontend-build-profile.mjs'

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

function runDocker(args) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export function validateLaunchImageProof(input, expectedProfile = 'launch') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('frontend build proof must be a JSON object')
  }
  if (input.profile !== expectedProfile) {
    throw new Error(`frontend build proof profile must be "${expectedProfile}", received "${String(input.profile)}"`)
  }
  if (!input.frontend_flags || typeof input.frontend_flags !== 'object' || Array.isArray(input.frontend_flags)) {
    throw new Error('frontend build proof must include frontend_flags')
  }

  const missingFlags = REQUIRED_LAUNCH_FRONTEND_FLAGS.filter(
    (flag) => input.frontend_flags[flag] !== 'true',
  )
  if (missingFlags.length > 0) {
    throw new Error(`frontend build proof is missing enabled launch flags: ${missingFlags.join(', ')}`)
  }

  return {
    profile: input.profile,
    enabled_flags: REQUIRED_LAUNCH_FRONTEND_FLAGS.length,
  }
}

function main() {
  const args = parseArgs(process.argv)
  const imageRef = readRequiredString('image-ref', args['image-ref'])
  const expectedProfile = typeof args['expected-profile'] === 'string'
    ? args['expected-profile'].trim()
    : 'launch'

  const raw = runDocker([
    'run',
    '--rm',
    '--entrypoint',
    'sh',
    imageRef,
    '-lc',
    'cat dist/frontend/frontend-build-flags.json',
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

  const summary = validateLaunchImageProof(parsed, expectedProfile)
  console.log(JSON.stringify({
    image_ref: imageRef,
    profile: summary.profile,
    enabled_flags: summary.enabled_flags,
  }, null, 2))
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isEntrypoint) {
  try {
    main()
  } catch (error) {
    console.error('[check-image-launch-proof] failed', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
