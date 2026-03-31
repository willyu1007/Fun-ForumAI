#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tsImport } from 'tsx/esm/api'
import {
  kubectlArgs,
  listRunningPods,
  parseCliArgs,
  pollUntil,
  requestJson,
  runCommandCapture,
  startPortForward,
  stopChildProcess,
} from './k8s-smoke-utils.mjs'

function usage(exitCode = 0) {
  console.log(`
k8s-local-staging.mjs

Apply local-kind staging overlay, refresh the backend image, and verify runtime fingerprint parity.

Usage:
  node scripts/k8s-local-staging.mjs [options]

Options:
  --k8s-context <name>            Kubernetes context (default: kind-funforum)
  --k8s-namespace <name>          Namespace (default: funforum)
  --overlay <path>                Kustomize overlay path (default: ops/deploy/k8s/overlays/local-kind)
  --secret-name <name>            Secret resource name (default: forum-app-secret)
  --dashscope-api-key-env <name>  Environment variable for the primary DashScope API key (default: DASHSCOPE_API_KEY)
  --media-generation-api-key-env <name>
                                   Environment variable for the image generation API key (default: MEDIA_GENERATION_API_KEY)
  --image-tag <image>             Backend image tag to build/load (default: fun-forum-api:dev)
  --kind-load-image <image>       Backward-compatible alias for --image-tag
  --dockerfile <path>             Dockerfile used for the backend image build (default: ops/packaging/services/llm-forum.Dockerfile)
  --build-context <path>          Docker build context (default: .)
  --skip-image-refresh            Skip local docker build + kind load (explicit stale-image opt-out)
  --skip-image-build              Skip local docker build but still allow kind image load
  --skip-kind-load                Skip kind image load after selecting/building the image
  --kind-cluster-name <name>      Kind cluster name when loading image (default: funforum)
  --create-kind-if-missing        Optional: auto-create kind cluster when context is missing
  --skip-db-migrate               Optional: skip "pnpm db:migrate:deploy" against in-cluster Postgres
  --postgres-local-port <port>    Local port used for temporary Postgres port-forward (default: 55432)
  --backend-label <selector>      Backend pod label selector (default: app.kubernetes.io/name=backend)
  --backend-local-port <port>     Local port for temporary backend port-forward (default: 4100)
  --backend-port <port>           Backend container port (default: 4000)
  --run-smoke                     Optional: run generic runtime staging smoke after rollout
  --help

Examples:
  DASHSCOPE_API_KEY=*** node scripts/k8s-local-staging.mjs
  DASHSCOPE_API_KEY=*** MEDIA_GENERATION_API_KEY=*** node scripts/k8s-local-staging.mjs
  DASHSCOPE_API_KEY=*** node scripts/k8s-local-staging.mjs --create-kind-if-missing
  DASHSCOPE_API_KEY=*** node scripts/k8s-local-staging.mjs --skip-db-migrate
  DASHSCOPE_API_KEY=*** pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum
`)
  process.exit(exitCode)
}

