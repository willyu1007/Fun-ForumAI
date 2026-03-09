#!/usr/bin/env node
import 'dotenv/config'

import { spawn } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_BASE = resolve(ROOT, '.ai', '.tmp', 't070')

function usage(exitCode = 0) {
  console.log(`
t070-rollout-shadow-review.mjs

Collect local-kind staging rollout evidence for T-070:
- align local kind staging
- fetch runtime feature snapshots
- seed data and run baseline persona eval
- execute controlled shadow run (scheduled_post + private_chat)
- rerun persona eval and emit blind review template + pre-review gate

Usage:
  node scripts/t070-rollout-shadow-review.mjs [options]

Options:
  --output <path>                 Output directory (default: .ai/.tmp/t070/<run-id>)
  --k8s-context <name>            Kubernetes context (default: kind-funforum)
  --k8s-namespace <name>          Namespace (default: funforum)
  --backend-label <selector>      Backend pod label selector (default: app.kubernetes.io/name=backend)
  --backend-local-port <port>     Local port for backend port-forward (default: 4100)
  --backend-port <port>           Backend container port (default: 4000)
  --postgres-service <name>       Postgres service name (default: postgres)
  --postgres-local-port <port>    Local Postgres port-forward port (default: 55432)
  --take <n>                      agent_runs scan size for t066 eval (default: 80)
  --warmup-attempts <n>           Attempts to find an owner-accessible scheduled post agent (default: 8)
  --post-retry-attempts <n>       Attempts to get a follow-up scheduled post from the same agent (default: 12)
  --chat-messages <n>             Number of private chat messages to send (default: 2)
  --skip-staging-setup            Skip scripts/k8s-local-staging.mjs
  --skip-db-migrate               Forwarded to k8s-local-staging.mjs when setup runs
  --help
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

function parseOptions(argv) {
  const raw = parseCliArgs(argv, {
    k8sContext: 'kind-funforum',
    k8sNamespace: 'funforum',
    backendLabel: 'app.kubernetes.io/name=backend',
    backendLocalPort: 4100,
    backendPort: 4000,
    postgresService: 'postgres',
    postgresLocalPort: 55432,
    take: 80,
    warmupAttempts: 8,
    postRetryAttempts: 12,
    chatMessages: 2,
    skipStagingSetup: false,
    skipDbMigrate: false,
    output: '',
  })

  if (raw.help) usage(0)

  return {
    output: raw.output ? resolve(ROOT, String(raw.output)) : '',
    k8sContext: String(raw.k8sContext),
    k8sNamespace: String(raw.k8sNamespace),
    backendLabel: String(raw.backendLabel),
    backendLocalPort: asInt(raw.backendLocalPort, 4100, '--backend-local-port'),
    backendPort: asInt(raw.backendPort, 4000, '--backend-port'),
    postgresService: String(raw.postgresService),
    postgresLocalPort: asInt(raw.postgresLocalPort, 55432, '--postgres-local-port'),
    take: asInt(raw.take, 80, '--take'),
    warmupAttempts: asInt(raw.warmupAttempts, 8, '--warmup-attempts'),
    postRetryAttempts: asInt(raw.postRetryAttempts, 12, '--post-retry-attempts'),
    chatMessages: asInt(raw.chatMessages, 2, '--chat-messages'),
    skipStagingSetup: Boolean(raw.skipStagingSetup),
    skipDbMigrate: Boolean(raw.skipDbMigrate),
  }
}

function devToken(userId, email, role = 'user') {
  return Buffer.from(JSON.stringify({ userId, email, role })).toString('base64url')
}

function databaseUrlForPort(port) {
  return `postgresql://postgres:postgres@127.0.0.1:${port}/llm_forum`
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
        rejectPromise(new Error(`kubectl port-forward exited early (${code ?? 'null'}) for svc/${serviceName}: ${output}`)),
      )
    })
  })

  return child
}

