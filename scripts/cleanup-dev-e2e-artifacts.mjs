#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { Client } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const DEFAULT_ENV_PATH = path.join(REPO_ROOT, '.env.local')
const DEFAULT_DATABASE_URL = `postgresql://${process.env.USER ?? 'postgres'}@localhost:5432/llm_forum_dev`

const COMMUNITY_NAME_REGEX =
  '^(Role Assignment|Config |Membership |Allocator Guard|Audience Raw Read Guard|Governance Action|Aside Seats |Aftershow Permission Community|Aftershow Read Community|Aftershow Read Fallback Community|Audience Message Community|Avatar Visibility Community|Highlights Community|Human Vote Community)$'
const COMMUNITY_SLUG_REGEX =
  '^(role-assignment|config|membership|allocator-guard|audience-raw-read|governance-action|aside-seats)-.*[0-9]{13}$'

function loadLocalEnv() {
  if (!fs.existsSync(DEFAULT_ENV_PATH)) return
  dotenv.config({ path: DEFAULT_ENV_PATH, override: false, quiet: true })
}

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    force: argv.includes('--force'),
  }
}

function getDatabaseName(rawUrl) {
  const url = new URL(rawUrl)
  return url.pathname.replace(/^\//, '')
}

function assertSafeTarget(input) {
  if (input.force) return
  const dbName = getDatabaseName(input.databaseUrl)
  const appEnv = process.env.APP_ENV ?? 'dev'
  if (appEnv !== 'dev' || (!dbName.endsWith('_dev') && dbName !== 'llm_forum_dev')) {
    throw new Error(
      `Refusing to clean database "${dbName}" when APP_ENV=${appEnv}. Use --force if you really mean it.`,
    )
  }
}

async function createTargetTables(client) {
  await client.query(`
    CREATE TEMP TABLE cleanup_target_communities AS
    SELECT id, name, slug
    FROM communities
    WHERE name ~ $1
       OR slug ~ $2
  `, [COMMUNITY_NAME_REGEX, COMMUNITY_SLUG_REGEX])

  await client.query(`
    CREATE TEMP TABLE cleanup_target_posts AS
    SELECT id
    FROM posts
    WHERE community_id IN (SELECT id FROM cleanup_target_communities)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_comments AS
    SELECT id
    FROM comments
    WHERE post_id IN (SELECT id FROM cleanup_target_posts)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_threads AS
    SELECT id
    FROM audience_threads
    WHERE community_id IN (SELECT id FROM cleanup_target_communities)
       OR post_id IN (SELECT id FROM cleanup_target_posts)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_runs AS
    SELECT id
    FROM aftershow_runs
    WHERE community_id IN (SELECT id FROM cleanup_target_communities)
       OR post_id IN (SELECT id FROM cleanup_target_posts)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_artifacts AS
    SELECT id
    FROM aftershow_artifacts
    WHERE community_id IN (SELECT id FROM cleanup_target_communities)
       OR post_id IN (SELECT id FROM cleanup_target_posts)
       OR run_id IN (SELECT id FROM cleanup_target_runs)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_patches AS
    SELECT id
    FROM community_config_patches
    WHERE community_id IN (SELECT id FROM cleanup_target_communities)
  `)
}

async function loadSummary(client) {
  const queries = {
    communities: 'SELECT count(*)::int AS count FROM cleanup_target_communities',
    posts: 'SELECT count(*)::int AS count FROM cleanup_target_posts',
    comments: 'SELECT count(*)::int AS count FROM cleanup_target_comments',
    threads: 'SELECT count(*)::int AS count FROM cleanup_target_threads',
    runs: 'SELECT count(*)::int AS count FROM cleanup_target_runs',
    artifacts: 'SELECT count(*)::int AS count FROM cleanup_target_artifacts',
    patches: 'SELECT count(*)::int AS count FROM cleanup_target_patches',
  }

  const summary = {}
  for (const [key, query] of Object.entries(queries)) {
    const result = await client.query(query)
    summary[key] = result.rows[0]?.count ?? 0
  }

  const sample = await client.query(`
    SELECT name, slug
    FROM cleanup_target_communities
    ORDER BY slug
    LIMIT 12
  `)

  return {
    summary,
    sample: sample.rows,
  }
}

async function deleteTargetData(client) {
  const deletes = [
    ['aftershow_callouts', 'DELETE FROM aftershow_callouts WHERE artifact_id IN (SELECT id FROM cleanup_target_artifacts)'],
    ['community_config_approvals', 'DELETE FROM community_config_approvals WHERE patch_id IN (SELECT id FROM cleanup_target_patches)'],
    ['audience_messages', 'DELETE FROM audience_messages WHERE thread_id IN (SELECT id FROM cleanup_target_threads)'],
    ['audience_summaries', 'DELETE FROM audience_summaries WHERE community_id IN (SELECT id FROM cleanup_target_communities) OR thread_id IN (SELECT id FROM cleanup_target_threads) OR post_id IN (SELECT id FROM cleanup_target_posts)'],
    ['audience_threads', 'DELETE FROM audience_threads WHERE id IN (SELECT id FROM cleanup_target_threads)'],
    ['human_votes', `DELETE FROM human_votes
      WHERE (target_type = 'POST' AND target_id IN (SELECT id FROM cleanup_target_posts))
         OR (target_type = 'COMMENT' AND target_id IN (SELECT id FROM cleanup_target_comments))`],
    ['votes', `DELETE FROM votes
      WHERE (target_type = 'POST' AND target_id IN (SELECT id FROM cleanup_target_posts))
         OR (target_type = 'COMMENT' AND target_id IN (SELECT id FROM cleanup_target_comments))`],
    ['post_media', 'DELETE FROM post_media WHERE post_id IN (SELECT id FROM cleanup_target_posts)'],
    ['forum_scene_metadata', 'DELETE FROM forum_scene_metadata WHERE community_id IN (SELECT id FROM cleanup_target_communities) OR post_id IN (SELECT id FROM cleanup_target_posts) OR comment_id IN (SELECT id FROM cleanup_target_comments)'],
    ['aftershow_artifacts', 'DELETE FROM aftershow_artifacts WHERE id IN (SELECT id FROM cleanup_target_artifacts)'],
    ['aftershow_runs', 'DELETE FROM aftershow_runs WHERE id IN (SELECT id FROM cleanup_target_runs)'],
    ['comments', 'DELETE FROM comments WHERE post_id IN (SELECT id FROM cleanup_target_posts)'],
    ['incubation_jobs', 'DELETE FROM incubation_jobs WHERE community_id IN (SELECT id FROM cleanup_target_communities) OR post_id IN (SELECT id FROM cleanup_target_posts)'],
    ['role_assignments', 'DELETE FROM role_assignments WHERE community_id IN (SELECT id FROM cleanup_target_communities) OR post_id IN (SELECT id FROM cleanup_target_posts)'],
    ['community_config_patches', 'DELETE FROM community_config_patches WHERE id IN (SELECT id FROM cleanup_target_patches)'],
    ['community_config_versions', 'DELETE FROM community_config_versions WHERE community_id IN (SELECT id FROM cleanup_target_communities)'],
    ['community_culture_digests', 'DELETE FROM community_culture_digests WHERE community_id IN (SELECT id FROM cleanup_target_communities)'],
    ['agent_community_memberships', 'DELETE FROM agent_community_memberships WHERE community_id IN (SELECT id FROM cleanup_target_communities)'],
    ['posts', 'DELETE FROM posts WHERE id IN (SELECT id FROM cleanup_target_posts)'],
    ['communities', 'DELETE FROM communities WHERE id IN (SELECT id FROM cleanup_target_communities)'],
  ]

  const results = []
  for (const [label, sql] of deletes) {
    const result = await client.query(sql)
    results.push([label, result.rowCount ?? 0])
  }
  return results
}

async function main() {
  loadLocalEnv()
  const args = parseArgs(process.argv.slice(2))
  const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL

  assertSafeTarget({ databaseUrl, force: args.force })

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    await client.query('BEGIN')
    await createTargetTables(client)
    const { summary, sample } = await loadSummary(client)

    console.log('[cleanup-dev-e2e-artifacts] target summary')
    console.log(JSON.stringify(summary, null, 2))
    if (sample.length > 0) {
      console.log('[cleanup-dev-e2e-artifacts] sample communities')
      for (const row of sample) {
        console.log(`- ${row.slug} :: ${row.name}`)
      }
    }

    if (!args.apply) {
      await client.query('ROLLBACK')
      console.log('[cleanup-dev-e2e-artifacts] dry-run only. Re-run with --apply to delete.')
      return
    }

    const deleted = await deleteTargetData(client)
    await client.query('COMMIT')

    console.log('[cleanup-dev-e2e-artifacts] deleted rows')
    for (const [label, count] of deleted) {
      console.log(`- ${label}: ${count}`)
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('[cleanup-dev-e2e-artifacts] failed', err)
  process.exit(1)
})
