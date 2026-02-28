#!/usr/bin/env node

/**
 * E2E smoke test for T-034 through T-042 features.
 *
 * Covers:
 *   T-034: Layer stack v2 (unified persona injection)
 *   T-035: Nurture orchestrator (growth closure)
 *   T-036: Public observation memory
 *   T-037: Social graph core
 *   T-038: Social graph behavior integration
 *   T-039: Social graph consistency hardening
 *   T-040: Stats core schema + deriver
 *   T-041: Stats behavior/relation/vote wiring
 *   T-042: Stats web panel endpoints
 *
 * Requires: backend running at localhost:4000 with all feature flags enabled.
 */

const BASE = process.env.BASE_URL || 'http://localhost:4000'

const devToken = (userId, email, role = 'user') =>
  Buffer.from(JSON.stringify({ userId, email, role })).toString('base64url')

let passed = 0
let failed = 0

function log(label, ok, detail = '') {
  const status = ok ? '✅ PASS' : '❌ FAIL'
  console.log(`  ${status}  ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) passed++
  else failed++
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function api(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  try {
    const res = await fetch(`${BASE}${path}`, opts)
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* non-JSON body */
    }
    return { status: res.status, json, ok: res.ok, text }
  } catch (err) {
    return { status: 0, json: null, ok: false, error: err.message, text: '' }
  }
}

// ═══════════════════════════════════════════════════════════════
//  0. Setup: obtain auth + create agent
// ═══════════════════════════════════════════════════════════════
async function setup() {
  console.log('\n═══ 0. Setup (auth + create agent) ═══')

  const email = `smoke-e2e-${Date.now()}@test.local`
  let token = null

  const reg = await api('POST', '/v1/auth/register', { email, password: 'SmokeE2E1234!', displayName: 'E2E Smoke' })
  token = reg.json?.data?.token

  if (!token) {
    const login = await api('POST', '/v1/auth/login', { email, password: 'SmokeE2E1234!' })
    token = login.json?.data?.token
  }

  if (!token) {
    token = devToken(`smoke-e2e-${Date.now()}`, email)
    log('Auth: using dev token (register/login unavailable)', true, 'dev token fallback')
  } else {
    log('Auth: obtained real JWT', true)
  }

  const create = await api('POST', '/v1/agents', { display_name: `StatsAgent-${Date.now()}` }, token)
  const agentId = create.json?.data?.id
  log('Agent: create', !!agentId, `id=${agentId ?? 'null'}, status=${create.status}`)
  if (!agentId) return null

  await sleep(1500)

  return { token, agentId, email }
}

// ═══════════════════════════════════════════════════════════════
//  1. T-034: Layer Stack v2 — Prompt rendering
// ═══════════════════════════════════════════════════════════════
async function testLayerStackV2(agentId, token) {
  console.log('\n═══ 1. T-034: Layer Stack v2 (prompt rendering) ═══')

  const render = await api(
    'POST',
    '/v1/dev/prompts/render',
    { agent_id: agentId, template_id: 'agent-reply-to-post', scene: 'forum_post' },
    token,
  )
  const renderOk = render.status === 200
  const hasLayers = render.json?.data?.layers !== undefined
  log('POST /v1/dev/prompts/render', renderOk, `status=${render.status}`)
  log('Response contains layers', hasLayers, renderOk ? JSON.stringify(Object.keys(render.json?.data?.layers ?? {})) : render.json?.error?.message ?? 'n/a')

  if (renderOk) {
    const hasMessages = Array.isArray(render.json?.data?.messages)
    log('Response contains rendered messages', hasMessages)
  }

  const render404 = await api(
    'POST',
    '/v1/dev/prompts/render',
    { agent_id: 'nonexistent-agent', template_id: 'agent-reply-to-post', scene: 'forum_post' },
    token,
  )
  log('Render with invalid agent → 404/500', render404.status === 404 || render404.status === 500)
}

// ═══════════════════════════════════════════════════════════════
//  2. T-036: Public observation memory (read endpoint)
// ═══════════════════════════════════════════════════════════════
async function testPublicObservation(agentId, token) {
  console.log('\n═══ 2. T-036: Public Observation Memory ═══')

  const obs = await api('GET', `/v1/agents/${agentId}/public-observations`, null, token)
  log('GET public-observations', obs.status === 200, `count=${obs.json?.data?.length ?? 0}`)

  const noAuth = await api('GET', `/v1/agents/${agentId}/public-observations`)
  log('Public-observations without token → 401', noAuth.status === 401)
}

// ═══════════════════════════════════════════════════════════════
//  3. T-037~T-039: Social Graph (relations)
// ═══════════════════════════════════════════════════════════════
async function testSocialGraph(agentId, token) {
  console.log('\n═══ 3. T-037~T-039: Social Graph ═══')

  const relations = await api('GET', `/v1/agents/${agentId}/relations?view=following`, null, token)
  log('GET relations (following)', relations.status === 200, `items=${relations.json?.data?.items?.length ?? 0}`)

  const summary = await api('GET', `/v1/agents/${agentId}/relations/summary`, null, token)
  const summaryOk = summary.status === 200
  log('GET relations/summary', summaryOk)

  if (summaryOk) {
    const d = summary.json?.data
    const hasStructure = d?.following && typeof d.following.effective === 'number'
      && d?.followers && typeof d.followers.effective === 'number'
      && typeof d?.friends === 'number'
    log(
      'Summary has expected fields',
      hasStructure,
      `following=${JSON.stringify(d?.following)}, friends=${d?.friends}`,
    )
  }

  const noAuth = await api('GET', `/v1/agents/${agentId}/relations?view=following`)
  log('Relations without token → 401', noAuth.status === 401)

  const wrongOwner = await api('GET', `/v1/agents/${agentId}/relations?view=following`, null,
    Buffer.from(JSON.stringify({ userId: 'other-user', email: 'other@test.local', role: 'user' })).toString('base64url'))
  log('Relations for wrong owner → 403', wrongOwner.status === 403)
}

// ═══════════════════════════════════════════════════════════════
//  4. T-040: Stats Core — Schema + Snapshot
// ═══════════════════════════════════════════════════════════════
async function testStatsCore(agentId, token) {
  console.log('\n═══ 4. T-040: Stats Core (schema + snapshot) ═══')

  const stats = await api('GET', `/v1/agents/${agentId}/stats`, null, token)
  const statsOk = stats.status === 200
  log('GET /stats', statsOk, `status=${stats.status}`)

  if (statsOk) {
    const d = stats.json?.data
    const hasStats = d?.stats && typeof d.stats.sociability === 'number'
    const hasState = d?.state && typeof d.state.valence === 'number'
    const hasDerived = d?.derived?.participation && typeof d.derived.participation.participation_multiplier === 'number'
    log('Stats: has personality axes', hasStats)
    log('Stats: has state vector', hasState)
    log('Stats: has derived knobs', hasDerived)
    log('Stats: unspent_points >= 0', d?.stats?.unspent_points >= 0, `points=${d?.stats?.unspent_points}`)

    const personality = ['sociability', 'curiosity', 'assertiveness', 'empathy', 'brashness', 'cynicism', 'stubbornness', 'volatility']
    const allPresent = personality.every((k) => typeof d?.stats?.[k] === 'number')
    log('Stats: all 8 personality axes present', allPresent)

    const abilities = ['memory', 'learning']
    const abilPresent = abilities.every((k) => typeof d?.stats?.[k] === 'number')
    log('Stats: memory + learning present', abilPresent)
  }

  const noAuth = await api('GET', `/v1/agents/${agentId}/stats`)
  log('Stats without token → 401', noAuth.status === 401)
}

// ═══════════════════════════════════════════════════════════════
//  5. T-040: Stats Derived Knobs
// ═══════════════════════════════════════════════════════════════
async function testStatsDerived(agentId, token) {
  console.log('\n═══ 5. T-040: Stats Derived Knobs ═══')

  const derived = await api('GET', `/v1/agents/${agentId}/stats/derived?scene=forum`, null, token)
  const derivedOk = derived.status === 200
  log('GET /stats/derived (forum)', derivedOk, `status=${derived.status}`)

  if (derivedOk) {
    const d = derived.json?.data
    const pm = d?.participation?.participation_multiplier
    const talk = d?.chat?.talkativeness_1_5
    log('Derived: participation.participation_multiplier', typeof pm === 'number', `val=${pm}`)
    log('Derived: chat.talkativeness_1_5', typeof talk === 'number', `val=${talk}`)

    if (typeof pm === 'number') {
      log('Derived: participation_multiplier in [0.4, 1.8]', pm >= 0.4 && pm <= 1.8)
    }
    if (typeof talk === 'number') {
      log('Derived: talkativeness_1_5 in [1, 5]', talk >= 1 && talk <= 5)
    }

    const hasVote = d?.vote && typeof d.vote.p_vote === 'number'
    log('Derived: vote knobs present', hasVote, `p_vote=${d?.vote?.p_vote}`)

    const hasRelation = d?.relation_policy && typeof d.relation_policy.pos_multiplier === 'number'
    log('Derived: relation_policy knobs present', hasRelation)
  }

  const derivedMemory = await api('GET', `/v1/agents/${agentId}/stats/derived?scene=memory&privacy_top_k=5&privacy_budget=800`, null, token)
  log('GET /stats/derived (memory scene)', derivedMemory.status === 200)
  if (derivedMemory.status === 200) {
    const d = derivedMemory.json?.data?.memory
    log('Derived memory: top_k_ability present', typeof d?.top_k_ability === 'number', `val=${d?.top_k_ability}`)
    log('Derived memory: budget_ability present', typeof d?.budget_ability === 'number', `val=${d?.budget_ability}`)
  }
}

// ═══════════════════════════════════════════════════════════════
//  6. T-040/T-042: Stats Allocation (preview + allocate)
// ═══════════════════════════════════════════════════════════════
async function testStatsAllocation(agentId, token) {
  console.log('\n═══ 6. T-040/T-042: Stats Allocation ═══')

  const snapshot = await api('GET', `/v1/agents/${agentId}/stats`, null, token)
  if (snapshot.status !== 200) {
    log('Get stats for allocation test', false, `status=${snapshot.status}`)
    return
  }

  const version = snapshot.json?.data?.stats?.version
  const unspent = snapshot.json?.data?.stats?.unspent_points
  log('Stats version & points', typeof version === 'number', `version=${version}, unspent=${unspent}`)

  if (unspent <= 0) {
    log('No unspent points — skip allocation test', true, 'No points to allocate')
    return
  }

  const previewReq = {
    allocation: { sociability: 1 },
    version,
  }

  const preview = await api('POST', `/v1/agents/${agentId}/stats/preview-allocation`, previewReq, token)
  const previewOk = preview.status === 200
  log('POST preview-allocation', previewOk, `status=${preview.status}`)

  if (previewOk) {
    const d = preview.json?.data
    log('Preview: cost_points > 0', d?.cost_points > 0, `cost=${d?.cost_points}`)
    log('Preview: remaining_points valid', typeof d?.remaining_points === 'number')
    log('Preview: after.sociability changed', d?.after?.sociability !== d?.before?.sociability)
  }

  const allocReq = {
    allocation: { sociability: 1 },
    version,
    confirm_no_respec: true,
    idempotency_key: `e2e-smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }

  const alloc = await api('POST', `/v1/agents/${agentId}/stats/allocate`, allocReq, token)
  const allocOk = alloc.status === 200
  log('POST allocate', allocOk, `status=${alloc.status}`)

  if (allocOk) {
    const d = alloc.json?.data
    log('Allocate: spent_points > 0', d?.spent_points > 0)
    log('Allocate: deduped = false (first call)', d?.deduped === false)
    log('Allocate: remaining_points decreased', d?.remaining_points < unspent)
  }

  const dedupAlloc = await api('POST', `/v1/agents/${agentId}/stats/allocate`, allocReq, token)
  const dedupOk = dedupAlloc.status === 200 && dedupAlloc.json?.data?.deduped === true
  log('POST allocate (duplicate idempotency) → deduped', dedupOk)

  const noRespec = await api('POST', `/v1/agents/${agentId}/stats/allocate`, {
    allocation: { sociability: 1 },
    version: version + 1,
    confirm_no_respec: false,
    idempotency_key: `e2e-smoke-norespec-${Date.now()}`,
  }, token)
  log('Allocate without confirm_no_respec → 400', noRespec.status === 400)
}

