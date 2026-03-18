#!/usr/bin/env node
/**
 * check-generated-clean.mjs
 * Verifies that generated files match what would be regenerated from sources.
 * Single responsibility: drift detection for generated artifacts.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

const GENERATED_FILES = [
  'ui/styles/tokens.css',
  'packages/design-tokens/styles/tokens.css',
  'ui/codegen/contract-types.ts',
  'packages/ui-contract/src/generated/contract-types.ts',
  'ui/codegen/contract-manifest.json',
  'packages/ui-contract/contract/contract-manifest.json',
  'packages/ui-contract/contract/contract.json',
  'ui/codegen/web-theme.ts',
  'packages/design-tokens/src/generated/web-theme.ts',
  'ui/codegen/mobile-theme.ts',
  'packages/design-tokens/src/generated/mobile-theme.ts',
  'packages/ui-web/styles/contract.css',
]

function check() {
  const errors = []
  const warnings = []

  // Store current content
  const originalContent = {}
  for (const file of GENERATED_FILES) {
    const path = resolve(ROOT, file)
    if (existsSync(path)) {
      originalContent[file] = readFileSync(path, 'utf-8')
    } else {
      warnings.push(`Generated file missing: ${file}`)
    }
  }

  // Regenerate all
  console.log('Regenerating artifacts to check for drift...')
  try {
    execSync('node scripts/ui/build-tokens-css.mjs', { cwd: ROOT, stdio: 'pipe' })
    execSync('node scripts/ui/build-contract-types.mjs', { cwd: ROOT, stdio: 'pipe' })
    execSync('node scripts/ui/build-contract-manifest.mjs', { cwd: ROOT, stdio: 'pipe' })
    execSync('node scripts/ui/build-web-theme.mjs', { cwd: ROOT, stdio: 'pipe' })
    execSync('node scripts/ui/build-mobile-theme.mjs', { cwd: ROOT, stdio: 'pipe' })
    execSync('node scripts/ui/sync-package-artifacts.mjs', { cwd: ROOT, stdio: 'pipe' })
  } catch (e) {
    console.error(`[FAIL] Build failed: ${e.message}`)
    process.exit(1)
  }

  // Compare
  for (const file of GENERATED_FILES) {
    const path = resolve(ROOT, file)
    if (!existsSync(path)) {
      continue
    }

    const newContent = readFileSync(path, 'utf-8')
    const oldContent = originalContent[file]

    if (!oldContent) {
      warnings.push(`New generated file: ${file}`)
      continue
    }

    const normalizeForCompare = (content) => content

    if (normalizeForCompare(newContent) !== normalizeForCompare(oldContent)) {
      errors.push(`Drift detected in: ${file}`)
    }
  }

  // Restore original content
  for (const [file, content] of Object.entries(originalContent)) {
    const path = resolve(ROOT, file)
    writeFileSync(path, content, 'utf-8')
  }

  if (warnings.length > 0) {
    console.log('Warnings:')
    warnings.forEach(w => console.log(`  - ${w}`))
  }

  if (errors.length > 0) {
    console.error('[FAIL] Generated files have drifted from sources:')
    errors.forEach(e => console.error(`  - ${e}`))
    console.error('\nRun `pnpm ui:build` to regenerate.')
    process.exit(1)
  }

  console.log('[PASS] All generated files are clean')
  process.exit(0)
}

check()
