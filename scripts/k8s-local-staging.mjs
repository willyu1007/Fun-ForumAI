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
import { registerChildProcessCleanup } from './lib/k8s-process-cleanup.mjs'
import {
  resolveDashscopeSecretData,
  resolveEnvBackedSecretValue,
  sanitizeSecretValue,
} from './lib/k8s-secret-resolution.mjs'
import {
  loadFrontendBuildProfile,
  toDockerBuildArgs,
} from '../ops/packaging/scripts/frontend-build-profile.mjs'
import { validateLaunchImageProof } from './ci/check-image-launch-proof.mjs'

const LEGACY_BACKEND_FLAG_PREFIX = ['FF', ''].join('_')
const RUNTIME_ENV_PIN_KEYS = ['LLM_PROVIDER', 'LLM_MODEL', 'LLM_BASE_URL']
const LOCAL_CLUSTER_BOUND_SECRET_KEYS = [
  'DATABASE_URL',
  'REDIS_URL',
  'RUNTIME_REDIS_URL',
  'SSE_REDIS_URL',
]
const LOCAL_KIND_ADMIN_EMAIL = 'codex-admin+kind@local.test'
const LOCAL_KIND_ADMIN_PASSWORD = 'CodexKind#2026'
const LOCAL_KIND_ADMIN_DISPLAY_NAME = 'Codex Kind Admin'

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
  --token-plan-api-key-env <name> Environment variable for the Token Plan API key (default: TOKEN_PLAN_OPENAI_API_KEY)
  --media-generation-api-key-env <name>
                                   Environment variable for the image generation API key (default: MEDIA_GENERATION_API_KEY)
  --frontend-build-profile <id>   Frontend build profile to bake into the image (default: launch, use "none" to skip)
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
  --backend-deployment <name>     Backend deployment name used for smoke scaling (default: backend)
  --backend-local-port <port>     Local port for temporary backend port-forward (default: 4100)
  --backend-port <port>           Backend container port (default: 4000)
  --seed-profile <profile>        Dev seed profile to apply after rollout (default: canonical, use "none" to skip)
  --skip-seed                     Skip POST /v1/dev/seed after rollout
  --run-smoke                     Optional: run generic runtime staging smoke after rollout
  --help

Examples:
  DASHSCOPE_API_KEY=*** node scripts/k8s-local-staging.mjs
  DASHSCOPE_API_KEY=*** TOKEN_PLAN_OPENAI_API_KEY=*** node scripts/k8s-local-staging.mjs
  DASHSCOPE_API_KEY=*** MEDIA_GENERATION_API_KEY=*** node scripts/k8s-local-staging.mjs
  DASHSCOPE_API_KEY=*** node scripts/k8s-local-staging.mjs --create-kind-if-missing
  DASHSCOPE_API_KEY=*** node scripts/k8s-local-staging.mjs --skip-db-migrate
  DASHSCOPE_API_KEY=*** MEDIA_GENERATION_API_KEY=*** node scripts/k8s-local-staging.mjs --seed-profile canonical
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

function decodeSecretData(data) {
  const out = {}
  if (!data || typeof data !== 'object') return out
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string') continue
    out[key] = Buffer.from(value, 'base64').toString('utf-8')
  }
  return out
}

function readEnvOverride(name) {
  return Object.prototype.hasOwnProperty.call(process.env, name)
    ? process.env[name]
    : undefined
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

async function unsetDeploymentEnvVars({ context, namespace, deployment, names }) {
  const envNames = Array.from(new Set((names ?? []).filter(Boolean)))
  if (envNames.length === 0) return
  await runCommandCapture(
    'kubectl',
    kubectlArgs(context, [
      'set',
      'env',
      `deploy/${String(deployment)}`,
      ...envNames.map((name) => `${name}-`),
      '-n',
      String(namespace),
    ]),
  )
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
      kubectlArgs(context, [
        'get',
        'secret',
        String(secretName),
        '-n',
        String(namespace),
        '-o',
        'json',
      ]),
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
  await runCommandCapture('kind', [
    'load',
    'docker-image',
    String(image),
    '--name',
    String(clusterName),
  ])
}

async function maybeRefreshImage({
  imageTag,
  dockerfile,
  buildContext,
  dockerBuildArgs,
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
      ...dockerBuildArgs,
      String(buildContext),
    ])
  } else {
    console.warn(`[staging] WARN: skip-image-build=true; reusing local docker image ${imageTag}`)
  }

  if (skipKindLoad) {
    console.warn(
      `[staging] WARN: skip-kind-load=true; cluster will reuse whatever image is already cached for ${imageTag}`,
    )
    return
  }

  await maybeKindLoadImage(imageTag, clusterName)
}

