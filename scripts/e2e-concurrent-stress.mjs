#!/usr/bin/env node
/**
 * E2E Concurrent Stress Test
 *
 * Tests multiple simultaneous:
 *   - scheduled_post (writeback + render)
 *   - private chat sessions (identity write + render)
 *   - forum comment events (render + event propagation)
 *
 * Usage: node scripts/e2e-concurrent-stress.mjs [--base-url http://localhost:4000] [--concurrency 5]
 */

const BASE_URL = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : 'http://localhost:4000'

const CONCURRENCY = process.argv.includes('--concurrency')
  ? parseInt(process.argv[process.argv.indexOf('--concurrency') + 1], 10)
  : 5

function devToken(userId, email, role = 'user') {
  return Buffer.from(JSON.stringify({ userId, email, role })).toString('base64url')
}

const ADMIN_TOKEN = devToken('admin-dev', 'admin-dev@local.test', 'admin')
const OWNER_TOKEN = devToken('dev-user-001', 'dev-user-001@dev.local', 'user')

async function api(method, path, { body, token } = {}) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const start = Date.now()
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    return { ok: res.ok, status: res.status, json, text, latencyMs: Date.now() - start }
  } catch (err) {
    return { ok: false, status: 0, json: null, text: err.message, latencyMs: Date.now() - start, error: err }
  }
}

const results = {
  runtimePosts: [],
  privateChatSessions: [],
  chatMessages: [],
  errors: [],
}

async function testRuntimePost(label) {
  const res = await api('POST', '/v1/dev/runtime/post')
  const entry = {
    label,
    ok: res.ok,
    status: res.status,
    latencyMs: res.latencyMs,
    agentId: res.json?.data?.agent_id ?? null,
    postId: res.json?.data?.post_id ?? null,
    triggered: res.json?.data?.triggered ?? false,
    error: res.json?.data?.error ?? null,
  }
  results.runtimePosts.push(entry)
  if (!res.ok) results.errors.push({ phase: 'runtime-post', label, status: res.status, text: res.text?.slice(0, 200) })
  return entry
}

async function testPrivateChat(agentId, label) {
  const sessionRes = await api('POST', `/v1/agents/${agentId}/chat/sessions`, { token: OWNER_TOKEN })
  if (!sessionRes.ok) {
    results.errors.push({ phase: 'chat-session-create', label, agentId, status: sessionRes.status, text: sessionRes.text?.slice(0, 200) })
    return null
  }
  const sessionId = sessionRes.json?.data?.id
  results.privateChatSessions.push({
    label,
    agentId,
    sessionId,
    createLatencyMs: sessionRes.latencyMs,
  })

  const msgRes = await api('POST', `/v1/agents/${agentId}/chat/sessions/${sessionId}/messages`, {
    token: OWNER_TOKEN,
    body: { content: '你好，你最近在想什么？跟我分享一下你现在最私人的想法吧。' },
  })
  const replyContent = msgRes.json?.data?.agent_reply?.content ?? ''
  const msgEntry = {
    label,
    agentId,
    sessionId,
    ok: msgRes.ok,
    status: msgRes.status,
    latencyMs: msgRes.latencyMs,
    hasReply: replyContent.length > 0,
    replyLength: replyContent.length,
  }
  results.chatMessages.push(msgEntry)
  if (!msgRes.ok) {
    results.errors.push({ phase: 'chat-message', label, agentId, sessionId, status: msgRes.status, text: msgRes.text?.slice(0, 300) })
  }

  const endRes = await api('POST', `/v1/agents/${agentId}/chat/sessions/${sessionId}/end`, { token: OWNER_TOKEN })
  if (!endRes.ok) {
    results.errors.push({ phase: 'chat-session-end', label, agentId, sessionId, status: endRes.status, text: endRes.text?.slice(0, 200) })
  }

  return msgEntry
}

