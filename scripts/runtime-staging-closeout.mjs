#!/usr/bin/env node

function usage(exitCode = 0) {
  console.log(`
runtime-staging-closeout.mjs

Usage:
  node scripts/runtime-staging-closeout.mjs \\
    --base-url <url> \\
    [--admin-token <token> | --admin-email <email> --admin-password <password>] \\
    [--dev-auth --dev-user-id <id> --dev-email <email>] \\
    [--agent-id <id>] [--human-user-id <id>] \\
    [--poll-ms <ms>] [--timeout-ms <ms>] \\
    [--stale-minutes <minutes>] [--message-count <count>] \\
    [--allow-env-pins] [--allow-debug-signals]

Environment fallbacks:
  RUNTIME_CLOSEOUT_BASE_URL or LAUNCH_WEB_BASE_URL or LAUNCH_WORKER_BASE_URL
  RUNTIME_CLOSEOUT_ADMIN_TOKEN or LAUNCH_ADMIN_TOKEN
`)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const out = {
    baseUrl: process.env.RUNTIME_CLOSEOUT_BASE_URL
      || process.env.LAUNCH_WEB_BASE_URL
      || process.env.LAUNCH_WORKER_BASE_URL
      || '',
    adminToken: process.env.RUNTIME_CLOSEOUT_ADMIN_TOKEN || process.env.LAUNCH_ADMIN_TOKEN || '',
    pollMs: 10_000,
    // Hidden-worker closeout depends on the 5-minute private-session timeout scheduler
    // plus the downstream digest/identity render chain, so keep the default window
    // comfortably above one scheduler tick.
    timeoutMs: 15 * 60_000,
    staleMinutes: 35,
    messageCount: 4,
    devAuth: false,
    devUserId: 'admin-dev',
    devEmail: 'admin-dev@local.test',
    allowEnvPins: false,
    allowDebugSignals: false,
  }

  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === '--help' || token === '-h') usage(0)
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    if (['dev-auth', 'allow-env-pins', 'allow-debug-signals'].includes(key)) {
      out[toCamel(key)] = true
      continue
    }
    const next = args[i + 1]
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    out[toCamel(key)] = next
    i++
  }

  if (!out.baseUrl) {
    throw new Error('--base-url is required (or set RUNTIME_CLOSEOUT_BASE_URL / LAUNCH_WEB_BASE_URL / LAUNCH_WORKER_BASE_URL)')
  }

  out.pollMs = Number(out.pollMs)
  out.timeoutMs = Number(out.timeoutMs)
  out.staleMinutes = Number(out.staleMinutes)
  out.messageCount = Number(out.messageCount)
  return out
}

function toCamel(input) {
  return input.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())
}

function normalizeUrl(url) {
  return String(url).replace(/\/+$/, '')
}

function parseJsonOrNull(text) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  const json = parseJsonOrNull(text)
  return {
    status: response.status,
    ok: response.ok,
    text,
    json,
  }
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

