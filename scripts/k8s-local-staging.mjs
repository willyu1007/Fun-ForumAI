#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { kubectlArgs, parseCliArgs, runCommandCapture, stopChildProcess } from './k8s-smoke-utils.mjs'

function usage(exitCode = 0) {
  console.log(`
k8s-local-staging.mjs

Apply local-kind staging overlay and inject LLM API key into forum-app-secret.

Usage:
  node scripts/k8s-local-staging.mjs [options]

Options:
  --k8s-context <name>            Kubernetes context (default: kind-funforum)
  --k8s-namespace <name>          Namespace (default: funforum)
  --overlay <path>                Kustomize overlay path (default: ops/deploy/k8s/overlays/local-kind)
  --secret-name <name>            Secret resource name (default: forum-app-secret)
  --llm-api-key-env <name>        Environment variable for API key (default: LLM_API_KEY)
  --kind-load-image <image>       Optional: run "kind load docker-image <image>"
  --kind-cluster-name <name>      Kind cluster name when loading image (default: funforum)
  --create-kind-if-missing        Optional: auto-create kind cluster when context is missing
  --skip-db-migrate               Optional: skip "pnpm db:migrate:deploy" against in-cluster Postgres
  --postgres-local-port <port>    Local port used for temporary Postgres port-forward (default: 55432)
  --run-smoke                     Optional: run T-023~T-025 smoke suite after rollout
  --help

Examples:
  LLM_API_KEY=*** node scripts/k8s-local-staging.mjs
  LLM_API_KEY=*** node scripts/k8s-local-staging.mjs --create-kind-if-missing
  LLM_API_KEY=*** node scripts/k8s-local-staging.mjs --skip-db-migrate
  LLM_API_KEY=*** pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum
`)
  process.exit(exitCode)
}

function decodeSecretData(data) {
  const out = {}
  if (!data || typeof data !== 'object') return out
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string') continue
    out[key] = Buffer.from(value, 'base64').toString('utf-8')
  }
  return out
}

async function runCommandWithStdin(cmd, args, stdinText) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.once('error', rejectPromise)
    child.once('close', (code) => {
      const exitCode = Number(code ?? 1)
      if (exitCode === 0) {
        resolvePromise({ stdout, stderr })
        return
      }
      rejectPromise(new Error(`${cmd} ${args.join(' ')} failed (${exitCode}): ${stderr || stdout}`))
    })

    child.stdin.write(stdinText)
    child.stdin.end()
  })
}

async function ensureCommandExists(cmd) {
  try {
    await runCommandCapture(cmd, ['--help'])
  } catch {
    throw new Error(`Command not found or not runnable: ${cmd}`)
  }
}

async function listK8sContexts() {
  const res = await runCommandCapture('kubectl', ['config', 'get-contexts', '-o', 'name'])
  return res.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

async function assertK8sContextExists(context) {
  const contexts = await listK8sContexts()
  if (contexts.includes(String(context))) return
  const list = contexts.length ? contexts.join(', ') : '(none)'
  throw new Error(`Kubernetes context "${context}" not found. Available contexts: ${list}`)
}

async function getSecretData({ context, namespace, secretName }) {
  try {
    const res = await runCommandCapture(
      'kubectl',
      kubectlArgs(context, ['get', 'secret', String(secretName), '-n', String(namespace), '-o', 'json']),
    )
    const payload = JSON.parse(res.stdout)
    return decodeSecretData(payload?.data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/notfound|not found/i.test(message)) return {}
    throw err
  }
}

async function maybeKindLoadImage(image, clusterName) {
  if (!image) return
  await ensureCommandExists('kind')
  console.log(`[staging] Loading image into kind cluster "${clusterName}": ${image}`)
  await runCommandCapture('kind', ['load', 'docker-image', String(image), '--name', String(clusterName)])
}

async function startServicePortForward({
  context,
  namespace,
  serviceName,
  localPort,
  servicePort,
  timeoutMs = 10_000,
}) {
  const child = spawn(
    'kubectl',
    kubectlArgs(context, [
      'port-forward',
      '-n',
      String(namespace),
      `svc/${String(serviceName)}`,
      `${Number(localPort)}:${Number(servicePort)}`,
    ]),
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )

  await new Promise((resolvePromise, rejectPromise) => {
    let output = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      rejectPromise(new Error(`Timeout waiting for port-forward to svc/${serviceName}`))
    }, timeoutMs)

    const finish = (fn) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }

    const onData = (chunk) => {
      const text = chunk.toString()
      output += text
      if (text.includes('Forwarding from')) {
        finish(resolvePromise)
      }
    }

    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.once('error', (err) => finish(() => rejectPromise(err)))
    child.once('exit', (code) => {
      finish(() =>
        rejectPromise(
          new Error(`kubectl port-forward exited early (${code ?? 'null'}) for svc/${serviceName}: ${output}`),
        ),
      )
    })
  })

  return child
}

