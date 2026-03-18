#!/usr/bin/env node
/**
 * build-contract-manifest.mjs
 * Generates ui/codegen/contract-manifest.json from ui/contract/contract.json.
 * Single responsibility: contract -> JSON manifest generation for tooling.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const CONTRACT_PATH = resolve(ROOT, 'ui/contract/contract.json')
const OUTPUT_DIR = resolve(ROOT, 'ui/codegen')
const OUTPUT_PATH = resolve(OUTPUT_DIR, 'contract-manifest.json')

function build() {
  if (!existsSync(CONTRACT_PATH)) {
    console.error(`[FAIL] Contract file not found: ${CONTRACT_PATH}`)
    process.exit(1)
  }

  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf-8'))
  const roles = contract.roles || {}

  const manifest = {
    source: 'ui/contract/contract.json',
    meta: contract.meta,
    roleCount: Object.keys(roles).length,
    roles: Object.keys(roles).sort(),
    roleDetails: {}
  }

  for (const [roleName, roleDef] of Object.entries(roles)) {
    manifest.roleDetails[roleName] = {
      attrs: Object.keys(roleDef.attrs || {}),
      slots: roleDef.slots || [],
      attrValues: roleDef.attrs || {}
    }
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2), 'utf-8')
  console.log(`[PASS] Generated ${OUTPUT_PATH}`)
  process.exit(0)
}

build()
