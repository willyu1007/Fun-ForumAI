#!/usr/bin/env node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs, runCommandCapture } from './k8s-smoke-utils.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function usage(exitCode = 0) {
  console.log(`
T-023 ~ T-025 K8s Smoke Suite

Usage:
  node scripts/t023-t025-k8s-smoke-suite.mjs [options]

Options (passed through to sub-scripts):
  --k8s-context <name>
  --k8s-namespace <name>
  --k8s-label-selector <selector>
  --service-auth-secret <secret>
  --service-auth-secret-name <name>
  --community-id <id>
  --actor-agent-id <id>
  --postgres-deployment <name>
  --postgres-user <name>
  --postgres-database <name>
  --help
`)
  process.exit(exitCode)
}

function toPassthroughArgs(args) {
  const out = []
  for (const [key, value] of Object.entries(args)) {
    if (key === 'help') continue
    if (value === undefined || value === null || value === false) continue
    const cliKey = `--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`
    if (value === true) out.push(cliKey)
    else out.push(cliKey, String(value))
  }
  return out
}

async function runStep(label, scriptPath, passthroughArgs) {
  console.log(`[suite] Running ${label}...`)
  const { stdout, stderr } = await runCommandCapture('node', [scriptPath, ...passthroughArgs])
  if (stdout.trim()) process.stdout.write(stdout)
  if (stderr.trim()) process.stderr.write(stderr)
  console.log(`[suite] ${label} done.`)
}

async function main() {
  const args = parseCliArgs(process.argv, {})
  if (args.help) usage(0)

  const passthrough = toPassthroughArgs(args)

  const t023 = resolve(__dirname, 't023-runtime-k8s-smoke-suite.mjs')
  const t024 = resolve(__dirname, 't024-consistency-smoke.mjs')
  const t025 = resolve(__dirname, 't025-sse-fanout-smoke.mjs')

  await runStep('T-023', t023, passthrough)
  await runStep('T-024', t024, passthrough)
  await runStep('T-025', t025, passthrough)

  console.log('[suite] PASS: T-023 ~ T-025')
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[suite] FAIL:', message)
  process.exit(1)
})
