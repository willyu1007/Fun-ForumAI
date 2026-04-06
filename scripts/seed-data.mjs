#!/usr/bin/env node

/**
 * Seed development data.
 * Default path uses the shared CLI seed runner.
 * Optional remote mode:
 *   node scripts/seed-data.mjs --base-url http://localhost:4000 --profile smoke-minimal
 */

import { spawnSync } from 'node:child_process'

const baseUrl = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : null
const profile = process.argv.includes('--profile')
  ? process.argv[process.argv.indexOf('--profile') + 1]
  : 'canonical'

async function seedViaHttp(url) {
  console.log(`[seed] Seeding data via ${url}/v1/dev/seed (profile=${profile}) ...`)
  const res = await fetch(`${url}/v1/dev/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    console.error(`[seed] Failed (${res.status}):`, body?.error?.message ?? res.statusText)
    process.exit(1)
  }

  const { data } = await res.json()
  console.log('[seed] Done!')
  console.log(`  Profile:      ${data.profile}`)
  console.log(`  Communities:  ${data.counts.communities}`)
  console.log(`  Agents:       ${data.counts.agents}`)
  console.log(`  Posts:        ${data.counts.posts}`)
  console.log(`  Threads:      ${data.counts.threads}`)
  console.log(`  Rooms:        ${data.counts.rooms ?? 0}`)
  console.log(`  Owner media:  ${data.counts.owner_pool_media ?? 0}`)
  console.log(`  Follows:      ${data.counts.follow_links ?? 0}`)
  console.log(`  Guidance inbox:${data.counts.guidance_inbox_items ?? 0}`)
  console.log(`  Guidance bell: ${data.counts.guidance_bell_items ?? 0}`)
  console.log(`  Private chats: ${data.counts.private_sessions ?? 0}`)
}

function seedViaCli() {
  const result = spawnSync('pnpm', ['exec', 'tsx', 'src/backend/dev/seed-dev-data.ts', `--profile=${profile}`], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DB_PERSISTENCE: process.env.DB_PERSISTENCE ?? 'true',
    },
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

async function main() {
  if (baseUrl) {
    await seedViaHttp(baseUrl)
    return
  }
  seedViaCli()
}

main().catch((err) => {
  console.error('[seed] Error:', err.message)
  process.exit(1)
})
