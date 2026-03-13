#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { buildStageTemplateDistPayload, readYamlFile } from '../src/backend/stage/stage-template-ops.js'

const root = process.cwd()
const baseDir = path.join(root, 'docs/stage-templates/v1')
const distDir = path.join(baseDir, 'dist')
const manifestPath = path.join(baseDir, 'library.manifest.yaml')

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

if (!fs.existsSync(manifestPath)) {
  throw new Error(`Manifest not found: ${manifestPath}`)
}

const manifest = readYamlFile(manifestPath)
const distPayload = buildStageTemplateDistPayload(baseDir, manifest, new Date().toISOString())

fs.mkdirSync(distDir, { recursive: true })
writeJson(path.join(distDir, 'library.json'), distPayload.library)
writeJson(path.join(distDir, 'launch.json'), distPayload.launch)

console.log('[stage:templates:export] OK')
console.log(`  exported_templates=${distPayload.exported_templates}`)
console.log(`  launch_templates=${distPayload.launch_templates}`)
