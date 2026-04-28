import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Prisma, PrismaClient } from '@prisma/client'
import { disconnectPrisma, getPrismaClient } from '../persistence/prisma-client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')
const DEFAULT_AUDIT_DIR = resolve(REPO_ROOT, '.ai/.tmp/launch-invalid-content-cleanup')
const DEFAULT_SAMPLE_LIMIT = 20
const SCRIPT_NAME = 'cleanup-invalid-launch-content'

export const CHRONICLE_INVALID_PROVENANCE_SQL = `
(
  entry_source ILIKE 'dev_seed%'
  OR entry_source ILIKE 'system_batch%'
  OR dedup_key LIKE 'canonical-moments:%'
  OR dedup_key LIKE 'batch-daily:%'
  OR dedup_key LIKE 'batch-weekly:%'
  OR title LIKE 'Signal · %'
  OR summary LIKE 'Signal captured for %'
  OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(tags_json) = 'array' THEN tags_json
        ELSE '[]'::jsonb
      END
    ) AS tag(value)
    WHERE tag.value LIKE 'signal:%'
  )
)`

export const ACHIEVEMENT_INVALID_PROVENANCE_SQL = `
(
  trigger_kind IN ('batch_daily', 'batch_weekly')
  OR source_dedup_key LIKE 'batch-daily:%'
  OR source_dedup_key LIKE 'batch-weekly:%'
  OR source_dedup_key LIKE 'canonical-moments:%'
)`

export const SIGNAL_LOG_INVALID_PROVENANCE_SQL = `
(
  signal_kind IN ('batch_daily', 'batch_weekly')
  OR dedup_key LIKE 'batch-daily:%'
  OR dedup_key LIKE 'batch-weekly:%'
  OR dedup_key LIKE 'canonical-moments:%'
)`

const COUNT_SQL = `
SELECT 'chronicle_entries' AS table_name, COUNT(*)::int AS count
FROM chronicle_entries
WHERE created_at >= $1 AND ${CHRONICLE_INVALID_PROVENANCE_SQL}
UNION ALL
SELECT 'agent_achievements' AS table_name, COUNT(*)::int AS count
FROM agent_achievements
WHERE created_at >= $1 AND ${ACHIEVEMENT_INVALID_PROVENANCE_SQL}
UNION ALL
SELECT 'agent_signal_logs' AS table_name, COUNT(*)::int AS count
FROM agent_signal_logs
WHERE created_at >= $1 AND ${SIGNAL_LOG_INVALID_PROVENANCE_SQL}
`

const SOURCE_SAMPLE_SQL = `
SELECT * FROM (
  SELECT
    'chronicle_entries' AS table_name,
    id,
    agent_id,
    created_at,
    COALESCE(entry_source, dedup_key, title) AS marker
  FROM chronicle_entries
  WHERE created_at >= $1 AND ${CHRONICLE_INVALID_PROVENANCE_SQL}
  UNION ALL
  SELECT
    'agent_achievements' AS table_name,
    id,
    agent_id,
    created_at,
    COALESCE(trigger_kind, source_dedup_key, code) AS marker
  FROM agent_achievements
  WHERE created_at >= $1 AND ${ACHIEVEMENT_INVALID_PROVENANCE_SQL}
  UNION ALL
  SELECT
    'agent_signal_logs' AS table_name,
    id,
    agent_id,
    created_at,
    COALESCE(signal_kind, dedup_key) AS marker
  FROM agent_signal_logs
  WHERE created_at >= $1 AND ${SIGNAL_LOG_INVALID_PROVENANCE_SQL}
) candidates
ORDER BY created_at DESC, table_name, id
LIMIT $2
`

const AFFECTED_AGENTS_SQL = `
SELECT DISTINCT agent_id
FROM (
  SELECT agent_id
  FROM chronicle_entries
  WHERE created_at >= $1 AND ${CHRONICLE_INVALID_PROVENANCE_SQL}
  UNION ALL
  SELECT agent_id
  FROM agent_achievements
  WHERE created_at >= $1 AND ${ACHIEVEMENT_INVALID_PROVENANCE_SQL}
  UNION ALL
  SELECT agent_id
  FROM agent_signal_logs
  WHERE created_at >= $1 AND ${SIGNAL_LOG_INVALID_PROVENANCE_SQL}
) affected
ORDER BY agent_id
`

