#!/usr/bin/env node
/**
 * check-ui-spec-sync.mjs
 * Verifies docs/context/ui/ui-spec.json matches the active UI SSOT files.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildUiSpecModel } from './ui-spec-lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const UI_SPEC_PATH = resolve(ROOT, 'docs/context/ui/ui-spec.json')

function main() {
  const errors = []

  if (!existsSync(UI_SPEC_PATH)) {
    errors.push('Missing docs/context/ui/ui-spec.json')
  }

  if (errors.length > 0) {
    console.error('[FAIL] UI spec sync check failed:')
    errors.forEach((error) => console.error(`  - ${error}`))
    process.exit(1)
  }

  const uiSpec = JSON.parse(readFileSync(UI_SPEC_PATH, 'utf-8'))
  const expected = buildUiSpecModel()

  if (JSON.stringify(uiSpec) !== JSON.stringify(expected)) {
    errors.push('docs/context/ui/ui-spec.json does not match the SSOT-derived model')
  }

  if (errors.length > 0) {
    console.error('[FAIL] UI spec sync check failed:')
    errors.forEach((error) => console.error(`  - ${error}`))
    process.exit(1)
  }

  console.log('[PASS] UI spec metadata is in sync with SSOT')
}

main()
