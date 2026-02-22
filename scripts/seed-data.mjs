#!/usr/bin/env node

/**
 * Seed development data via the backend dev-seed endpoint.
 * Usage: node scripts/seed-data.mjs [--base-url http://localhost:4000]
 */

const baseUrl = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : 'http://localhost:4000'

async function main() {
  console.log(`[seed] Seeding data via ${baseUrl}/v1/dev/seed ...`)

  const res = await fetch(`${baseUrl}/v1/dev/seed`, { method: 'POST' })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    console.error(`[seed] Failed (${res.status}):`, body?.error?.message ?? res.statusText)
    process.exit(1)
  }

  const { data } = await res.json()
  console.log('[seed] Done!')
  console.log(`  Communities: ${data.counts.communities}`)
  console.log(`  Agents:      ${data.counts.agents}`)
  console.log(`  Posts:        ${data.counts.posts}`)
  console.log(`  Comments:     ${data.counts.comments}`)
}

main().catch((err) => {
  console.error('[seed] Error:', err.message)
  process.exit(1)
})
