#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import YAML from 'yaml'
import { locateDevDocsPath } from './lib/dev-docs-paths.mjs'
import { getRepoRoot } from './mobile-env.mjs'

const root = getRepoRoot()
const maestroRoot = path.join(root, 'apps/mobile/.maestro')
const requiredFlows = [
  'shared/anonymous.yaml',
  'shared/login.yaml',
  'shared/feed.yaml',
  'shared/rooms.yaml',
  'shared/agents.yaml',
  'shared/xp.yaml',
  'shared/private.yaml',
  'ios/smoke.yaml',
  'android/smoke.yaml',
]
const requiredScripts = [
  'mobile:smoke:prepare',
  'mobile:smoke:ios',
  'mobile:smoke:android',
  'mobile:smoke:validate',
]
const requiredTestIds = [
  'tab-feed',
  'tab-rooms',
  'tab-agents',
  'tab-xp',
  'tab-private',
  'tab-profile',
  'feed-focused-marker',
  'rooms-focused-marker',
  'agents-focused-marker',
  'growth-focused-marker',
  'private-focused-marker',
  'profile-focused-marker',
  'auth-email-input',
  'auth-password-input',
  'auth-login-button',
  'feed-refresh-button',
  'feed-post-detail-title',
  'rooms-refresh-button',
  'agents-refresh-button',
  'growth-refresh-button',
  'growth-summary-card',
  'private-create-session-button',
  'private-chat-input',
  'private-chat-send-button',
]
function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function parseFlow(relativePath) {
  const absolutePath = path.join(maestroRoot, relativePath)
  const raw = fs.readFileSync(absolutePath, 'utf8')
  const documents = YAML.parseAllDocuments(raw)
  if (documents.some((document) => document.errors.length > 0)) {
    const detail = documents.flatMap((document) => document.errors).map((error) => error.message).join('; ')
    throw new Error(`${relativePath} failed YAML parse: ${detail}`)
  }
  return documents.map((document) => document.toJSON())
}

function validateRunFlowRefs(relativePath, documents) {
  const flowDir = path.dirname(path.join(maestroRoot, relativePath))
  for (const document of documents) {
    if (!Array.isArray(document)) continue
    for (const step of document) {
      if (!step || typeof step !== 'object' || !('runFlow' in step)) continue
      const runFlow = step.runFlow
      const file = typeof runFlow === 'string'
        ? runFlow
        : runFlow && typeof runFlow === 'object' && typeof runFlow.file === 'string'
          ? runFlow.file
          : null
      const inlineCommands = runFlow && typeof runFlow === 'object' && Array.isArray(runFlow.commands)
      if (!file && !inlineCommands) {
        throw new Error(`${relativePath} contains runFlow without a file reference.`)
      }
      if (!file) {
        continue
      }
      const target = path.resolve(flowDir, file)
      assert(fs.existsSync(target), `${relativePath} references missing runFlow file: ${file}`)
    }
  }
}

try {
  const pkg = JSON.parse(readText('package.json'))
  for (const scriptName of requiredScripts) {
    assert(pkg.scripts?.[scriptName], `package.json missing script: ${scriptName}`)
  }

  for (const relativePath of requiredFlows) {
    assert(fs.existsSync(path.join(maestroRoot, relativePath)), `Missing Maestro flow: ${relativePath}`)
    const documents = parseFlow(relativePath)
    validateRunFlowRefs(relativePath, documents)
  }

  assert(fs.existsSync(path.join(root, 'scripts/mobile-smoke-prepare.mjs')), 'Missing scripts/mobile-smoke-prepare.mjs')
  assert(fs.existsSync(path.join(root, 'scripts/mobile-smoke-run.mjs')), 'Missing scripts/mobile-smoke-run.mjs')
  assert(fs.existsSync(path.join(root, 'scripts/mobile-maestro-check.mjs')), 'Missing scripts/mobile-maestro-check.mjs')
  const operatorGuidePath = locateDevDocsPath({
    bundle_slug: 'ios-android-runtime-smoke-kit',
    file_name: '06-operator-guide.md',
  }).path
  assert(
    fs.existsSync(operatorGuidePath),
    'Missing T-061 operator guide.',
  )

  const testIdRegistry = readText('apps/mobile/src/testing/test-ids.ts')
  for (const value of requiredTestIds) {
    assert(testIdRegistry.includes(`'${value}'`), `Missing testID in registry: ${value}`)
  }

  const screenSources = [
    'apps/mobile/src/navigation/main-tabs.tsx',
    'apps/mobile/src/navigation/auth-screen.tsx',
    'apps/mobile/src/navigation/feed-stack.tsx',
    'apps/mobile/src/navigation/rooms-stack.tsx',
    'apps/mobile/src/navigation/agents-stack.tsx',
    'apps/mobile/src/navigation/growth-stack.tsx',
    'apps/mobile/src/navigation/private-stack.tsx',
  ]

  for (const sourcePath of screenSources) {
    const content = readText(sourcePath)
    assert(content.includes('testIDs'), `${sourcePath} is not wired to the shared testID registry.`)
  }

  const ciWorkflow = readText('.github/workflows/ci.yml')
  assert(ciWorkflow.includes('pnpm mobile:smoke:validate'), 'CI workflow does not run pnpm mobile:smoke:validate.')

  console.log('mobile:smoke:validate passed')
} catch (error) {
  console.error('mobile:smoke:validate failed')
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