async function runDbMigrations({
  context,
  namespace,
  postgresLocalPort,
  postgresServiceName = 'postgres',
  postgresServicePort = 5432,
  databaseName = 'llm_forum',
}) {
  const forward = await startServicePortForward({
    context,
    namespace,
    serviceName: postgresServiceName,
    localPort: Number(postgresLocalPort),
    servicePort: Number(postgresServicePort),
  })
  try {
    const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${Number(postgresLocalPort)}/${databaseName}`
    await runCommandCapture('pnpm', ['db:migrate:deploy'], {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    })
  } finally {
    await stopChildProcess(forward)
  }
}

function defaultDatabaseUrl(namespace) {
  return `postgresql://postgres:postgres@postgres.${namespace}.svc.cluster.local:5432/llm_forum`
}

function defaultRedisUrl(namespace) {
  return `redis://redis.${namespace}.svc.cluster.local:6379`
}

async function runSmokeSuite({ context, namespace }) {
  console.log('[staging] Running T-023~T-025 K8s smoke suite...')
  const scriptArgs = [
    'scripts/t023-t025-k8s-smoke-suite.mjs',
    '--k8s-context',
    String(context),
    '--k8s-namespace',
    String(namespace),
  ]
  const { stdout, stderr } = await runCommandCapture('node', scriptArgs)
  if (stdout.trim()) process.stdout.write(stdout)
  if (stderr.trim()) process.stderr.write(stderr)
}

async function main() {
  const args = parseCliArgs(process.argv, {
    k8sContext: 'kind-funforum',
    k8sNamespace: 'funforum',
    overlay: 'ops/deploy/k8s/overlays/local-kind',
    secretName: 'forum-app-secret',
    llmApiKeyEnv: 'LLM_API_KEY',
    kindClusterName: 'funforum',
    createKindIfMissing: false,
    skipDbMigrate: false,
    postgresLocalPort: 55432,
    runSmoke: false,
  })

  if (args.help) usage(0)

  await ensureCommandExists('kubectl')

  const contexts = await listK8sContexts()
  if (!contexts.includes(String(args.k8sContext))) {
    if (!args.createKindIfMissing) {
      const list = contexts.length ? contexts.join(', ') : '(none)'
      throw new Error(`Kubernetes context "${args.k8sContext}" not found. Available contexts: ${list}`)
    }
    await ensureCommandExists('kind')
    console.log(`[staging] Context missing, creating kind cluster "${args.kindClusterName}"...`)
    await runCommandCapture('kind', ['create', 'cluster', '--name', String(args.kindClusterName)])
    await assertK8sContextExists(args.k8sContext)
  }

  const overlayPath = resolve(process.cwd(), String(args.overlay))
  await access(overlayPath)

  const llmApiKey = process.env[String(args.llmApiKeyEnv)] || ''
  if (!llmApiKey.trim()) {
    throw new Error(`Missing API key env "${args.llmApiKeyEnv}". Example: export ${args.llmApiKeyEnv}=<your-key>`)
  }

  await maybeKindLoadImage(args.kindLoadImage, args.kindClusterName)

  console.log(`[staging] Applying overlay: ${overlayPath}`)
  await runCommandCapture('kubectl', kubectlArgs(args.k8sContext, ['apply', '-k', overlayPath]))

  if (!args.skipDbMigrate) {
    console.log('[staging] Running database migrations (pnpm db:migrate:deploy)...')
    await runDbMigrations({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      postgresLocalPort: Number(args.postgresLocalPort),
    })
  }

  const existingSecretData = await getSecretData({
    context: args.k8sContext,
    namespace: args.k8sNamespace,
    secretName: args.secretName,
  })

  const mergedSecretData = {
    DATABASE_URL: existingSecretData.DATABASE_URL || defaultDatabaseUrl(String(args.k8sNamespace)),
    REDIS_URL: existingSecretData.REDIS_URL || defaultRedisUrl(String(args.k8sNamespace)),
    JWT_SECRET: process.env.JWT_SECRET || existingSecretData.JWT_SECRET || 'local-dev-jwt-secret',
    SERVICE_AUTH_SECRET:
      process.env.SERVICE_AUTH_SECRET || existingSecretData.SERVICE_AUTH_SECRET || 'local-dev-service-auth-secret',
    LLM_API_KEY: llmApiKey,
  }

  const secretManifest = JSON.stringify(
    {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: String(args.secretName),
        namespace: String(args.k8sNamespace),
      },
      type: 'Opaque',
      stringData: mergedSecretData,
    },
    null,
    2,
  )

  console.log(`[staging] Injecting API key into secret/${args.secretName} in namespace ${args.k8sNamespace}`)
  await runCommandWithStdin(
    'kubectl',
    kubectlArgs(args.k8sContext, ['apply', '-f', '-']),
    `${secretManifest}\n`,
  )

  console.log('[staging] Restarting backend deployment to pick up updated secret values...')
  await runCommandCapture(
    'kubectl',
    kubectlArgs(args.k8sContext, ['rollout', 'restart', 'deploy/backend', '-n', String(args.k8sNamespace)]),
  )

  console.log('[staging] Waiting for backend rollout...')
  await runCommandCapture(
    'kubectl',
    kubectlArgs(args.k8sContext, [
      'rollout',
      'status',
      'deploy/backend',
      '-n',
      String(args.k8sNamespace),
      '--timeout=180s',
    ]),
  )

  if (args.runSmoke) {
    await runSmokeSuite({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
    })
  }

  console.log('[staging] Local K8s staging rehearsal is ready.')
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[staging] FAIL: ${message}`)
  process.exit(1)
})
