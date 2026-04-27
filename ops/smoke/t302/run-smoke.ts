#!/usr/bin/env tsx
//
// T-302 — admin/community media import smoke harness
//
// Boots the real backend Express app in-process with in-memory repos,
// seeds a single test community programmatically, then exercises the six
// admin media import endpoints over real HTTP plus a couple of auth gates.
//
// Designed for execution as an isolated test environment (no Postgres,
// no Redis, no external services). Run via:
//
//   NODE_ENV=development APP_ENV=dev PORT=4101 \
//   JWT_SECRET=smoke-jwt-secret SERVICE_AUTH_SECRET=smoke-service-secret \
//   pnpm exec tsx ops/smoke/t302/run-smoke.ts
//
// Exits 0 on all-pass, 1 on any assertion failure. Output is structured so
// each assertion is on its own line for grep/pipeline consumption.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// PNG buffer reused from existing test fixtures.
const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5NQAAAAASUVORK5CYII=',
  'base64',
)

interface AssertionRecord {
  name: string
  ok: boolean
  detail?: string
}

const records: AssertionRecord[] = []

function record(name: string, ok: boolean, detail?: string): void {
  records.push({ name, ok, detail })
  const status = ok ? '[ok]' : '[fail]'
  console.log(`${status} ${name}${detail ? ` — ${detail}` : ''}`)
}

