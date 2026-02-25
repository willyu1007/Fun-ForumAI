#!/usr/bin/env node
import crypto from 'node:crypto'

function usage(exitCode = 0) {
  console.log(`
runtime-staging-smoke.mjs

Usage:
  node scripts/runtime-staging-smoke.mjs \\
    --node1-url <url> \\
    --node2-url <url> \\
    [--admin-token <token> | --admin-email <email> --admin-password <password>] \\
    [--sample-duration-ms <ms>] \\
    [--poll-ms <ms>] \\
    [--inject-posts] \\
    [--service-auth-secret <secret>] \\
    [--community-id <id>] \\
    [--actor-agent-id <id>] \\
    [--event-count <n>] \\
    [--wait-drain-ms <ms>] \\
    [--expect-backend <redis|any>] \\
    [--allow-runtime-stopped] \\
    [--dry-run]

Examples:
  node scripts/runtime-staging-smoke.mjs \\
    --node1-url http://127.0.0.1:4101 \\
    --node2-url http://127.0.0.1:4102 \\
    --admin-token <token> \\
    --sample-duration-ms 90000 \\
    --poll-ms 3000

  node scripts/runtime-staging-smoke.mjs \\
    --node1-url http://127.0.0.1:4101 \\
    --node2-url http://127.0.0.1:4102 \\
    --admin-token <token> \\
    --inject-posts \\
    --service-auth-secret <secret> \\
    --community-id <community-id> \\
    --actor-agent-id <agent-id> \\
    --event-count 8 \\
    --wait-drain-ms 120000
`)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const out = {
    sampleDurationMs: 60_000,
    pollMs: 3_000,
    eventCount: 6,
    waitDrainMs: 120_000,
    expectBackend: 'redis',
    allowRuntimeStopped: false,
    injectPosts: false,
    dryRun: false,
  }

  for (let i = 0; i < args.length; i++) {
    const t = args[i]
    if (t === '--help' || t === '-h') usage(0)
    if (!t.startsWith('--')) continue

    const key = t.slice(2)
    const next = args[i + 1]
    const isFlag = ['inject-posts', 'allow-runtime-stopped', 'dry-run'].includes(key)
    if (isFlag) {
      out[toCamel(key)] = true
      continue
    }
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    out[toCamel(key)] = next
    i++
  }

  out.sampleDurationMs = Number(out.sampleDurationMs)
  out.pollMs = Number(out.pollMs)
  out.eventCount = Number(out.eventCount)
  out.waitDrainMs = Number(out.waitDrainMs)

  return out
}

function toCamel(kebab) {
  return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function ensureTrailingSlashTrimmed(url) {
  return String(url).replace(/\/+$/, '')
}

async function requestJson(url, opts = {}) {
  const res = await fetch(url, opts)
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: res.status, ok: res.ok, json, text }
}

function createServiceToken(identity, bodyRaw, secret) {
  const timestamp = Date.now().toString()
  const nonce = crypto.randomUUID()
  const bodyHash = crypto.createHash('sha256').update(bodyRaw || '').digest('hex')
  const payload = `${identity}:${timestamp}:${nonce}:${bodyHash}`
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${identity}:${timestamp}:${nonce}:${signature}`
}

async function loginAdmin(baseUrl, email, password) {
  const login = await requestJson(`${baseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!login.ok || !login.json?.data?.token) {
    throw new Error(`Failed to login admin (${login.status}): ${login.text}`)
  }
  return login.json.data.token
}

async function getRuntimeStats(baseUrl, adminToken) {
  const resp = await requestJson(`${baseUrl}/v1/admin/runtime/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  if (!resp.ok) {
    throw new Error(`Runtime stats failed (${resp.status}) on ${baseUrl}: ${resp.text}`)
  }
  return resp.json?.data
}

async function createRuntimeEventViaPost(baseUrl, serviceAuthSecret, communityId, actorAgentId, seq) {
  const body = {
    actor_agent_id: actorAgentId,
    run_id: `runtime-smoke-${Date.now()}-${seq}`,
    community_id: communityId,
    title: `[runtime-smoke-${seq}] queue check`,
    body: `runtime queue smoke event ${seq}`,
    tags: ['runtime-smoke', 't023'],
  }
  const bodyRaw = JSON.stringify(body)
  const serviceToken = createServiceToken('agent-runtime', bodyRaw, serviceAuthSecret)
  return requestJson(`${baseUrl}/v1/posts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-service-token': serviceToken,
    },
    body: bodyRaw,
  })
}

function formatStatsLine(label, stats) {
  const rt = stats.runtime
  return `${label}: queue=${stats.event_queue?.size} isLeader=${rt?.is_leader} running=${rt?.running} backend=${rt?.queue_backend}/${rt?.leader_backend}`
}

