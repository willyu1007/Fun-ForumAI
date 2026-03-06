#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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

function buildBaseStageSpecWithoutAftershow() {
  return {
    version: 'v1',
    min_tier_pool: 'T1',
    roles: {
      resident: {
        min_tier: 'T1',
        runtime_gate: true,
        t4_longform_only: false,
      },
      guest: {
        min_tier: 'T1',
        runtime_gate: true,
        t4_longform_only: false,
      },
      core: {
        min_tier: 'T3',
        runtime_gate: true,
        t4_longform_only: false,
      },
    },
    tier_gate: {
      resident_min_tier: 'T3',
      core_min_tier: 'T3',
      t4_longform_min_tier: 'T4',
    },
    strict_t4: {
      enabled: true,
      premod_required: true,
      min_sources: 3,
      grant_required: true,
      max_ttl_hours: 168,
      redaction: 'strong',
    },
    allocator: {
      community_max_agents: 20,
      thread_max_agents: 20,
      cooldown_seconds: 60,
      max_actions_per_hour: 30,
      max_tokens_per_day: 100000,
      event_base_quota: {
        NewPostCreated: 5,
        NewCommentCreated: 3,
        NewMessageCreated: 0,
        VoteCast: 0,
        RoomTick: 4,
      },
      director_guard: {
        contrast_min_relevance_ratio: 0.45,
        wildcard_min_relevance_ratio: 0.35,
        min_abs_score: 0.8,
        thread_window: 6,
        thread_max_agent_occurrences: 2,
        thread_cooldown_seconds: 600,
      },
    },
    human_participation: {
      mode: 'A',
      audience_zone_enabled: true,
      agent_reads_audience_zone: false,
      agent_reply_via_aftershow: true,
    },
    incubation: {
      enabled: false,
      seed_source: 'private_digest_only',
      grant_required: true,
      redaction_profile: 'strong',
      research: {
        allow_web_search: true,
        min_sources: 3,
      },
      format: {
        min_words: 600,
        max_words: 2500,
        citation_style: 'endnotes',
      },
    },
  }
}

async function runConfigNormalizationProbe(connectionString) {
  const client = new Client({ connectionString })
  await client.connect()

  const migrationSql = readFileSync(
    new URL('../prisma/migrations/20260306090000_t054_control_plane_stage_spec_normalization/migration.sql', import.meta.url),
    'utf8',
  )
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const userId = `probe_user_${suffix}`
  const communityId = randomUUID()
  const versionId = randomUUID()
  const patchId = randomUUID()
  const legacyAftershow = {
    mode: 'THRESHOLD',
    threshold: {
      audience_comments: 1,
      human_vote_score: 0,
    },
  }
  const baseStageSpec = buildBaseStageSpecWithoutAftershow()
  const legacyRules = {
    stage_spec_v1: baseStageSpec,
    aftershow: legacyAftershow,
  }
  const now = new Date()

  try {
    await client.query(
      `INSERT INTO "human_users" (
         "id",
         "email",
         "password_hash",
         "display_name",
         "created_at",
         "updated_at"
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, `probe-${suffix}@example.com`, 'probe-hash', 'Probe User', now, now],
    )

    await client.query(
      `INSERT INTO "communities" ("id", "name", "slug", "rules_json", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [communityId, 'Probe Community', `probe-community-${suffix}`, JSON.stringify(legacyRules), now, now],
    )

    await client.query(
      `INSERT INTO "community_config_versions" (
         "id",
         "community_id",
         "version",
         "rules_json",
         "status",
         "risk_level",
         "created_at",
         "updated_at"
       ) VALUES ($1, $2, $3, $4::jsonb, $5::"ConfigVersionStatus", $6::"ConfigRiskLevel", $7, $8)`,
      [versionId, communityId, 1, JSON.stringify(legacyRules), 'ACTIVE', 'LOW', now, now],
    )

    await client.query(
      `INSERT INTO "community_config_patches" (
         "id",
         "community_id",
         "base_version_id",
         "status",
         "risk_level",
         "patch_json",
         "proposed_rules_json",
         "proposed_by_user_id",
         "created_at",
         "updated_at"
       ) VALUES (
         $1,
         $2,
         $3,
         $4::"ConfigPatchStatus",
         $5::"ConfigRiskLevel",
         $6::jsonb,
         $7::jsonb,
         $8,
         $9,
         $10
       )`,
      [
        patchId,
        communityId,
        versionId,
        'PROPOSED',
        'LOW',
        JSON.stringify({ aftershow: legacyAftershow }),
        JSON.stringify(legacyRules),
        userId,
        now,
        now,
      ],
    )

    await client.query(migrationSql)

    const communityRow = await client.query(
      `SELECT "rules_json" FROM "communities" WHERE "id" = $1`,
      [communityId],
    )
    const versionRow = await client.query(
      `SELECT "rules_json" FROM "community_config_versions" WHERE "id" = $1`,
      [versionId],
    )
    const patchRow = await client.query(
      `SELECT "patch_json", "proposed_rules_json", "risk_level"
       FROM "community_config_patches"
       WHERE "id" = $1`,
      [patchId],
    )

    const normalizedCommunityRules = communityRow.rows[0]?.rules_json
    const normalizedVersionRules = versionRow.rows[0]?.rules_json
    const normalizedPatch = patchRow.rows[0]
    assert.ok(normalizedCommunityRules?.stage_spec_v1?.aftershow, 'community rules_json should gain a missing stage_spec_v1.aftershow subtree')
    assert.equal(normalizedCommunityRules.aftershow, undefined, 'community rules_json should not keep top-level aftershow')
    assert.deepEqual(
      normalizedCommunityRules.stage_spec_v1.aftershow.threshold,
      { audience_comments: 1, human_vote_score: 0 },
      'community rules_json should preserve the missing aftershow subtree migrated under stage_spec_v1',
    )
    assert.deepEqual(
      normalizedVersionRules.stage_spec_v1.aftershow.threshold,
      { audience_comments: 1, human_vote_score: 0 },
      'version snapshot should be normalized to stage_spec_v1.aftershow',
    )
    assert.deepEqual(
      normalizedPatch.patch_json,
      {
        stage_spec_v1: {
          aftershow: legacyAftershow,
        },
      },
      'patch_json should be normalized to stage_spec_v1-only shape',
    )
    assert.deepEqual(
      normalizedPatch.proposed_rules_json.stage_spec_v1.aftershow.threshold,
      { audience_comments: 1, human_vote_score: 0 },
      'proposed_rules_json should be normalized to stage_spec_v1.aftershow',
    )
    assert.equal(normalizedPatch.proposed_rules_json.aftershow, undefined, 'proposed_rules_json should drop top-level aftershow')
    assert.equal(normalizedPatch.risk_level, 'HIGH', 'normalized stage_spec_v1 patch should be elevated to HIGH risk')
    assert.deepEqual(
      normalizedCommunityRules.stage_spec_v1.aftershow.threshold,
      { audience_comments: 1, human_vote_score: 0 },
      'stage runtime should now read the normalized aftershow threshold from stage_spec_v1',
    )
  } finally {
    await client.end()
  }
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
  }

  let testError = null
  try {
    run('pnpm db:migrate:deploy', testEnv)
    await runConfigNormalizationProbe(isolatedDatabaseUrl)

    run('pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts', testEnv)
    run('pnpm vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts', testEnv)
    run('pnpm vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts -t "Role assignment control-plane endpoints create and update assignments"', testEnv)
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
