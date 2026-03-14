#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import {
  buildSceneBindingV1ListFromManifestItem,
  buildStageTemplateV2FromAuthoring,
  normalizeManifestBindings,
  parseStageTemplateAuthoringDocument,
  parseStageTemplateAuthoringManifest,
} from '../src/backend/stage/public-director-contract.js'

const root = process.cwd()
const baseDir = path.join(root, 'docs/stage-templates/source')
const manifestPath = path.join(baseDir, 'manifest.yaml')

function readJsonYaml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  try {
    return parseYaml(raw)
  } catch (error) {
    throw new Error(`Invalid YAML payload: ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function fail(message) {
  console.error(`[stage:templates:validate] ${message}`)
  process.exit(1)
}

if (!fs.existsSync(manifestPath)) {
  fail(`Manifest not found: ${manifestPath}`)
}

const manifest = readJsonYaml(manifestPath)
try {
  parseStageTemplateAuthoringManifest(manifest)
} catch (error) {
  fail(`Manifest contract invalid: ${error instanceof Error ? error.message : String(error)}`)
}

const templates = manifest.templates
if (templates.length < 50) {
  fail(`Template count must be >= 50, got ${templates.length}`)
}

const launch = templates.filter((item) =>
  item.lifecycle_status === 'core_active' || item.lifecycle_status === 'seasonal_active')
const hidden = templates.filter((item) => item.lifecycle_status === 'hidden')
if (launch.length !== 20) {
  fail(`Launch template count must be 20, got ${launch.length}`)
}
if (hidden.length < 30) {
  fail(`Hidden template count must be >= 30, got ${hidden.length}`)
}

const ids = new Set()
for (const item of templates) {
  if (!item.id || typeof item.id !== 'string') {
    fail('Each template manifest item must include string id')
  }
  if (ids.has(item.id)) {
    fail(`Duplicate template id in manifest: ${item.id}`)
  }
  ids.add(item.id)

  const relPath = String(item.path || '')
  if (!relPath.startsWith('templates/')) {
    fail(`Template path must be under templates/: ${item.id}`)
  }
  const absPath = path.join(baseDir, relPath)
  if (!fs.existsSync(absPath)) {
    fail(`Template file missing for ${item.id}: ${absPath}`)
  }

  const doc = readJsonYaml(absPath)
  if (doc?.template_id !== item.id) {
    fail(`template_id mismatch in ${relPath}: expected ${item.id}`)
  }
  if (doc?.template_version !== 'v2') {
    fail(`template_version must be v2 in ${relPath}`)
  }
  if (doc?.stage_spec?.version !== 'v1') {
    fail(`stage_spec.version must be v1 in ${relPath}`)
  }

  try {
    parseStageTemplateAuthoringDocument(doc)
    buildStageTemplateV2FromAuthoring(item, doc)
  } catch (error) {
    fail(`Director contract invalid for ${item.id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

for (const item of launch) {
  const manifestBindings = normalizeManifestBindings(item)
  if (manifestBindings.length === 0) {
    fail(`Launch template must include at least one binding: ${item.id}`)
  }
  const templatePath = path.join(baseDir, String(item.path || ''))
  const templateDoc = readJsonYaml(templatePath)
  const stageTemplate = buildStageTemplateV2FromAuthoring(item, templateDoc)
  if (buildSceneBindingV1ListFromManifestItem(item, stageTemplate.director).length === 0) {
    fail(`Launch template must project an active scene binding: ${item.id}`)
  }
}

console.log('[stage:templates:validate] OK')
console.log(`  templates=${templates.length}`)
console.log(`  launch=${launch.length}`)
console.log(`  hidden=${hidden.length}`)
