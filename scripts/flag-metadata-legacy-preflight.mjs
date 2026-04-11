#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yaml',
  '.yml',
  '.md',
  '.prisma',
])

const LIVE_TARGETS = [
  'src',
  'apps',
  'packages',
  'ops',
  'scripts',
  'prisma/schema.prisma',
  'playwright.config.mjs',
]

const EXCLUDED_PATHS = [
  /^\.ai\//,
  /^artifacts\//,
  /^dev-docs\//,
  /^docs\//,
  /^node_modules\//,
  /^prisma\/migrations\//,
  /^scripts\/flag-metadata-legacy-inventory\.mjs$/,
  /^scripts\/flag-metadata-legacy-preflight\.mjs$/,
  /(^|\/)__tests__\//,
  /\.test\.[^.]+$/,
  /\.spec\.[^.]+$/,
]

const BANNED_MARKERS = [
  { id: 'frontend_vite_flags', pattern: ['VITE', 'FF', ''].join('_') },
  { id: 'mobile_expo_flags', pattern: ['EXPO', 'PUBLIC', 'FF', ''].join('_') },
  { id: 'backend_feature_layer', pattern: ['config', 'features'].join('.') },
  { id: 'legacy_health_router', pattern: ['create', 'LegacyApiHealthRouter'].join('') },
  { id: 'mobile_compat_export', pattern: ['@fun-forum/ui-mobile', 'compat'].join('/') },
  { id: 'frontend_build_flags_artifact', pattern: ['frontend-build', 'flags'].join('-') },
  { id: 'frontend_flags_contract', pattern: ['frontend', 'flags'].join('_') },
  { id: 'legacy_agent_media_asset', pattern: ['Legacy', 'Agent', 'Media', 'Asset'].join('') },
  { id: 'legacy_growth_archive', pattern: ['Legacy', 'Growth', 'Event', 'Archive'].join('') },
  { id: 'prisma_meta_json', pattern: ['meta', 'Json'].join('') },
  { id: 'prisma_metadata_json', pattern: ['metadata', 'Json'].join('') },
  { id: 'prisma_moderation_metadata_json', pattern: ['moderation', 'Metadata', 'Json'].join('') },
]

function isExcluded(relativePath) {
  return EXCLUDED_PATHS.some((pattern) => pattern.test(relativePath))
}

function isTextFile(relativePath) {
  return TEXT_EXTENSIONS.has(extname(relativePath))
}

function walk(relativePath) {
  const pathname = resolve(ROOT, relativePath)
  if (!existsSync(pathname)) return []

  const stats = statSync(pathname)
  if (stats.isFile()) {
    return isExcluded(relativePath) || !isTextFile(relativePath) ? [] : [relativePath]
  }

  if (!stats.isDirectory()) return []

  return readdirSync(pathname, { withFileTypes: true }).flatMap((entry) => {
    const childRelativePath = relative(ROOT, resolve(pathname, entry.name))
    if (entry.isDirectory()) {
      return isExcluded(childRelativePath) ? [] : walk(childRelativePath)
    }
    if (!entry.isFile()) return []
    return isExcluded(childRelativePath) || !isTextFile(childRelativePath)
      ? []
      : [childRelativePath]
  })
}

function buildPrismaInventory() {
  const schemaPath = resolve(ROOT, 'prisma/schema.prisma')
  if (!existsSync(schemaPath)) {
    return {
      metadataFields: [],
      legacyModels: [],
    }
  }

  const lines = readFileSync(schemaPath, 'utf8').split('\n')
  const metadataFields = []
  const legacyModels = []
  let currentModel = null

  for (const line of lines) {
    const modelMatch = line.match(/^model\s+(\w+)\s+\{/)
    if (modelMatch) {
      currentModel = modelMatch[1]
      if (currentModel === 'LegacyAgentMediaAsset' || currentModel === 'LegacyGrowthEventArchive') {
        legacyModels.push(currentModel)
      }
      continue
    }

    if (line.trim() === '}') {
      currentModel = null
      continue
    }

    if (!currentModel) continue
    const fieldMatch = line.match(/^\s+(metaJson|metadataJson|moderationMetadataJson)\s+/)
    if (fieldMatch) {
      metadataFields.push({
        model: currentModel,
        field: fieldMatch[1],
      })
    }
  }

  return {
    metadataFields,
    legacyModels,
  }
}

function main() {
  const files = [...new Set(LIVE_TARGETS.flatMap((target) => walk(target)))].sort()
  const findings = []

  for (const relativePath of files) {
    const text = readFileSync(resolve(ROOT, relativePath), 'utf8')
    for (const marker of BANNED_MARKERS) {
      if (text.includes(marker.pattern)) {
        findings.push({
          marker: marker.id,
          pattern: marker.pattern,
          file: relativePath,
        })
      }
    }
  }

  const prismaInventory = buildPrismaInventory()
  const summary = {
    scanned_files: files.length,
    findings: findings.length,
    findings_by_marker: Object.fromEntries(
      BANNED_MARKERS.map((marker) => [
        marker.id,
        findings.filter((finding) => finding.marker === marker.id).length,
      ]).filter(([, count]) => count > 0),
    ),
    prisma_metadata_fields: prismaInventory.metadataFields.length,
    prisma_legacy_models: prismaInventory.legacyModels,
  }

  console.log(JSON.stringify({ summary, findings, prismaInventory }, null, 2))

  if (
    findings.length > 0 ||
    prismaInventory.metadataFields.length > 0 ||
    prismaInventory.legacyModels.length > 0
  ) {
    process.exit(1)
  }
}

main()
