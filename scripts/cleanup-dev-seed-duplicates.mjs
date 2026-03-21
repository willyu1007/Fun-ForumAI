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

const MANAGED_SEED_IDENTITIES = [
  { owner_id: 'dev-user-001', display_name: '苏格拉底-7B' },
  { owner_id: 'dev-user-001', display_name: '洛芙蕾丝' },
  { owner_id: 'dev-user-001', display_name: '辩论大师' },
  { owner_id: 'dev-user-001', display_name: '俳句师' },
  { owner_id: 'dev-admin-001', display_name: '代码审查官' },
]

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
    CREATE TEMP TABLE cleanup_seed_identities (
      owner_id text NOT NULL,
      display_name text NOT NULL
    ) ON COMMIT DROP
  `)

  for (const identity of MANAGED_SEED_IDENTITIES) {
    await client.query(
      'INSERT INTO cleanup_seed_identities (owner_id, display_name) VALUES ($1, $2)',
      [identity.owner_id, identity.display_name],
    )
  }

  await client.query(`
    CREATE TEMP TABLE cleanup_target_agents AS
    WITH ranked AS (
      SELECT
        a.id,
        a.owner_id,
        a.display_name,
        a.created_at,
        row_number() OVER (
          PARTITION BY a.owner_id, a.display_name
          ORDER BY a.created_at ASC, a.id ASC
        ) AS rn
      FROM agents a
      INNER JOIN cleanup_seed_identities i
        ON i.owner_id = a.owner_id
       AND i.display_name = a.display_name
    )
    SELECT id, owner_id, display_name, created_at
    FROM ranked
    WHERE rn > 1
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_posts AS
    SELECT id
    FROM posts
    WHERE author_agent_id IN (SELECT id FROM cleanup_target_agents)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_comments AS
    SELECT id
    FROM comments
    WHERE author_agent_id IN (SELECT id FROM cleanup_target_agents)
       OR post_id IN (SELECT id FROM cleanup_target_posts)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_threads AS
    SELECT id
    FROM audience_threads
    WHERE post_id IN (SELECT id FROM cleanup_target_posts)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_audience_messages AS
    SELECT id
    FROM audience_messages
    WHERE thread_id IN (SELECT id FROM cleanup_target_threads)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_aftershow_runs AS
    SELECT id
    FROM aftershow_runs
    WHERE post_id IN (SELECT id FROM cleanup_target_posts)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_aftershow_artifacts AS
    SELECT id
    FROM aftershow_artifacts
    WHERE post_id IN (SELECT id FROM cleanup_target_posts)
       OR run_id IN (SELECT id FROM cleanup_target_aftershow_runs)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_sessions AS
    SELECT id
    FROM private_sessions
    WHERE agent_id IN (SELECT id FROM cleanup_target_agents)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_rooms AS
    SELECT id
    FROM rooms
    WHERE created_by_agent_id IN (SELECT id FROM cleanup_target_agents)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_room_episodes AS
    SELECT id
    FROM room_episodes
    WHERE room_id IN (SELECT id FROM cleanup_target_rooms)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_room_program_events AS
    SELECT id
    FROM room_program_events
    WHERE room_id IN (SELECT id FROM cleanup_target_rooms)
  `)

  await client.query(`
    CREATE TEMP TABLE cleanup_target_room_messages AS
    SELECT id
    FROM room_messages
    WHERE room_id IN (SELECT id FROM cleanup_target_rooms)
       OR author_agent_id IN (SELECT id FROM cleanup_target_agents)
  `)
}

async function loadSummary(client) {
  const queries = {
    duplicate_agents: 'SELECT count(*)::int AS count FROM cleanup_target_agents',
    duplicate_posts: 'SELECT count(*)::int AS count FROM cleanup_target_posts',
    duplicate_comments: 'SELECT count(*)::int AS count FROM cleanup_target_comments',
    duplicate_private_sessions: 'SELECT count(*)::int AS count FROM cleanup_target_sessions',
    duplicate_rooms: 'SELECT count(*)::int AS count FROM cleanup_target_rooms',
  }

  const summary = {}
  for (const [key, query] of Object.entries(queries)) {
    const result = await client.query(query)
    summary[key] = result.rows[0]?.count ?? 0
  }

  const sample = await client.query(`
    SELECT owner_id, display_name, id, created_at
    FROM cleanup_target_agents
    ORDER BY owner_id, display_name, created_at
    LIMIT 20
  `)

  return {
    summary,
    sample: sample.rows,
  }
}

async function deleteByAgentColumn(client, table, column) {
  return client.query(
    `DELETE FROM ${table} WHERE ${column} IN (SELECT id FROM cleanup_target_agents)`,
  )
}

async function deleteByAgentColumns(client, table, columns) {
  const whereClause = columns
    .map((column) => `${column} IN (SELECT id FROM cleanup_target_agents)`)
    .join(' OR ')
  return client.query(`DELETE FROM ${table} WHERE ${whereClause}`)
}

async function deleteTargetData(client) {
  const results = []

  const directAgentTables = [
    ['active_tension_items', 'agent_id'],
    ['agent_achievements', 'agent_id'],
    ['agent_active_overlays', 'agent_id'],
    ['agent_budgets', 'agent_id'],
    ['agent_community_memberships', 'agent_id'],
    ['agent_configs', 'agent_id'],
    ['agent_credits', 'agent_id'],
    ['agent_inclination_assets', 'agent_id'],
    ['agent_inference_profiles', 'agent_id'],
    ['agent_inference_shadow_reviews', 'agent_id'],
    ['agent_instructions', 'agent_id'],
    ['agent_memories', 'agent_id'],
    ['agent_persona_delta_logs', 'agent_id'],
    ['agent_persona_states', 'agent_id'],
    ['agent_privacy_settings', 'agent_id'],
    ['agent_public_projections', 'agent_id'],
    ['agent_runs', 'agent_id'],
    ['agent_signal_logs', 'agent_id'],
    ['agent_stage_tier_snapshots', 'agent_id'],
    ['agent_stat_events', 'agent_id'],
    ['agent_states', 'agent_id'],
    ['agent_stats', 'agent_id'],
    ['agent_traits', 'agent_id'],
    ['agent_xp', 'agent_id'],
    ['chronicle_entries', 'agent_id'],
    ['context_relation_states', 'agent_id'],
    ['cost_logs', 'agent_id'],
    ['credit_events', 'agent_id'],
    ['episodic_cards', 'agent_id'],
    ['human_agent_follows', 'agent_id'],
    ['legacy_growth_events_archive', 'agent_id'],
    ['private_shadow_memories', 'agent_id'],
    ['raw_context_events', 'agent_id'],
    ['self_model_states', 'agent_id'],
    ['xp_events', 'agent_id'],
  ]

  const multiAgentTables = [
    ['agent_relation_events', ['from_agent_id', 'to_agent_id']],
    ['agent_relations', ['from_agent_id', 'to_agent_id']],
    ['ppr_snapshots', ['candidate_agent_id', 'source_agent_id']],
  ]

  const deletes = [
    ['aftershow_callouts', `
      DELETE FROM aftershow_callouts
      WHERE artifact_id IN (SELECT id FROM cleanup_target_aftershow_artifacts)
         OR audience_message_id IN (SELECT id FROM cleanup_target_audience_messages)
    `],
    ['message_reactions', `
      DELETE FROM message_reactions
      WHERE message_id IN (SELECT id FROM cleanup_target_room_messages)
         OR reactor_agent_id IN (SELECT id FROM cleanup_target_agents)
    `],
    ['audience_messages', 'DELETE FROM audience_messages WHERE id IN (SELECT id FROM cleanup_target_audience_messages)'],
    ['audience_summaries', `
      DELETE FROM audience_summaries
      WHERE thread_id IN (SELECT id FROM cleanup_target_threads)
         OR post_id IN (SELECT id FROM cleanup_target_posts)
    `],
    ['audience_threads', 'DELETE FROM audience_threads WHERE id IN (SELECT id FROM cleanup_target_threads)'],
    ['human_votes', `
      DELETE FROM human_votes
      WHERE (target_type = 'POST' AND target_id IN (SELECT id FROM cleanup_target_posts))
         OR (target_type = 'COMMENT' AND target_id IN (SELECT id FROM cleanup_target_comments))
    `],
    ['votes', `
      DELETE FROM votes
      WHERE voter_agent_id IN (SELECT id FROM cleanup_target_agents)
         OR (target_type = 'POST' AND target_id IN (SELECT id FROM cleanup_target_posts))
         OR (target_type = 'COMMENT' AND target_id IN (SELECT id FROM cleanup_target_comments))
    `],
    ['post_media', 'DELETE FROM post_media WHERE post_id IN (SELECT id FROM cleanup_target_posts)'],
    ['forum_scene_metadata', `
      DELETE FROM forum_scene_metadata
      WHERE post_id IN (SELECT id FROM cleanup_target_posts)
         OR comment_id IN (SELECT id FROM cleanup_target_comments)
    `],
    ['notifications', `
      DELETE FROM notifications
      WHERE target_id IN (SELECT id FROM cleanup_target_agents)
         OR target_id IN (SELECT id FROM cleanup_target_posts)
         OR target_id IN (SELECT id FROM cleanup_target_comments)
         OR target_id IN (SELECT id FROM cleanup_target_sessions)
         OR target_id IN (SELECT id FROM cleanup_target_rooms)
    `],
    ['private_messages', 'DELETE FROM private_messages WHERE session_id IN (SELECT id FROM cleanup_target_sessions)'],
    ['room_selection_ledgers_by_room', `
      DELETE FROM room_selection_ledgers
      WHERE room_id IN (SELECT id FROM cleanup_target_rooms)
    `],
    ['room_selection_ledgers_by_program_event', `
      DELETE FROM room_selection_ledgers
      WHERE program_event_id IN (SELECT id FROM cleanup_target_room_program_events)
    `],
    ['room_selection_ledgers_by_candidate', `
      DELETE FROM room_selection_ledgers
      WHERE candidate_agent_id IN (SELECT id FROM cleanup_target_agents)
    `],
    ['room_highlights', `
      DELETE FROM room_highlights
      WHERE room_id IN (SELECT id FROM cleanup_target_rooms)
         OR source_message_id IN (SELECT id FROM cleanup_target_room_messages)
    `],
    ['room_shared_memories', 'DELETE FROM room_shared_memories WHERE room_id IN (SELECT id FROM cleanup_target_rooms)'],
    ['room_live_snapshots', 'DELETE FROM room_live_snapshots WHERE room_id IN (SELECT id FROM cleanup_target_rooms)'],
    ['room_messages', 'DELETE FROM room_messages WHERE id IN (SELECT id FROM cleanup_target_room_messages)'],
    ['room_program_events', `
      DELETE FROM room_program_events
      WHERE id IN (SELECT id FROM cleanup_target_room_program_events)
    `],
    ['room_episode_beats', `
      DELETE FROM room_episode_beats
      WHERE room_id IN (SELECT id FROM cleanup_target_rooms)
    `],
    ['room_episode_casts', `
      DELETE FROM room_episode_casts
      WHERE room_id IN (SELECT id FROM cleanup_target_rooms)
         OR agent_id IN (SELECT id FROM cleanup_target_agents)
    `],
    ['room_episodes', 'DELETE FROM room_episodes WHERE id IN (SELECT id FROM cleanup_target_room_episodes)'],
    ['room_programs', 'DELETE FROM room_programs WHERE room_id IN (SELECT id FROM cleanup_target_rooms)'],
    ['room_memberships', `
      DELETE FROM room_memberships
      WHERE room_id IN (SELECT id FROM cleanup_target_rooms)
         OR agent_id IN (SELECT id FROM cleanup_target_agents)
    `],
    ['rooms', 'DELETE FROM rooms WHERE id IN (SELECT id FROM cleanup_target_rooms)'],
    ['aftershow_artifacts', 'DELETE FROM aftershow_artifacts WHERE id IN (SELECT id FROM cleanup_target_aftershow_artifacts)'],
    ['aftershow_runs', 'DELETE FROM aftershow_runs WHERE id IN (SELECT id FROM cleanup_target_aftershow_runs)'],
    ['agent_memories_by_session', 'DELETE FROM agent_memories WHERE source_session_id IN (SELECT id FROM cleanup_target_sessions)'],
    ['private_sessions', 'DELETE FROM private_sessions WHERE id IN (SELECT id FROM cleanup_target_sessions)'],
    ['comments', `
      DELETE FROM comments
      WHERE id IN (SELECT id FROM cleanup_target_comments)
         OR post_id IN (SELECT id FROM cleanup_target_posts)
    `],
    ['posts', 'DELETE FROM posts WHERE id IN (SELECT id FROM cleanup_target_posts)'],
    ['incubation_jobs', `
      DELETE FROM incubation_jobs
      WHERE proposer_agent_id IN (SELECT id FROM cleanup_target_agents)
         OR post_id IN (SELECT id FROM cleanup_target_posts)
    `],
    ['incubation_grants', 'DELETE FROM incubation_grants WHERE reviewer_agent_id IN (SELECT id FROM cleanup_target_agents)'],
    ['role_assignments', `
      DELETE FROM role_assignments
      WHERE agent_id IN (SELECT id FROM cleanup_target_agents)
         OR post_id IN (SELECT id FROM cleanup_target_posts)
    `],
  ]

  for (const [label, sql] of deletes) {
    const result = await client.query(sql)
    results.push([label, result.rowCount ?? 0])
  }

  for (const [table, column] of directAgentTables) {
    const result = await deleteByAgentColumn(client, table, column)
    results.push([table, result.rowCount ?? 0])
  }

  for (const [table, columns] of multiAgentTables) {
    const result = await deleteByAgentColumns(client, table, columns)
    results.push([table, result.rowCount ?? 0])
  }

  const agentResult = await client.query('DELETE FROM agents WHERE id IN (SELECT id FROM cleanup_target_agents)')
  results.push(['agents', agentResult.rowCount ?? 0])

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

    console.log('[cleanup-dev-seed-duplicates] target summary')
    console.log(JSON.stringify(summary, null, 2))
    if (sample.length > 0) {
      console.log('[cleanup-dev-seed-duplicates] sample duplicate agents')
      for (const row of sample) {
        console.log(`- ${row.owner_id} :: ${row.display_name} :: ${row.id} :: ${row.created_at.toISOString?.() ?? row.created_at}`)
      }
    }

    if (!args.apply) {
      await client.query('ROLLBACK')
      console.log('[cleanup-dev-seed-duplicates] dry-run only. Re-run with --apply to delete.')
      return
    }

    const deleted = await deleteTargetData(client)
    await client.query('COMMIT')

    console.log('[cleanup-dev-seed-duplicates] deleted rows')
    for (const [label, count] of deleted) {
      if (count > 0) {
        console.log(`- ${label}: ${count}`)
      }
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('[cleanup-dev-seed-duplicates] failed', err)
  process.exit(1)
})
