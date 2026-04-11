#!/usr/bin/env node
/**
 * check-package-runtime-consumption.mjs
 * Verifies that UI package dist exports are loadable by real consumers.
 * Single responsibility: runtime import validation for package entrypoints.
 */

import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

const CHECKS = [
  {
    label: 'design-tokens dist entry',
    command: `node --input-type=module -e "import('${resolve(ROOT, 'packages/design-tokens/dist/index.js')}').then(() => console.log('ok')).catch((error) => { console.error(error.code || error.name); console.error(error.message); process.exit(1) })"`,
  },
  {
    label: 'ui-contract dist entry',
    command: `node --input-type=module -e "import('${resolve(ROOT, 'packages/ui-contract/dist/index.js')}').then(() => console.log('ok')).catch((error) => { console.error(error.code || error.name); console.error(error.message); process.exit(1) })"`,
  },
  {
    label: 'ui-contract manifest dist entry',
    command: `node --input-type=module -e "import('${resolve(ROOT, 'packages/ui-contract/dist/manifest.js')}').then(() => console.log('ok')).catch((error) => { console.error(error.code || error.name); console.error(error.message); process.exit(1) })"`,
  },
  {
    label: 'root web consumer import',
    command: `node --input-type=module -e "import('@fun-forum/ui-web').then(() => console.log('ok')).catch((error) => { console.error(error.code || error.name); console.error(error.message); process.exit(1) })"`,
  },
  {
    label: 'root web theme subpath import',
    command: `node --input-type=module -e "import('@fun-forum/ui-web/theme').then(() => console.log('ok')).catch((error) => { console.error(error.code || error.name); console.error(error.message); process.exit(1) })"`,
  },
  {
    label: 'mobile app consumer import',
    command: `pnpm --dir apps/mobile exec node --input-type=module -e "import('@fun-forum/ui-mobile/theme').then(() => console.log('ok')).catch((error) => { console.error(error.code || error.name); console.error(error.message); process.exit(1) })"`,
  },
]

function check() {
  try {
    for (const { label, command } of CHECKS) {
      console.log(`[CHECK] ${label}`)
      execSync(command, { cwd: ROOT, stdio: 'inherit' })
    }
  } catch {
    console.error('[FAIL] UI package runtime consumption check failed')
    process.exit(1)
  }

  console.log('[PASS] UI package runtime consumption paths are valid')
  process.exit(0)
}

check()
