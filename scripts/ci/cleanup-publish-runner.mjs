#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)

function readFlag(name, fallback = '') {
  const index = args.indexOf(`--${name}`)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

function readRepeatedFlag(name) {
  const values = []
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== `--${name}`) continue
    const value = args[index + 1]
    if (!value || value.startsWith('--')) continue
    values.push(value)
    index += 1
  }
  return values
}

function log(message) {
  console.log(`[cleanup-publish-runner] ${message}`)
}

function run(command, commandArgs, { allowFailure = true } = {}) {
  try {
    execFileSync(command, commandArgs, { stdio: 'inherit' })
  } catch (error) {
    if (!allowFailure) throw error
    const detail = error instanceof Error ? error.message : String(error)
    log(`best-effort command failed: ${command} ${commandArgs.join(' ')} :: ${detail}`)
  }
}

function ensureSafeWorkspace(workspacePath) {
  const resolved = path.resolve(workspacePath)
  const parsed = path.parse(resolved)
  if (!resolved || resolved === parsed.root) {
    throw new Error(`refusing to clean unsafe workspace path: ${workspacePath}`)
  }
  return resolved
}

function cleanupWorkspace(workspacePath) {
  if (!workspacePath) return
  const resolved = ensureSafeWorkspace(workspacePath)
  if (!existsSync(resolved)) return

  for (const entry of readdirSync(resolved)) {
    rmSync(path.join(resolved, entry), { force: true, recursive: true })
  }

  log(`workspace cleaned: ${resolved}`)
}

function cleanupArchive(archivePath) {
  if (!archivePath) return
  const resolved = path.resolve(archivePath)
  if (!existsSync(resolved)) return
  rmSync(resolved, { force: true })
  log(`archive removed: ${resolved}`)
}

function cleanupImages(imageRefs) {
  const uniqueRefs = [...new Set(imageRefs.filter(Boolean))]
  for (const imageRef of uniqueRefs) {
    run('docker', ['image', 'rm', '-f', imageRef])
  }
}

function main() {
  const workspace = readFlag('workspace', process.env.GITHUB_WORKSPACE || '')
  const archivePath = readFlag('archive-path', process.env.PUBLISH_SOURCE_ARCHIVE || '')
  const imageRefs = readRepeatedFlag('image-ref')

  cleanupImages(imageRefs)
  run('docker', ['container', 'prune', '-f'])
  run('docker', ['image', 'prune', '-af'])
  run('docker', ['builder', 'prune', '-af'])
  cleanupArchive(archivePath)
  cleanupWorkspace(workspace)
  run('df', ['-h'])
  run('docker', ['system', 'df'])
}

try {
  main()
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error)
  console.error(`[cleanup-publish-runner] ${detail}`)
  process.exit(1)
}
