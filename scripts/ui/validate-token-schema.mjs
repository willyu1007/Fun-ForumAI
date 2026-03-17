#!/usr/bin/env node
/**
 * validate-token-schema.mjs
 * Validates ui/tokens/base.json against expected schema structure.
 * Single responsibility: schema validation only.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const TOKENS_PATH = resolve(ROOT, 'ui/tokens/base.json')

const REQUIRED_SECTIONS = ['meta', 'color', 'typography', 'space', 'radius', 'shadow', 'border', 'sizing', 'motion', 'z']
const REQUIRED_COLORS = [
  'bg', 'surface', 'surface_elevated', 'text_primary', 'text_secondary', 'text_muted',
  'border', 'border_subtle', 'primary', 'primary_hover', 'primary_active', 'on_primary',
  'accent', 'accent_hover', 'accent_active', 'on_accent', 'danger', 'on_danger',
  'success', 'on_success', 'warning', 'on_warning', 'focus_ring'
]

function validate() {
  const errors = []

  if (!existsSync(TOKENS_PATH)) {
    console.error(`[FAIL] Token file not found: ${TOKENS_PATH}`)
    process.exit(1)
  }

  let tokens
  try {
    tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'))
  } catch (e) {
    console.error(`[FAIL] Invalid JSON in ${TOKENS_PATH}: ${e.message}`)
    process.exit(1)
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!tokens[section]) {
      errors.push(`Missing required section: ${section}`)
    }
  }

  if (tokens.color) {
    for (const colorKey of REQUIRED_COLORS) {
      if (!tokens.color[colorKey]) {
        errors.push(`Missing required color: color.${colorKey}`)
      }
    }
  }

  if (tokens.meta) {
    if (!tokens.meta.token_version) {
      errors.push('Missing meta.token_version')
    }
  }

  if (errors.length > 0) {
    console.error('[FAIL] Token schema validation failed:')
    errors.forEach(e => console.error(`  - ${e}`))
    process.exit(1)
  }

  console.log('[PASS] Token schema validation passed')
  process.exit(0)
}

validate()