async function waitForDeploymentRollout({ context, namespace, deployment, timeoutSeconds = 180 }) {
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

async function getDeploymentReplicaCount({ context, namespace, deployment }) {
  const res = await runCommandCapture(
    'kubectl',
    kubectlArgs(context, [
      'get',
      'deployment',
      String(deployment),
      '-n',
      String(namespace),
      '-o',
      'json',
    ]),
  )
  const payload = JSON.parse(res.stdout)
  return Number(payload?.spec?.replicas ?? 1)
}

async function scaleDeploymentReplicas({
  context,
  namespace,
  deployment,
  replicas,
}) {
  await runCommandCapture(
    'kubectl',
    kubectlArgs(context, [
      'scale',
      `deploy/${String(deployment)}`,
      '-n',
      String(namespace),
      `--replicas=${Number(replicas)}`,
    ]),
  )
  await waitForDeploymentRollout({
    context,
    namespace,
    deployment,
  })
}

async function setBackendDeploymentImage({
  context,
  namespace,
  deployment,
  imageTag,
}) {
  if (!imageTag) return
  console.log(`[staging] Setting ${deployment} image to ${imageTag}`)
  await runCommandCapture(
    'kubectl',
    kubectlArgs(context, [
      'set',
      'image',
      `deploy/${String(deployment)}`,
      `backend=${String(imageTag)}`,
      '-n',
      String(namespace),
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
          new Error(
            `kubectl port-forward exited early (${code ?? 'null'}) for svc/${serviceName}: ${output}`,
          ),
        ),
      )
    })
  })

  return child
}

async function startServicePortForwardWithFallback({
  context,
  namespace,
  serviceName,
  preferredLocalPort,
  servicePort,
  maxAttempts = 10,
}) {
  const requestedPort = Number(preferredLocalPort)
  let lastError = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidatePort = requestedPort + attempt
    try {
      const child = await startServicePortForward({
        context,
        namespace,
        serviceName,
        localPort: candidatePort,
        servicePort,
      })
      return {
        child,
        localPort: candidatePort,
        fellBackFromRequestedPort: candidatePort !== requestedPort,
      }
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const isPortConflict =
        /address already in use|unable to listen on any of the requested ports/i.test(message)
      if (!isPortConflict) {
        throw error
      }
    }
  }

  throw (
    lastError ?? new Error(`Unable to establish service port-forward after ${maxAttempts} attempts`)
  )
}

