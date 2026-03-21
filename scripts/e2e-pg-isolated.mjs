#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { Client } from 'pg'

function run(cmd, env) {
  console.log(`[e2e-pg-isolated] $ ${cmd}`)
  execSync(cmd, {
    stdio: 'inherit',
    env,
  })
}

function withDatabase(rawUrl, databaseName) {
  const url = new URL(rawUrl)
  url.pathname = `/${databaseName}`
  url.searchParams.delete('schema')
  return url.toString()
}

function adminDatabaseUrl(rawUrl) {
  return withDatabase(rawUrl, 'postgres')
}

function makeSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
}

function sanitizeDbName(name) {
  const value = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid database name: ${value}`)
  }
  return value
}

async function createDatabase(adminClient, dbName) {
  await adminClient.query(`CREATE DATABASE "${dbName}"`)
}

async function dropDatabase(adminClient, dbName) {
  await adminClient.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
    [dbName],
  )
  await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}"`)
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || `postgresql://${process.env.USER ?? 'postgres'}@localhost:5432/llm_forum_dev`
  const parsedMain = new URL(databaseUrl)
  const mainDbName = parsedMain.pathname.replace(/^\//, '')
  if (!mainDbName) {
    throw new Error('DATABASE_URL must include a database name')
  }

  const suffix = makeSuffix()
  const base = sanitizeDbName(mainDbName)
  const isolatedDbName = `${base}_e2e_${suffix}`.slice(0, 63)
  const isolatedShadowDbName = `${base}_shadow_${suffix}`.slice(0, 63)

  const isolatedDatabaseUrl = withDatabase(databaseUrl, isolatedDbName)
  const isolatedShadowDatabaseUrl = withDatabase(databaseUrl, isolatedShadowDbName)

  console.log(`[e2e-pg-isolated] main_db=${mainDbName}`)
  console.log(`[e2e-pg-isolated] isolated_db=${isolatedDbName}`)
  console.log(`[e2e-pg-isolated] shadow_db=${isolatedShadowDbName}`)

  const adminClient = new Client({ connectionString: adminDatabaseUrl(databaseUrl) })
  await adminClient.connect()
  await createDatabase(adminClient, isolatedDbName)
  await createDatabase(adminClient, isolatedShadowDbName)

  const testEnv = {
    ...process.env,
    DB_PERSISTENCE: 'true',
    DATABASE_URL: isolatedDatabaseUrl,
    SHADOW_DATABASE_URL: isolatedShadowDatabaseUrl,
    E2E_PERSISTENT_DB_ISOLATED: 'true',
  }

  let testError = null
  try {
    run('pnpm db:migrate:deploy', testEnv)
    run('pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts', testEnv)
    run(
      [
        'pnpm vitest run',
        'src/backend/routes/__tests__/e2e-agents-control-plane.test.ts',
        'src/backend/routes/__tests__/e2e-governance-control-plane.test.ts',
        'src/backend/routes/__tests__/e2e-incubation-control-plane.test.ts',
        'src/backend/routes/__tests__/e2e-community-config-control-plane.test.ts',
        'src/backend/routes/__tests__/e2e-role-assignment-control-plane.test.ts',
        'src/backend/routes/__tests__/e2e-inference-profile-control-plane.test.ts',
      ].join(' '),
      testEnv,
    )
    run(
      'pnpm vitest run src/backend/routes/__tests__/e2e-role-assignment-control-plane.test.ts -t "Role assignment control-plane endpoints create and update assignments"',
      testEnv,
    )
    run('pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts -t "GET /v1/posts/:postId/aside-seats returns role assignments for post scope"', testEnv)
  } catch (err) {
    testError = err
  } finally {
    try {
      await dropDatabase(adminClient, isolatedShadowDbName)
      await dropDatabase(adminClient, isolatedDbName)
      console.log(`[e2e-pg-isolated] dropped isolated_db=${isolatedDbName} shadow_db=${isolatedShadowDbName}`)
    } catch (dropErr) {
      console.error('[e2e-pg-isolated] cleanup failed', dropErr)
      if (!testError) {
        testError = dropErr
      }
    } finally {
      await adminClient.end()
    }
  }

  if (testError) {
    throw testError
  }
}

main().catch((err) => {
  console.error('[e2e-pg-isolated] failed', err)
  process.exit(1)
})
