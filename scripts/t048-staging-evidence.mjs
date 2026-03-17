#!/usr/bin/env node
import { createHmac, createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

function usage(exitCode = 0) {
  console.log(`
t048-staging-evidence.mjs

Collects T-048 staging evidence in one run:
- baseline vs treatment allocator benchmark (pod-local)
- public highlights noise ratio sampling
- private-chat real-call sequential/stress sampling
- runtime-post stress sampling
- token-based cost estimation and gate calculation

Usage:
  node scripts/t048-staging-evidence.mjs [options]

Options:
  --base-url <url>                     API base URL (default: http://127.0.0.1:4000)
  --k8s-context <name>                 K8S context (default: kind-funforum)
  --k8s-namespace <name>               K8S namespace (default: funforum)
  --service-auth-secret <secret>       Service auth secret for /v1/posts (optional)
  --secret-name <name>                 K8S secret name for auto-resolve (default: forum-app-secret)
  --min-agents <n>                     Minimum active agents for fixture (default: 10)
  --runtime-post-count <n>             Runtime-post sample count (default: 6)
  --private-seq-total <n>              Sequential private-chat calls (default: 8)
  --private-stress-total <n>           Stress private-chat calls (default: 24)
  --private-stress-concurrency <n>     Stress private-chat concurrency (default: 6)
  --allocator-iterations <n>           Allocator benchmark iterations in pod (default: 120)
  --allocator-window-size <n>          Top-k stability window size (default: 10)
  --agent-model <name>                 Model used when script creates fixture/owner agents (optional)
  --output <path>                      Write JSON report to file (optional)
  --help

Environment fallback:
  BASE_URL, K8S_CONTEXT, K8S_NAMESPACE, SERVICE_AUTH_SECRET

Example:
  node scripts/t048-staging-evidence.mjs \\
    --base-url http://127.0.0.1:4000 \\
    --k8s-context kind-funforum \\
    --k8s-namespace funforum \\
    --secret-name forum-app-secret \\
    --output .ai/.tmp/t048/staging-evidence.json
`)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const out = {
    baseUrl: process.env.BASE_URL || 'http://127.0.0.1:4000',
    k8sContext: process.env.K8S_CONTEXT || 'kind-funforum',
    k8sNamespace: process.env.K8S_NAMESPACE || 'funforum',
    serviceAuthSecret: process.env.SERVICE_AUTH_SECRET || '',
    secretName: 'forum-app-secret',
    minAgents: 10,
    runtimePostCount: 6,
    privateSeqTotal: 8,
    privateStressTotal: 24,
    privateStressConcurrency: 6,
    allocatorIterations: 120,
    allocatorWindowSize: 10,
    agentModel: process.env.EVIDENCE_AGENT_MODEL || '',
    output: '',
  }

  const args = argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === '--') {
      continue
    }
    if (token === '--help' || token === '-h') {
      usage(0)
    }
    if (!token.startsWith('--')) continue

    const key = token.slice(2)
    const next = args[i + 1]
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }

    if (key === 'base-url') out.baseUrl = next
    else if (key === 'k8s-context') out.k8sContext = next
    else if (key === 'k8s-namespace') out.k8sNamespace = next
    else if (key === 'service-auth-secret') out.serviceAuthSecret = next
    else if (key === 'secret-name') out.secretName = next
    else if (key === 'min-agents') out.minAgents = Number(next)
    else if (key === 'runtime-post-count') out.runtimePostCount = Number(next)
    else if (key === 'private-seq-total') out.privateSeqTotal = Number(next)
    else if (key === 'private-stress-total') out.privateStressTotal = Number(next)
    else if (key === 'private-stress-concurrency') out.privateStressConcurrency = Number(next)
    else if (key === 'allocator-iterations') out.allocatorIterations = Number(next)
    else if (key === 'allocator-window-size') out.allocatorWindowSize = Number(next)
    else if (key === 'agent-model') out.agentModel = next
    else if (key === 'output') out.output = next
    else throw new Error(`Unknown option: --${key}`)

    i++
  }

  if (!Number.isFinite(out.minAgents) || out.minAgents < 2) {
    throw new Error('--min-agents must be >= 2')
  }
  if (!Number.isFinite(out.runtimePostCount) || out.runtimePostCount < 1) {
    throw new Error('--runtime-post-count must be >= 1')
  }
  if (!Number.isFinite(out.privateSeqTotal) || out.privateSeqTotal < 1) {
    throw new Error('--private-seq-total must be >= 1')
  }
  if (!Number.isFinite(out.privateStressTotal) || out.privateStressTotal < 1) {
    throw new Error('--private-stress-total must be >= 1')
  }
  if (!Number.isFinite(out.privateStressConcurrency) || out.privateStressConcurrency < 1) {
    throw new Error('--private-stress-concurrency must be >= 1')
  }
  if (!Number.isFinite(out.allocatorIterations) || out.allocatorIterations < 20) {
    throw new Error('--allocator-iterations must be >= 20')
  }
  if (!Number.isFinite(out.allocatorWindowSize) || out.allocatorWindowSize < 2) {
    throw new Error('--allocator-window-size must be >= 2')
  }

  return out
}

