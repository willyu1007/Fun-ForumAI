#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tsImport } from 'tsx/esm/api'
import { parseCliArgs } from './k8s-smoke-utils.mjs'

function usage(exitCode = 0) {
  console.log(`
t070-finalize-review.mjs

Finalize T-070 rollout verdict from:
- corpus-manifest.json
- gate-summary.pre-review.json
- review-results.json

Usage:
  node scripts/t070-finalize-review.mjs --input <dir> [--review <file>]

Options:
  --input <dir>     T-070 output directory
  --review <file>   Optional path to review-results.json (default: <input>/review-results.json)
  --help
`)
  process.exit(exitCode)
}

function parseOptions(argv) {
  const raw = parseCliArgs(argv, { input: '', review: '' })
  if (raw.help) usage(0)
  if (!raw.input) {
    throw new Error('--input is required')
  }
  return {
    inputDir: resolve(String(raw.input)),
    reviewPath: raw.review ? resolve(String(raw.review)) : '',
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main() {
  const opts = parseOptions(process.argv)
  const gateHelpers = await tsImport('../src/backend/runtime/persona-rollout-gate.ts', import.meta.url)
  const {
    finalizePersonaRolloutGate,
    renderPersonaRolloutVerdictMarkdown,
  } = gateHelpers

  const manifest = await readJson(join(opts.inputDir, 'corpus-manifest.json'))
  const preReview = await readJson(join(opts.inputDir, 'gate-summary.pre-review.json'))
  const review = await readJson(opts.reviewPath || join(opts.inputDir, 'review-results.json'))

  const finalSnapshot = finalizePersonaRolloutGate({
    preReview,
    review,
    manifest,
  })
  const verdict = renderPersonaRolloutVerdictMarkdown(finalSnapshot)

  await writeJson(join(opts.inputDir, 'gate-snapshot.final.json'), finalSnapshot)
  await writeFile(join(opts.inputDir, 'rollout-verdict.md'), verdict, 'utf8')

  console.log(JSON.stringify({
    ok: true,
    input_dir: opts.inputDir,
    overall_status: finalSnapshot.overall_status,
    recommendation: finalSnapshot.recommendation,
  }, null, 2))
}

main().catch((err) => {
  console.error('[t070-finalize-review] failed:', err)
  process.exit(1)
})
