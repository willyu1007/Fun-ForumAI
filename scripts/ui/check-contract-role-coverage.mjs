#!/usr/bin/env node
/**
 * check-contract-role-coverage.mjs
 * Verifies contract.css stays aligned with contract.json at the role/attr/slot level.
 * Single responsibility: guard the CSS contract from silently drifting away from SSOT.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const CONTRACT_JSON_PATH = resolve(ROOT, 'ui/contract/contract.json')
const CONTRACT_CSS_PATH = resolve(ROOT, 'ui/styles/contract.css')
const OPTIONAL_GLOBAL_STYLE_ROLES = new Set([
  'avatar',
  'breadcrumb',
  'checkbox',
  'dropdown-menu',
  'nav',
  'radio',
  'scroll-area',
  'skeleton',
  'switch',
  'toast',
  'toggle',
  'toggle-group',
  'tooltip',
])

function normalizeAttrName(attrName) {
  return attrName.replace(/-/g, '_')
}

function main() {
  const errors = []

  if (!existsSync(CONTRACT_JSON_PATH)) {
    errors.push('Missing ui/contract/contract.json')
  }

  if (!existsSync(CONTRACT_CSS_PATH)) {
    errors.push('Missing ui/styles/contract.css')
  }

  if (errors.length > 0) {
    console.error('[FAIL] Contract role coverage check failed:')
    errors.forEach((error) => console.error(`  - ${error}`))
    process.exit(1)
  }

  const contract = JSON.parse(readFileSync(CONTRACT_JSON_PATH, 'utf-8'))
  const contractCss = readFileSync(CONTRACT_CSS_PATH, 'utf-8')
  const roles = contract.roles ?? {}
  const selectors = [...contractCss.matchAll(/([^{}]+)\{/g)].map((match) => match[1].trim())

  for (const roleName of Object.keys(roles)) {
    if (OPTIONAL_GLOBAL_STYLE_ROLES.has(roleName)) {
      continue
    }

    if (!contractCss.includes(`[data-ui="${roleName}"]`)) {
      errors.push(`Missing base selector for role "${roleName}"`)
    }
  }

  for (const selectorGroup of selectors) {
    const groupSelectors = selectorGroup
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)

    for (const selector of groupSelectors) {
      const roleMatch = selector.match(/\[data-ui="([^"]+)"\]/)
      if (!roleMatch) {
        continue
      }

      const roleName = roleMatch[1]
      const role = roles[roleName]

      if (!role) {
        errors.push(`Selector references unknown role "${roleName}": ${selector}`)
        continue
      }

      const attrDefinitions = role.attrs ?? {}
      const slotDefinitions = new Set(role.slots ?? [])

      for (const [, rawAttrName, value] of selector.matchAll(/\[data-([a-z0-9-]+)="([^"]+)"\]/g)) {
        if (rawAttrName === 'ui' || rawAttrName === 'slot') {
          continue
        }

        const attrName = normalizeAttrName(rawAttrName)
        const allowedValues = attrDefinitions[attrName]

        if (!allowedValues) {
          errors.push(`Selector uses undeclared attr "${rawAttrName}" on role "${roleName}": ${selector}`)
          continue
        }

        if (!allowedValues.includes(value)) {
          errors.push(`Selector uses undeclared value ${roleName}[data-${rawAttrName}="${value}"]`)
        }
      }

      for (const [, slotName] of selector.matchAll(/\[data-slot="([^"]+)"\]/g)) {
        if (!slotDefinitions.has(slotName)) {
          errors.push(`Selector uses undeclared slot ${roleName}[data-slot="${slotName}"]`)
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('[FAIL] Contract role coverage is incomplete:')
    errors.forEach((error) => console.error(`  - ${error}`))
    process.exit(1)
  }

  console.log(
    `[PASS] contract.css stays aligned with ${Object.keys(roles).length} contract roles (${OPTIONAL_GLOBAL_STYLE_ROLES.size} optional global-style roles skipped)`,
  )
}

main()
