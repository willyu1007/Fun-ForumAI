#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const defaultEnvPath = path.join(repoRoot, '.env.local')

export function getRepoRoot() {
  return repoRoot
}

export function getMobileAppRoot() {
  return path.join(repoRoot, 'apps/mobile')
}

export function loadLocalEnv() {
  if (!fs.existsSync(defaultEnvPath)) {
    return null
  }

  dotenv.config({ path: defaultEnvPath, override: false, quiet: true })
  return defaultEnvPath
}

export function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}