function buildAdminDevToken(): string {
  const payload = {
    userId: 'smoke-admin',
    email: 'smoke-admin@t302.local',
    role: 'admin',
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function buildUserDevToken(): string {
  const payload = {
    userId: 'smoke-user',
    email: 'smoke-user@t302.local',
    role: 'user',
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function pickAssetIdFromImport(payload: unknown): string | null {
  const item = (payload as { data?: { asset?: { asset_id?: string } } } | null)?.data
  return item?.asset?.asset_id ?? null
}

function pickReuseModes(payload: unknown): string[] {
  const item = (payload as { data?: { reuse_policy?: { allowed_reuse_modes?: string[] } } } | null)
    ?.data
  return item?.reuse_policy?.allowed_reuse_modes ?? []
}

function pickPoolSceneId(payload: unknown): string | null {
  const item = (payload as { data?: { pool_binding?: { scene_id?: string } } } | null)?.data
  return item?.pool_binding?.scene_id ?? null
}

async function main(): Promise<number> {
  // Make sure smoke runs in an isolated media dir.
  const mediaDir = mkdtempSync(join(tmpdir(), 't302-smoke-'))
  process.env.MEDIA_LOCAL_DIR = process.env.MEDIA_LOCAL_DIR ?? mediaDir
  process.env.MEDIA_STORAGE_BACKEND = process.env.MEDIA_STORAGE_BACKEND ?? 'local'
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'development'
  process.env.APP_ENV = process.env.APP_ENV ?? 'dev'
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'smoke-jwt-secret-not-for-prod'
  process.env.SERVICE_AUTH_SECRET = process.env.SERVICE_AUTH_SECRET ?? 'smoke-service-secret-not-for-prod'
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent'

  const port = Number(process.env.PORT ?? 4101)

  // Lazy import after env mutation so config picks up our values.
  const [{ app }, container, { healthState }] = await Promise.all([
    import('../../../src/backend/app.js'),
    import('../../../src/backend/container.js'),
    import('../../../src/backend/health/state.js'),
  ])

  const community = container.communityRepo.create({
    name: 'T-302 Smoke Community',
    slug: `t302-smoke-${Date.now()}`,
    description: 'Smoke harness fixture (in-memory).',
  })

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const handle = app.listen(port, () => {
      healthState.markStartupComplete()
      resolve(handle)
    })
    handle.on('error', reject)
  })

  const baseUrl = `http://127.0.0.1:${port}`
  const adminToken = buildAdminDevToken()
  const userToken = buildUserDevToken()

  try {
    // 1. Health check — poll until ready since startup is async.
    {
      const deadline = Date.now() + 15_000
      let healthy = false
      let lastStatus = 0
      while (Date.now() < deadline) {
        const res = await fetch(`${baseUrl}/health`).catch(() => null)
        lastStatus = res?.status ?? 0
        if (res?.status === 200) {
          const body = (await readJson(res)) as { ok?: boolean } | null
          if (body?.ok === true) {
            healthy = true
            break
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      record('GET /health responds 200 with ok=true', healthy, `lastStatus=${lastStatus}`)
    }

    // 2. Auth gates: unauthenticated upload → 401
    {
      const form = new FormData()
      form.set(
        'file',
        new Blob([new Uint8Array(VALID_PNG_BUFFER)], { type: 'image/png' }),
        'unauth.png',
      )
      const res = await fetch(`${baseUrl}/v1/admin/media/platform-canonical/imports/upload`, {
        method: 'POST',
        body: form,
      })
      record('Unauthenticated platform upload → 401', res.status === 401,
        `status=${res.status}`)
    }

    // 3. Auth gates: non-admin URL import → 403
    {
      const res = await fetch(`${baseUrl}/v1/admin/media/platform-canonical/imports/url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source_url: 'https://example.com/x.png' }),
      })
      record('Non-admin platform URL import → 403', res.status === 403,
        `status=${res.status}`)
    }

    // 4. Platform upload (default allow_quote_original=false)
    let platformDefaultAssetId: string | null = null
    {
      const form = new FormData()
      form.set(
        'file',
        new Blob([new Uint8Array(VALID_PNG_BUFFER)], { type: 'image/png' }),
        'platform-default.png',
      )
      const res = await fetch(`${baseUrl}/v1/admin/media/platform-canonical/imports/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: form,
      })
      const body = await readJson(res)
      const modes = pickReuseModes(body)
      const sceneId = pickPoolSceneId(body)
      platformDefaultAssetId = pickAssetIdFromImport(body)
      record(
        'Platform upload (default) → 201 + scene=platform_canonical:global + no quote_original',
        res.status === 201
          && sceneId === 'platform_canonical:global'
          && !modes.includes('quote_original'),
        `status=${res.status} scene=${sceneId} modes=[${modes.join(',')}]`,
      )
    }

    // 5. Platform upload with explicit allow_quote_original=true
    {
      const form = new FormData()
      form.set(
        'file',
        new Blob([new Uint8Array(VALID_PNG_BUFFER)], { type: 'image/png' }),
        'platform-explicit.png',
      )
      form.set('allow_quote_original', 'true')
      const res = await fetch(`${baseUrl}/v1/admin/media/platform-canonical/imports/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: form,
      })
      const body = await readJson(res)
      const modes = pickReuseModes(body)
      record(
        'Platform upload (allow_quote_original=true) includes quote_original mode',
        res.status === 201 && modes.includes('quote_original'),
        `status=${res.status} modes=[${modes.join(',')}]`,
      )
    }

    // 6. Platform URL import — non-https rejected at validation
    {
      const res = await fetch(`${baseUrl}/v1/admin/media/platform-canonical/imports/url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source_url: 'http://example.com/insecure.png' }),
      })
      record('Platform URL import http:// → 400', res.status === 400, `status=${res.status}`)
    }

    // 7. Platform URL import — private network rejected
    {
      const res = await fetch(`${baseUrl}/v1/admin/media/platform-canonical/imports/url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source_url: 'https://127.0.0.1/internal.png' }),
      })
      record('Platform URL import https://127.0.0.1 → 400', res.status === 400, `status=${res.status}`)
    }

    // 8. Platform asset list contains the imported assets
    {
      const res = await fetch(`${baseUrl}/v1/admin/media/platform-canonical/assets?limit=10`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      })
      const body = (await readJson(res)) as
        | { data?: { pool?: { scene_id?: string }; items?: Array<{ asset?: { asset_id?: string } }> } }
        | null
      const items = body?.data?.items ?? []
      const found = platformDefaultAssetId
        ? items.some((item) => item.asset?.asset_id === platformDefaultAssetId)
        : items.length > 0
      record(
        'Platform list returns DB-backed pool items',
        res.status === 200
          && body?.data?.pool?.scene_id === 'platform_canonical:global'
          && items.length >= 2
          && found,
        `status=${res.status} items=${items.length}`,
      )
    }

    // 9. Community upload (default allow_quote_original=false)
    let communityDefaultAssetId: string | null = null
    {
      const form = new FormData()
      form.set(
        'file',
        new Blob([new Uint8Array(VALID_PNG_BUFFER)], { type: 'image/png' }),
        'community-default.png',
      )
      const res = await fetch(
        `${baseUrl}/v1/admin/communities/${community.id}/media/commons/imports/upload`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminToken}` },
          body: form,
        },
      )
      const body = await readJson(res)
      const modes = pickReuseModes(body)
      const sceneId = pickPoolSceneId(body)
      communityDefaultAssetId = pickAssetIdFromImport(body)
      const expectedSceneId = `community_commons:${community.id}`
      record(
        'Community upload (default) → 201 + scene=community_commons:<id> + no quote_original',
        res.status === 201
          && sceneId === expectedSceneId
          && !modes.includes('quote_original'),
        `status=${res.status} scene=${sceneId} modes=[${modes.join(',')}]`,
      )
    }

    // 10. Community asset list scoped to this community
    {
      const res = await fetch(
        `${baseUrl}/v1/admin/communities/${community.id}/media/commons/assets`,
        { headers: { 'Authorization': `Bearer ${adminToken}` } },
      )
      const body = (await readJson(res)) as
        | { data?: { pool?: { scene_id?: string; community_id?: string }; items?: Array<{ asset?: { asset_id?: string } }> } }
        | null
      const items = body?.data?.items ?? []
      const found = communityDefaultAssetId
        ? items.some((item) => item.asset?.asset_id === communityDefaultAssetId)
        : items.length > 0
      record(
        'Community list scoped to current community.id',
        res.status === 200
          && body?.data?.pool?.scene_id === `community_commons:${community.id}`
          && body?.data?.pool?.community_id === community.id
          && found,
        `status=${res.status} items=${items.length}`,
      )
    }

    // 11. Missing community pool does not create/read an orphan commons scope
    {
      const missingCommunityId = `missing-t302-smoke-${Date.now()}`
      const res = await fetch(
        `${baseUrl}/v1/admin/communities/${missingCommunityId}/media/commons/assets`,
        { headers: { 'Authorization': `Bearer ${adminToken}` } },
      )
      const body = (await readJson(res)) as { error?: { code?: string } } | null
      record(
        'Missing community commons list → 404',
        res.status === 404 && body?.error?.code === 'NOT_FOUND',
        `status=${res.status} code=${body?.error?.code ?? 'unknown'}`,
      )
    }

    // 12. Reject upload without a file
    {
      const form = new FormData()
      form.set('allow_quote_original', 'false')
      const res = await fetch(`${baseUrl}/v1/admin/media/platform-canonical/imports/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: form,
      })
      record('Platform upload missing file → 400', res.status === 400, `status=${res.status}`)
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  const failed = records.filter((r) => !r.ok)
  console.log('')
  console.log(`[summary] ${records.length - failed.length}/${records.length} assertions passed`)
  if (failed.length > 0) {
    for (const fail of failed) {
      console.log(`  - FAIL: ${fail.name} ${fail.detail ?? ''}`)
    }
    return 1
  }
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[smoke] crashed:', err)
    process.exit(2)
  })
