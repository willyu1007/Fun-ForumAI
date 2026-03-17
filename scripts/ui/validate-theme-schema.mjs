#!/usr/bin/env node
/**
 * validate-theme-schema.mjs
 * Validates ui/tokens/themes/*.json against expected theme structure.
 * Single responsibility: theme schema validation only.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const THEMES_DIR = resolve(ROOT, 'ui/tokens/themes')

function validate() {
  const errors = []

  if (!existsSync(THEMES_DIR)) {
    console.error(`[FAIL] Themes directory not found: ${THEMES_DIR}`)
    process.exit(1)
  }

  const themeFiles = readdirSync(THEMES_DIR).filter(f => f.endsWith('.json'))

  if (themeFiles.length === 0) {
    console.error('[FAIL] No theme files found')
    process.exit(1)
  }

  for (const file of themeFiles) {
    const themePath = resolve(THEMES_DIR, file)
    let theme

    try {
      theme = JSON.parse(readFileSync(themePath, 'utf-8'))
    } catch (e) {
      errors.push(`${file}: Invalid JSON - ${e.message}`)
      continue
    }

    if (!theme.meta) {
      errors.push(`${file}: Missing meta section`)
      continue
    }

    if (!theme.meta.theme) {
      errors.push(`${file}: Missing meta.theme`)
    }

    if (!theme.meta.extends) {
      errors.push(`${file}: Missing meta.extends`)
    }

    if (!theme.color) {
      errors.push(`${file}: Missing color section (themes should override colors)`)
    }
  }

  if (errors.length > 0) {
    console.error('[FAIL] Theme schema validation failed:')
    errors.forEach(e => console.error(`  - ${e}`))
    process.exit(1)
  }

  console.log(`[PASS] Theme schema validation passed (${themeFiles.length} themes)`)
  process.exit(0)
}

validate()
