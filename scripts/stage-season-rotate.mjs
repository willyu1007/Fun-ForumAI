#!/usr/bin/env node

import path from 'node:path'
import { applySeasonRotationAtomic } from '../src/backend/stage/stage-template-ops.js'

const root = process.cwd()
const baseDir = path.join(root, 'docs/stage-templates/v1')

function parseArgs(argv) {
  const args = { openCount: 3 }
  for (const part of argv) {
    if (part.startsWith('--open-count=')) {
      args.openCount = Number.parseInt(part.slice('--open-count='.length), 10)
    }
  }
  return args
}

const { openCount } = parseArgs(process.argv.slice(2))
if (!Number.isFinite(openCount) || openCount < 3 || openCount > 5) {
  throw new Error('--open-count must be between 3 and 5')
}

const result = applySeasonRotationAtomic({
  base_dir: baseDir,
  open_count: openCount,
  dry_run: false,
})

console.log('[stage:season:rotate] OK')
console.log(`  open_count=${result.open_count}`)
console.log(`  replaced=${result.replaced.length}`)
console.log(`  activated=${result.activated.length}`)