const KEYWORD_SUSPECT_SQL = `
SELECT * FROM (
  SELECT
    'chronicle_entries' AS table_name,
    id,
    agent_id,
    created_at,
    COALESCE(title, '') AS title,
    COALESCE(summary, '') AS body
  FROM chronicle_entries
  WHERE created_at >= $1
    AND NOT ${CHRONICLE_INVALID_PROVENANCE_SQL}
    AND (
      title ~* '(mock|fixed|lazy|placeholder)'
      OR summary ~* '(mock|fixed|lazy|placeholder)'
      OR COALESCE(entry_source, '') ~* '(mock|fixed|lazy|placeholder)'
      OR COALESCE(dedup_key, '') ~* '(mock|fixed|lazy|placeholder)'
    )
  UNION ALL
  SELECT
    'agent_bio_projections' AS table_name,
    agent_id AS id,
    agent_id,
    updated_at AS created_at,
    '' AS title,
    COALESCE(public_bio, '') AS body
  FROM agent_bio_projections
  WHERE updated_at >= $1
    AND COALESCE(public_bio, '') ~* '(mock|fixed|lazy|placeholder)'
) suspects
ORDER BY created_at DESC, table_name, id
LIMIT $2
`

const DELETE_CHRONICLE_SQL = `
WITH deleted AS (
  DELETE FROM chronicle_entries
  WHERE created_at >= $1 AND ${CHRONICLE_INVALID_PROVENANCE_SQL}
  RETURNING id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`

const DELETE_ACHIEVEMENTS_SQL = `
WITH deleted AS (
  DELETE FROM agent_achievements
  WHERE created_at >= $1 AND ${ACHIEVEMENT_INVALID_PROVENANCE_SQL}
  RETURNING id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`

const DELETE_SIGNAL_LOGS_SQL = `
WITH deleted AS (
  DELETE FROM agent_signal_logs
  WHERE created_at >= $1 AND ${SIGNAL_LOG_INVALID_PROVENANCE_SQL}
  RETURNING id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`