function evaluateLeaderSamples(samples) {
  const dualLeader = samples.filter((s) => s.n1Leader && s.n2Leader).length
  const singleLeader = samples.filter((s) => Number(Boolean(s.n1Leader)) + Number(Boolean(s.n2Leader)) === 1).length
  return { dualLeader, singleLeader }
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.node1Url || !args.node2Url) {
    throw new Error('Both --node1-url and --node2-url are required')
  }
  if (!Number.isFinite(args.sampleDurationMs) || args.sampleDurationMs <= 0) {
    throw new Error('--sample-duration-ms must be > 0')
  }
  if (!Number.isFinite(args.pollMs) || args.pollMs < 500) {
    throw new Error('--poll-ms must be >= 500')
  }

  const node1 = ensureTrailingSlashTrimmed(args.node1Url)
  const node2 = ensureTrailingSlashTrimmed(args.node2Url)
  const serviceAuthSecret = args.serviceAuthSecret || process.env.SERVICE_AUTH_SECRET || ''

  let adminToken = args.adminToken || ''
  if (!adminToken) {
    if (!args.adminEmail || !args.adminPassword) {
      throw new Error('Provide --admin-token, or --admin-email + --admin-password')
    }
    adminToken = await loginAdmin(node1, args.adminEmail, args.adminPassword)
  }

  const plan = {
    node1,
    node2,
    sampleDurationMs: args.sampleDurationMs,
    pollMs: args.pollMs,
    injectPosts: Boolean(args.injectPosts),
    eventCount: args.eventCount,
    waitDrainMs: args.waitDrainMs,
    expectBackend: args.expectBackend,
  }
  console.log('[runtime-smoke] Plan:', JSON.stringify(plan, null, 2))

  if (args.dryRun) {
    console.log('[runtime-smoke] Dry run complete')
    return
  }

  const baseline1 = await getRuntimeStats(node1, adminToken)
  const baseline2 = await getRuntimeStats(node2, adminToken)
  console.log('[runtime-smoke] Baseline')
  console.log('  ' + formatStatsLine('node1', baseline1))
  console.log('  ' + formatStatsLine('node2', baseline2))

  if (args.expectBackend === 'redis') {
    const n1 = baseline1.runtime
    const n2 = baseline2.runtime
    const backendMismatch = !(
      n1?.queue_backend === 'redis' &&
      n1?.leader_backend === 'redis' &&
      n2?.queue_backend === 'redis' &&
      n2?.leader_backend === 'redis'
    )
    if (backendMismatch) {
      throw new Error('Backend mismatch: expected redis/redis on both nodes')
    }
  }

  if (!args.allowRuntimeStopped) {
    if (!baseline1.runtime?.running && !baseline2.runtime?.running) {
      throw new Error('Runtime is stopped on both nodes. Set --allow-runtime-stopped to bypass.')
    }
  }

  if (args.injectPosts) {
    if (!serviceAuthSecret || !args.communityId || !args.actorAgentId) {
      throw new Error('--inject-posts requires --service-auth-secret (or SERVICE_AUTH_SECRET), --community-id, and --actor-agent-id')
    }
    console.log(`[runtime-smoke] Injecting ${args.eventCount} post events via node1`)
    for (let i = 0; i < args.eventCount; i++) {
      const created = await createRuntimeEventViaPost(
        node1,
        serviceAuthSecret,
        args.communityId,
        args.actorAgentId,
        i + 1,
      )
      if (!created.ok) {
        throw new Error(`Event injection failed at #${i + 1} (${created.status}): ${created.text}`)
      }
    }
  }

  const samples = []
  const sampleEndAt = Date.now() + args.sampleDurationMs
  while (Date.now() < sampleEndAt) {
    const [s1, s2] = await Promise.all([
      getRuntimeStats(node1, adminToken),
      getRuntimeStats(node2, adminToken),
    ])
    samples.push({
      ts: new Date().toISOString(),
      n1Leader: Boolean(s1.runtime?.is_leader),
      n2Leader: Boolean(s2.runtime?.is_leader),
      n1Queue: Number(s1.event_queue?.size ?? 0),
      n2Queue: Number(s2.event_queue?.size ?? 0),
    })
    await sleep(args.pollMs)
  }

  const leaderEval = evaluateLeaderSamples(samples)
  if (leaderEval.dualLeader > 0) {
    throw new Error(`Dual-leader detected in ${leaderEval.dualLeader} sample(s)`)
  }
  if (leaderEval.singleLeader === 0) {
    throw new Error('No single-leader sample observed; cannot confirm leader election')
  }

  let queueDrained = true
  if (args.injectPosts) {
    const baselineMaxQueue = Math.max(
      Number(baseline1.event_queue?.size ?? 0),
      Number(baseline2.event_queue?.size ?? 0),
    )

    console.log('[runtime-smoke] Waiting for queue drain after injection...')
    const drainEndAt = Date.now() + args.waitDrainMs
    queueDrained = false
    while (Date.now() < drainEndAt) {
      const [s1, s2] = await Promise.all([
        getRuntimeStats(node1, adminToken),
        getRuntimeStats(node2, adminToken),
      ])
      const nowMaxQueue = Math.max(
        Number(s1.event_queue?.size ?? 0),
        Number(s2.event_queue?.size ?? 0),
      )
      if (nowMaxQueue <= baselineMaxQueue) {
        queueDrained = true
        break
      }
      await sleep(args.pollMs)
    }
    if (!queueDrained) {
      throw new Error('Queue did not drain back to baseline within wait window')
    }
  }

  const final1 = await getRuntimeStats(node1, adminToken)
  const final2 = await getRuntimeStats(node2, adminToken)

  const summary = {
    sampleCount: samples.length,
    dualLeaderSamples: leaderEval.dualLeader,
    singleLeaderSamples: leaderEval.singleLeader,
    queueDrained,
    final: {
      node1: {
        queue: final1.event_queue?.size,
        isLeader: final1.runtime?.is_leader,
        running: final1.runtime?.running,
      },
      node2: {
        queue: final2.event_queue?.size,
        isLeader: final2.runtime?.is_leader,
        running: final2.runtime?.running,
      },
    },
  }

  console.log('[runtime-smoke] PASS')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[runtime-smoke] FAIL:', message)
  process.exit(1)
})