async function main() {
  console.log(`\n=== E2E Concurrent Stress Test ===`)
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Concurrency: ${CONCURRENCY}`)

  const healthRes = await api('GET', '/health')
  if (!healthRes.ok) {
    console.error('Backend not healthy:', healthRes.text)
    process.exit(1)
  }
  console.log('Backend healthy.\n')

  const agentsRes = await api('GET', '/v1/me/agents', { token: OWNER_TOKEN })
  const agents = agentsRes.json?.data ?? []
  if (agents.length === 0) {
    console.error('No agents found. Run seed first.')
    process.exit(1)
  }
  const agentIds = agents.slice(0, 8).map(a => a.id)
  console.log(`Found ${agents.length} agents, using ${agentIds.length} for test.\n`)

  // Phase 1: Concurrent runtime posts (writeback + render)
  console.log(`--- Phase 1: ${CONCURRENCY} concurrent runtime posts ---`)
  const postPromises = Array.from({ length: CONCURRENCY }, (_, i) =>
    testRuntimePost(`post-${i}`)
  )
  const postResults = await Promise.allSettled(postPromises)
  const postOk = postResults.filter(r => r.status === 'fulfilled' && r.value.triggered).length
  const postFail = postResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
  const postLatencies = results.runtimePosts.map(r => r.latencyMs)
  console.log(`  Triggered: ${postOk}/${CONCURRENCY}`)
  console.log(`  Failed: ${postFail}/${CONCURRENCY}`)
  console.log(`  Latency: min=${Math.min(...postLatencies)}ms, max=${Math.max(...postLatencies)}ms, avg=${Math.round(postLatencies.reduce((a,b)=>a+b,0)/postLatencies.length)}ms`)

  // Phase 2: Concurrent private chat sessions (identity write + render)
  console.log(`\n--- Phase 2: ${Math.min(CONCURRENCY, agentIds.length)} concurrent private chat sessions ---`)
  const chatAgents = agentIds.slice(0, CONCURRENCY)
  const chatPromises = chatAgents.map((agentId, i) =>
    testPrivateChat(agentId, `chat-${i}`)
  )
  const chatResults = await Promise.allSettled(chatPromises)
  const chatOk = chatResults.filter(r => r.status === 'fulfilled' && r.value?.ok).length
  const chatFail = chatResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.ok)).length
  const chatLatencies = results.chatMessages.filter(r => r.latencyMs).map(r => r.latencyMs)
  if (chatLatencies.length > 0) {
    console.log(`  Successful replies: ${chatOk}/${chatAgents.length}`)
    console.log(`  Failed: ${chatFail}/${chatAgents.length}`)
    console.log(`  Reply latency: min=${Math.min(...chatLatencies)}ms, max=${Math.max(...chatLatencies)}ms, avg=${Math.round(chatLatencies.reduce((a,b)=>a+b,0)/chatLatencies.length)}ms`)
  }

  // Phase 3: Mixed concurrent (posts + chats simultaneously)
  console.log(`\n--- Phase 3: Mixed concurrent (${CONCURRENCY} posts + ${Math.min(3, agentIds.length)} chats) ---`)
  const mixedPromises = [
    ...Array.from({ length: CONCURRENCY }, (_, i) => testRuntimePost(`mixed-post-${i}`)),
    ...agentIds.slice(0, 3).map((agentId, i) => testPrivateChat(agentId, `mixed-chat-${i}`)),
  ]
  await Promise.allSettled(mixedPromises)

  // Summary
  console.log('\n=== Summary ===')
  console.log(`Total runtime posts: ${results.runtimePosts.length}`)
  console.log(`  Triggered: ${results.runtimePosts.filter(r => r.triggered).length}`)
  console.log(`  Unique agents: ${new Set(results.runtimePosts.filter(r => r.agentId).map(r => r.agentId)).size}`)
  console.log(`Total chat sessions: ${results.privateChatSessions.length}`)
  console.log(`Total chat messages: ${results.chatMessages.length}`)
  console.log(`  With reply: ${results.chatMessages.filter(r => r.hasReply).length}`)
  console.log(`  Avg reply length: ${Math.round(results.chatMessages.filter(r => r.replyLength > 0).reduce((a,b) => a + b.replyLength, 0) / Math.max(1, results.chatMessages.filter(r => r.replyLength > 0).length))} chars`)
  console.log(`Total errors: ${results.errors.length}`)

  if (results.errors.length > 0) {
    console.log('\n=== Errors ===')
    for (const err of results.errors) {
      console.log(`  [${err.phase}] ${err.label}: ${err.status} - ${err.text?.slice(0, 150)}`)
    }
  }

  // Check admin runtime features for final state
  const featuresRes = await api('GET', '/v1/admin/runtime/features', { token: ADMIN_TOKEN })
  const observability = featuresRes.json?.data?.observability
  if (observability) {
    const cm = observability.context_memory
    console.log('\n=== Observability Counters ===')
    console.log(`  Identity writes: success=${cm?.identity_writes?.success_total ?? 0}, failure=${cm?.identity_writes?.failure_total ?? 0}`)
    console.log(`  Typed writes: success=${cm?.typed_writes?.success_total ?? 0}, failure=${cm?.typed_writes?.failure_total ?? 0}`)
    console.log(`  Retrieval: total=${cm?.retrieval?.total ?? 0}, typed=${cm?.retrieval?.public_typed_hits ?? 0}, legacy=${cm?.retrieval?.public_legacy_hits ?? 0}`)
    console.log(`  Public ingress: forum=${cm?.public_ingress?.forum_total ?? 0}, chat_room=${cm?.public_ingress?.chat_room_total ?? 0}`)

    const renderLog = observability.render_log_preview
    if (Array.isArray(renderLog) && renderLog.length > 0) {
      console.log(`\n=== Render Log (last ${renderLog.length} entries) ===`)
      const byModel = {}
      const byIntent = {}
      for (const entry of renderLog) {
        byModel[entry.model_id] = (byModel[entry.model_id] ?? 0) + 1
        byIntent[entry.intent] = (byIntent[entry.intent] ?? 0) + 1
      }
      console.log(`  By model: ${JSON.stringify(byModel)}`)
      console.log(`  By intent: ${JSON.stringify(byIntent)}`)
    }
  }

  // Check usage ledger
  const ledgerEntries = featuresRes.json?.data?.observability?.render_log_preview ?? []
  console.log(`\n=== Usage Ledger Preview ===`)
  console.log(`  Entries in buffer: ${ledgerEntries.length}`)
  if (ledgerEntries.length > 0) {
    const totalCost = ledgerEntries.reduce((sum, e) => sum + (e.actual_cost_cny ?? e.estimated_cost_cny ?? 0), 0)
    console.log(`  Total estimated cost: ¥${totalCost.toFixed(4)}`)
  }

  const exitCode = results.errors.length > 0 ? 1 : 0
  console.log(`\nExit code: ${exitCode}`)
  process.exit(exitCode)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(2)
})
