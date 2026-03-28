#!/usr/bin/env node
/**
 * build-ui-spec.mjs
 * Syncs docs/context/ui/ui-spec.json metadata from the active UI SSOT.
 * Single responsibility: keep the LLM-facing UI context aligned with current SSOT.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildUiSpecModel } from './ui-spec-lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const UI_SPEC_PATH = resolve(ROOT, 'docs/context/ui/ui-spec.json')

function main() {
  if (!existsSync(resolve(ROOT, 'docs/context/ui'))) {
    mkdirSync(resolve(ROOT, 'docs/context/ui'), { recursive: true })
  }

  const uiSpec = buildUiSpecModel()

  writeFileSync(UI_SPEC_PATH, `${JSON.stringify(uiSpec, null, 2)}\n`, 'utf-8')
  console.log(`[PASS] Synced ${UI_SPEC_PATH}`)
}

main()
