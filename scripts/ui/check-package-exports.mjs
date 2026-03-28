#!/usr/bin/env node
/**
 * check-package-exports.mjs
 * Verifies workspace package exports point to real files or directories.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const PACKAGE_JSON_PATHS = [
  'packages/design-tokens/package.json',
  'packages/ui-contract/package.json',
  'packages/ui-mobile/package.json',
  'packages/ui-web/package.json',
]

function checkExportTarget(packageRoot, target, errors, label) {
  if (typeof target !== 'string') {
    return
  }

  const normalizedTarget = target.includes('*')
    ? target.slice(0, target.indexOf('*'))
    : target
  const absoluteTarget = resolve(packageRoot, normalizedTarget)

  if (!existsSync(absoluteTarget)) {
    errors.push(`${label} -> ${target} does not exist`)
  }
}

function main() {
  const errors = []

  for (const packageJsonPath of PACKAGE_JSON_PATHS) {
    const absolutePackageJsonPath = resolve(ROOT, packageJsonPath)
    const packageRoot = dirname(absolutePackageJsonPath)
    const packageJson = JSON.parse(readFileSync(absolutePackageJsonPath, 'utf-8'))
    const exportsMap = packageJson.exports ?? {}

    if (typeof packageJson.main === 'string') {
      checkExportTarget(packageRoot, packageJson.main, errors, `${packageJson.name}#main`)
    }

    if (typeof packageJson.types === 'string') {
      checkExportTarget(packageRoot, packageJson.types, errors, `${packageJson.name}#types`)
    }

    for (const [exportName, exportValue] of Object.entries(exportsMap)) {
      if (typeof exportValue === 'string') {
        checkExportTarget(packageRoot, exportValue, errors, `${packageJson.name}${exportName}`)
        continue
      }

      if (typeof exportValue === 'object' && exportValue !== null) {
        for (const [condition, target] of Object.entries(exportValue)) {
          checkExportTarget(packageRoot, target, errors, `${packageJson.name}${exportName}.${condition}`)
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('[FAIL] Package export validation failed:')
    errors.forEach((error) => console.error(`  - ${error}`))
    process.exit(1)
  }

  console.log('[PASS] Workspace package exports resolve to real files')
}

main()
