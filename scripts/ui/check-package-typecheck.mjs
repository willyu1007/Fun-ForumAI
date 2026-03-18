#!/usr/bin/env node
/**
 * check-package-typecheck.mjs
 * Verifies UI workspace packages and the mobile app typecheck cleanly.
 * Single responsibility: package-level TypeScript validation for UI foundations.
 */

import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

const CHECKS = [
  'pnpm exec tsc -p packages/design-tokens/tsconfig.json',
  'pnpm exec tsc -p packages/ui-contract/tsconfig.json',
  'pnpm exec tsc -p packages/ui-web/tsconfig.json',
  'pnpm exec tsc -p packages/ui-mobile/tsconfig.json',
  'pnpm exec tsc -p apps/mobile/tsconfig.json',
]

function check() {
  try {
    for (const command of CHECKS) {
      console.log(`[CHECK] ${command}`)
      execSync(command, { cwd: ROOT, stdio: 'inherit' })
    }
  } catch (error) {
    console.error('[FAIL] UI package typecheck failed')
    process.exit(1)
  }

  console.log('[PASS] UI packages and mobile theme wrappers typecheck cleanly')
  process.exit(0)
}

check()