async function runDbMigrations({
  context,
  namespace,
  postgresLocalPort,
  postgresServiceName = 'postgres',
  postgresServicePort = 5432,
  databaseName = 'llm_forum',
}) {
  const forwardResult = await startServicePortForwardWithFallback({
    context,
    namespace,
    serviceName: postgresServiceName,
    preferredLocalPort: Number(postgresLocalPort),
    servicePort: Number(postgresServicePort),
  })
  const forward = forwardResult.child
  try {
    if (forwardResult.fellBackFromRequestedPort) {
      console.warn(
        `[staging] WARN: postgres local port ${postgresLocalPort} was unavailable, using ${forwardResult.localPort} instead`,
      )
    }
    const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${forwardResult.localPort}/${databaseName}`
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

async function verifyDbMigrationStatus({
  context,
  namespace,
  postgresLocalPort,
  postgresServiceName = 'postgres',
  postgresServicePort = 5432,
  databaseName = 'llm_forum',
}) {
  const forwardResult = await startServicePortForwardWithFallback({
    context,
    namespace,
    serviceName: postgresServiceName,
    preferredLocalPort: Number(postgresLocalPort),
    servicePort: Number(postgresServicePort),
  })
  const forward = forwardResult.child
  try {
    if (forwardResult.fellBackFromRequestedPort) {
      console.warn(
        `[staging] WARN: postgres local port ${postgresLocalPort} was unavailable, using ${forwardResult.localPort} instead`,
      )
    }
    const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${forwardResult.localPort}/${databaseName}`
    try {
      await runCommandCapture('pnpm', ['db:migrate:status'], {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `--skip-db-migrate was requested, but the local-kind database is not migration-clean. ` +
          `Run the command again without --skip-db-migrate, or migrate the in-cluster Postgres first. ` +
          `Root cause: ${message}`,
        { cause: error },
      )
    }
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
      const isPortConflict =
        /address already in use|unable to listen on any of the requested ports/i.test(message)
      if (!isPortConflict) {
        throw error
      }
    }
  }

  throw (
    lastError ?? new Error(`Unable to establish backend port-forward after ${maxAttempts} attempts`)
  )
}

async function runSmokeSuite({ context, namespace, labelSelector, deployment }) {
  let readyPods = await listRunningPods({
    context,
    namespace,
    labelSelector,
  })
  const requiredPods = 2
  const originalReplicas = await getDeploymentReplicaCount({
    context,
    namespace,
    deployment,
  })
  let scaledForSmoke = false

  if (readyPods.length < requiredPods && originalReplicas < requiredPods) {
    console.log(
      `[staging] Scaling ${deployment} to ${requiredPods} replicas so generic runtime staging smoke can run...`,
    )
    await scaleDeploymentReplicas({
      context,
      namespace,
      deployment,
      replicas: requiredPods,
    })
    scaledForSmoke = true
    readyPods = await listRunningPods({
      context,
      namespace,
      labelSelector,
    })
  }

  if (readyPods.length < requiredPods) {
    console.warn(
      `[staging] WARN: skipping generic runtime staging smoke because selector ${labelSelector} has ${readyPods.length} ready backend pod(s); the smoke requires at least 2.`,
    )
    return
  }

  try {
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
      '--admin-email',
      LOCAL_KIND_ADMIN_EMAIL,
      '--admin-password',
      LOCAL_KIND_ADMIN_PASSWORD,
    ]
    const { stdout, stderr } = await runCommandCapture('node', scriptArgs)
    if (stdout.trim()) process.stdout.write(stdout)
    if (stderr.trim()) process.stderr.write(stderr)
  } finally {
    if (scaledForSmoke) {
      console.log(
        `[staging] Restoring ${deployment} replica count to ${originalReplicas} after generic smoke...`,
      )
      await scaleDeploymentReplicas({
        context,
        namespace,
        deployment,
        replicas: originalReplicas,
      })
    }
  }
}

