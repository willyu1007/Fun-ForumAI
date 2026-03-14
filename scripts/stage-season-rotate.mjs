#!/usr/bin/env node

import path from 'node:path'
import { applySeasonRotationAtomic } from '../src/backend/stage/stage-template-ops.js'

const root = process.cwd()
const baseDir = path.join(root, 'docs/stage-templates/source')

function parseArgs(argv) {
  const args = { openCount: 3, dryRun: false }
  for (const part of argv) {
    if (part.startsWith('--open-count=')) {
      args.openCount = Number.parseInt(part.slice('--open-count='.length), 10)
      continue
    }
    if (part === '--dry-run') {
      args.dryRun = true
    }
  }
  return args
}

const { openCount, dryRun } = parseArgs(process.argv.slice(2))
if (!Number.isFinite(openCount) || openCount < 3 || openCount > 5) {
  throw new Error('--open-count must be between 3 and 5')
}

const result = applySeasonRotationAtomic({
  base_dir: baseDir,
  dist_dir: path.join(root, 'docs/stage-templates/dist'),
  open_count: openCount,
  dry_run: dryRun,
})

console.log('[stage:season:rotate] OK')
console.log(`  open_count=${result.open_count}`)
console.log(`  dry_run=${result.dry_run}`)
console.log(`  replaced=${result.replaced.length}`)
console.log(`  activated=${result.activated.length}`)