const PRICE_CNY_PER_1M = {
  'qwen-plus': { input: 2.936, output: 8.807 },
  'qwen3-plus': { input: 2.936, output: 8.807 },
  'qwen-flash': { input: 0.15, output: 1.5 },
  'qwen3-flash': { input: 0.15, output: 1.5 },
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf-8',
    ...opts,
  })
  if (res.status !== 0) {
    const stderr = (res.stderr || '').trim()
    const stdout = (res.stdout || '').trim()
    throw new Error(`${cmd} ${args.join(' ')} failed: ${stderr || stdout || `exit ${res.status}`}`)
  }
  return (res.stdout || '').trim()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestJson(baseUrl, method, path, { body, token, headers = {}, retries = 5 } = {}) {
  const h = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...headers,
  }
  if (token) h.Authorization = `Bearer ${token}`

  let lastErr = null
  for (let i = 0; i < retries; i++) {
    try {
      const started = Date.now()
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: h,
        body: body ? JSON.stringify(body) : undefined,
      })
      const elapsedMs = Date.now() - started
      const text = await res.text()
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }
      return { status: res.status, ok: res.ok, json, text, elapsedMs }
    } catch (err) {
      lastErr = err
      await sleep(500)
    }
  }
  throw lastErr
}

function createServiceToken(serviceAuthSecret, bodyRaw) {
  const identity = 'agent-runtime'
  const timestamp = Date.now().toString()
  const nonce = randomUUID()
  const bodyHash = createHash('sha256').update(bodyRaw || '').digest('hex')
  const payload = `${identity}:${timestamp}:${nonce}:${bodyHash}`
  const signature = createHmac('sha256', serviceAuthSecret).update(payload).digest('hex')
  return `${identity}:${timestamp}:${nonce}:${signature}`
}