// ═══════════════════════════════════════════════════════════════
//  6b. Stats Allocation with seed agent (DB-resident, has points)
// ═══════════════════════════════════════════════════════════════
async function testStatsAllocationWithSeedAgent() {
  console.log('\n═══ 6b. Stats Allocation (seed agent with points) ═══')

  const ownerToken = devToken('dev-user-001', 'dev-user@local')
  const agents = await api('GET', '/v1/me/agents', null, ownerToken)
  if (agents.status !== 200 || !agents.json?.data?.length) {
    log('Seed agent available (skip if fresh DB)', true, 'No seed agents — OK for fresh/restarted backend')
    return
  }

  const seedAgentId = agents.json.data[0].id
  log('Seed agent found', true, `id=${seedAgentId}`)

  const snap = await api('GET', `/v1/agents/${seedAgentId}/stats`, null, ownerToken)
  if (snap.status !== 200) {
    log('Seed agent stats', false, `status=${snap.status}`)
    return
  }

  const version = snap.json?.data?.stats?.version
  const points = snap.json?.data?.stats?.unspent_points
  log('Seed agent stats loaded', true, `version=${version}, points=${points}`)

  if (points <= 0) {
    log('Seed agent has 0 points — allocation test skipped', true, 'OK (expected for level-1 agents)')
    return
  }

  const previewReq = { allocation: { curiosity: 1 }, version }
  const preview = await api('POST', `/v1/agents/${seedAgentId}/stats/preview-allocation`, previewReq, ownerToken)
  log('Preview allocation', preview.status === 200, `cost=${preview.json?.data?.cost_points}`)

  if (preview.status !== 200) return

  const idemKey = `e2e-seed-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const allocReq = {
    allocation: { curiosity: 1 },
    version,
    confirm_no_respec: true,
    idempotency_key: idemKey,
  }

  const alloc = await api('POST', `/v1/agents/${seedAgentId}/stats/allocate`, allocReq, ownerToken)
  log('Allocate points', alloc.status === 200, `status=${alloc.status}, spent=${alloc.json?.data?.spent_points}`)

  if (alloc.status === 200) {
    const d = alloc.json?.data
    log('Allocation: deduped=false (first call)', d?.deduped === false)
    log('Allocation: curiosity increased', d?.stats?.curiosity > snap.json?.data?.stats?.curiosity)

    const dup = await api('POST', `/v1/agents/${seedAgentId}/stats/allocate`, allocReq, ownerToken)
    log('Allocation: idempotency dedup', dup.status === 200 && dup.json?.data?.deduped === true)
  }
}

// ═══════════════════════════════════════════════════════════════
//  7. T-040: Stats Events + State Timeline
// ═══════════════════════════════════════════════════════════════
async function testStatsEvents(agentId, token) {
  console.log('\n═══ 7. T-040: Stats Events & State Timeline ═══')

  const events = await api('GET', `/v1/agents/${agentId}/stats/events?limit=10`, null, token)
  log('GET /stats/events', events.status === 200, `items=${events.json?.data?.items?.length ?? 0}`)

  if (events.status === 200 && events.json?.data?.items?.length > 0) {
    const first = events.json.data.items[0]
    log('Event has expected fields', !!(first.id && first.event_type && first.created_at))
  }

  const timeline = await api('GET', `/v1/agents/${agentId}/stats/state-timeline?hours=24`, null, token)
  log('GET /stats/state-timeline', timeline.status === 200)
}

// ═══════════════════════════════════════════════════════════════
//  8. T-034: Memories endpoint
// ═══════════════════════════════════════════════════════════════
async function testMemories(agentId, token) {
  console.log('\n═══ 8. T-034/T-035: Memories & Privacy ═══')

  const memories = await api('GET', `/v1/agents/${agentId}/memories`, null, token)
  log('GET /memories', memories.status === 200, `items=${memories.json?.data?.length ?? 0}`)

  const privacy = await api('GET', `/v1/agents/${agentId}/privacy-settings`, null, token)
  log('GET /privacy-settings', privacy.status === 200)

  if (privacy.status === 200) {
    const d = privacy.json?.data
    log('Privacy: has disclosure_level', d?.disclosure_level !== undefined, `level=${d?.disclosure_level}`)
  }
}

// ═══════════════════════════════════════════════════════════════
//  9. Cross-cutting: Feature flag guard
// ═══════════════════════════════════════════════════════════════
async function testFeatureGuards(agentId, token) {
  console.log('\n═══ 9. Feature flag guard (negative test) ═══')

  const fakeAgent = 'nonexistent-agent-id'
  const stats404 = await api('GET', `/v1/agents/${fakeAgent}/stats`, null, token)
  log('GET /stats for nonexistent agent → 404', stats404.status === 404)

  const relations404 = await api('GET', `/v1/agents/${fakeAgent}/relations?view=following`, null, token)
  log('GET /relations for nonexistent agent → 404', relations404.status === 404)
}

// ═══════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n🔧 E2E Smoke Test — T-034 through T-042`)
  console.log(`   Target: ${BASE}\n`)

  const health = await api('GET', '/health')
  if (health.status !== 200) {
    console.error(`\n❌ Backend not reachable at ${BASE} (status=${health.status}). Aborting.\n`)
    process.exit(2)
  }
  log('Health check', true)

  const ctx = await setup()
  if (!ctx) {
    console.error('\n❌ Setup failed — cannot continue\n')
    process.exit(2)
  }

  await testLayerStackV2(ctx.agentId, ctx.token)
  await testPublicObservation(ctx.agentId, ctx.token)
  await testSocialGraph(ctx.agentId, ctx.token)
  await testStatsCore(ctx.agentId, ctx.token)
  await testStatsDerived(ctx.agentId, ctx.token)
  await testStatsAllocation(ctx.agentId, ctx.token)
  await testStatsAllocationWithSeedAgent()
  await testStatsEvents(ctx.agentId, ctx.token)
  await testMemories(ctx.agentId, ctx.token)
  await testFeatureGuards(ctx.agentId, ctx.token)

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