function createDevAdminToken(userId, email) {
  const payload = {
    userId,
    email,
    role: 'admin',
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function assertCondition(condition, message, details) {
  if (condition) return
  const suffix = details ? ` ${JSON.stringify(details)}` : ''
  throw new Error(`${message}${suffix}`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hasExecutionPlanEvidence(entry) {
  return Boolean(
    entry
    && entry.policy_id
    && entry.adapter_id
    && entry.credential_id
    && entry.provider_id
    && entry.model_id
    && Array.isArray(entry.route_order)
    && Array.isArray(entry.ordered_candidates)
    && entry.merge_trace,
  )
}

async function fetchAdminJson(baseUrl, adminToken, path) {
  const response = await requestJson(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}: ${response.text}`)
  }
  return response.json?.data
}

async function postAdminJson(baseUrl, adminToken, path, body) {
  const response = await requestJson(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}: ${response.text}`)
  }
  return response.json?.data
}

async function postAdminJsonDetailed(baseUrl, adminToken, path, body) {
  return requestJson(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function triggerVisibleCloseout(baseUrl, adminToken, body) {
  const privateReply = await postAdminJsonDetailed(
    baseUrl,
    adminToken,
    '/v1/admin/runtime/closeout/visible/private-reply',
    body,
  )
  if (privateReply.ok) {
    return privateReply.json?.data
  }

  console.warn(
    `[runtime-closeout] visible private-reply unavailable (${privateReply.status}); falling back to proactive opening`,
  )

  const proactiveOpening = await postAdminJsonDetailed(
    baseUrl,
    adminToken,
    '/v1/admin/runtime/closeout/visible/proactive-opening',
    body,
  )
  if (!proactiveOpening.ok) {
    throw new Error(
      `Visible closeout failed: private-reply (${privateReply.status}) ${privateReply.text}; `
      + `proactive-opening (${proactiveOpening.status}) ${proactiveOpening.text}`,
    )
  }
  return proactiveOpening.json?.data
}

async function main() {
  const args = parseArgs(process.argv)
  const baseUrl = normalizeUrl(args.baseUrl)
  const adminToken = args.adminToken
    || (args.devAuth
      ? createDevAdminToken(args.devUserId, args.devEmail)
      : await loginAdmin(baseUrl, args.adminEmail, args.adminPassword))

  console.log(`[runtime-closeout] checking health at ${baseUrl}`)
  const health = await requestJson(`${baseUrl}/health`)
  assertCondition(health.ok, 'Health check failed', { status: health.status, body: health.text })

  const runtimeStats = await fetchAdminJson(baseUrl, adminToken, '/v1/admin/runtime/stats')
  const runtimeFeatures = await fetchAdminJson(baseUrl, adminToken, '/v1/admin/runtime/features')
  const authorityState = runtimeFeatures?.observability?.authority_state ?? runtimeStats?.runtime?.authority_state

  assertCondition(runtimeStats?.runtime?.routing_mode === 'policy_driven', 'Runtime stats routing_mode must be policy_driven', runtimeStats?.runtime)
  assertCondition(runtimeFeatures?.runtime?.routing_mode === 'policy_driven', 'Runtime features routing_mode must be policy_driven', runtimeFeatures?.runtime)
  assertCondition(
    args.allowEnvPins || !authorityState?.env_pins_present,
    'Runtime env pins are present',
    authorityState,
  )
  assertCondition(
    args.allowDebugSignals || !authorityState?.debug_signals_present,
    'Runtime debug signals are present',
    authorityState,
  )

  console.log('[runtime-closeout] triggering visible proof')
  const visible = await triggerVisibleCloseout(baseUrl, adminToken, {
    ...(args.agentId ? { agent_id: args.agentId } : {}),
    ...(args.humanUserId ? { human_user_id: args.humanUserId } : {}),
    ...(!args.agentId
      ? {
          allow_agent_fanout: true,
          max_agent_attempts: 5,
        }
      : {}),
  })
  assertCondition(Array.isArray(visible?.ledger_entries) && visible.ledger_entries.length > 0, 'Visible closeout produced no ledger entries', visible)
  assertCondition(
    visible.ledger_entries.some(hasExecutionPlanEvidence),
    'Visible closeout ledger entry is missing execution-plan evidence',
    visible.ledger_entries,
  )

  console.log('[runtime-closeout] creating hidden worker-backed stale fixture')
  const hiddenFixtureAgentId = args.agentId || visible?.agent_id || ''
  const hiddenFixtureHumanUserId = args.humanUserId || visible?.human_user_id || ''
  const fixture = await postAdminJson(
    baseUrl,
    adminToken,
    '/v1/admin/runtime/closeout/hidden-worker/private-session-fixture',
    {
      ...(hiddenFixtureAgentId ? { agent_id: hiddenFixtureAgentId } : {}),
      ...(hiddenFixtureHumanUserId ? { human_user_id: hiddenFixtureHumanUserId } : {}),
      stale_minutes: args.staleMinutes,
      message_count: args.messageCount,
    },
  )

  const startedAt = Date.now()
  let fixtureState = null
  while (Date.now() - startedAt < args.timeoutMs) {
    fixtureState = await fetchAdminJson(
      baseUrl,
      adminToken,
      `/v1/admin/runtime/closeout/hidden-worker/private-session-fixture/${fixture.session_id}`,
    )

    const extractEntries = fixtureState?.ledger?.extract ?? []
    const distillEntries = fixtureState?.ledger?.distill ?? []
    const identityEntries = fixtureState?.ledger?.identity ?? []
    const completed = fixtureState?.digest_status === 'COMPLETED'

    if (completed && extractEntries.length > 0 && distillEntries.length > 0 && identityEntries.length > 0) {
      assertCondition(
        identityEntries.some((entry) => entry.policy_id?.startsWith('identity_write-')),
        'Identity ledger entries did not retain identity_write policy attribution',
        identityEntries,
      )
      assertCondition(
        identityEntries.some(hasExecutionPlanEvidence),
        'Identity ledger entries are missing execution-plan evidence',
        identityEntries,
      )
      break
    }

    await sleep(args.pollMs)
  }

  assertCondition(fixtureState, 'Hidden worker fixture state was never observed')
  assertCondition(fixtureState?.digest_status === 'COMPLETED', 'Hidden worker fixture did not complete before timeout', fixtureState)
  assertCondition((fixtureState?.ledger?.extract ?? []).length > 0, 'No hidden extract ledger evidence found', fixtureState)
  assertCondition((fixtureState?.ledger?.distill ?? []).length > 0, 'No hidden distill ledger evidence found', fixtureState)
  assertCondition((fixtureState?.ledger?.identity ?? []).length > 0, 'No identity ledger evidence found', fixtureState)

  console.log(JSON.stringify({
    ok: true,
    checked_at: new Date().toISOString(),
    health_status: health.status,
    routing_mode: runtimeFeatures?.runtime?.routing_mode,
    authority_state: authorityState,
    visible: {
      mode: visible.mode,
      session_id: visible.session_id,
      trace_id: visible.trace_id,
      ledger_entries: visible.ledger_entries.length,
    },
    hidden_worker: {
      session_id: fixture.session_id,
      digest_status: fixtureState.digest_status,
      extract_entries: fixtureState.ledger.extract.length,
      distill_entries: fixtureState.ledger.distill.length,
      identity_entries: fixtureState.ledger.identity.length,
    },
  }, null, 2))
}

main().catch((err) => {
  console.error(`[runtime-closeout] ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