async function apiService(baseUrl, serviceAuthSecret, method, path, body) {
  const bodyRaw = JSON.stringify(body || {})
  const token = createServiceToken(serviceAuthSecret, bodyRaw)
  return requestJson(baseUrl, method, path, {
    body,
    headers: { 'x-service-token': token },
  })
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function cnyEstimate(model, tokensIn, tokensOut) {
  const key = String(model || '').toLowerCase()
  const rate = PRICE_CNY_PER_1M[key]
  if (!rate) return null
  return (tokensIn / 1_000_000) * rate.input + (tokensOut / 1_000_000) * rate.output
}

function adminDevToken() {
  return Buffer.from(JSON.stringify({ userId: 'admin-dev', email: 'admin-dev@local.test', role: 'admin' })).toString('base64url')
}

async function runtimeFeatures(baseUrl) {
  const res = await requestJson(baseUrl, 'GET', '/v1/admin/runtime/features', { token: adminDevToken() })
  if (!res.ok) throw new Error(`runtime features failed: ${res.status} ${res.text}`)
  return res.json?.data
}

async function detectRuntimeModel(baseUrl) {
  try {
    const features = await runtimeFeatures(baseUrl)
    const model = String(
      features?.runtime?.bootstrap_llm_model ?? features?.runtime?.llm_model ?? '',
    ).trim()
    return model
  } catch {
    return ''
  }
}

function backendPod(k8sContext, k8sNamespace) {
  return run('kubectl', [
    '--context',
    k8sContext,
    '-n',
    k8sNamespace,
    'get',
    'pods',
    '-l',
    'app.kubernetes.io/name=backend',
    '-o',
    'jsonpath={.items[0].metadata.name}',
  ])
}

function getServiceAuthSecretFromK8s(k8sContext, k8sNamespace, secretName) {
  const raw = run('kubectl', [
    '--context',
    k8sContext,
    '-n',
    k8sNamespace,
    'get',
    'secret',
    secretName,
    '-o',
    'json',
  ])

  const payload = JSON.parse(raw)
  const encoded = payload?.data?.SERVICE_AUTH_SECRET
  if (typeof encoded !== 'string' || !encoded.trim()) {
    return ''
  }
  return Buffer.from(encoded, 'base64').toString('utf-8')
}

function resolveServiceAuthSecret(args) {
  if (args.serviceAuthSecret && args.serviceAuthSecret.trim()) {
    return { value: args.serviceAuthSecret, source: 'cli_or_env' }
  }

  try {
    const fromSecret = getServiceAuthSecretFromK8s(args.k8sContext, args.k8sNamespace, args.secretName)
    if (fromSecret && fromSecret.trim()) {
      return { value: fromSecret, source: `k8s_secret:${args.secretName}` }
    }
  } catch {
    // ignore and fall through
  }

  const fallback = 'local-dev-service-auth-secret'
  return { value: fallback, source: 'fallback_default' }
}

function runPodScript({ k8sContext, k8sNamespace, scriptName, scriptBody, env = {} }) {
  const pod = backendPod(k8sContext, k8sNamespace)
  const envPrefix = Object.entries(env)
    .map(([k, v]) => `${k}=${JSON.stringify(String(v))}`)
    .join(' ')

  const cmd = `cat >/tmp/${scriptName}.mts <<'EOS'\n${scriptBody}\nEOS\ncd /app && ${envPrefix ? `${envPrefix} ` : ''}tsx /tmp/${scriptName}.mts`

  return run('kubectl', ['--context', k8sContext, '-n', k8sNamespace, 'exec', pod, '--', 'sh', '-lc', cmd])
}

function parseMarker(stdout, marker = '__RESULT__') {
  const line = stdout
    .split('\n')
    .map((x) => x.trim())
    .find((x) => x.startsWith(marker))
  if (!line) {
    throw new Error(`marker ${marker} not found in output: ${stdout}`)
  }
  return JSON.parse(line.slice(marker.length))
}

function allocatorBenchInPod({
  label,
  k8sContext,
  k8sNamespace,
  env,
  iterations = 120,
  windowSize = 10,
}) {
  const script = `
import { performance } from 'node:perf_hooks'
import { allocator, agentRepo, communityRepo, pprRefreshScheduler, warmPersistenceState } from '/app/src/backend/container.ts'
import { runtimeFeatureMetrics } from '/app/src/backend/runtime/runtime-feature-metrics.ts'

function pct(values, p) {
  if (!values.length) return 0
  const s = [...values].sort((a,b)=>a-b)
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))
  return s[idx]
}
function avg(values) {
  return values.length ? values.reduce((a,b)=>a+b,0) / values.length : 0
}
function jaccard(a, b) {
  const union = new Set([...a, ...b])
  if (union.size === 0) return 1
  let inter = 0
  for (const v of a) if (b.has(v)) inter++
  return inter / union.size
}
function topKFromSelections(chunk, k = 5) {
  const count = new Map()
  for (const sel of chunk) {
    for (const id of sel) {
      count.set(id, (count.get(id) || 0) + 1)
    }
  }
  const ranked = [...count.entries()].sort((a,b)=> (b[1]-a[1]) || a[0].localeCompare(b[0]))
  return new Set(ranked.slice(0, k).map((x)=>x[0]))
}

await warmPersistenceState()
const general = communityRepo.findBySlug('general') || communityRepo.findAll({ limit: 20 }).items[0]
const agents = agentRepo.findActive({ limit: 100 }).items
const author = agents[0]

if (!general || !author || agents.length < 2) {
  console.log('__RESULT__' + JSON.stringify({ label: ${JSON.stringify(label)}, error: 'insufficient_data', agents: agents.length, hasCommunity: Boolean(general) }))
  process.exit(0)
}

if (pprRefreshScheduler) {
  try {
    await pprRefreshScheduler.runBackfillOnce()
    await pprRefreshScheduler.runRefresh('bench')
  } catch {}
}

const before = runtimeFeatureMetrics.snapshot()
const latencies = []
const selections = []
const iterations = ${Math.max(20, Math.trunc(iterations))}
const windowSize = ${Math.max(2, Math.trunc(windowSize))}
const tagSets = [
  ['哲学', 'AI', '伦理'],
  ['技术', '架构', '性能'],
  ['创意', '写作', '诗歌'],
  ['社会', '辩论', '观点'],
]

for (let i = 0; i < iterations; i++) {
  const tags = tagSets[i % tagSets.length]
  const event = {
    event_id: 'bench-' + ${JSON.stringify(label)} + '-' + i + '-' + Date.now(),
    idempotency_key: 'bench-' + ${JSON.stringify(label)} + '-' + i + '-' + Date.now() + '-' + Math.random(),
    event_type: 'NewPostCreated',
    chain_depth: 0,
    community_id: general.id,
    author_agent_id: author.id,
    post_id: 'thread-' + Math.floor(i / 3),
    tags,
    created_at: new Date().toISOString(),
  }
  const t0 = performance.now()
  const out = allocator.allocate(event)
  latencies.push(performance.now() - t0)
  selections.push((out.agents || []).map((a) => a.agent_id))
}

const windows = []
for (let i = 0; i + windowSize <= selections.length; i += windowSize) {
  windows.push(topKFromSelections(selections.slice(i, i + windowSize), 5))
}
const jaccards = []
for (let i = 0; i + 1 < windows.length; i++) {
  jaccards.push(jaccard(windows[i], windows[i + 1]))
}

const after = runtimeFeatureMetrics.snapshot()
console.log('__RESULT__' + JSON.stringify({
  label: ${JSON.stringify(label)},
  agents_total: agents.length,
  iterations,
  latency_ms: {
    p50: pct(latencies, 50),
    p95: pct(latencies, 95),
    p99: pct(latencies, 99),
    mean: avg(latencies),
  },
  topk_stability: {
    windows: windows.length,
    avg_jaccard: avg(jaccards),
    min_jaccard: jaccards.length ? Math.min(...jaccards) : 1,
    max_jaccard: jaccards.length ? Math.max(...jaccards) : 1,
  },
  counters_delta: {
    allocator: {
      ppr_hits: after.allocator.ppr_hits - before.allocator.ppr_hits,
      ppr_misses: after.allocator.ppr_misses - before.allocator.ppr_misses,
    },
    director: {
      selected_core: after.director.selected_core - before.director.selected_core,
      selected_contrast: after.director.selected_contrast - before.director.selected_contrast,
      selected_wildcard: after.director.selected_wildcard - before.director.selected_wildcard,
      guard_rejections: after.director.guard_rejections - before.director.guard_rejections,
    },
  },
}))
process.exit(0)
`

  const stdout = runPodScript({ k8sContext, k8sNamespace, scriptName: `alloc-bench-${label}`, scriptBody: script, env })
  return parseMarker(stdout)
}

function noiseMeasureInPod({ label, authorAgentId, k8sContext, k8sNamespace, env }) {
  const script = `
import { achievementChronicleService, warmPersistenceState } from '/app/src/backend/container.ts'

await warmPersistenceState()
const highlights = await achievementChronicleService.getPublicHighlights(${JSON.stringify(authorAgentId)})
const top = Array.isArray(highlights.top_chronicle) ? highlights.top_chronicle : []
const noisy = top.filter((entry) => {
  const summary = String(entry?.summary ?? '')
  const kind = String(entry?.entry_kind ?? '')
  return /signal|信号/i.test(summary) || kind.startsWith('signal:')
}).length
const total = top.length
console.log('__RESULT__' + JSON.stringify({
  label: ${JSON.stringify(label)},
  total,
  noisy,
  noise_ratio: total > 0 ? noisy / total : 0,
  top,
}))
process.exit(0)
`

  const stdout = runPodScript({ k8sContext, k8sNamespace, scriptName: `noise-${label}`, scriptBody: script, env })
  return parseMarker(stdout)
}

function devToken(userId, email, role = 'user') {
  return Buffer.from(JSON.stringify({ userId, email, role })).toString('base64url')
}

async function createAgentWithToken(baseUrl, token, displayName, model) {
  const payload = { display_name: displayName }
  if (model) payload.model = model
  const res = await requestJson(baseUrl, 'POST', '/v1/agents', {
    token,
    body: payload,
  })
  if (!res.ok || !res.json?.data?.id) {
    throw new Error(`create fixture agent failed: ${res.status} ${res.text}`)
  }
  return res.json.data.id
}

function getDbFixtureInPod({ k8sContext, k8sNamespace }) {
  const script = `
import { agentRepo, communityRepo, warmPersistenceState } from '/app/src/backend/container.ts'
await warmPersistenceState()
const communities = communityRepo.findAll({ limit: 50 }).items
const agents = agentRepo.findActive({ limit: 200 }).items
const general = communities.find((c) => c.slug === 'general') || communities[0] || null
console.log('__RESULT__' + JSON.stringify({
  community_count: communities.length,
  agent_count: agents.length,
  general,
  agent_ids: agents.map((a) => a.id),
}))
process.exit(0)
`
  const stdout = runPodScript({ k8sContext, k8sNamespace, scriptName: 'db-fixture', scriptBody: script })
  return parseMarker(stdout)
}

async function ensureDbFixture({ baseUrl, k8sContext, k8sNamespace, minAgents, agentModel }) {
  const fixtureToken = devToken('fixture-owner', 'fixture-owner@test.local')
  for (let round = 0; round < 20; round++) {
    const db = getDbFixtureInPod({ k8sContext, k8sNamespace })
    if (db.general && db.agent_count >= minAgents) {
      return db
    }

    const missing = Math.max(0, minAgents - Number(db.agent_count || 0))
    const batch = Math.min(3, Math.max(1, missing))
    for (let i = 0; i < batch; i++) {
      await createAgentWithToken(
        baseUrl,
        fixtureToken,
        `fixture-agent-${Date.now()}-${round}-${i}`,
        agentModel,
      )
    }
    await sleep(600)
  }
  throw new Error('failed to prepare DB fixture agents')
}

async function generateSignalEvents({ baseUrl, serviceAuthSecret, authorId, voterIds, communityId, label }) {
  const post = await apiService(baseUrl, serviceAuthSecret, 'POST', '/v1/posts', {
    actor_agent_id: authorId,
    run_id: `signal-${label}-${Date.now()}`,
    community_id: communityId,
    title: `[${label}] signal pressure`,
    body: 'signal noise measurement',
    tags: ['signal', 'benchmark', label],
  })

  const postId = post.json?.data?.id
  if (!post.ok || !postId) {
    throw new Error(`signal post create failed: ${post.status} ${post.text}`)
  }

  for (let i = 0; i < voterIds.length; i++) {
    const direction = i % 2 === 0 ? 'UP' : 'DOWN'
    await apiService(baseUrl, serviceAuthSecret, 'POST', '/v1/votes', {
      voter_agent_id: voterIds[i],
      target_type: 'POST',
      target_id: postId,
      direction,
    })
  }

  await sleep(1200)
  return { post_id: postId, votes: voterIds.length }
}

async function registerAndCreateAgent(baseUrl, prefix, model) {
  const ts = Date.now()
  const email = `${prefix}-${ts}@test.local`
  const password = 'StageRealCall!2026'
  let token = null

  const reg = await requestJson(baseUrl, 'POST', '/v1/auth/register', {
    body: { email, password, displayName: prefix },
  })
  token = reg.json?.data?.token || null

  if (!token) {
    const login = await requestJson(baseUrl, 'POST', '/v1/auth/login', {
      body: { email, password },
    })
    token = login.json?.data?.token || null
  }

  if (!token) throw new Error('failed to obtain user token')

  const payload = { display_name: `${prefix}-agent-${ts}` }
  if (model) payload.model = model

  const create = await requestJson(baseUrl, 'POST', '/v1/agents', {
    token,
    body: payload,
  })
  if (!create.ok || !create.json?.data?.id) {
    throw new Error(`failed to create agent: ${create.status} ${create.text}`)
  }

  return { token, agentId: create.json.data.id, email }
}

async function createPrivateSession(baseUrl, token, agentId) {
  let last = null
  for (let i = 0; i < 12; i++) {
    const res = await requestJson(baseUrl, 'POST', `/v1/agents/${agentId}/chat/sessions`, { token })
    if (res.ok && res.json?.data?.id) {
      return res.json.data.id
    }
    last = res
    await sleep(500)
  }
  throw new Error(`create session failed after retries: ${last?.status} ${last?.text}`)
}

async function sendPrivateMessage(baseUrl, token, agentId, sessionId, content) {
  let last = null
  for (let i = 0; i < 4; i++) {
    const res = await requestJson(baseUrl, 'POST', `/v1/agents/${agentId}/chat/sessions/${sessionId}/messages`, {
      token,
      body: { content },
    })
    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        elapsed_ms: res.elapsedMs,
        token_cost: Number(res.json?.data?.token_cost || 0),
        error: null,
      }
    }
    last = res
    await sleep(250)
  }
  return {
    ok: false,
    status: last?.status ?? 0,
    elapsed_ms: last?.elapsedMs ?? 0,
    token_cost: 0,
    error: last?.text ?? 'send message failed',
  }
}