function asInt(value, fallback, label) {
  const parsed = Number(value ?? fallback)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive number`)
  }
  return parsed
}

function devToken(userId, email, role = 'user') {
  return Buffer.from(JSON.stringify({ userId, email, role })).toString('base64url')
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

async function maybeRefreshImage({
  imageTag,
  dockerfile,
  buildContext,
  clusterName,
  skipImageRefresh,
  skipImageBuild,
  skipKindLoad,
}) {
  if (skipImageRefresh) {
    console.warn(`[staging] WARN: skip-image-refresh=true; reusing existing image ${imageTag}`)
    return
  }
  if (!skipImageBuild) {
    await ensureCommandExists('docker')
    console.log(`[staging] Building backend image: ${imageTag}`)
    await runCommandCapture('docker', [
      'build',
      '-f',
      String(dockerfile),
      '-t',
      String(imageTag),
      String(buildContext),
    ])
  } else {
    console.warn(`[staging] WARN: skip-image-build=true; reusing local docker image ${imageTag}`)
  }

  if (skipKindLoad) {
    console.warn(`[staging] WARN: skip-kind-load=true; cluster will reuse whatever image is already cached for ${imageTag}`)
    return
  }

  await maybeKindLoadImage(imageTag, clusterName)
}

async function waitForDeploymentRollout({
  context,
  namespace,
  deployment,
  timeoutSeconds = 180,
}) {
  await runCommandCapture(
    'kubectl',
    kubectlArgs(context, [
      'rollout',
      'status',
      `deploy/${String(deployment)}`,
      '-n',
      String(namespace),
      `--timeout=${Number(timeoutSeconds)}s`,
    ]),
  )
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

async function startBackendPortForwardWithFallback({
  context,
  namespace,
  podName,
  preferredLocalPort,
  containerPort,
  maxAttempts = 10,
}) {
  const requestedPort = Number(preferredLocalPort)
  let lastError = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidatePort = requestedPort + attempt
    try {
      const child = await startPortForward({
        context,
        namespace,
        podName,
        localPort: candidatePort,
        containerPort,
      })
      return {
        child,
        localPort: candidatePort,
        fellBackFromRequestedPort: candidatePort !== requestedPort,
      }
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const isPortConflict = /address already in use|unable to listen on any of the requested ports/i.test(message)
      if (!isPortConflict) {
        throw error
      }
    }
  }

  throw lastError ?? new Error(`Unable to establish backend port-forward after ${maxAttempts} attempts`)
}

async function runSmokeSuite({ context, namespace, labelSelector }) {
  const readyPods = await listRunningPods({
    context,
    namespace,
    labelSelector,
  })
  if (readyPods.length < 2) {
    console.warn(
      `[staging] WARN: skipping generic runtime staging smoke because selector ${labelSelector} has ${readyPods.length} ready backend pod(s); the smoke requires at least 2.`,
    )
    return
  }

  console.log('[staging] Running generic runtime staging smoke...')
  const scriptArgs = [
    'scripts/runtime-staging-smoke.mjs',
    '--discover-nodes-k8s',
    '--k8s-context',
    String(context),
    '--k8s-namespace',
    String(namespace),
    '--k8s-label-selector',
    String(labelSelector),
    '--dev-auth',
  ]
  const { stdout, stderr } = await runCommandCapture('node', scriptArgs)
  if (stdout.trim()) process.stdout.write(stdout)
  if (stderr.trim()) process.stderr.write(stderr)
}

async function waitForBackend(baseUrl) {
  await pollUntil(async () => {
    const res = await requestJson(`${baseUrl}/health`)
    return res.ok ? res : null
  }, { timeoutMs: 30_000, intervalMs: 1000 })
}

async function fetchRuntimeFeatures(baseUrl, adminToken) {
  const res = await requestJson(`${baseUrl}/v1/admin/runtime/features`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
  })
  if (!res.ok) {
    throw new Error(`GET /v1/admin/runtime/features failed: ${res.status} ${res.text}`)
  }
  return res.json?.data
}

async function loadLocalRuntimeBuildInfo() {
  const mod = await tsImport('../src/backend/lib/runtime-build-info.ts', import.meta.url)
  return mod.getRuntimeBuildInfo()
}

function validateRuntimeFeatures(features, localBuildInfo) {
  const remoteBuild = features?.runtime?.build
  if (!remoteBuild || typeof remoteBuild !== 'object') {
    throw new Error('Runtime features payload is missing runtime.build fingerprint details')
  }
  if (remoteBuild.code_fingerprint !== localBuildInfo.code_fingerprint) {
    throw new Error(
      `Runtime build fingerprint mismatch: local=${localBuildInfo.code_fingerprint} remote=${remoteBuild.code_fingerprint ?? 'missing'}`,
    )
  }

  const flags = features?.flags ?? {}
  const requiredScenes = ['forum_post', 'forum_thread', 'forum_turn', 'chat_room', 'private_chat', 'proactive_dm', 'scheduled_post']
  const requiredDirectorFlags = ['directorRuntimeStateV1']
  if (flags.personaRuntimeV1 !== true) {
    throw new Error('Runtime features show personaRuntimeV1=false after local-kind reconciliation')
  }
  if (flags.personaWritebackV1 !== true) {
    throw new Error('Runtime features show personaWritebackV1=false after local-kind reconciliation')
  }
  for (const flagName of requiredDirectorFlags) {
    if (flags[flagName] !== true) {
      throw new Error(`Runtime features show ${flagName}=false after local-kind reconciliation`)
    }
  }
  if (!Array.isArray(flags.personaRuntimeScenes)) {
    throw new Error('Runtime features are missing personaRuntimeScenes array')
  }
  const missingScenes = requiredScenes.filter((scene) => !flags.personaRuntimeScenes.includes(scene))
  if (missingScenes.length > 0) {
    throw new Error(`Runtime features are missing persona runtime scenes: ${missingScenes.join(', ')}`)
  }
}

async function main() {
  const args = parseCliArgs(process.argv, {
    k8sContext: 'kind-funforum',
    k8sNamespace: 'funforum',
    overlay: 'ops/deploy/k8s/overlays/local-kind',
    secretName: 'forum-app-secret',
    dashscopeApiKeyEnv: 'DASHSCOPE_API_KEY',
    mediaGenerationApiKeyEnv: 'MEDIA_GENERATION_API_KEY',
    imageTag: 'fun-forum-api:dev',
    dockerfile: 'ops/packaging/services/llm-forum.Dockerfile',
    buildContext: '.',
    skipImageRefresh: false,
    skipImageBuild: false,
    skipKindLoad: false,
    kindClusterName: 'funforum',
    createKindIfMissing: false,
    skipDbMigrate: false,
    postgresLocalPort: 55432,
    backendLabel: 'app.kubernetes.io/name=backend',
    backendLocalPort: 4100,
    backendPort: 4000,
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
  const dockerfilePath = resolve(process.cwd(), String(args.dockerfile))
  await access(dockerfilePath)
  const buildContextPath = resolve(process.cwd(), String(args.buildContext))
  await access(buildContextPath)

  const existingSecretData = await getSecretData({
    context: args.k8sContext,
    namespace: args.k8sNamespace,
    secretName: args.secretName,
  })
  const preservedSecretData = Object.fromEntries(
    Object.entries(existingSecretData).filter(
      ([key]) => key !== 'FF_HOME_PROGRAMMING_V1' && key !== 'FF_PROGRAMMING_OPS_V1',
    ),
  )

  const dashscopeApiKey = (
    process.env[String(args.dashscopeApiKeyEnv)] ||
    existingSecretData.DASHSCOPE_API_KEY ||
    ''
  )
  const mediaGenerationApiKey = (
    process.env[String(args.mediaGenerationApiKeyEnv)] ||
    process.env.ARK_API_KEY ||
    existingSecretData.MEDIA_GENERATION_API_KEY ||
    existingSecretData.ARK_API_KEY ||
    ''
  )
  if (!dashscopeApiKey.trim()) {
    throw new Error(
      `Missing API key env "${args.dashscopeApiKeyEnv}" and no reusable DashScope API key was found in secret/${args.secretName}`,
    )
  }

  await maybeRefreshImage({
    imageTag: String(args.imageTag || args.kindLoadImage),
    dockerfile: dockerfilePath,
    buildContext: buildContextPath,
    clusterName: args.kindClusterName,
    skipImageRefresh: Boolean(args.skipImageRefresh),
    skipImageBuild: Boolean(args.skipImageBuild),
    skipKindLoad: Boolean(args.skipKindLoad),
  })

  console.log(`[staging] Applying overlay: ${overlayPath}`)
  await runCommandCapture('kubectl', kubectlArgs(args.k8sContext, ['apply', '-k', overlayPath]))

  console.log('[staging] Waiting for postgres and redis rollouts...')
  await waitForDeploymentRollout({
    context: args.k8sContext,
    namespace: args.k8sNamespace,
    deployment: 'postgres',
  })
  await waitForDeploymentRollout({
    context: args.k8sContext,
    namespace: args.k8sNamespace,
    deployment: 'redis',
  })

  if (!args.skipDbMigrate) {
    console.log('[staging] Running database migrations (pnpm db:migrate:deploy)...')
    await runDbMigrations({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      postgresLocalPort: Number(args.postgresLocalPort),
    })
  }

  const mergedSecretData = {
    ...preservedSecretData,
    DATABASE_URL: existingSecretData.DATABASE_URL || defaultDatabaseUrl(String(args.k8sNamespace)),
    REDIS_URL: existingSecretData.REDIS_URL || defaultRedisUrl(String(args.k8sNamespace)),
    JWT_SECRET: process.env.JWT_SECRET || existingSecretData.JWT_SECRET || 'local-dev-jwt-secret',
    SERVICE_AUTH_SECRET:
      process.env.SERVICE_AUTH_SECRET || existingSecretData.SERVICE_AUTH_SECRET || 'local-dev-service-auth-secret',
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || existingSecretData.DASHSCOPE_API_KEY || dashscopeApiKey,
    DASHSCOPE_API_KEY_SECONDARY:
      process.env.DASHSCOPE_API_KEY_SECONDARY || existingSecretData.DASHSCOPE_API_KEY_SECONDARY || '',
    ZAI_API_KEY: process.env.ZAI_API_KEY || existingSecretData.ZAI_API_KEY || '',
    ZAI_API_KEY_SECONDARY:
      process.env.ZAI_API_KEY_SECONDARY || existingSecretData.ZAI_API_KEY_SECONDARY || '',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || existingSecretData.DEEPSEEK_API_KEY || '',
    DEEPSEEK_API_KEY_SECONDARY:
      process.env.DEEPSEEK_API_KEY_SECONDARY || existingSecretData.DEEPSEEK_API_KEY_SECONDARY || '',
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY || existingSecretData.MOONSHOT_API_KEY || '',
    MOONSHOT_API_KEY_SECONDARY:
      process.env.MOONSHOT_API_KEY_SECONDARY || existingSecretData.MOONSHOT_API_KEY_SECONDARY || '',
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY || existingSecretData.MINIMAX_API_KEY || '',
    MINIMAX_API_KEY_SECONDARY:
      process.env.MINIMAX_API_KEY_SECONDARY || existingSecretData.MINIMAX_API_KEY_SECONDARY || '',
    TENCENT_HUNYUAN_API_KEY:
      process.env.TENCENT_HUNYUAN_API_KEY || existingSecretData.TENCENT_HUNYUAN_API_KEY || '',
    TENCENT_HUNYUAN_API_KEY_SECONDARY:
      process.env.TENCENT_HUNYUAN_API_KEY_SECONDARY || existingSecretData.TENCENT_HUNYUAN_API_KEY_SECONDARY || '',
    ARK_API_KEY: process.env.ARK_API_KEY || existingSecretData.ARK_API_KEY || '',
    ARK_API_KEY_SECONDARY:
      process.env.ARK_API_KEY_SECONDARY || existingSecretData.ARK_API_KEY_SECONDARY || '',
    MEDIA_GENERATION_API_KEY: mediaGenerationApiKey,
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

  const localBuildInfo = await loadLocalRuntimeBuildInfo()
  const adminToken = devToken('admin-dev', 'admin-dev@local.test', 'admin')
  let backendForward = null
  try {
    const backendPods = await listRunningPods({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      labelSelector: String(args.backendLabel),
    })
    if (backendPods.length === 0) {
      throw new Error(`No ready backend pod found for selector ${args.backendLabel}`)
    }
    const backendForwardResult = await startBackendPortForwardWithFallback({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      podName: backendPods[0],
      preferredLocalPort: asInt(args.backendLocalPort, 4100, '--backend-local-port'),
      containerPort: asInt(args.backendPort, 4000, '--backend-port'),
    })
    backendForward = backendForwardResult.child
    const backendLocalPort = backendForwardResult.localPort
    if (backendForwardResult.fellBackFromRequestedPort) {
      console.warn(
        `[staging] WARN: backend local port ${args.backendLocalPort} was unavailable, using ${backendLocalPort} instead`,
      )
    }

    const baseUrl = `http://127.0.0.1:${backendLocalPort}`
    await waitForBackend(baseUrl)
    const runtimeFeatures = await fetchRuntimeFeatures(baseUrl, adminToken)
    validateRuntimeFeatures(runtimeFeatures, localBuildInfo)
    console.log('[staging] Runtime fingerprint verified:', JSON.stringify({
      code_fingerprint: runtimeFeatures.runtime.build.code_fingerprint,
      persona_runtime: runtimeFeatures.runtime.persona_runtime,
      local_port: backendLocalPort,
    }))
  } finally {
    await stopChildProcess(backendForward)
  }

  if (args.runSmoke) {
    await runSmokeSuite({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      labelSelector: args.backendLabel,
    })
  }

  console.log('[staging] Local K8s staging rehearsal is ready.')
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[staging] FAIL: ${message}`)
  process.exit(1)
})