async function waitForBackend(baseUrl) {
  await pollUntil(
    async () => {
      const res = await requestJson(`${baseUrl}/health`)
      return res.ok ? res : null
    },
    { timeoutMs: 30_000, intervalMs: 1000 },
  )
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

async function bootstrapLocalAdmin({
  context,
  namespace,
  postgresLocalPort,
  postgresServiceName = 'postgres',
  postgresServicePort = 5432,
  databaseName = 'llm_forum',
}) {
  const forwardResult = await startServicePortForwardWithFallback({
    context,
    namespace,
    serviceName: postgresServiceName,
    preferredLocalPort: Number(postgresLocalPort),
    servicePort: Number(postgresServicePort),
  })
  const forward = forwardResult.child
  try {
    if (forwardResult.fellBackFromRequestedPort) {
      console.warn(
        `[staging] WARN: postgres local port ${postgresLocalPort} was unavailable, using ${forwardResult.localPort} instead`,
      )
    }
    const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${forwardResult.localPort}/${databaseName}`
    await runCommandCapture(
      'node',
      [
        'scripts/bootstrap-admin-account.mjs',
        '--email',
        LOCAL_KIND_ADMIN_EMAIL,
        '--password',
        LOCAL_KIND_ADMIN_PASSWORD,
        '--display-name',
        LOCAL_KIND_ADMIN_DISPLAY_NAME,
      ],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          AUTH_BOOTSTRAP_ADMIN_EMAILS: LOCAL_KIND_ADMIN_EMAIL,
        },
      },
    )
  } finally {
    await stopChildProcess(forward)
  }
}

async function loginAdmin(baseUrl) {
  const res = await requestJson(`${baseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: LOCAL_KIND_ADMIN_EMAIL,
      password: LOCAL_KIND_ADMIN_PASSWORD,
    }),
  })
  if (!res.ok) {
    throw new Error(`POST /v1/auth/login failed: ${res.status} ${res.text}`)
  }
  const token = res.json?.data?.token
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('POST /v1/auth/login succeeded but did not return a token')
  }
  return token
}

async function fetchFrontendBuildProof(baseUrl) {
  const res = await requestJson(`${baseUrl}/frontend-build-capabilities.json`, {
    headers: {
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`GET /frontend-build-capabilities.json failed: ${res.status} ${res.text}`)
  }
  return res.json
}

async function seedDevData(baseUrl, profile) {
  const res = await requestJson(`${baseUrl}/v1/dev/seed`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(profile ? { profile } : {}),
  })
  if (!res.ok) {
    throw new Error(`POST /v1/dev/seed failed: ${res.status} ${res.text}`)
  }
  return res.json?.data
}

async function maybeSeedDevData(baseUrl, profile, runtimeFeatures) {
  if (!profile) return null
  try {
    return await seedDevData(baseUrl, profile)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const nodeEnv = runtimeFeatures?.runtime?.node_env
    if (/POST \/v1\/dev\/seed failed: 404\b/.test(message)) {
      if (nodeEnv && nodeEnv !== 'production') {
        throw error
      }
      console.warn(
        '[staging] WARN: /v1/dev/seed is unavailable in production-like local-kind mode; skipping seed.',
      )
      return null
    }
    throw error
  }
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

  const flags = features?.launch_capabilities ?? features?.flags ?? {}
  const requiredScenes = [
    'forum_post',
    'forum_thread',
    'forum_turn',
    'chat_room',
    'private_chat',
    'proactive_dm',
    'scheduled_post',
  ]
  const requiredTrueFlags = [
    'directorRuntimeStateV1',
    'multimodalAgentMediaV1',
    'mediaGenerationV1',
    'mediaRolloutControllerV1',
  ]
  if (flags.personaRuntimeV1 !== true) {
    throw new Error('Runtime features show personaRuntimeV1=false after local-kind reconciliation')
  }
  if (flags.personaWritebackV1 !== true) {
    throw new Error(
      'Runtime features show personaWritebackV1=false after local-kind reconciliation',
    )
  }
  for (const flagName of requiredTrueFlags) {
    if (flags[flagName] !== true) {
      throw new Error(`Runtime features show ${flagName}=false after local-kind reconciliation`)
    }
  }
  if (!Array.isArray(flags.personaRuntimeScenes)) {
    throw new Error('Runtime features are missing personaRuntimeScenes array')
  }
  const missingScenes = requiredScenes.filter(
    (scene) => !flags.personaRuntimeScenes.includes(scene),
  )
  if (missingScenes.length > 0) {
    throw new Error(
      `Runtime features are missing persona runtime scenes: ${missingScenes.join(', ')}`,
    )
  }
}

function normalizeFrontendBuildProfile(raw) {
  if (raw === 'none') return null
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim()
  }
  return 'launch'
}

function normalizeSeedProfile(raw) {
  if (raw === 'none') return null
  if (raw === 'launch' || raw === 'smoke-minimal') {
    return raw
  }
  return 'canonical'
}