async function runPrivateChatLoad({ baseUrl, token, agentId, sessionId, total, concurrency, prefix }) {
  const started = Date.now()
  const results = []
  let next = 0

  async function worker() {
    while (true) {
      const idx = next++
      if (idx >= total) break
      const msg = `${prefix} #${idx} :: ${new Date().toISOString()}`
      const out = await sendPrivateMessage(baseUrl, token, agentId, sessionId, msg)
      results.push(out)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const ok = results.filter((r) => r.ok)
  const latencies = ok.map((r) => r.elapsed_ms)
  const tokenCosts = ok.map((r) => r.token_cost)

  return {
    total,
    concurrency,
    elapsed_ms: Date.now() - started,
    success: ok.length,
    failed: results.length - ok.length,
    success_rate: results.length > 0 ? ok.length / results.length : 0,
    latency_ms: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      mean: mean(latencies),
    },
    token_cost_total: tokenCosts.reduce((a, b) => a + b, 0),
    token_cost_mean: mean(tokenCosts),
    sample_errors: results.filter((r) => !r.ok).slice(0, 5).map((r) => r.error),
  }
}

async function runRuntimePostSamples({ baseUrl, count }) {
  const samples = []
  for (let i = 0; i < count; i++) {
    const res = await requestJson(baseUrl, 'POST', '/v1/dev/runtime/post')
    samples.push({
      ok: res.ok,
      status: res.status,
      elapsed_ms: res.elapsedMs,
      triggered: Boolean(res.json?.data?.triggered),
      usage: res.json?.data?.usage || null,
      latency_ms: Number(res.json?.data?.latency_ms || 0),
      post_id: res.json?.data?.post_id || null,
      error: res.ok ? null : (res.text || 'runtime post failed'),
    })
    await sleep(400)
  }

  const ok = samples.filter((s) => s.ok)
  const usageIn = ok.reduce((sum, s) => sum + Number(s.usage?.prompt_tokens || 0), 0)
  const usageOut = ok.reduce((sum, s) => sum + Number(s.usage?.completion_tokens || 0), 0)

  return {
    total: count,
    success: ok.length,
    failed: count - ok.length,
    triggered: ok.filter((s) => s.triggered).length,
    usage_prompt_tokens: usageIn,
    usage_completion_tokens: usageOut,
    usage_total_tokens: usageIn + usageOut,
    latency_ms: {
      p50: percentile(ok.map((s) => s.elapsed_ms), 50),
      p95: percentile(ok.map((s) => s.elapsed_ms), 95),
      p99: percentile(ok.map((s) => s.elapsed_ms), 99),
      mean: mean(ok.map((s) => s.elapsed_ms)),
    },
    sample_errors: samples.filter((s) => !s.ok).slice(0, 5).map((s) => s.error),
    samples,
  }
}

async function getCostReview(baseUrl, agentId) {
  const res = await requestJson(baseUrl, 'GET', `/v1/agents/${agentId}/cost-review?days=1`)
  if (!res.ok) return null
  return res.json?.data || null
}

function stableNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

async function maybeWriteOutput(outputPath, payload) {
  if (!outputPath) return
  const absolute = resolve(process.cwd(), outputPath)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

async function main() {
  const args = parseArgs(process.argv)
  const serviceAuth = resolveServiceAuthSecret(args)

  const out = {
    started_at: new Date().toISOString(),
    base_url: args.baseUrl,
    k8s: { context: args.k8sContext, namespace: args.k8sNamespace },
    service_auth_secret_source: serviceAuth.source,
    pricing_assumption_cny_per_1m: PRICE_CNY_PER_1M,
  }

  const health = await requestJson(args.baseUrl, 'GET', '/health')
  if (!health.ok) throw new Error(`health failed: ${health.status}`)

  const runtimeModelHint = String(args.agentModel || (await detectRuntimeModel(args.baseUrl)) || '').trim()
  const agentModel = runtimeModelHint || 'qwen-plus'
  out.agent_model_for_new_agents = agentModel

  const fixture = await ensureDbFixture({
    baseUrl: args.baseUrl,
    k8sContext: args.k8sContext,
    k8sNamespace: args.k8sNamespace,
    minAgents: args.minAgents,
    agentModel,
  })

  if (!fixture.general || !Array.isArray(fixture.agent_ids) || fixture.agent_ids.length < 5) {
    throw new Error('insufficient DB fixture data (need general + >=5 agents)')
  }

  const author = { id: fixture.agent_ids[0] }
  const voterIds = fixture.agent_ids.slice(1, 5)

  out.seed_fixture = {
    community_id: fixture.general.id,
    agent_count: fixture.agent_count,
    author_agent_id: author.id,
    voter_agent_ids: voterIds,
  }

  out.signal_events = await generateSignalEvents({
    baseUrl: args.baseUrl,
    serviceAuthSecret: serviceAuth.value,
    authorId: author.id,
    voterIds,
    communityId: fixture.general.id,
    label: 'live',
  })

  const baselineEnv = {
    FF_ALLOCATOR_PPR_ENABLED: 'false',
    FF_CASTING_DIRECTOR_ENABLED: 'false',
    FF_CASTING_DIRECTOR_V2: 'false',
    FF_SIGNAL_LOG_V1: 'false',
    FF_RUNTIME_FEATURES_V1: 'true',
  }
  const treatmentEnv = {
    FF_ALLOCATOR_PPR_ENABLED: 'true',
    FF_CASTING_DIRECTOR_ENABLED: 'false',
    FF_CASTING_DIRECTOR_V2: 'false',
    FF_SIGNAL_LOG_V1: 'true',
    FF_RUNTIME_FEATURES_V1: 'true',
    FF_PPR_REFRESH_V2: 'true',
  }

  out.baseline = {
    allocator_bench: allocatorBenchInPod({
      label: 'baseline',
      k8sContext: args.k8sContext,
      k8sNamespace: args.k8sNamespace,
      env: baselineEnv,
      iterations: args.allocatorIterations,
      windowSize: args.allocatorWindowSize,
    }),
    signal_noise: noiseMeasureInPod({
      label: 'baseline',
      authorAgentId: author.id,
      k8sContext: args.k8sContext,
      k8sNamespace: args.k8sNamespace,
      env: baselineEnv,
    }),
  }

  out.treatment = {
    runtime_features_before: await runtimeFeatures(args.baseUrl),
    allocator_bench: allocatorBenchInPod({
      label: 'treatment',
      k8sContext: args.k8sContext,
      k8sNamespace: args.k8sNamespace,
      env: treatmentEnv,
      iterations: args.allocatorIterations,
      windowSize: args.allocatorWindowSize,
    }),
    signal_noise: noiseMeasureInPod({
      label: 'treatment',
      authorAgentId: author.id,
      k8sContext: args.k8sContext,
      k8sNamespace: args.k8sNamespace,
      env: treatmentEnv,
    }),
  }

  const owner = await registerAndCreateAgent(args.baseUrl, 't048-realcall', agentModel)
  const sessionId = await createPrivateSession(args.baseUrl, owner.token, owner.agentId)

  const sequential = await runPrivateChatLoad({
    baseUrl: args.baseUrl,
    token: owner.token,
    agentId: owner.agentId,
    sessionId,
    total: args.privateSeqTotal,
    concurrency: 1,
    prefix: 'sequential',
  })

  const stress = await runPrivateChatLoad({
    baseUrl: args.baseUrl,
    token: owner.token,
    agentId: owner.agentId,
    sessionId,
    total: args.privateStressTotal,
    concurrency: args.privateStressConcurrency,
    prefix: 'stress',
  })

  const runtimePosts = await runRuntimePostSamples({
    baseUrl: args.baseUrl,
    count: args.runtimePostCount,
  })

  const costReview = await getCostReview(args.baseUrl, owner.agentId)
  const featuresAfter = await runtimeFeatures(args.baseUrl)

  const model = String(
    featuresAfter?.runtime?.bootstrap_llm_model ?? featuresAfter?.runtime?.llm_model ?? 'unknown',
  )
  const privateIn = stableNumber(costReview?.by_action_type?.private_chat?.tokens_in)
  const privateOut = stableNumber(costReview?.by_action_type?.private_chat?.tokens_out)
  const privateCny = cnyEstimate(model, privateIn, privateOut)
  const scheduledCny = cnyEstimate(
    model,
    stableNumber(runtimePosts.usage_prompt_tokens),
    stableNumber(runtimePosts.usage_completion_tokens),
  )

  out.treatment.real_calls = {
    owner_agent_id: owner.agentId,
    session_id: sessionId,
    model,
    sequential,
    stress,
    runtime_posts: runtimePosts,
    cost_review: costReview,
    estimated_cost_cny: {
      private_chat: privateCny,
      scheduled_post: scheduledCny,
      total: (privateCny ?? 0) + (scheduledCny ?? 0),
    },
    runtime_features_after: featuresAfter,
  }

  const bJac = stableNumber(out.baseline.allocator_bench?.topk_stability?.avg_jaccard)
  const tJac = stableNumber(out.treatment.allocator_bench?.topk_stability?.avg_jaccard)
  const bNoise = stableNumber(out.baseline.signal_noise?.noise_ratio)
  const tNoise = stableNumber(out.treatment.signal_noise?.noise_ratio)
  const bP95 = stableNumber(out.baseline.allocator_bench?.latency_ms?.p95)
  const tP95 = stableNumber(out.treatment.allocator_bench?.latency_ms?.p95)

  const topkUpliftPct = bJac > 0 ? ((tJac - bJac) / bJac) * 100 : null
  const noiseReductionPct = bNoise > 0 ? ((bNoise - tNoise) / bNoise) * 100 : null
  const topkDelta = tJac - bJac
  const allocatorExtraP95 = tP95 - bP95

  const topkGateMode = bJac <= 0
    ? 'absolute_floor_when_baseline_zero'
    : (bJac >= 0.75 ? 'saturation_non_regression' : 'relative_uplift')
  const topkGate = bJac <= 0
    ? tJac >= 0.25
    : (bJac >= 0.75 ? topkDelta >= -0.02 : (topkUpliftPct ?? -Infinity) >= 25)

  const noiseGateMode = bNoise > 0 ? 'relative_reduction' : 'baseline_zero_non_regression'
  const noiseGate = bNoise > 0
    ? (noiseReductionPct ?? -Infinity) >= 40
    : tNoise <= 0

  out.thresholds = {
    topk_uplift_pct: topkUpliftPct,
    topk_delta: topkDelta,
    topk_gate_mode: topkGateMode,
    noise_reduction_pct: noiseReductionPct,
    noise_gate_mode: noiseGateMode,
    allocator_extra_p95_ms: allocatorExtraP95,
    gates: {
      topk_uplift_ge_25: topkGate,
      noise_reduction_ge_40: noiseGate,
      allocator_extra_p95_le_20: allocatorExtraP95 <= 20,
    },
  }

  out.finished_at = new Date().toISOString()

  await maybeWriteOutput(args.output, out)
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[t048-staging-evidence] FAIL:', message)
  process.exit(1)
})
