#!/usr/bin/env node
/**
 * check-contract-codegen-drift.mjs
 * Verifies that contract-types.ts is in sync with contract.json.
 * Single responsibility: contract -> codegen consistency check.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const CONTRACT_PATH = resolve(ROOT, 'ui/contract/contract.json')
const TYPES_PATH = resolve(ROOT, 'ui/codegen/contract-types.ts')

function check() {
  const errors = []

  if (!existsSync(CONTRACT_PATH)) {
    console.error(`[FAIL] Contract file not found: ${CONTRACT_PATH}`)
    process.exit(1)
  }

  if (!existsSync(TYPES_PATH)) {
    console.error(`[FAIL] Types file not found: ${TYPES_PATH}`)
    console.error('Run `pnpm ui:contract:build` to generate.')
    process.exit(1)
  }

  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf-8'))
  const typesContent = readFileSync(TYPES_PATH, 'utf-8')

  const contractRoles = Object.keys(contract.roles || {}).sort()

  // Extract roles from UiRole type
  const roleMatch = typesContent.match(/export type UiRole = ([^;]+);/)
  if (!roleMatch) {
    errors.push('Could not find UiRole type definition in contract-types.ts')
  } else {
    const typeRoles = roleMatch[1]
      .split('|')
      .map(r => r.trim().replace(/"/g, ''))
      .filter(r => r)
      .sort()

    // Check for missing roles
    for (const role of contractRoles) {
      if (!typeRoles.includes(role)) {
        errors.push(`Role "${role}" is in contract.json but missing from UiRole type`)
      }
    }

    // Check for extra roles
    for (const role of typeRoles) {
      if (!contractRoles.includes(role)) {
        errors.push(`Role "${role}" is in UiRole type but missing from contract.json`)
      }
    }
  }

  // Check slots for each role - look in UiRoleSlotsMap section
  const slotsMapMatch = typesContent.match(/export interface UiRoleSlotsMap \{([\s\S]*?)\n\}/)
  if (!slotsMapMatch) {
    errors.push('Could not find UiRoleSlotsMap interface in contract-types.ts')
  } else {
    const slotsMapContent = slotsMapMatch[1]

    for (const roleName of contractRoles) {
      const roleDef = contract.roles[roleName]
      const slots = roleDef.slots || []

      if (slots.length > 0) {
        // Use a more robust pattern that handles the union format
        const slotPattern = new RegExp(`"${roleName}":\\s*([^;]+);`)
        const slotMatch = slotsMapContent.match(slotPattern)

        if (!slotMatch) {
          errors.push(`Role "${roleName}" slots not found in UiRoleSlotsMap`)
        } else {
          const typeSlots = slotMatch[1]
            .split('|')
            .map(s => s.trim().replace(/"/g, ''))
            .filter(s => s && s !== 'never')

          for (const slot of slots) {
            if (!typeSlots.includes(slot)) {
              errors.push(`Slot "${slot}" for role "${roleName}" is missing from types`)
            }
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('[FAIL] Contract/codegen drift detected:')
    errors.forEach(e => console.error(`  - ${e}`))
    console.error('\nRun `pnpm ui:contract:build` to fix.')
    process.exit(1)
  }

  console.log(`[PASS] Contract and codegen are in sync (${contractRoles.length} roles)`)
  process.exit(0)
}

check()
