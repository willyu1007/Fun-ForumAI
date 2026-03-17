#!/usr/bin/env node
/**
 * validate-contract-schema.mjs
 * Validates ui/contract/contract.json against expected contract structure.
 * Single responsibility: contract schema validation only.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const CONTRACT_PATH = resolve(ROOT, 'ui/contract/contract.json')

function validate() {
  const errors = []

  if (!existsSync(CONTRACT_PATH)) {
    console.error(`[FAIL] Contract file not found: ${CONTRACT_PATH}`)
    process.exit(1)
  }

  let contract
  try {
    contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf-8'))
  } catch (e) {
    console.error(`[FAIL] Invalid JSON in ${CONTRACT_PATH}: ${e.message}`)
    process.exit(1)
  }

  if (!contract.meta) {
    errors.push('Missing meta section')
  } else {
    if (!contract.meta.contract_version) {
      errors.push('Missing meta.contract_version')
    }
    if (!contract.meta.tailwind_policy) {
      errors.push('Missing meta.tailwind_policy')
    }
  }

  if (!contract.roles) {
    errors.push('Missing roles section')
  } else {
    for (const [roleName, roleDef] of Object.entries(contract.roles)) {
      if (typeof roleDef !== 'object') {
        errors.push(`Role ${roleName}: invalid definition (must be object)`)
        continue
      }

      if (!('attrs' in roleDef)) {
        errors.push(`Role ${roleName}: missing attrs (can be empty object)`)
      }

      if (!('slots' in roleDef)) {
        errors.push(`Role ${roleName}: missing slots (can be empty array)`)
      } else if (!Array.isArray(roleDef.slots)) {
        errors.push(`Role ${roleName}: slots must be an array`)
      }

      if (roleDef.attrs && typeof roleDef.attrs === 'object') {
        for (const [attrName, attrValues] of Object.entries(roleDef.attrs)) {
          if (!Array.isArray(attrValues)) {
            errors.push(`Role ${roleName}.attrs.${attrName}: must be an array of allowed values`)
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('[FAIL] Contract schema validation failed:')
    errors.forEach(e => console.error(`  - ${e}`))
    process.exit(1)
  }

  const roleCount = Object.keys(contract.roles || {}).length
  console.log(`[PASS] Contract schema validation passed (${roleCount} roles)`)
  process.exit(0)
}

validate()
