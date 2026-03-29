#!/usr/bin/env node

import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

const args = process.argv.slice(2)

function readFlag(name, fallback = '') {
  const index = args.indexOf(`--${name}`)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

function required(name, value) {
  if (value) return value
  console.error(`[error] Missing required value for ${name}.`)
  process.exit(1)
}

function validateDockerTag(tag, label) {
  const dockerTagPattern = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/
  if (!dockerTagPattern.test(tag)) {
    console.error(`[error] ${label} must be a valid Docker tag, received "${tag}".`)
    process.exit(1)
  }
}

function validateCommitSha(value, label) {
  if (!/^[a-f0-9]{40}$/i.test(value)) {
    console.error(`[error] ${label} must be a full 40-character commit SHA, received "${value}".`)
    process.exit(1)
  }
}

function validateReleaseTag(tag) {
  const reserved = new Set(['main', 'staging', 'prod', 'latest'])
  if (reserved.has(tag)) {
    console.error(`[error] release_tag "${tag}" is reserved and must stay unavailable for immutable-only delivery.`)
    process.exit(1)
  }
  if (tag.startsWith('sha-')) {
    console.error('[error] release_tag must not start with "sha-"; use source_sha for immutable commit tags.')
    process.exit(1)
  }
}

function loadPackagingTarget(targetId) {
  const registryPath = resolve(ROOT, 'docs/packaging/registry.json')
  if (!existsSync(registryPath)) {
    console.error('[error] docs/packaging/registry.json not found.')
    process.exit(1)
  }

  const registry = JSON.parse(readFileSync(registryPath, 'utf-8'))
  const target = (registry.targets ?? []).find((item) => item.id === targetId)
  if (!target) {
    console.error(`[error] Packaging target "${targetId}" not found in docs/packaging/registry.json.`)
    process.exit(1)
  }

  return target
}

function writeOutputs(entries) {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) return

  const lines = Object.entries(entries).map(([key, value]) => `${key}=${String(value)}`)
  appendFileSync(outputPath, `${lines.join('\n')}\n`)
}

function normalizeSourceSha(raw) {
  if (raw.startsWith('sha-')) return raw
  return `sha-${raw}`
}

function main() {
  const mode = required('mode', readFlag('mode'))
  if (!['publish', 'promote'].includes(mode)) {
    console.error(`[error] Unsupported mode "${mode}". Use "publish" or "promote".`)
    process.exit(1)
  }

  const packagingTargetId = 'llm-forum'

  const region = required('ALICLOUD_REGION', process.env.ALICLOUD_REGION)
  if (region !== 'cn-hangzhou') {
    console.error(`[error] ALICLOUD_REGION must be "cn-hangzhou", received "${region}".`)
    process.exit(1)
  }

  const repository = required('ACR_REPOSITORY', process.env.ACR_REPOSITORY)
  if (repository !== 'app') {
    console.error(`[error] ACR_REPOSITORY must be "app", received "${repository}".`)
    process.exit(1)
  }

  const target = loadPackagingTarget(packagingTargetId)
  const loginServer = required('ACR_LOGIN_SERVER', process.env.ACR_LOGIN_SERVER)
  const namespace = required('ACR_NAMESPACE', process.env.ACR_NAMESPACE)

  required('ACR_INSTANCE_ID', process.env.ACR_INSTANCE_ID)
  required('ACR_API_ENDPOINT', process.env.ACR_API_ENDPOINT)
  required('ALICLOUD_OIDC_PROVIDER_ARN', process.env.ALICLOUD_OIDC_PROVIDER_ARN)
  required('ALICLOUD_ROLE_ARN', process.env.ALICLOUD_ROLE_ARN)

  const imageRepo = `${loginServer}/${namespace}/${repository}`
  const outputs = {
    service_id: packagingTargetId,
    packaging_target_id: packagingTargetId,
    dockerfile: target.dockerfile,
    context: target.context || '.',
    image_repo: imageRepo,
    login_server: loginServer,
    namespace,
    repository,
  }

  if (mode === 'publish') {
    const commitSha = required('GITHUB_SHA', process.env.GITHUB_SHA)
    validateCommitSha(commitSha, 'GITHUB_SHA')
    const shaTag = `sha-${commitSha}`
    validateDockerTag(shaTag, 'sha tag')

    Object.assign(outputs, {
      commit_sha: commitSha,
      sha_tag: shaTag,
      sha_ref: `${imageRepo}:${shaTag}`,
      created_tags: shaTag,
    })
  } else {
    const rawSourceSha = required('SOURCE_SHA', process.env.SOURCE_SHA)
    const sourceTag = normalizeSourceSha(rawSourceSha.trim())
    validateDockerTag(sourceTag, 'source_sha')
    validateCommitSha(sourceTag.replace(/^sha-/, ''), 'source_sha')

    const releaseTag = (process.env.RELEASE_TAG || '').trim()
    if (releaseTag) {
      validateDockerTag(releaseTag, 'release_tag')
      validateReleaseTag(releaseTag)
    }

    Object.assign(outputs, {
      commit_sha: sourceTag.replace(/^sha-/, ''),
      sha_tag: sourceTag,
      source_ref: `${imageRepo}:${sourceTag}`,
      release_tag: releaseTag,
      release_ref: releaseTag ? `${imageRepo}:${releaseTag}` : '',
      created_tags: releaseTag || 'none',
    })
  }

  writeOutputs(outputs)
  console.log(JSON.stringify(outputs, null, 2))
}

main()
