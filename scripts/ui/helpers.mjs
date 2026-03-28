#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const ROOT = resolve(__dirname, '../..')

export function resolveRoot(...segments) {
  return resolve(ROOT, ...segments)
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

export function ensureParentDir(path) {
  ensureDir(dirname(path))
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

export function writeText(path, content) {
  ensureParentDir(path)
  writeFileSync(path, content, 'utf-8')
}

export function writeJson(path, value) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function copyFileTargets(sourcePath, targetPaths) {
  for (const targetPath of targetPaths) {
    ensureParentDir(targetPath)
    copyFileSync(sourcePath, targetPath)
  }
}

export function readOptionalText(path) {
  return existsSync(path) ? readFileSync(path, 'utf-8') : null
}

export function flattenObject(obj, prefix = '') {
  const result = {}

  for (const [key, value] of Object.entries(obj)) {
    const nextKey = prefix ? `${prefix}-${key}` : key

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, nextKey))
    } else {
      result[nextKey] = value
    }
  }

  return result
}

export function deepMerge(baseValue, overrideValue) {
  if (
    typeof baseValue !== 'object' ||
    baseValue === null ||
    Array.isArray(baseValue) ||
    typeof overrideValue !== 'object' ||
    overrideValue === null ||
    Array.isArray(overrideValue)
  ) {
    return overrideValue
  }

  const result = { ...baseValue }

  for (const [key, value] of Object.entries(overrideValue)) {
    result[key] = key in result ? deepMerge(result[key], value) : value
  }

  return result
}

export function loadBaseTokens() {
  return readJson(resolveRoot('ui/tokens/base.json'))
}

export function loadThemes() {
  const themesDir = resolveRoot('ui/tokens/themes')
  if (!existsSync(themesDir)) {
    return []
  }

  return readdirSync(themesDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const path = resolve(themesDir, file)
      const value = readJson(path)

      return {
        file,
        path,
        name: value.meta?.theme || file.replace('.json', ''),
        value,
      }
    })
}

export function findThemeByName(themes, name) {
  return themes.find((theme) => theme.name === name) ?? null
}

export function toCssVarName(key) {
  return `--ui-${key.replace(/_/g, '-')}`
}

export function formatCssValue(value) {
  return typeof value === 'number' ? String(value) : value
}

export function collectCssVars(css) {
  return new Set([...css.matchAll(/(--ui-[a-z0-9-]+)/g)].map((match) => match[1]))
}

export function collectCssVarReferences(css) {
  return new Set(
    [...css.matchAll(/var\((--ui-[a-z0-9-]+)/g)].map((match) => match[1]),
  )
}

export function parseSize(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}