async function main() {
  const args = parseCliArgs(process.argv, {
    k8sContext: 'kind-funforum',
    k8sNamespace: 'funforum',
    overlay: 'ops/deploy/k8s/overlays/local-kind',
    secretName: 'forum-app-secret',
    dashscopeApiKeyEnv: 'DASHSCOPE_API_KEY',
    tokenPlanApiKeyEnv: 'TOKEN_PLAN_OPENAI_API_KEY',
    mediaGenerationApiKeyEnv: 'MEDIA_GENERATION_API_KEY',
    frontendBuildProfile: 'launch',
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
    backendDeployment: 'backend',
    backendLocalPort: 4100,
    backendPort: 4000,
    seedProfile: 'canonical',
    skipSeed: false,
    runSmoke: false,
  })

  if (args.help) usage(0)

  await ensureCommandExists('kubectl')

  const contexts = await listK8sContexts()
  if (!contexts.includes(String(args.k8sContext))) {
    if (!args.createKindIfMissing) {
      const list = contexts.length ? contexts.join(', ') : '(none)'
      throw new Error(
        `Kubernetes context "${args.k8sContext}" not found. Available contexts: ${list}`,
      )
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
  const frontendBuildProfileId = normalizeFrontendBuildProfile(args.frontendBuildProfile)
  const frontendBuildProfile = frontendBuildProfileId
    ? loadFrontendBuildProfile(frontendBuildProfileId)
    : null
  const dockerBuildArgs = frontendBuildProfile
    ? toDockerBuildArgs(frontendBuildProfile).flatMap(([key, value]) => [
        '--build-arg',
        `${key}=${value}`,
      ])
    : []
  dockerBuildArgs.push('--build-arg', 'VITE_FF_CHATROOM_STAGING_HOLD_V1=true')
  const seedProfile = normalizeSeedProfile(args.seedProfile)

  const existingSecretData = await getSecretData({
    context: args.k8sContext,
    namespace: args.k8sNamespace,
    secretName: args.secretName,
  })
  const preservedSecretData = Object.fromEntries(
    Object.entries(existingSecretData).filter(
      ([key]) =>
        !key.startsWith(LEGACY_BACKEND_FLAG_PREFIX) &&
        !RUNTIME_ENV_PIN_KEYS.includes(key) &&
        !LOCAL_CLUSTER_BOUND_SECRET_KEYS.includes(key),
    ),
  )

  const { dashscopeApiKey, dashscopeSecondaryApiKey } = resolveDashscopeSecretData({
    existingSecretData,
    dashscopeApiKeyEnv: args.dashscopeApiKeyEnv,
    env: process.env,
  })
  const tokenPlanApiKey = resolveEnvBackedSecretValue({
    existingSecretData,
    envKey: args.tokenPlanApiKeyEnv,
    secretKey: 'TOKEN_PLAN_OPENAI_API_KEY',
    env: process.env,
  })
  const mediaGenerationApiKey =
    sanitizeSecretValue(process.env[String(args.mediaGenerationApiKeyEnv)]) ||
    sanitizeSecretValue(process.env.ARK_API_KEY) ||
    sanitizeSecretValue(existingSecretData.MEDIA_GENERATION_API_KEY) ||
    sanitizeSecretValue(existingSecretData.ARK_API_KEY) ||
    ''
  if (!dashscopeApiKey.trim() && !tokenPlanApiKey.trim()) {
    throw new Error(
      `Missing usable text-provider credentials. Provide "${args.dashscopeApiKeyEnv}" and/or "${args.tokenPlanApiKeyEnv}", or ensure secret/${args.secretName} already contains a non-placeholder value.`,
    )
  }

  await maybeRefreshImage({
    imageTag: String(args.imageTag || args.kindLoadImage),
    dockerfile: dockerfilePath,
    buildContext: buildContextPath,
    dockerBuildArgs,
    clusterName: args.kindClusterName,
    skipImageRefresh: Boolean(args.skipImageRefresh),
    skipImageBuild: Boolean(args.skipImageBuild),
    skipKindLoad: Boolean(args.skipKindLoad),
  })

  console.log(`[staging] Applying overlay: ${overlayPath}`)
  await runCommandCapture('kubectl', kubectlArgs(args.k8sContext, ['apply', '-k', overlayPath]))
  await setBackendDeploymentImage({
    context: args.k8sContext,
    namespace: args.k8sNamespace,
    deployment: args.backendDeployment,
    imageTag: String(args.imageTag || args.kindLoadImage),
  })

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
  } else {
    console.log(
      '[staging] Verifying database migration status because --skip-db-migrate was requested...',
    )
    await verifyDbMigrationStatus({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      postgresLocalPort: Number(args.postgresLocalPort),
    })
  }

  console.log('[staging] Clearing deprecated runtime env pins from backend deployment...')
  await unsetDeploymentEnvVars({
    context: args.k8sContext,
    namespace: args.k8sNamespace,
    deployment: args.backendDeployment,
    names: RUNTIME_ENV_PIN_KEYS,
  })

  const databaseUrl = readEnvOverride('DATABASE_URL') ?? defaultDatabaseUrl(String(args.k8sNamespace))
  const redisUrl = readEnvOverride('REDIS_URL') ?? defaultRedisUrl(String(args.k8sNamespace))
  const runtimeRedisUrl = readEnvOverride('RUNTIME_REDIS_URL') ?? redisUrl
  const sseRedisUrl = readEnvOverride('SSE_REDIS_URL') ?? runtimeRedisUrl

  const mergedSecretData = {
    ...preservedSecretData,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    RUNTIME_REDIS_URL: runtimeRedisUrl,
    SSE_REDIS_URL: sseRedisUrl,
    JWT_SECRET:
      readEnvOverride('JWT_SECRET')
      ?? existingSecretData.JWT_SECRET
      ?? 'local-dev-jwt-secret',
    SERVICE_AUTH_SECRET:
      readEnvOverride('SERVICE_AUTH_SECRET')
      ?? existingSecretData.SERVICE_AUTH_SECRET
      ??
      'local-dev-service-auth-secret',
    DASHSCOPE_API_KEY: dashscopeApiKey,
    DASHSCOPE_API_KEY_SECONDARY: dashscopeSecondaryApiKey,
    TOKEN_PLAN_OPENAI_API_KEY: tokenPlanApiKey,
    ZAI_API_KEY: sanitizeSecretValue(
      readEnvOverride('ZAI_API_KEY') ?? existingSecretData.ZAI_API_KEY ?? '',
    ),
    ZAI_API_KEY_SECONDARY:
      sanitizeSecretValue(
        readEnvOverride('ZAI_API_KEY_SECONDARY')
        ?? existingSecretData.ZAI_API_KEY_SECONDARY
        ?? '',
      ),
    DEEPSEEK_API_KEY:
      sanitizeSecretValue(
        readEnvOverride('DEEPSEEK_API_KEY') ?? existingSecretData.DEEPSEEK_API_KEY ?? '',
      ),
    MOONSHOT_API_KEY:
      sanitizeSecretValue(
        readEnvOverride('MOONSHOT_API_KEY') ?? existingSecretData.MOONSHOT_API_KEY ?? '',
      ),
    MINIMAX_API_KEY:
      sanitizeSecretValue(
        readEnvOverride('MINIMAX_API_KEY') ?? existingSecretData.MINIMAX_API_KEY ?? '',
      ),
    MINIMAX_API_KEY_SECONDARY:
      sanitizeSecretValue(
        readEnvOverride('MINIMAX_API_KEY_SECONDARY')
        ?? existingSecretData.MINIMAX_API_KEY_SECONDARY
        ?? '',
      ),
    TENCENT_HUNYUAN_API_KEY:
      sanitizeSecretValue(
        readEnvOverride('TENCENT_HUNYUAN_API_KEY')
        ?? existingSecretData.TENCENT_HUNYUAN_API_KEY
        ?? '',
      ),
    ARK_API_KEY: sanitizeSecretValue(
      readEnvOverride('ARK_API_KEY') ?? existingSecretData.ARK_API_KEY ?? '',
    ),
    ARK_API_KEY_SECONDARY:
      sanitizeSecretValue(
        readEnvOverride('ARK_API_KEY_SECONDARY')
        ?? existingSecretData.ARK_API_KEY_SECONDARY
        ?? '',
      ),
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

  console.log(
    `[staging] Injecting API key into secret/${args.secretName} in namespace ${args.k8sNamespace}`,
  )
  await runCommandWithStdin(
    'kubectl',
    kubectlArgs(args.k8sContext, ['apply', '-f', '-']),
    `${secretManifest}\n`,
  )

  console.log('[staging] Restarting backend deployment to pick up updated secret values...')
  await runCommandCapture(
    'kubectl',
    kubectlArgs(args.k8sContext, [
      'rollout',
      'restart',
      'deploy/backend',
      '-n',
      String(args.k8sNamespace),
    ]),
  )

  console.log('[staging] Waiting for backend rollout...')
  await runCommandCapture(
    'kubectl',
    kubectlArgs(args.k8sContext, [
      'rollout',
      'status',
      `deploy/${String(args.backendDeployment)}`,
      '-n',
      String(args.k8sNamespace),
      '--timeout=180s',
    ]),
  )

  const localBuildInfo = await loadLocalRuntimeBuildInfo()
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
    const unregisterBackendForwardCleanup = registerChildProcessCleanup(backendForward)
    const backendLocalPort = backendForwardResult.localPort
    if (backendForwardResult.fellBackFromRequestedPort) {
      console.warn(
        `[staging] WARN: backend local port ${args.backendLocalPort} was unavailable, using ${backendLocalPort} instead`,
      )
    }

    const baseUrl = `http://127.0.0.1:${backendLocalPort}`
    await waitForBackend(baseUrl)
    await bootstrapLocalAdmin({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      postgresLocalPort: Number(args.postgresLocalPort),
    })
    const adminToken = await loginAdmin(baseUrl)
    const runtimeFeatures = await fetchRuntimeFeatures(baseUrl, adminToken)
    validateRuntimeFeatures(runtimeFeatures, localBuildInfo)
    if (frontendBuildProfile) {
      const frontendBuildProof = await fetchFrontendBuildProof(baseUrl)
      validateLaunchImageProof(frontendBuildProof, frontendBuildProfile.profile)
      if (frontendBuildProof.frontend_capabilities?.multimodal_agent_media !== true) {
        throw new Error('Frontend build proof is missing multimodal_agent_media=true')
      }
    }
    let seedSummary = null
    if (!args.skipSeed && seedProfile) {
      seedSummary = await maybeSeedDevData(baseUrl, seedProfile, runtimeFeatures)
      if ((seedSummary?.counts?.communities ?? 0) < 1 || (seedSummary?.counts?.agents ?? 0) < 1) {
        if (seedSummary) {
          throw new Error(`Seed profile ${seedProfile} did not create usable entities`)
        }
      }
    }
    console.log(
      '[staging] Runtime fingerprint verified:',
      JSON.stringify({
        code_fingerprint: runtimeFeatures.runtime.build.code_fingerprint,
        persona_runtime: runtimeFeatures.runtime.persona_runtime,
        frontend_build_profile: frontendBuildProfile?.profile ?? null,
        seeded_profile: !args.skipSeed && seedProfile ? seedProfile : null,
        seeded_counts: seedSummary?.counts ?? null,
        local_port: backendLocalPort,
      }),
    )
    unregisterBackendForwardCleanup()
  } finally {
    await stopChildProcess(backendForward)
  }

  if (args.runSmoke) {
    await runSmokeSuite({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      labelSelector: args.backendLabel,
      deployment: args.backendDeployment,
    })
  }

  console.log('[staging] Local K8s staging rehearsal is ready.')
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[staging] FAIL: ${message}`)
  process.exit(1)
})
