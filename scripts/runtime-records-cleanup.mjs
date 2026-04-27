#!/usr/bin/env node
//
// T-301 Slice 6 — runtime operation record retention cleanup CLI.
//
// Default mode is dry-run. Pass --apply to execute the deletes.
//
// Retention contract (locked in dev-docs/active/runtime-operation-records-console/07-contract-review.md):
//   error / critical: 90 days
//   warn:             30 days
//   info / succeeded: 7 days  (only sampled lifecycle markers are stored at this severity)
//
// Cleanup MUST only delete `runtime_operation_records` rows.
// Records linked to a `RiskEventLog` (`linked_risk_event_id IS NOT NULL`) are
// excluded from ordinary cleanup unless explicitly approved.

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const DAY_MS = 86_400_000

// MUST stay in sync with `RUNTIME_OPERATION_RETENTION_DAYS` in
// `src/backend/services/runtime-operation-record-service.ts`. The cross-check
// test in `scripts/__tests__/runtime-records-cleanup.test.ts` imports both
// modules and asserts the cutoffs are byte-identical for the same `now`.
const RETENTION_DAYS = {
  errorCritical: 90,
  warn: 30,
  info: 7,
}

function usage(exitCode = 0) {
  console.log(`
runtime-records-cleanup.mjs

Apply T-301 retention policy to the runtime_operation_records table.
Default mode is --dry-run. Use --apply to delete.

Usage:
  node scripts/runtime-records-cleanup.mjs [--apply | --dry-run] [--now <iso>]

Options:
  --apply              Delete expired rows. Default is dry-run.
  --dry-run            Report counts only (this is the default).
  --now <iso>          Override the current time used to compute cutoffs (ISO 8601).
  --help               Show this message.

Examples:
  node scripts/runtime-records-cleanup.mjs                        # dry-run
  node scripts/runtime-records-cleanup.mjs --apply                # delete
  node scripts/runtime-records-cleanup.mjs --apply --now <iso>    # pinned now
  pnpm runtime-records:cleanup                                    # dry-run via pnpm
  pnpm runtime-records:cleanup:apply                              # delete via pnpm
`)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const out = { apply: false, now: null }
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === '--help' || a === '-h') usage(0)
    else if (a === '--dry-run') out.apply = false
    else if (a === '--apply') out.apply = true
    else if (a === '--now') {
      const value = args[i + 1]
      if (!value) {
        console.error('--now requires an ISO timestamp argument')
        process.exit(2)
      }
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) {
        console.error(`--now is not a valid ISO timestamp: ${value}`)
        process.exit(2)
      }
      out.now = parsed
      i += 1
    } else {
      console.error(`unknown argument: ${a}`)
      usage(2)
    }
  }
  return out
}

async function loadLocalEnv() {
  const envPath = resolve(ROOT, '.env.local')
  try {
    await access(envPath, constants.F_OK)
  } catch {
    return
  }
  const raw = await readFile(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const normalized = line.trim()
    if (!normalized || normalized.startsWith('#')) continue
    const separatorIndex = normalized.indexOf('=')
    if (separatorIndex <= 0) continue
    const key = normalized.slice(0, separatorIndex).trim()
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue
    const rawValue = normalized.slice(separatorIndex + 1).trim()
    const unquoted = rawValue.startsWith('"') && rawValue.endsWith('"')
      ? rawValue.slice(1, -1)
      : rawValue.startsWith("'") && rawValue.endsWith("'")
        ? rawValue.slice(1, -1)
        : rawValue
    process.env[key] = unquoted
  }
}

export function computeRetentionCutoffs(now) {
  return {
    errorCriticalBefore: new Date(now.getTime() - RETENTION_DAYS.errorCritical * DAY_MS),
    warnBefore: new Date(now.getTime() - RETENTION_DAYS.warn * DAY_MS),
    infoBefore: new Date(now.getTime() - RETENTION_DAYS.info * DAY_MS),
  }
}

async function countDryRun(prisma, cutoffs) {
  const [errorCritical, warn, info] = await Promise.all([
    prisma.runtimeOperationRecord.count({
      where: {
        linkedRiskEventId: null,
        severity: { in: ['critical', 'error'] },
        occurredAt: { lt: cutoffs.errorCriticalBefore },
      },
    }),
    prisma.runtimeOperationRecord.count({
      where: {
        linkedRiskEventId: null,
        severity: 'warn',
        occurredAt: { lt: cutoffs.warnBefore },
      },
    }),
    prisma.runtimeOperationRecord.count({
      where: {
        linkedRiskEventId: null,
        severity: 'info',
        occurredAt: { lt: cutoffs.infoBefore },
      },
    }),
  ])
  return { errorCritical, warn, info, total: errorCritical + warn + info }
}

async function applyDelete(prisma, cutoffs) {
  const result = await prisma.runtimeOperationRecord.deleteMany({
    where: {
      linkedRiskEventId: null,
      OR: [
        { severity: { in: ['critical', 'error'] }, occurredAt: { lt: cutoffs.errorCriticalBefore } },
        { severity: 'warn', occurredAt: { lt: cutoffs.warnBefore } },
        { severity: 'info', occurredAt: { lt: cutoffs.infoBefore } },
      ],
    },
  })
  return { deleted: result.count }
}

async function createPrismaSession() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  return { prisma, pool }
}

async function closePrismaSession(session) {
  await session.prisma.$disconnect().catch(() => null)
  await session.pool.end().catch(() => null)
}

async function main() {
  const opts = parseArgs(process.argv)
  await loadLocalEnv()

  const now = opts.now ?? new Date()
  const cutoffs = computeRetentionCutoffs(now)
  const session = await createPrismaSession()

  try {
    if (opts.apply) {
      const dryRun = await countDryRun(session.prisma, cutoffs)
      console.log(JSON.stringify({
        mode: 'apply',
        now: now.toISOString(),
        cutoffs: {
          error_critical_before: cutoffs.errorCriticalBefore.toISOString(),
          warn_before: cutoffs.warnBefore.toISOString(),
          info_before: cutoffs.infoBefore.toISOString(),
        },
        candidates: dryRun,
      }, null, 2))
      const result = await applyDelete(session.prisma, cutoffs)
      console.log(JSON.stringify({
        mode: 'apply',
        result,
      }, null, 2))
    } else {
      const dryRun = await countDryRun(session.prisma, cutoffs)
      console.log(JSON.stringify({
        mode: 'dry-run',
        now: now.toISOString(),
        cutoffs: {
          error_critical_before: cutoffs.errorCriticalBefore.toISOString(),
          warn_before: cutoffs.warnBefore.toISOString(),
          info_before: cutoffs.infoBefore.toISOString(),
        },
        candidates: dryRun,
        note: 'pass --apply to delete',
      }, null, 2))
    }
  } finally {
    await closePrismaSession(session)
  }
}

// Allow `node` direct execution; skip on import for tests.
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : String(err))
    process.exit(1)
  })
}
