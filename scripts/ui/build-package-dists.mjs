#!/usr/bin/env node
/**
 * build-package-dists.mjs
 * Builds distributable JavaScript and type declarations for UI workspace packages.
 * Single responsibility: compile package dist outputs in dependency order.
 */

import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

const DIST_DIRS = [
  'packages/design-tokens/dist',
  'packages/ui-contract/dist',
  'packages/ui-web/dist',
  'packages/ui-mobile/dist',
]

const BUILD_COMMANDS = [
  'pnpm exec tsc -p packages/design-tokens/tsconfig.json',
  'pnpm exec tsc -p packages/ui-contract/tsconfig.json',
  'pnpm exec tsc -p packages/ui-web/tsconfig.json',
  'pnpm exec tsc -p packages/ui-mobile/tsconfig.json',
]

function build() {
  for (const distDir of DIST_DIRS) {
    const distPath = resolve(ROOT, distDir)
    if (existsSync(distPath)) {
      rmSync(distPath, { recursive: true, force: true })
    }
  }

  try {
    for (const command of BUILD_COMMANDS) {
      console.log(`[BUILD] ${command}`)
      execSync(command, { cwd: ROOT, stdio: 'inherit' })
    }
  } catch {
    console.error('[FAIL] UI package dist build failed')
    process.exit(1)
  }

  console.log('[PASS] UI package dist outputs built successfully')
  process.exit(0)
}

build()
