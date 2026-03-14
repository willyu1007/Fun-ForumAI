#!/usr/bin/env node
import {
  DEFAULT_LAUNCH_PATH,
  DEFAULT_REPORT_OUTPUT_BASE,
  createPrismaSession,
  generateDirectorClosureReport,
  loadLocalEnv,
  nowRunId,
  percent,
  readJsonFile,
  summarizeLaunchCatalog,
  writeReportArtifacts,
} from './lib/director-history-shared.mjs'
import { closePrismaSession } from './lib/director-history-shared.mjs'
import { join, resolve } from 'node:path'

function usage(exitCode = 0) {
  console.log(`
director-closure-report.mjs

Generate a read-only director-closure report with current/historical segmentation.

Usage:
  node scripts/director-closure-report.mjs [options]

Options:
  --launch-path <path>  Path to launch.json (default: docs/stage-templates/dist/launch.json)
  --output <dir>        Output directory (default: .ai/.tmp/director-closure/<run-id>)
  --current-since <ts>  Optional ISO timestamp to limit current-window candidates before latest-per-scope reduction
  --use-raw             Read current/historical metrics from raw retained tables instead of summary tables
  --skip-db             Skip Prisma / database queries
  --help
`)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const out = {
    launchPath: DEFAULT_LAUNCH_PATH,
    output: '',
    skipDb: false,
    useRaw: false,
    currentSince: '',
  }

  const args = argv.slice(2)
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i]
    if (token === '--help' || token === '-h') usage(0)
    if (token === '--skip-db') {
      out.skipDb = true
      continue
    }
    if (token === '--use-raw') {
      out.useRaw = true
      continue
    }
    if (!token.startsWith('--')) continue

    const key = token.slice(2)
    const value = args[i + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }

    if (key === 'launch-path') out.launchPath = resolve(value)
    else if (key === 'output') out.output = resolve(value)
    else if (key === 'current-since') out.currentSince = value
    else throw new Error(`Unknown option: --${key}`)
    i += 1
  }

  return out
}

async function main() {
  await loadLocalEnv()
  const args = parseArgs(process.argv)
  const runId = nowRunId()
  const outputDir = args.output || join(DEFAULT_REPORT_OUTPUT_BASE, runId)
  const launchCatalog = await readJsonFile(args.launchPath)
  const currentSince = args.currentSince ? new Date(args.currentSince) : null
  if (currentSince && Number.isNaN(currentSince.getTime())) {
    throw new Error(`Invalid --current-since timestamp: ${args.currentSince}`)
  }

  const report = {
    run_id: runId,
    generated_at: new Date().toISOString(),
    launch_catalog: summarizeLaunchCatalog(launchCatalog),
    database: null,
  }

  if (!args.skipDb && process.env.DATABASE_URL) {
    const session = await createPrismaSession()
    try {
      report.database = await generateDirectorClosureReport(session.prisma, launchCatalog, {
        currentSince,
        useRaw: args.useRaw,
      })
    } catch (error) {
      report.database = {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      }
    } finally {
      await closePrismaSession(session)
    }
  } else {
    report.database = {
      status: 'skipped',
      message: args.skipDb ? 'Skipped by --skip-db' : 'DATABASE_URL is not set',
    }
  }

  await writeReportArtifacts(outputDir, report)

  console.log('[director-closure-report] OK')
  console.log(`  output=${outputDir}`)
  console.log(`  launch.chat_room_bindings=${report.launch_catalog.active_bindings_by_surface.chat_room ?? 0}`)
  if (report.database?.forum) {
    console.log(`  forum.current.scene_hit_rate=${percent(report.database.forum.scene_hit_rate)}`)
    console.log(`  forum.current.selector_fallback_rate=${percent(report.database.forum.selector_fallback_rate)}`)
    console.log(`  forum.historical.scene_hit_rate=${percent(report.database.forum.historical?.scene_hit_rate)}`)
  } else {
    console.log(`  forum=${report.database?.status ?? 'n/a'} (${report.database?.message ?? 'no data'})`)
  }
  if (report.database?.chatroom) {
    console.log(`  chatroom.current.binding_hit_rate=${percent(report.database.chatroom.binding_hit_rate)}`)
    console.log(`  chatroom.current.runtime_sources=${JSON.stringify(report.database.chatroom.runtime_sources)}`)
    console.log(`  chatroom.historical.binding_hit_rate=${percent(report.database.chatroom.historical?.binding_hit_rate)}`)
    console.log(`  chatroom.historical.runtime_sources=${JSON.stringify(report.database.chatroom.historical?.runtime_sources ?? [])}`)
  } else {
    console.log(`  chatroom=${report.database?.status ?? 'n/a'} (${report.database?.message ?? 'no data'})`)
  }
}

main().catch((error) => {
  console.error('[director-closure-report] FAILED')
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
})
