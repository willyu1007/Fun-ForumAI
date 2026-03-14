#!/usr/bin/env node
import {
  DEFAULT_BATCH_LIMIT,
  DEFAULT_LAUNCH_PATH,
  DEFAULT_RETENTION_DAYS,
  createPrismaSession,
  loadLocalEnv,
  readJsonFile,
  refreshDirectorHistorySummaries,
  runDirectorHistoryMaintenance,
} from './lib/director-history-shared.mjs'
import { closePrismaSession } from './lib/director-history-shared.mjs'
import { resolve } from 'node:path'

function usage(exitCode = 0) {
  console.log(`
director-history-maintenance.mjs

Run archive / summary maintenance for director history retention.

Usage:
  node scripts/director-history-maintenance.mjs <command> [options]

Commands:
  dry-run
  archive
  backfill
  refresh-summary
  run-daily

Options:
  --launch-path <path>     Path to launch.json (default: docs/stage-templates/dist/launch.json)
  --retention-days <days>  Hot retention window in days (default: 90)
  --batch-limit <count>    Batch size per archive table (default: 500)
  --help
`)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const command = args[0]
  if (!command || command === '--help' || command === '-h') usage(0)

  const out = {
    command,
    launchPath: DEFAULT_LAUNCH_PATH,
    retentionDays: DEFAULT_RETENTION_DAYS,
    batchLimit: DEFAULT_BATCH_LIMIT,
  }

  for (let i = 1; i < args.length; i += 1) {
    const token = args[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = args[i + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }

    if (key === 'launch-path') out.launchPath = resolve(value)
    else if (key === 'retention-days') out.retentionDays = Number(value)
    else if (key === 'batch-limit') out.batchLimit = Number(value)
    else throw new Error(`Unknown option: --${key}`)
    i += 1
  }

  if (!Number.isFinite(out.retentionDays) || out.retentionDays <= 0) {
    throw new Error('--retention-days must be > 0')
  }
  if (!Number.isFinite(out.batchLimit) || out.batchLimit <= 0) {
    throw new Error('--batch-limit must be > 0')
  }
  return out
}

async function main() {
  await loadLocalEnv()
  const args = parseArgs(process.argv)
  const needsLaunch = ['backfill', 'refresh-summary', 'run-daily'].includes(args.command)
  const launchCatalog = needsLaunch ? await readJsonFile(args.launchPath) : null
  const session = await createPrismaSession()

  try {
    let result
    if (args.command === 'dry-run') {
      result = await runDirectorHistoryMaintenance(session.prisma, null, {
        dryRun: true,
        jobType: 'dry_run',
        retentionDays: args.retentionDays,
        batchLimit: args.batchLimit,
      })
    } else if (args.command === 'archive') {
      result = await runDirectorHistoryMaintenance(session.prisma, null, {
        dryRun: false,
        jobType: 'archive',
        retentionDays: args.retentionDays,
        batchLimit: args.batchLimit,
      })
    } else if (args.command === 'backfill') {
      result = await runDirectorHistoryMaintenance(session.prisma, launchCatalog, {
        dryRun: false,
        jobType: 'backfill',
        retentionDays: args.retentionDays,
        batchLimit: args.batchLimit,
      })
    } else if (args.command === 'refresh-summary') {
      if (!launchCatalog) {
        throw new Error('launch catalog is required for refresh-summary')
      }
      result = await refreshDirectorHistorySummaries(session.prisma, launchCatalog, new Date())
    } else if (args.command === 'run-daily') {
      if (!launchCatalog) {
        throw new Error('launch catalog is required for run-daily')
      }
      result = await runDirectorHistoryMaintenance(session.prisma, launchCatalog, {
        dryRun: false,
        jobType: 'run_daily',
        retentionDays: args.retentionDays,
        batchLimit: args.batchLimit,
      })
    } else {
      throw new Error(`Unknown command: ${args.command}`)
    }

    console.log('[director-history-maintenance] OK')
    console.log(JSON.stringify({
      command: args.command,
      retention_days: args.retentionDays,
      batch_limit: args.batchLimit,
      result,
    }, null, 2))
  } finally {
    await closePrismaSession(session)
  }
}

main().catch((error) => {
  console.error('[director-history-maintenance] FAILED')
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
})
