#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

function required(name, value) {
  if (value) return value
  console.error(`[error] Missing required value for ${name}.`)
  process.exit(1)
}

function runJsonCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  })

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim()
    const stdout = (result.stdout || '').trim()
    console.error(stderr || stdout || `[error] ${command} ${args.join(' ')} failed.`)
    process.exit(result.status ?? 1)
  }

  try {
    return JSON.parse(result.stdout)
  } catch (error) {
    console.error(`[error] Failed to parse ${command} JSON output: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

function remoteTagExists(ref) {
  const result = spawnSync('docker', ['manifest', 'inspect', ref], {
    encoding: 'utf-8',
    env: process.env,
    stdio: ['ignore', 'ignore', 'ignore'],
  })
  return result.status === 0
}

function normalizeBoolean(value) {
  return value === true || String(value).trim().toLowerCase() === 'true'
}

function main() {
  const mode = required('PUBLISH_MODE', process.env.PUBLISH_MODE)
  if (!['publish', 'promote'].includes(mode)) {
    console.error(`[error] Unsupported PUBLISH_MODE "${mode}".`)
    process.exit(1)
  }

  const region = required('ALICLOUD_REGION', process.env.ALICLOUD_REGION)
  const endpoint = required('ACR_API_ENDPOINT', process.env.ACR_API_ENDPOINT)
  const instanceId = required('ACR_INSTANCE_ID', process.env.ACR_INSTANCE_ID)
  const namespace = required('ACR_NAMESPACE', process.env.ACR_NAMESPACE)
  const repository = required('ACR_REPOSITORY', process.env.ACR_REPOSITORY)

  const repo = runJsonCommand('aliyun', [
    'cr',
    'GetRepository',
    '--region',
    region,
    '--endpoint',
    endpoint,
    '--InstanceId',
    instanceId,
    '--RepoNamespaceName',
    namespace,
    '--RepoName',
    repository,
  ])

  const tagImmutability = normalizeBoolean(repo.TagImmutability ?? repo.tagImmutability ?? repo.data?.TagImmutability)
  if (!tagImmutability) {
    console.log('[ok] ACR repository tag mutability allows channel aliases.')
    return
  }

  const mutableTargets =
    mode === 'publish'
      ? [
          required('MAIN_REF', process.env.MAIN_REF),
          required('STAGING_REF', process.env.STAGING_REF),
        ]
      : [
          required('PROD_REF', process.env.PROD_REF),
          (process.env.RELEASE_REF || '').trim(),
        ].filter(Boolean)

  const existingTargets = mutableTargets.filter((ref) => remoteTagExists(ref))
  if (existingTargets.length === 0) {
    console.warn(
      '[warn] ACR repository has TagImmutability enabled. This run may succeed only because the mutable alias tags do not exist yet; future publish/promote runs will fail once those aliases are created.',
    )
    return
  }

  console.error('[error] ACR repository has TagImmutability enabled, but this workflow requires overwritable alias tags.')
  console.error(`[error] Existing mutable tags: ${existingTargets.join(', ')}`)
  console.error('[error] Disable repository tag immutability or redesign the alias strategy before continuing.')
  process.exit(1)
}

main()
