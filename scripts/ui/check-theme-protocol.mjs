#!/usr/bin/env node
/**
 * check-theme-protocol.mjs
 * Verifies theme protocol consistency across files.
 * Single responsibility: theme protocol validation.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

const TOKENS_CSS = resolve(ROOT, 'ui/styles/tokens.css')
const INDEX_CSS = resolve(ROOT, 'src/frontend/index.css')

function check() {
  const errors = []
  const warnings = []

  // Check tokens.css uses data-theme
  if (existsSync(TOKENS_CSS)) {
    const tokensCss = readFileSync(TOKENS_CSS, 'utf-8')

    if (!tokensCss.includes('data-theme')) {
      errors.push('tokens.css does not use data-theme attribute for theming')
    }

    if (tokensCss.includes('.dark {') || tokensCss.includes('.dark{')) {
      warnings.push('tokens.css uses .dark class (should use data-theme only)')
    }
  } else {
    errors.push('tokens.css not found')
  }

  // Check index.css for protocol
  if (existsSync(INDEX_CSS)) {
    const indexCss = readFileSync(INDEX_CSS, 'utf-8')

    if (indexCss.includes('.dark {') || indexCss.includes('.dark{')) {
      errors.push('index.css still defines a .dark theme block instead of consuming the generated data-theme tokens')
    }

    if (!indexCss.includes('@fun-forum/ui-web/styles')) {
      errors.push('index.css does not import @fun-forum/ui-web/styles as the primary UI style entrypoint')
    }
  }

  if (errors.length > 0) {
    console.error('[FAIL] Theme protocol issues:')
    errors.forEach(e => console.error(`  - ${e}`))
  }

  if (warnings.length > 0) {
    console.log('Warnings:')
    warnings.forEach(w => console.log(`  - ${w}`))
  }

  if (errors.length > 0) {
    process.exit(1)
  }

  console.log('[PASS] Theme protocol check passed')
  process.exit(0)
}

check()
