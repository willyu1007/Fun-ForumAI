#!/usr/bin/env node
/**
 * check-contract-css-var-existence.mjs
 * Ensures every --ui-* variable referenced in contract.css exists in tokens.css.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectCssVarReferences, collectCssVars } from './helpers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const TOKENS_PATH = resolve(ROOT, 'ui/styles/tokens.css')
const CONTRACT_PATH = resolve(ROOT, 'ui/styles/contract.css')

function main() {
  const errors = []

  if (!existsSync(TOKENS_PATH)) {
    errors.push('Missing ui/styles/tokens.css')
  }

  if (!existsSync(CONTRACT_PATH)) {
    errors.push('Missing ui/styles/contract.css')
  }

  if (errors.length > 0) {
    console.error('[FAIL] Contract CSS var check failed:')
    errors.forEach((error) => console.error(`  - ${error}`))
    process.exit(1)
  }

  const tokenVars = collectCssVars(readFileSync(TOKENS_PATH, 'utf-8'))
  const contractVars = collectCssVarReferences(readFileSync(CONTRACT_PATH, 'utf-8'))
  const missing = [...contractVars].filter((variableName) => !tokenVars.has(variableName)).sort()

  if (missing.length > 0) {
    console.error('[FAIL] contract.css references missing token variables:')
    missing.forEach((variableName) => console.error(`  - ${variableName}`))
    process.exit(1)
  }

  console.log(`[PASS] All ${contractVars.size} contract CSS variables exist in tokens.css`)
}

main()
