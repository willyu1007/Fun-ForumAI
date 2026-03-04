#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

const root = process.cwd()
const baseDir = path.join(root, 'docs/stage-templates/v1')
const distDir = path.join(baseDir, 'dist')
const manifestPath = path.join(baseDir, 'library.manifest.yaml')

function readJsonYaml(filePath) {
  return parseYaml(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

if (!fs.existsSync(manifestPath)) {
  throw new Error(`Manifest not found: ${manifestPath}`)
}

const manifest = readJsonYaml(manifestPath)
const templates = manifest.templates.map((item) => {
  const filePath = path.join(baseDir, item.path)
  const doc = readJsonYaml(filePath)
  return {
    id: item.id,
    category: item.category,
    status: item.status,
    binding: item.binding ?? null,
    stage_spec: doc.stage_spec,
    name: doc.name,
  }
})

const launch = templates.filter((item) => item.status === 'launch')

fs.mkdirSync(distDir, { recursive: true })
writeJson(path.join(distDir, 'library.json'), {
  version: 'v1',
  exported_at: new Date().toISOString(),
  templates,
})
writeJson(path.join(distDir, 'launch.json'), {
  version: 'v1',
  exported_at: new Date().toISOString(),
  templates: launch,
})

console.log('[stage:templates:export] OK')
console.log(`  exported_templates=${templates.length}`)
console.log(`  launch_templates=${launch.length}`)
