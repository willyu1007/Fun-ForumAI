#!/usr/bin/env node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseCliArgs,
  runCommandCapture,
  getSecretValue,
  resolveSmokeIds,
} from './k8s-smoke-utils.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const runtimeSmokeScript = resolve(__dirname, 'runtime-staging-smoke.mjs')

function usage(exitCode = 0) {
  console.log(`
T-023 Runtime K8s Smoke Suite

Usage:
  node scripts/t023-runtime-k8s-smoke-suite.mjs [options]

Options:
  --k8s-context <name>            Kubernetes context (default: kind-funforum)
  --k8s-namespace <name>          Namespace (default: funforum)
  --k8s-label-selector <selector> Pod selector (default: app.kubernetes.io/name=backend)
  --sample-duration-ms <ms>       Sample duration for each smoke (default: 30000)
  --poll-ms <ms>                  Poll interval (default: 2000)
  --event-count <n>               Number of injected events (default: 8)
  --wait-drain-ms <ms>            Queue drain wait timeout (default: 90000)
  --service-auth-secret <secret>  Service auth secret (default: read from K8s secret)
  --service-auth-secret-name <n>  Secret resource name (default: forum-app-secret)
  --community-id <id>             Community id (default: auto-resolve from Postgres)
  --actor-agent-id <id>           Agent id (default: auto-resolve from Postgres)
  --postgres-deployment <name>    Postgres deployment name (default: postgres)
  --postgres-user <name>          Postgres user (default: postgres)
  --postgres-database <name>      Postgres database (default: llm_forum)
  --skip-injection                Only run leader smoke, skip injection smoke
  --help                          Show help
`)
  process.exit(exitCode)
}

function toCliArgs(map) {
  const args = []
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined || v === null || v === false) continue
    const cliKey = `--${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`
    if (v === true) {
      args.push(cliKey)
    } else {
      args.push(cliKey, String(v))
    }
  }
  return args
}

async function runRuntimeSmoke(args) {
  await runCommandCapture('node', [runtimeSmokeScript, ...args])
}

async function main() {
  const args = parseCliArgs(process.argv, {
    k8sContext: 'kind-funforum',
    k8sNamespace: 'funforum',
    k8sLabelSelector: 'app.kubernetes.io/name=backend',
    sampleDurationMs: 30_000,
    pollMs: 2_000,
    eventCount: 8,
    waitDrainMs: 90_000,
    serviceAuthSecretName: 'forum-app-secret',
    postgresDeployment: 'postgres',
    postgresUser: 'postgres',
    postgresDatabase: 'llm_forum',
  })

  if (args.help) usage(0)

  const common = {
    discoverNodesK8s: true,
    k8sContext: args.k8sContext,
    k8sNamespace: args.k8sNamespace,
    k8sLabelSelector: args.k8sLabelSelector,
    devAuth: true,
    sampleDurationMs: Number(args.sampleDurationMs),
    pollMs: Number(args.pollMs),
  }

  console.log('[t023-suite] Running leader-only smoke...')
  await runRuntimeSmoke(toCliArgs(common))

  if (args.skipInjection) {
    console.log('[t023-suite] skip-injection enabled, done.')
    return
  }

  const secret = args.serviceAuthSecret || await getSecretValue({
    context: args.k8sContext,
    namespace: args.k8sNamespace,
    secretName: args.serviceAuthSecretName,
    key: 'SERVICE_AUTH_SECRET',
  })

  if (!secret) {
    throw new Error('Cannot resolve service auth secret; provide --service-auth-secret')
  }

  const ids = await resolveSmokeIds({
    context: args.k8sContext,
    namespace: args.k8sNamespace,
    postgresDeployment: args.postgresDeployment,
    postgresUser: args.postgresUser,
    postgresDatabase: args.postgresDatabase,
    communityId: args.communityId,
    actorAgentId: args.actorAgentId,
  })

  console.log('[t023-suite] Running injection smoke...')
  await runRuntimeSmoke(toCliArgs({
    ...common,
    injectPosts: true,
    serviceAuthSecret: secret,
    communityId: ids.communityId,
    actorAgentId: ids.actorAgentId,
    eventCount: Number(args.eventCount),
    waitDrainMs: Number(args.waitDrainMs),
  }))

  console.log('[t023-suite] PASS')
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[t023-suite] FAIL:', message)
  process.exit(1)
})