const DERIVED_DELETE_SQL: Array<{ key: string; sql: string }> = [
  {
    key: 'biography_chapter_material_refs',
    sql: `
WITH deleted AS (
  DELETE FROM biography_chapter_material_refs
  WHERE agent_id = ANY($1::text[])
  RETURNING id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
  {
    key: 'biography_chapter_revisions',
    sql: `
WITH deleted AS (
  DELETE FROM biography_chapter_revisions
  WHERE agent_id = ANY($1::text[])
  RETURNING id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
  {
    key: 'agent_biography_chapters',
    sql: `
WITH deleted AS (
  DELETE FROM agent_biography_chapters
  WHERE agent_id = ANY($1::text[])
  RETURNING id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
  {
    key: 'agent_biography_materials',
    sql: `
WITH deleted AS (
  DELETE FROM agent_biography_materials
  WHERE agent_id = ANY($1::text[])
  RETURNING id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
  {
    key: 'agent_biography_book_views',
    sql: `
WITH deleted AS (
  DELETE FROM agent_biography_book_views
  WHERE agent_id = ANY($1::text[])
  RETURNING agent_id AS id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
  {
    key: 'biography_book_memories',
    sql: `
WITH deleted AS (
  DELETE FROM biography_book_memories
  WHERE agent_id = ANY($1::text[])
  RETURNING agent_id AS id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
  {
    key: 'agent_bio_render_logs',
    sql: `
WITH deleted AS (
  DELETE FROM agent_bio_render_logs
  WHERE agent_id = ANY($1::text[])
  RETURNING id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
  {
    key: 'agent_bio_projections',
    sql: `
WITH deleted AS (
  DELETE FROM agent_bio_projections
  WHERE agent_id = ANY($1::text[])
  RETURNING agent_id AS id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
  {
    key: 'agent_worldview_states',
    sql: `
WITH deleted AS (
  DELETE FROM agent_worldview_states
  WHERE agent_id = ANY($1::text[])
  RETURNING agent_id AS id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
  {
    key: 'post_search_docs',
    sql: `
WITH deleted AS (
  DELETE FROM post_search_docs
  WHERE author_agent_id = ANY($1::text[])
  RETURNING post_id AS id, author_agent_id AS agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
  {
    key: 'thread_search_docs',
    sql: `
WITH deleted AS (
  DELETE FROM thread_search_docs
  WHERE author_agent_id = ANY($1::text[])
  RETURNING thread_id AS id, author_agent_id AS agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
  {
    key: 'agent_search_docs',
    sql: `
WITH deleted AS (
  DELETE FROM agent_search_docs
  WHERE agent_id = ANY($1::text[])
  RETURNING agent_id AS id, agent_id
)
SELECT id, agent_id FROM deleted ORDER BY id
`,
  },
]

const UPSERT_DIRTY_COMPILE_STATE_SQL = `
INSERT INTO agent_biography_compile_states (
  agent_id,
  dirty,
  dirty_reasons_json,
  compile_status,
  stale_since,
  updated_at,
  created_at
)
SELECT
  agent_id,
  true,
  '["invalid_launch_content_cleanup"]'::jsonb,
  'DIRTY',
  now(),
  now(),
  now()
FROM unnest($1::text[]) AS agent_id
ON CONFLICT (agent_id) DO UPDATE SET
  dirty = true,
  dirty_reasons_json = '["invalid_launch_content_cleanup"]'::jsonb,
  compile_status = 'DIRTY',
  stale_since = COALESCE(agent_biography_compile_states.stale_since, now()),
  updated_at = now()
RETURNING agent_id AS id, agent_id
`

type RawQueryClient = Pick<PrismaClient, '$queryRawUnsafe' | '$transaction'> | Prisma.TransactionClient

export interface CleanupCliOptions {
  apply: boolean
  since: Date | null
  sampleLimit: number
  auditDir: string
  skipDerived: boolean
}

export interface CleanupCutoff {
  value: Date
  source: 'active_kickoff' | 'argument'
  kickoff_baseline_id: string | null
}

interface CountRow {
  table_name: string
  count: number | bigint | string
}

interface IdAgentRow {
  id: string
  agent_id: string
}

interface CandidateSampleRow extends IdAgentRow {
  table_name: string
  created_at: Date
  marker: string | null
}

interface KeywordSuspectRow extends IdAgentRow {
  table_name: string
  created_at: Date
  title: string
  body: string
}

function usage(exitCode = 0): never {
  console.log(`
${SCRIPT_NAME}

Dry-run-first cleanup for post-kickoff synthetic launch content.

Usage:
  pnpm launch.cleanup.invalid -- [--dry-run] [--since <iso>] [--sample-limit <n>] [--audit-dir <path>]
  pnpm launch.cleanup.invalid -- --apply [--since <iso>] [--sample-limit <n>] [--audit-dir <path>]

Options:
  --apply                 Delete provenance-proven invalid source rows and invalidate derived projections.
  --dry-run               Report candidates only. Default.
  --since <iso>           Override cutoff. Default is latest active kickoff activated_at.
  --sample-limit <n>      Number of candidate/suspect sample rows in stdout and audit. Default ${DEFAULT_SAMPLE_LIMIT}.
  --audit-dir <path>      Directory for JSON audit artifacts. Default .ai/.tmp/launch-invalid-content-cleanup.
  --skip-derived          Delete source rows only; leave derived projections untouched.
  --help                  Show this message.
`)
  process.exit(exitCode)
}

function parseIsoDate(value: string, flag: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${flag} is not a valid ISO timestamp: ${value}`)
  }
  return parsed
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer: ${value}`)
  }
  return parsed
}

export function parseCleanupArgs(argv: string[]): CleanupCliOptions {
  const options: CleanupCliOptions = {
    apply: false,
    since: null,
    sampleLimit: DEFAULT_SAMPLE_LIMIT,
    auditDir: DEFAULT_AUDIT_DIR,
    skipDerived: false,
  }
  const modeFlags = new Set<string>()

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--') continue
    if (arg === '--help' || arg === '-h') usage(0)
    if (arg === '--apply') {
      options.apply = true
      modeFlags.add('--apply')
      continue
    }
    if (arg === '--dry-run') {
      options.apply = false
      modeFlags.add('--dry-run')
      continue
    }
    if (arg === '--skip-derived') {
      options.skipDerived = true
      continue
    }
    if (arg === '--since' || arg.startsWith('--since=')) {
      const value = arg.includes('=') ? arg.slice('--since='.length) : argv[++i]
      if (!value) throw new Error('--since requires an ISO timestamp')
      options.since = parseIsoDate(value, '--since')
      continue
    }
    if (arg === '--sample-limit' || arg.startsWith('--sample-limit=')) {
      const value = arg.includes('=') ? arg.slice('--sample-limit='.length) : argv[++i]
      if (!value) throw new Error('--sample-limit requires a value')
      options.sampleLimit = parsePositiveInteger(value, '--sample-limit')
      continue
    }
    if (arg === '--audit-dir' || arg.startsWith('--audit-dir=')) {
      const value = arg.includes('=') ? arg.slice('--audit-dir='.length) : argv[++i]
      if (!value) throw new Error('--audit-dir requires a path')
      options.auditDir = resolve(REPO_ROOT, value)
      continue
    }
    throw new Error(`unknown argument: ${arg}`)
  }

  if (modeFlags.has('--apply') && modeFlags.has('--dry-run')) {
    throw new Error('choose exactly one of --apply or --dry-run')
  }

  return options
}

function toCount(value: number | bigint | string): number {
  return typeof value === 'bigint' ? Number(value) : Number(value)
}

function compactRows(rows: IdAgentRow[]) {
  return {
    count: rows.length,
    ids: rows.map((row) => row.id),
    agent_ids: Array.from(new Set(rows.map((row) => row.agent_id))),
  }
}

async function queryUnsafe<T>(
  client: RawQueryClient,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  return client.$queryRawUnsafe<T[]>(sql, ...params)
}

export async function resolveCleanupCutoff(
  prisma: RawQueryClient,
  since: Date | null,
): Promise<CleanupCutoff> {
  if (since) {
    return {
      value: since,
      source: 'argument',
      kickoff_baseline_id: null,
    }
  }

  const rows = await queryUnsafe<{
    id: string
    activated_at: Date | null
  }>(
    prisma,
    `
SELECT id, activated_at
FROM warmup_suites
WHERE state = 'active' AND activated_at IS NOT NULL
ORDER BY activated_at DESC
LIMIT 1
`,
  )
  const row = rows[0]
  if (!row?.activated_at) {
    throw new Error('no active kickoff activated_at found; pass --since <iso> to set an explicit cutoff')
  }
  return {
    value: row.activated_at,
    source: 'active_kickoff',
    kickoff_baseline_id: row.id,
  }
}

async function readCandidateSnapshot(
  prisma: RawQueryClient,
  cutoff: Date,
  sampleLimit: number,
) {
  const [counts, samples, affectedAgents, keywordSuspects] = await Promise.all([
    queryUnsafe<CountRow>(prisma, COUNT_SQL, cutoff),
    queryUnsafe<CandidateSampleRow>(prisma, SOURCE_SAMPLE_SQL, cutoff, sampleLimit),
    queryUnsafe<{ agent_id: string }>(prisma, AFFECTED_AGENTS_SQL, cutoff),
    queryUnsafe<KeywordSuspectRow>(prisma, KEYWORD_SUSPECT_SQL, cutoff, sampleLimit),
  ])

  return {
    counts: Object.fromEntries(counts.map((row) => [row.table_name, toCount(row.count)])),
    samples: samples.map((row) => ({
      table_name: row.table_name,
      id: row.id,
      agent_id: row.agent_id,
      created_at: row.created_at.toISOString(),
      marker: row.marker,
    })),
    affected_agent_ids: affectedAgents.map((row) => row.agent_id),
    keyword_suspects: keywordSuspects.map((row) => ({
      table_name: row.table_name,
      id: row.id,
      agent_id: row.agent_id,
      created_at: row.created_at.toISOString(),
      title: row.title,
      body: row.body.slice(0, 280),
    })),
  }
}

async function invalidateDerivedForAgents(
  tx: Prisma.TransactionClient,
  agentIds: string[],
) {
  const result: Record<string, ReturnType<typeof compactRows>> = {}
  for (const item of DERIVED_DELETE_SQL) {
    const rows = await queryUnsafe<IdAgentRow>(tx, item.sql, agentIds)
    result[item.key] = compactRows(rows)
  }
  const dirtyRows = await queryUnsafe<IdAgentRow>(tx, UPSERT_DIRTY_COMPILE_STATE_SQL, agentIds)
  result.agent_biography_compile_states_dirty = compactRows(dirtyRows)
  return result
}

async function deleteInvalidSourceRows(tx: Prisma.TransactionClient, cutoff: Date) {
  const [chronicle, achievements, signalLogs] = await Promise.all([
    queryUnsafe<IdAgentRow>(tx, DELETE_CHRONICLE_SQL, cutoff),
    queryUnsafe<IdAgentRow>(tx, DELETE_ACHIEVEMENTS_SQL, cutoff),
    queryUnsafe<IdAgentRow>(tx, DELETE_SIGNAL_LOGS_SQL, cutoff),
  ])
  return {
    chronicle_entries: compactRows(chronicle),
    agent_achievements: compactRows(achievements),
    agent_signal_logs: compactRows(signalLogs),
  }
}

function buildAuditPath(options: CleanupCliOptions): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const mode = options.apply ? 'apply' : 'dry-run'
  return resolve(options.auditDir, `${stamp}-${mode}.json`)
}

async function writeAuditArtifact(options: CleanupCliOptions, payload: unknown): Promise<string> {
  await mkdir(options.auditDir, { recursive: true })
  const path = buildAuditPath(options)
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return path
}

export async function runCleanup(prisma: PrismaClient, options: CleanupCliOptions) {
  const cutoff = await resolveCleanupCutoff(prisma, options.since)
  const before = await readCandidateSnapshot(prisma, cutoff.value, options.sampleLimit)

  let applyResult: Record<string, unknown> | null = null
  if (options.apply) {
    applyResult = await prisma.$transaction(async (tx) => {
      const snapshot = await readCandidateSnapshot(tx, cutoff.value, options.sampleLimit)
      const affectedAgentIds = snapshot.affected_agent_ids
      const derived =
        !options.skipDerived && affectedAgentIds.length > 0
          ? await invalidateDerivedForAgents(tx, affectedAgentIds)
          : {}
      const source = await deleteInvalidSourceRows(tx, cutoff.value)
      return {
        affected_agent_ids: affectedAgentIds,
        derived,
        source,
      }
    })
  }

  const payload = {
    tool: SCRIPT_NAME,
    mode: options.apply ? 'apply' : 'dry-run',
    generated_at: new Date().toISOString(),
    cutoff: {
      source: cutoff.source,
      value: cutoff.value.toISOString(),
      kickoff_baseline_id: cutoff.kickoff_baseline_id,
    },
    options: {
      sample_limit: options.sampleLimit,
      skip_derived: options.skipDerived,
    },
    candidates: before,
    apply_result: applyResult,
    notes: [
      'Deletion is provenance-based only.',
      'keyword_suspects are reported for manual review and are not deleted by this script.',
      options.apply
        ? 'After apply, run launch enrichment/search rebuild flows to regenerate derived content.'
        : 'Pass --apply to execute deletion and derived invalidation.',
    ],
  }
  const audit_path = await writeAuditArtifact(options, payload)
  return { ...payload, audit_path }
}

function isMainModule(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  return fileURLToPath(import.meta.url) === resolve(entry)
}

async function main() {
  const options = parseCleanupArgs(process.argv.slice(2))
  const prisma = getPrismaClient()
  try {
    const result = await runCleanup(prisma, options)
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await disconnectPrisma()
  }
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(`[${SCRIPT_NAME}] failed`, error)
    process.exit(1)
  })
}
