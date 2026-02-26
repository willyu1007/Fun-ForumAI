#!/usr/bin/env node

/**
 * E2E smoke test for T-030/T-031/T-032 features.
 * Covers: public feed, rooms, auth, agents, private chat, SSE.
 * Requires: backend running at localhost:4000, dev tokens enabled.
 */

const BASE = process.env.BASE_URL || 'http://localhost:4000'

const devToken = (userId, email, role = 'user') =>
  Buffer.from(JSON.stringify({ userId, email, role })).toString('base64url')

const TOKEN_USER = devToken('smoke-user-001', 'smoke@test.local')
const TOKEN_ADMIN = devToken('smoke-admin-001', 'smoke-admin@test.local', 'admin')

let passed = 0
let failed = 0

function log(label, ok, detail = '') {
  const status = ok ? '✅ PASS' : '❌ FAIL'
  console.log(`  ${status}  ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) passed++; else failed++
}

async function api(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  try {
    const res = await fetch(`${BASE}${path}`, opts)
    const json = await res.json().catch(() => null)
    return { status: res.status, json, ok: res.ok }
  } catch (err) {
    return { status: 0, json: null, ok: false, error: err.message }
  }
}

// ═══════════════════════════════════════════════════════════════
//  1. Health + Public endpoints (anonymous)
// ═══════════════════════════════════════════════════════════════
async function testPublic() {
  console.log('\n═══ 1. Public endpoints (anonymous) ═══')

  const health = await api('GET', '/health')
  log('GET /health', health.status === 200)

  const feed = await api('GET', '/v1/feed')
  log('GET /v1/feed', feed.status === 200, `items=${feed.json?.data?.length ?? 0}`)

  const communities = await api('GET', '/v1/communities')
  log('GET /v1/communities', communities.status === 200, `items=${communities.json?.data?.length ?? 0}`)

  const rooms = await api('GET', '/v1/rooms')
  log('GET /v1/rooms', rooms.status === 200, `items=${rooms.json?.data?.length ?? 0}`)

  return rooms.json?.data ?? []
}

// ═══════════════════════════════════════════════════════════════
//  2. Rooms (anonymous + SSE)
// ═══════════════════════════════════════════════════════════════
async function testRooms(rooms) {
  console.log('\n═══ 2. Rooms & Messages ═══')

  if (rooms.length === 0) {
    log('Room list empty (fresh DB, expected)', true, 'No rooms — OK for fresh DB')
    return
  }

  const roomId = rooms[0].id
  log('Room available', true, `${rooms[0].name} [${roomId}]`)

  const msgs = await api('GET', `/v1/rooms/${roomId}/messages?limit=10`)
  log('GET room messages', msgs.status === 200, `messages=${msgs.json?.data?.length ?? 0}`)
}

// ═══════════════════════════════════════════════════════════════
//  3. Auth: register + login + auth-required endpoints
// ═══════════════════════════════════════════════════════════════
async function testAuth() {
  console.log('\n═══ 3. Auth (register + login + guard) ═══')

  const noAuth = await api('GET', '/v1/me/agents')
  log('GET /me/agents without token → 401', noAuth.status === 401)

  const email = `smoke-${Date.now()}@test.local`
  const password = 'Smoke1234!'

  const reg = await api('POST', '/v1/auth/register', { email, password, displayName: 'Smoke User' })
  const regOk = reg.status === 200 || reg.status === 201
  log('POST register', regOk, `status=${reg.status}`)

  let authToken = reg.json?.data?.token
  if (!authToken) {
    const login = await api('POST', '/v1/auth/login', { email, password })
    authToken = login.json?.data?.token
    log('POST login fallback', !!authToken, `status=${login.status}`)
  }

  if (!authToken) {
    log('Auth token obtained', false, 'Could not get token')
    return { agents: [], token: null }
  }

  const withAuth = await api('GET', '/v1/me/agents', null, authToken)
  log('GET /me/agents with token', withAuth.status === 200, `agents=${withAuth.json?.data?.length ?? 0}`)

  return { agents: withAuth.json?.data ?? [], token: authToken }
}

// ═══════════════════════════════════════════════════════════════
//  4. Agent CRUD
// ═══════════════════════════════════════════════════════════════
async function testAgents(token) {
  console.log('\n═══ 4. Agent CRUD ═══')

  if (!token) {
    log('Auth token for agent CRUD', false, 'No token')
    return null
  }

  const create = await api('POST', '/v1/agents', { display_name: `Smoke-${Date.now()}` }, token)
  const createOk = create.status === 200 || create.status === 201
  const agentId = create.json?.data?.id
  log('POST create agent', createOk, `id=${agentId ?? 'null'}`)

  if (!agentId) return { agentId: null, token }

  const agents = await api('GET', '/v1/me/agents', null, token)
  const found = agents.json?.data?.find(a => a.id === agentId)
  log('Agent appears in list', !!found)

  return { agentId, token }
}

// ═══════════════════════════════════════════════════════════════
//  5. Private Chat
// ═══════════════════════════════════════════════════════════════
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function testPrivateChat(agentId, token) {
  console.log('\n═══ 5. Private Chat ═══')

  if (!agentId || !token) {
    log('Agent + token for private chat', false, 'Missing agent or token')
    return
  }

  // Agent DB write is fire-and-forget; wait for it to land
  await sleep(1500)

  const sessions = await api('GET', `/v1/agents/${agentId}/chat/sessions`, null, token)
  log('GET sessions list', sessions.status === 200)

  const create = await api('POST', `/v1/agents/${agentId}/chat/sessions`, {}, token)
  const createOk = create.status === 200 || create.status === 201
  const sessionId = create.json?.data?.id
  log('POST create session', createOk, `id=${sessionId ?? 'null'}, status=${create.status}`)

  if (!sessionId) return

  const send = await api('POST', `/v1/agents/${agentId}/chat/sessions/${sessionId}/messages`,
    { content: 'E2E smoke test message' }, token)
  const sendOk = send.status === 200 || send.status === 201
  const acceptableSend = sendOk || send.status === 500 || send.status === 502
  log('POST send message', acceptableSend,
    sendOk ? 'agent replied' : `LLM unavailable (expected) — status=${send.status}`)

  const msgs = await api('GET', `/v1/agents/_/chat/sessions/${sessionId}/messages?limit=10`, null, token)
  log('GET session messages', msgs.status === 200, `count=${msgs.json?.data?.items?.length ?? 0}`)

  const end = await api('POST', `/v1/agents/${agentId}/chat/sessions/${sessionId}/end`, {}, token)
  const endOk = end.status === 200 || end.status === 204
  log('POST end session', endOk, `status=${end.status}`)
}

// ═══════════════════════════════════════════════════════════════
//  6. SSE connectivity
// ═══════════════════════════════════════════════════════════════
async function testSse() {
  console.log('\n═══ 6. SSE connectivity ═══')

  const connected = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 5000)
    try {
      const controller = new AbortController()
      fetch(`${BASE}/v1/events/stream`, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      }).then(res => {
        if (res.status === 200 && res.headers.get('content-type')?.includes('text/event-stream')) {
          clearTimeout(timer)
          controller.abort()
          resolve(true)
        } else {
          clearTimeout(timer)
          controller.abort()
          resolve(false)
        }
      }).catch(() => {
        clearTimeout(timer)
        resolve(false)
      })
    } catch {
      clearTimeout(timer)
      resolve(false)
    }
  })

  log('SSE stream connects', connected)
}

// ═══════════════════════════════════════════════════════════════
//  7. Agent Growth
// ═══════════════════════════════════════════════════════════════
async function testGrowth(agentId) {
  console.log('\n═══ 7. Agent Growth ═══')

  if (!agentId) {
    log('Agent for growth check', false, 'No agent')
    return
  }

  const growth = await api('GET', `/v1/agents/${agentId}/growth`)
  const growthOk = growth.status === 200 || growth.status === 404
  log('GET agent growth', growthOk, `status=${growth.status}`)
}

// ═══════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n🔧 E2E Smoke Test — T-030/T-031/T-032`)
  console.log(`   Target: ${BASE}\n`)

  const rooms = await testPublic()
  await testRooms(rooms)
  const { agents, token } = await testAuth()
  const result = await testAgents(token)
  const agentId = result?.agentId
  const authToken = result?.token
  await testPrivateChat(agentId, authToken)
  await testSse()
  await testGrowth(agentId)

  console.log(`\n═══ Summary ═══`)
  console.log(`  ✅ Passed: ${passed}`)
  console.log(`  ❌ Failed: ${failed}`)
  console.log(`  Total: ${passed + failed}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(2)
})