async function api(baseUrl, method, path, { body, token } = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return requestJson(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function expectOkJson(baseUrl, method, path, options, label) {
  const res = await api(baseUrl, method, path, options)
  if (!res.ok) {
    throw new Error(`${label} failed: ${res.status} ${res.text}`)
  }
  return res.json
}

async function waitForBackend(baseUrl) {
  await pollUntil(async () => {
    const res = await requestJson(`${baseUrl}/health`)
    return res.ok ? res : null
  }, { timeoutMs: 30_000, intervalMs: 1000 })
}

async function maybeSetupLocalKind(opts, shadowLog) {
  if (opts.skipStagingSetup) {
    shadowLog.steps.push({
      step: 'setup-local-kind',
      status: 'skipped',
      at: new Date().toISOString(),
      detail: 'skipStagingSetup=true',
    })
    return
  }

  const args = [
    'scripts/k8s-local-staging.mjs',
    '--k8s-context',
    opts.k8sContext,
    '--k8s-namespace',
    opts.k8sNamespace,
  ]
  if (opts.skipDbMigrate) args.push('--skip-db-migrate')

  await runCommandCapture('node', args, { env: process.env })
  shadowLog.steps.push({
    step: 'setup-local-kind',
    status: 'ok',
    at: new Date().toISOString(),
    detail: `context=${opts.k8sContext} namespace=${opts.k8sNamespace}`,
  })
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function runPersonaEval({ outputDir, take, databaseUrl }) {
  await runCommandCapture(
    'node',
    ['scripts/t066-persona-eval.mjs', '--take', String(take), '--output', outputDir],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    },
  )
}

async function fetchRuntimeFeatures(baseUrl, adminToken) {
  const payload = await expectOkJson(
    baseUrl,
    'GET',
    '/v1/admin/runtime/features',
    { token: adminToken },
    'GET /v1/admin/runtime/features',
  )
  return payload.data
}

async function fetchOwnedAgents(baseUrl, ownerToken) {
  const payload = await expectOkJson(
    baseUrl,
    'GET',
    '/v1/me/agents',
    { token: ownerToken },
    'GET /v1/me/agents',
  )
  return Array.isArray(payload.data) ? payload.data : []
}

async function fetchAgentRuns(baseUrl, agentId, ownerToken, limit = 100) {
  const payload = await expectOkJson(
    baseUrl,
    'GET',
    `/v1/agents/${agentId}/runs?limit=${limit}`,
    { token: ownerToken },
    `GET /v1/agents/${agentId}/runs`,
  )
  return {
    items: Array.isArray(payload.data) ? payload.data : [],
    meta: payload.meta ?? {},
  }
}

async function forceRuntimePost(baseUrl) {
  const res = await api(baseUrl, 'POST', '/v1/dev/runtime/post')
  if (!res.ok) {
    throw new Error(`POST /v1/dev/runtime/post failed: ${res.status} ${res.text}`)
  }
  return res.json?.data ?? {}
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isPersistedRuntimePost(result) {
  return Boolean(
    result?.triggered === true &&
    hasText(result.agent_id) &&
    hasText(result.post_id) &&
    !hasText(result.error),
  )
}

function runtimePostStepStatus(result, { ownerAgentIds, targetAgentId } = {}) {
  if (!result?.triggered) return 'noop'
  if (!isPersistedRuntimePost(result)) return 'write-failed'
  if (targetAgentId) {
    return result.agent_id === targetAgentId ? 'ok' : 'other-agent'
  }
  if (ownerAgentIds instanceof Set) {
    return ownerAgentIds.has(result.agent_id) ? 'ok' : 'other-agent'
  }
  return 'ok'
}

function parseIsoTimestamp(value) {
  if (!hasText(value)) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function runsWithinWindow(items, startedAt) {
  const startedAtMs = parseIsoTimestamp(startedAt)
  if (startedAtMs === null) return []
  return items.filter((item) => {
    const createdAtMs = parseIsoTimestamp(item?.created_at)
    return createdAtMs !== null && createdAtMs >= startedAtMs
  })
}

function countObservedRuns(items) {
  return items.filter((item) => item?.output_json?.persona_observation?.version === 'persona-observation-v1').length
}

async function seedData(baseUrl, ownerToken, shadowLog) {
  const res = await api(baseUrl, 'POST', '/v1/dev/seed')
  if (res.ok) {
    shadowLog.steps.push({
      step: 'dev-seed',
      status: 'ok',
      at: new Date().toISOString(),
    })
    return
  }

  const existingAgents = await fetchOwnedAgents(baseUrl, ownerToken)
  if (existingAgents.length > 0) {
    shadowLog.steps.push({
      step: 'dev-seed',
      status: 'warn',
      at: new Date().toISOString(),
      detail: {
        message: 'dev-seed failed, but owner agents already exist; continuing with existing fixtures.',
        http_status: res.status,
      },
    })
    return
  }

  throw new Error(`POST /v1/dev/seed failed: ${res.status} ${res.text}`)
}

async function selectTargetAgent(baseUrl, ownerAgentIds, attempts, shadowLog) {
  const ownerHits = []
  for (let i = 0; i < attempts; i++) {
    const result = await forceRuntimePost(baseUrl)
    shadowLog.steps.push({
      step: 'runtime-post-warmup',
      status: runtimePostStepStatus(result, { ownerAgentIds }),
      at: new Date().toISOString(),
      attempt: i + 1,
      detail: {
        triggered: Boolean(result.triggered),
        agent_id: result.agent_id ?? null,
        post_id: result.post_id ?? null,
        error: result.error ?? null,
      },
    })
    if (isPersistedRuntimePost(result) && ownerAgentIds.has(result.agent_id)) {
      ownerHits.push({
        agent_id: result.agent_id,
        post_id: result.post_id,
        attempt: i + 1,
      })
    }
  }

  if (ownerHits.length === 0) {
    throw new Error('Unable to obtain a persisted scheduled_post from a dev-user-owned agent during warmup.')
  }

  const ranked = Array.from(
    ownerHits.reduce((map, hit) => {
      const current = map.get(hit.agent_id) ?? { agent_id: hit.agent_id, hits: 0, last_attempt: 0 }
      current.hits += 1
      current.last_attempt = hit.attempt
      map.set(hit.agent_id, current)
      return map
    }, new Map()).values(),
  ).sort((left, right) =>
    right.hits - left.hits ||
    right.last_attempt - left.last_attempt ||
    left.agent_id.localeCompare(right.agent_id),
  )

  const selected = ranked[0]
  shadowLog.steps.push({
    step: 'target-agent-selected',
    status: 'ok',
    at: new Date().toISOString(),
    detail: {
      agent_id: selected.agent_id,
      owner_successful_public_posts: ownerHits.length,
      ranking: ranked,
    },
  })

  return selected.agent_id
}

function chatMessages(total) {
  const base = [
    '最近你在想什么？我更想听到你此刻最私人、最不适合公开场合直接说出的那一面。',
    '如果你把刚才那种感受带回公开发言，你会怎么调整语气，既保留变化又不显得突兀？',
    '再具体一点，你会主动避免哪些措辞，或者刻意保留哪些新的倾向？',
  ]
  return base.slice(0, total)
}

async function sendPrivateChatScenario(baseUrl, agentId, ownerToken, totalMessages, shadowLog) {
  const sessionPayload = await expectOkJson(
    baseUrl,
    'POST',
    `/v1/agents/${agentId}/chat/sessions`,
    { token: ownerToken },
    'POST /chat/sessions',
  )
  const sessionId = sessionPayload.data?.id
  if (!sessionId) {
    throw new Error(`Failed to create private chat session for agent ${agentId}`)
  }

  shadowLog.steps.push({
    step: 'private-chat-session',
    status: 'ok',
    at: new Date().toISOString(),
    detail: { agent_id: agentId, session_id: sessionId },
  })

  for (const [index, content] of chatMessages(totalMessages).entries()) {
    const payload = await expectOkJson(
      baseUrl,
      'POST',
      `/v1/agents/${agentId}/chat/sessions/${sessionId}/messages`,
      {
        token: ownerToken,
        body: { content },
      },
      'POST /chat/messages',
    )
    shadowLog.steps.push({
      step: 'private-chat-message',
      status: 'ok',
      at: new Date().toISOString(),
      detail: {
        agent_id: agentId,
        session_id: sessionId,
        index: index + 1,
        response_keys: payload.data ? Object.keys(payload.data) : [],
      },
    })
  }

  await expectOkJson(
    baseUrl,
    'POST',
    `/v1/agents/${agentId}/chat/sessions/${sessionId}/end`,
    { token: ownerToken },
    'POST /chat/sessions/:id/end',
  )
  shadowLog.steps.push({
    step: 'private-chat-end',
    status: 'ok',
    at: new Date().toISOString(),
    detail: { agent_id: agentId, session_id: sessionId },
  })

  return {
    session_id: sessionId,
    finished_at: new Date().toISOString(),
  }
}

async function runFollowUpPosts(baseUrl, targetAgentId, attempts, shadowLog) {
  let matched = false
  let matchedPostId = null
  for (let i = 0; i < attempts; i++) {
    const result = await forceRuntimePost(baseUrl)
    const isTarget = isPersistedRuntimePost(result) && result.agent_id === targetAgentId
    shadowLog.steps.push({
      step: 'runtime-post-followup',
      status: runtimePostStepStatus(result, { targetAgentId }),
      at: new Date().toISOString(),
      attempt: i + 1,
      detail: {
        triggered: Boolean(result.triggered),
        agent_id: result.agent_id ?? null,
        post_id: result.post_id ?? null,
        error: result.error ?? null,
      },
    })
    if (isTarget) {
      matched = true
      matchedPostId = result.post_id
      break
    }
  }
  return {
    matched,
    matched_post_id: matchedPostId,
  }
}

async function loadGateHelpers() {
  return tsImport('../src/backend/runtime/persona-rollout-gate.ts', import.meta.url)
}

async function main() {
  const opts = parseOptions(process.argv)
  const runId = `t070-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const outputDir = opts.output || join(OUT_BASE, runId)
  const baselineEvalDir = join(outputDir, 'baseline-eval')
  const finalEvalDir = join(outputDir, 'final-eval')
  const shadowLog = {
    run_id: runId,
    started_at: new Date().toISOString(),
    steps: [],
  }

  const adminToken = devToken('admin-dev', 'admin-dev@local.test', 'admin')
  const ownerToken = devToken('dev-user-001', 'dev-user-001@dev.local', 'user')
  const gateHelpers = await loadGateHelpers()
  const {
    buildPersonaBlindReviewTemplate,
    buildPersonaRolloutPreReview,
  } = gateHelpers

  let backendForward = null
  let postgresForward = null
  let baseUrl = ''
  let databaseUrl = ''
  let targetAgentId = null
  let privateChatCompletedAt = null

  await mkdir(outputDir, { recursive: true })

  try {
    await maybeSetupLocalKind(opts, shadowLog)

    const backendPods = await listRunningPods({
      context: opts.k8sContext,
      namespace: opts.k8sNamespace,
      labelSelector: opts.backendLabel,
    })
    if (backendPods.length === 0) {
      throw new Error(`No ready backend pod found for selector ${opts.backendLabel}`)
    }

    backendForward = await startPortForward({
      context: opts.k8sContext,
      namespace: opts.k8sNamespace,
      podName: backendPods[0],
      localPort: opts.backendLocalPort,
      containerPort: opts.backendPort,
    })
    postgresForward = await startServicePortForward({
      context: opts.k8sContext,
      namespace: opts.k8sNamespace,
      serviceName: opts.postgresService,
      localPort: opts.postgresLocalPort,
      servicePort: 5432,
    })

    baseUrl = `http://127.0.0.1:${opts.backendLocalPort}`
    databaseUrl = databaseUrlForPort(opts.postgresLocalPort)
    await waitForBackend(baseUrl)

    const runtimeBefore = await fetchRuntimeFeatures(baseUrl, adminToken)
    await writeJson(join(outputDir, 'runtime-features.before.json'), runtimeBefore)

    await seedData(baseUrl, ownerToken, shadowLog)
    const ownedAgents = await fetchOwnedAgents(baseUrl, ownerToken)
    if (ownedAgents.length === 0) {
      throw new Error('GET /v1/me/agents returned no owner-accessible agents after dev seed.')
    }

    const ownerAgentIds = new Set(ownedAgents.map((agent) => agent.id))

    await runPersonaEval({
      outputDir: baselineEvalDir,
      take: opts.take,
      databaseUrl,
    })

    targetAgentId = await selectTargetAgent(baseUrl, ownerAgentIds, opts.warmupAttempts, shadowLog)
    const privateChatResult = await sendPrivateChatScenario(baseUrl, targetAgentId, ownerToken, opts.chatMessages, shadowLog)
    privateChatCompletedAt = privateChatResult.finished_at
    const followUpResult = await runFollowUpPosts(baseUrl, targetAgentId, opts.postRetryAttempts, shadowLog)
    if (!followUpResult.matched) {
      shadowLog.steps.push({
        step: 'followup-post-result',
        status: 'warn',
        at: new Date().toISOString(),
        detail: {
          agent_id: targetAgentId,
          message: 'No persisted follow-up scheduled_post from the same agent within retry budget.',
        },
      })
    } else {
      shadowLog.steps.push({
        step: 'followup-post-result',
        status: 'ok',
        at: new Date().toISOString(),
        detail: {
          agent_id: targetAgentId,
          post_id: followUpResult.matched_post_id,
        },
      })
    }

    await runPersonaEval({
      outputDir: finalEvalDir,
      take: opts.take,
      databaseUrl,
    })

    const runtimeAfter = await fetchRuntimeFeatures(baseUrl, adminToken)
    await writeJson(join(outputDir, 'runtime-features.after.json'), runtimeAfter)

    const baselineManifest = await readJson(join(baselineEvalDir, 'corpus-manifest.json'))
    const baselineAttribution = await readJson(join(baselineEvalDir, 'attribution-summary.json'))
    const finalManifest = await readJson(join(finalEvalDir, 'corpus-manifest.json'))
    const finalAttribution = await readJson(join(finalEvalDir, 'attribution-summary.json'))
    const offlineGate = await readJson(join(finalEvalDir, 'gate-summary.json'))

    await copyFile(join(finalEvalDir, 'corpus-manifest.json'), join(outputDir, 'corpus-manifest.json'))
    await copyFile(join(finalEvalDir, 'blind-review-sheet.md'), join(outputDir, 'blind-review-sheet.md'))
    await copyFile(join(finalEvalDir, 'attribution-summary.json'), join(outputDir, 'attribution-summary.json'))
    await copyFile(join(finalEvalDir, 'gate-summary.json'), join(outputDir, 'gate-summary.raw.json'))

    const targetRuns = targetAgentId
      ? await fetchAgentRuns(baseUrl, targetAgentId, ownerToken, 100)
      : { items: [], meta: {} }
    const targetWindowRuns = runsWithinWindow(targetRuns.items, shadowLog.started_at)
    const targetObservedWindowRuns = countObservedRuns(targetWindowRuns)
    if (targetAgentId) {
      await writeJson(join(outputDir, 'target-agent-runs.json'), {
        agent_id: targetAgentId,
        baseline_manifest_run_id: baselineManifest.run_id,
        final_manifest_run_id: finalManifest.run_id,
        window_started_at: shadowLog.started_at,
        private_chat_completed_at: privateChatCompletedAt,
        window_items: targetWindowRuns,
        window_run_count: targetWindowRuns.length,
        window_observed_run_count: targetObservedWindowRuns,
        ...targetRuns,
      })
    } else {
      await writeJson(join(outputDir, 'target-agent-runs.json'), {
        agent_id: null,
        window_started_at: shadowLog.started_at,
        private_chat_completed_at: privateChatCompletedAt,
        window_items: [],
        window_run_count: 0,
        window_observed_run_count: 0,
        items: [],
        meta: {},
      })
    }

    const preReview = buildPersonaRolloutPreReview({
      offlineGate,
      baselineAttribution,
      currentAttribution: finalAttribution,
      manifest: finalManifest,
      shadowActivity: {
        targetAgentId,
        windowStartedAt: shadowLog.started_at,
        targetAgentRunCount: targetWindowRuns.length,
        targetAgentObservedRunCount: targetObservedWindowRuns,
      },
    })
    await writeJson(join(outputDir, 'gate-summary.pre-review.json'), preReview)

    const reviewTemplate = buildPersonaBlindReviewTemplate(finalManifest, 'collaborative')
    await writeJson(join(outputDir, 'review-results.template.json'), reviewTemplate)

    shadowLog.finished_at = new Date().toISOString()
    await writeJson(join(outputDir, 'shadow-run-log.json'), shadowLog)

    console.log(JSON.stringify({
      ok: true,
      output_dir: outputDir,
      target_agent_id: targetAgentId,
      pre_review_status: preReview.overall_status,
      recommendation: preReview.recommendation,
    }, null, 2))
  } catch (err) {
    shadowLog.finished_at = new Date().toISOString()
    shadowLog.steps.push({
      step: 'fatal',
      status: 'error',
      at: new Date().toISOString(),
      detail: err instanceof Error ? err.message : String(err),
    })
    await writeJson(join(outputDir, 'shadow-run-log.json'), shadowLog)
    throw err
  } finally {
    await stopChildProcess(backendForward)
    await stopChildProcess(postgresForward)
  }
}

main().catch((err) => {
  console.error('[t070-rollout-shadow-review] failed:', err)
  process.exit(1)
})
