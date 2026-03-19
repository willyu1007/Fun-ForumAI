#!/usr/bin/env node
/**
 * check-theme-protocol.mjs
 * Verifies theme protocol consistency across files.
 * Single responsibility: theme protocol validation.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

const TOKENS_CSS = resolve(ROOT, 'ui/styles/tokens.css')
const INDEX_CSS = resolve(ROOT, 'src/frontend/index.css')
const WEB_THEME_SOURCE = resolve(ROOT, 'scripts/ui/build-web-theme.mjs')
const GENERATED_WEB_THEMES = [
  resolve(ROOT, 'ui/codegen/web-theme.ts'),
  resolve(ROOT, 'packages/design-tokens/src/generated/web-theme.ts'),
]
const SCAN_ROOTS = [
  resolve(ROOT, 'src/frontend'),
  resolve(ROOT, 'packages'),
]
const ALLOWED_DARK_FILES = new Set([
  TOKENS_CSS,
  resolve(ROOT, 'packages/design-tokens/styles/tokens.css'),
  resolve(ROOT, 'ui/tokens/themes/default.dark.json'),
  ...GENERATED_WEB_THEMES,
])
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.mjs'])
const DARK_CLASS_TOGGLE = /classList\.(?:toggle|add|remove)\(\s*['"]dark['"]/
const DARK_SELECTOR = /(^|[^A-Za-z0-9_-])\.dark(?:[\s:{[(]|$)/m
const DARK_UTILITY = /\bdark:[^\s"'`]+/

function collectFiles(dir) {
  const files = []

  if (!existsSync(dir)) {
    return files
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name === 'generated') {
        continue
      }
      files.push(...collectFiles(fullPath))
      continue
    }

    if (SCAN_EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

function lineNumberFor(content, pattern) {
  const match = content.match(pattern)
  if (!match || match.index === undefined) {
    return null
  }

  return content.slice(0, match.index).split('\n').length
}

function formatHit(filePath, lineNumber, detail) {
  const location = lineNumber ? `${relative(ROOT, filePath)}:${lineNumber}` : relative(ROOT, filePath)
  return `${location} ${detail}`
}

function check() {
  const errors = []

  // Check tokens.css uses data-theme
  if (existsSync(TOKENS_CSS)) {
    const tokensCss = readFileSync(TOKENS_CSS, 'utf-8')

    if (!tokensCss.includes('data-theme')) {
      errors.push('tokens.css does not use data-theme attribute for theming')
    }
  } else {
    errors.push('tokens.css not found')
  }

  // Check index.css for protocol
  if (existsSync(INDEX_CSS)) {
    const indexCss = readFileSync(INDEX_CSS, 'utf-8')

    if (indexCss.includes('@custom-variant dark')) {
      errors.push('index.css must not declare @custom-variant dark; use data-theme only')
    }

    if (DARK_SELECTOR.test(indexCss)) {
      errors.push('index.css still contains a .dark selector; use generated data-theme tokens only')
    }

    if (!indexCss.includes('@fun-forum/ui-web/styles')) {
      errors.push('index.css does not import @fun-forum/ui-web/styles as the primary UI style entrypoint')
    }
  }

  const themeSource = readFileSync(WEB_THEME_SOURCE, 'utf-8')
  if (DARK_CLASS_TOGGLE.test(themeSource)) {
    errors.push('build-web-theme.mjs still toggles the dark class; applyTheme() must only set data-theme')
  }

  for (const themeFile of GENERATED_WEB_THEMES) {
    if (!existsSync(themeFile)) {
      errors.push(`generated theme file missing: ${relative(ROOT, themeFile)}`)
      continue
    }

    const generatedTheme = readFileSync(themeFile, 'utf-8')
    if (DARK_CLASS_TOGGLE.test(generatedTheme)) {
      errors.push(`${relative(ROOT, themeFile)} still toggles the dark class`)
    }
  }

  for (const filePath of SCAN_ROOTS.flatMap((root) => collectFiles(root))) {
    if (ALLOWED_DARK_FILES.has(filePath)) {
      continue
    }

    const content = readFileSync(filePath, 'utf-8')

    if (content.includes('@custom-variant dark')) {
      errors.push(
        formatHit(filePath, lineNumberFor(content, /@custom-variant\s+dark/), 'must not declare @custom-variant dark'),
      )
    }

    if (DARK_CLASS_TOGGLE.test(content)) {
      errors.push(
        formatHit(filePath, lineNumberFor(content, DARK_CLASS_TOGGLE), 'must not toggle the dark class'),
      )
    }

    if (DARK_UTILITY.test(content)) {
      errors.push(
        formatHit(filePath, lineNumberFor(content, DARK_UTILITY), 'contains a dark: utility and must use semantic tokens instead'),
      )
    }

    if (DARK_SELECTOR.test(content)) {
      errors.push(
        formatHit(filePath, lineNumberFor(content, DARK_SELECTOR), 'contains a .dark selector and must use data-theme instead'),
      )
    }
  }

  if (errors.length > 0) {
    console.error('[FAIL] Theme protocol issues:')
    errors.forEach(e => console.error(`  - ${e}`))
  }

  if (errors.length > 0) {
    process.exit(1)
  }

  console.log('[PASS] Theme protocol check passed')
  process.exit(0)
}

check()
