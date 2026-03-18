#!/usr/bin/env node
/**
 * index.mjs
 * Orchestration entry point for UI scripts.
 * Single responsibility: command routing only, no business logic.
 * 
 * Usage:
 *   node scripts/ui/index.mjs build   # Run all build scripts
 *   node scripts/ui/index.mjs check   # Run all check scripts
 *   node scripts/ui/index.mjs validate # Run all validation scripts
 */

import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

const SCRIPTS = {
  validate: [
    'validate-token-schema.mjs',
    'validate-theme-schema.mjs',
    'validate-contract-schema.mjs',
  ],
  buildGenerated: [
    'build-tokens-css.mjs',
    'build-web-theme.mjs',
    'build-mobile-theme.mjs',
    'build-contract-types.mjs',
    'build-contract-manifest.mjs',
    'sync-package-artifacts.mjs',
  ],
  buildPackages: [
    'build-package-dists.mjs',
  ],
  check: [
    'check-contract-codegen-drift.mjs',
    'check-generated-clean.mjs',
    'check-package-typecheck.mjs',
    'check-package-runtime-consumption.mjs',
    'check-theme-protocol.mjs',
  ],
}

function run(scripts) {
  let failed = false

  for (const script of scripts) {
    const scriptPath = resolve(__dirname, script)
    console.log(`\n--- Running ${script} ---`)

    try {
      execSync(`node ${scriptPath}`, { cwd: ROOT, stdio: 'inherit' })
    } catch {
      failed = true
      console.error(`[FAIL] ${script} failed`)
    }
  }

  return failed
}

function main() {
  const command = process.argv[2]

  if (!command) {
    console.log('Usage: node scripts/ui/index.mjs <command>')
    console.log('Commands: build, build-generated, check, validate, all')
    process.exit(1)
  }

  let failed = false

  switch (command) {
    case 'validate':
      failed = run(SCRIPTS.validate)
      break

    case 'build':
      failed = run(SCRIPTS.validate)
      if (!failed) {
        failed = run(SCRIPTS.buildGenerated)
      }
      if (!failed) {
        failed = run(SCRIPTS.buildPackages)
      }
      break

    case 'build-generated':
      failed = run(SCRIPTS.validate)
      if (!failed) {
        failed = run(SCRIPTS.buildGenerated)
      }
      break

    case 'check':
      failed = run(SCRIPTS.check)
      break

    case 'all':
      failed = run(SCRIPTS.validate)
      if (!failed) {
        failed = run(SCRIPTS.buildGenerated)
      }
      if (!failed) {
        failed = run(SCRIPTS.buildPackages)
      }
      if (!failed) {
        failed = run(SCRIPTS.check)
      }
      break

    default:
      console.error(`Unknown command: ${command}`)
      console.log('Commands: build, build-generated, check, validate, all')
      process.exit(1)
  }

  if (failed) {
    console.error('\n[FAIL] Some scripts failed')
    process.exit(1)
  }

  console.log('\n[DONE] All scripts completed successfully')
  process.exit(0)
}

main()
