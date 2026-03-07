#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import YAML from 'yaml'
import { loadLocalEnv } from './mobile-env.mjs'

const root = process.cwd()
loadLocalEnv()

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readYaml(filePath) {
  return YAML.parse(fs.readFileSync(filePath, 'utf8'))
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function hasIgnorePattern(content, pattern) {
  const normalized = content.replace(/\r\n/g, '\n')
  return normalized.split('\n').some((line) => line.trim() === pattern)
}

function runExpoConfig() {
  const output = execFileSync(
    'pnpm',
    ['--dir', 'apps/mobile', 'exec', 'expo', 'config', '--type', 'public', '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  return JSON.parse(output)
}

try {
  const mobilePackage = readJson(path.join(root, 'apps/mobile/package.json'))
  const appConfigPath = path.join(root, 'apps/mobile/app.config.ts')
  const easJsonPath = path.join(root, 'apps/mobile/eas.json')
  const gitignorePath = path.join(root, '.gitignore')
  const envContractPath = path.join(root, 'env/contract.yaml')

  assert(
    Boolean(mobilePackage.dependencies?.['expo-dev-client']),
    'apps/mobile/package.json is missing expo-dev-client dependency.',
  )
  assert(fs.existsSync(appConfigPath), 'apps/mobile/app.config.ts is missing.')
  assert(fs.existsSync(easJsonPath), 'apps/mobile/eas.json is missing.')

  const expoConfig = runExpoConfig()
  assert(expoConfig.slug === 'fun-forum-ai', 'Expo config did not render the expected slug.')
  assert(
    Array.isArray(expoConfig.plugins) && expoConfig.plugins.includes('expo-dev-client'),
    'Expo config did not include expo-dev-client plugin.',
  )
  assert(
    expoConfig.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false,
    'Expo config is missing ios.infoPlist.ITSAppUsesNonExemptEncryption=false.',
  )
  if (process.env.EXPO_EAS_PROJECT_ID?.trim()) {
    assert(
      expoConfig.extra?.eas?.projectId === process.env.EXPO_EAS_PROJECT_ID.trim(),
      'Expo config did not inject extra.eas.projectId from EXPO_EAS_PROJECT_ID.',
    )
  }

  const easConfig = readJson(easJsonPath)
  assert(
    Boolean(easConfig.build?.['development-ios-simulator']),
    'eas.json is missing development-ios-simulator profile.',
  )
  assert(
    Boolean(easConfig.build?.['development-android']),
    'eas.json is missing development-android profile.',
  )

  const gitignore = fs.readFileSync(gitignorePath, 'utf8')
  for (const pattern of ['apps/mobile/ios', 'apps/mobile/android', 'apps/mobile/.expo']) {
    assert(hasIgnorePattern(gitignore, pattern), `.gitignore is missing pattern: ${pattern}`)
  }

  const envContract = readYaml(envContractPath)
  assert(
    Boolean(envContract.variables?.EXPO_PUBLIC_API_BASE_URL),
    'env/contract.yaml is missing EXPO_PUBLIC_API_BASE_URL.',
  )
  assert(
    Boolean(envContract.variables?.EXPO_EAS_PROJECT_ID),
    'env/contract.yaml is missing EXPO_EAS_PROJECT_ID.',
  )

  console.log('mobile:config:check passed')
} catch (error) {
  console.error('mobile:config:check failed')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
