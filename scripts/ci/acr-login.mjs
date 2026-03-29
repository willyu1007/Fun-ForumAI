#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

function required(name, value) {
  if (value) return value
  console.error(`[error] Missing required value for ${name}.`)
  process.exit(1)
}

function runAliyunGetAuthToken(region, endpoint, instanceId) {
  const result = spawnSync(
    'aliyun',
    ['cr', 'GetAuthorizationToken', '--region', region, '--endpoint', endpoint, '--InstanceId', instanceId],
    {
      encoding: 'utf-8',
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    },
  )

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim()
    const stdout = (result.stdout || '').trim()
    console.error(stderr || stdout || '[error] aliyun cr GetAuthorizationToken failed.')
    process.exit(result.status ?? 1)
  }

  return result.stdout
}

function parseTokenPayload(payload) {
  let body
  try {
    body = JSON.parse(payload)
  } catch (error) {
    console.error(`[error] Failed to parse GetAuthorizationToken response as JSON: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  const username =
    body.TempUsername ??
    body.tempUsername ??
    body.data?.TempUsername ??
    body.data?.tempUsername ??
    'cr_temp_user'
  const password =
    body.AuthorizationToken ??
    body.authorizationToken ??
    body.data?.AuthorizationToken ??
    body.data?.authorizationToken

  if (!password) {
    console.error('[error] AuthorizationToken missing in GetAuthorizationToken response.')
    process.exit(1)
  }

  return { username, password }
}

function dockerLogin(loginServer, username, password) {
  const result = spawnSync('docker', ['login', '--username', username, '--password-stdin', loginServer], {
    input: password,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: process.env,
    encoding: 'utf-8',
  })

  if (result.error) {
    console.error(`[error] Failed to execute docker login: ${result.error instanceof Error ? result.error.message : String(result.error)}`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function main() {
  const region = required('ALICLOUD_REGION', process.env.ALICLOUD_REGION)
  const endpoint = required('ACR_API_ENDPOINT', process.env.ACR_API_ENDPOINT)
  const instanceId = required('ACR_INSTANCE_ID', process.env.ACR_INSTANCE_ID)
  const loginServer = required('ACR_LOGIN_SERVER', process.env.ACR_LOGIN_SERVER)

  const tokenJson = runAliyunGetAuthToken(region, endpoint, instanceId)
  const { username, password } = parseTokenPayload(tokenJson)
  dockerLogin(loginServer, username, password)
}

main()
