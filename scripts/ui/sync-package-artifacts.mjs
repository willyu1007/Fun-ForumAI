#!/usr/bin/env node
/**
 * sync-package-artifacts.mjs
 * Syncs generated UI artifacts from the ui/ SSOT into package-local sources.
 * Single responsibility: keep package-consumable assets aligned with ui/ codegen.
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

const SYNC_TARGETS = [
  ['ui/codegen/web-theme.ts', 'packages/design-tokens/src/generated/web-theme.ts'],
  ['ui/codegen/mobile-theme.ts', 'packages/design-tokens/src/generated/mobile-theme.ts'],
  ['ui/styles/tokens.css', 'packages/design-tokens/styles/tokens.css'],
  ['ui/codegen/contract-types.ts', 'packages/ui-contract/src/generated/contract-types.ts'],
  ['ui/codegen/contract-manifest.json', 'packages/ui-contract/contract/contract-manifest.json'],
  ['ui/contract/contract.json', 'packages/ui-contract/contract/contract.json'],
  ['ui/styles/contract.css', 'packages/ui-web/styles/contract.css'],
]

function sync() {
  for (const [sourceRelativePath, targetRelativePath] of SYNC_TARGETS) {
    const sourcePath = resolve(ROOT, sourceRelativePath)
    const targetPath = resolve(ROOT, targetRelativePath)

    if (!existsSync(sourcePath)) {
      console.error(`[FAIL] Sync source not found: ${sourceRelativePath}`)
      process.exit(1)
    }

    mkdirSync(dirname(targetPath), { recursive: true })
    copyFileSync(sourcePath, targetPath)
    console.log(`[PASS] Synced ${targetRelativePath}`)
  }

  process.exit(0)
}

sync()
