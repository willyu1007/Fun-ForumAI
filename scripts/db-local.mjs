#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const CONTAINER = process.env.LOCAL_DB_CONTAINER ?? 'funforum-local-pg'
const IMAGE = process.env.LOCAL_DB_IMAGE ?? 'postgres:18-alpine'
const DB_USER = process.env.LOCAL_DB_USER ?? process.env.USER ?? 'postgres'
const DB_NAME = process.env.LOCAL_DB_NAME ?? 'llm_forum_dev'
const DB_PORT = Number(process.env.LOCAL_DB_PORT ?? 5432)
const BOOTSTRAP_PGVECTOR = process.env.LOCAL_DB_BOOTSTRAP_PGVECTOR !== 'false'

const PGVECTOR_BOOTSTRAP = `
set -e
if [ ! -f /usr/local/share/postgresql/extension/vector.control ] || [ ! -f /usr/local/lib/postgresql/vector.so ]; then
  apk add --no-cache postgresql-pgvector
  mkdir -p /usr/local/share/postgresql/extension /usr/local/lib/postgresql
  cp -f /usr/share/postgresql18/extension/vector* /usr/local/share/postgresql/extension/
  cp -f /usr/lib/postgresql18/vector.so /usr/local/lib/postgresql/
fi
exec docker-entrypoint.sh postgres
`.trim()

const command = process.argv[2] ?? 'help'
const timeoutSeconds = Number(process.env.LOCAL_DB_WAIT_TIMEOUT_SEC ?? 60)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function runDocker(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
  })

  if (result.error) {
    throw result.error
  }

  return result
}

function getContainerState() {
  const result = runDocker(['inspect', '-f', '{{.State.Status}}', CONTAINER])
  if (result.status !== 0) {
    return null
  }
  return result.stdout.trim()
}

function ensureDockerOk() {
  const result = runDocker(['--version'])
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim() || 'docker command failed'
    throw new Error(message)
  }
}

function up() {
  ensureDockerOk()
  const state = getContainerState()

  if (state === 'running') {
    console.log(`[db-local] ${CONTAINER} is already running on localhost:${DB_PORT}`)
    return
  }

  if (state) {
    const startResult = runDocker(['start', CONTAINER])
    if (startResult.status !== 0) {
      const message = (startResult.stderr || startResult.stdout || '').trim()
      throw new Error(message)
    }
    console.log(`[db-local] started existing container ${CONTAINER}`)
    return
  }

  const runResult = runDocker([
    'run',
    '--name',
    CONTAINER,
    '-e',
    `POSTGRES_USER=${DB_USER}`,
    '-e',
    `POSTGRES_DB=${DB_NAME}`,
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    '-p',
    `${DB_PORT}:5432`,
    '-d',
    IMAGE,
    ...(BOOTSTRAP_PGVECTOR ? ['sh', '-lc', PGVECTOR_BOOTSTRAP] : []),
  ])

  if (runResult.status !== 0) {
    const message = (runResult.stderr || runResult.stdout || '').trim()
    throw new Error(message)
  }

  console.log(`[db-local] created and started ${CONTAINER} (${IMAGE})`)
}

function down() {
  ensureDockerOk()
  const state = getContainerState()
  if (!state) {
    console.log(`[db-local] container ${CONTAINER} does not exist`)
    return
  }

  const stopResult = runDocker(['rm', '-f', CONTAINER])
  if (stopResult.status !== 0) {
    const message = (stopResult.stderr || stopResult.stdout || '').trim()
    throw new Error(message)
  }
  console.log(`[db-local] removed container ${CONTAINER}`)
}

function status() {
  ensureDockerOk()
  const state = getContainerState()
  if (!state) {
    console.log(`[db-local] ${CONTAINER}: not created`)
    return
  }

  const portResult = runDocker(['port', CONTAINER, '5432'])
  const portInfo = portResult.status === 0 ? portResult.stdout.trim() : '(port unavailable)'
  console.log(`[db-local] ${CONTAINER}: ${state}`)
  console.log(`[db-local] image: ${IMAGE}`)
  console.log(`[db-local] port: ${portInfo}`)
  console.log(`[db-local] db: ${DB_NAME}, user: ${DB_USER}`)
}

async function waitReady() {
  ensureDockerOk()
  const state = getContainerState()
  if (state !== 'running') {
    throw new Error(`[db-local] ${CONTAINER} is not running`)
  }

  const deadline = Date.now() + timeoutSeconds * 1000
  while (Date.now() < deadline) {
    const probe = runDocker(['exec', CONTAINER, 'pg_isready', '-U', DB_USER, '-d', DB_NAME])
    if (probe.status === 0) {
      console.log(`[db-local] PostgreSQL is ready (${CONTAINER})`)
      return
    }
    await sleep(1000)
  }

  throw new Error(`[db-local] timeout waiting for PostgreSQL readiness (${timeoutSeconds}s)`)
}

function logs() {
  ensureDockerOk()
  const state = getContainerState()
  if (!state) {
    throw new Error(`[db-local] container ${CONTAINER} does not exist`)
  }
  const result = runDocker(['logs', '--tail', '200', CONTAINER], { inherit: true })
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim()
    throw new Error(message)
  }
}

function printHelp() {
  console.log(`Usage: node scripts/db-local.mjs <command>

Commands:
  up       Start (or create) local PostgreSQL container
  wait     Wait until PostgreSQL is ready
  status   Show container status
  logs     Print recent container logs
  down     Remove local PostgreSQL container

Environment overrides:
  LOCAL_DB_CONTAINER        (default: funforum-local-pg)
  LOCAL_DB_IMAGE            (default: postgres:18-alpine)
  LOCAL_DB_USER             (default: $USER or postgres)
  LOCAL_DB_NAME             (default: llm_forum_dev)
  LOCAL_DB_PORT             (default: 5432)
  LOCAL_DB_BOOTSTRAP_PGVECTOR (default: true)
  LOCAL_DB_WAIT_TIMEOUT_SEC (default: 60)
`)
}

try {
  switch (command) {
    case 'up':
      up()
      break
    case 'wait':
      await waitReady()
      break
    case 'status':
      status()
      break
    case 'logs':
      logs()
      break
    case 'down':
      down()
      break
    case 'help':
    default:
      printHelp()
      break
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
}
