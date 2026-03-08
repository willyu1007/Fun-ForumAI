#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import {
  FEED_POST_TITLE,
  assertBackendReachable,
  createRunId,
  ensureDir,
  fetchJson,
  getHostBackendBaseUrl,
  getSmokeRunDir,
  writeJson,
  writeLatestFixturePointer,
} from './mobile-smoke-lib.mjs'

async function main() {
  const backendBaseUrl = getHostBackendBaseUrl()
  await assertBackendReachable(backendBaseUrl)

  const runId = createRunId()
  const runDir = ensureDir(getSmokeRunDir(runId))
  const fixturePath = path.join(runDir, 'fixture.json')
  const email = `${runId}@mobile-smoke.local`
  const password = 'SmokePass123'
  const displayName = `Mobile Smoke ${runId}`
  const agentName = `Smoke Agent ${runId}`
  const roomTopic = `Smoke Room ${runId}`
  const privateMessage = `mobile smoke message ${runId}`

  await fetchJson(`${backendBaseUrl}/v1/dev/seed`, { method: 'POST' })

  const feedResult = await fetchJson(`${backendBaseUrl}/v1/feed`)
  const seededPost = Array.isArray(feedResult.data)
    ? feedResult.data.find((post) => post.title === FEED_POST_TITLE)
    : null

  if (!seededPost?.id) {
    throw new Error(`Unable to locate seeded feed post "${FEED_POST_TITLE}".`)
  }

  await fetchJson(`${backendBaseUrl}/v1/auth/register`, {
    method: 'POST',
    body: { email, password, displayName },
  })

  const loginResult = await fetchJson(`${backendBaseUrl}/v1/auth/login`, {
    method: 'POST',
    body: { email, password },
  })
  const token = loginResult.data?.token
  if (!token) {
    throw new Error('Smoke login did not return a token.')
  }

  const meAgents = await fetchJson(`${backendBaseUrl}/v1/me/agents`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  let agent = Array.isArray(meAgents.data)
    ? meAgents.data.find((item) => item.display_name === agentName)
    : null

  if (!agent) {
    const created = await fetchJson(`${backendBaseUrl}/v1/agents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { display_name: agentName },
    })
    agent = created.data
  }

  if (!agent?.id) {
    throw new Error('Smoke agent creation failed.')
  }

  const roomResult = await fetchJson(`${backendBaseUrl}/v1/agents/${agent.id}/rooms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { topic: roomTopic },
  })
  const room = roomResult.data
  if (!room?.id || !room?.name) {
    throw new Error('Smoke room creation failed.')
  }

  const fixture = {
    run_id: runId,
    created_at: new Date().toISOString(),
    backend_base_url: backendBaseUrl,
    feed_post_title: FEED_POST_TITLE,
    feed_post_id: seededPost.id,
    feed_post_match_text: `${FEED_POST_TITLE} ${seededPost.id}`,
    user: {
      email,
      password,
      display_name: displayName,
    },
    agent: {
      id: agent.id,
      display_name: agent.display_name,
    },
    room: {
      id: room.id,
      name: room.name,
      topic: roomTopic,
    },
    private_message: privateMessage,
  }

  writeJson(fixturePath, fixture)
  writeLatestFixturePointer(runId, fixturePath)

  console.log(`mobile smoke fixture ready: ${fixturePath}`)
  console.log(`run_id=${runId}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
