import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createFrontendStaticRouter } from '../frontend-static.js'

describe('frontend static router', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true })
    }
  })

  function createFixture() {
    const dir = mkdtempSync(join(tmpdir(), 'frontend-static-'))
    tempDirs.push(dir)
    writeFileSync(join(dir, 'index.html'), '<!doctype html><html><body>launch-home</body></html>\n', 'utf8')
    writeFileSync(
      join(dir, 'frontend-build-flags.json'),
      `${JSON.stringify({
        version: 1,
        profile: 'staging-launch',
        frontend_flags: {
          VITE_FF_HOME_PROGRAMMING_V1: 'true',
          VITE_FF_PROGRAMMING_OPS_V1: 'true',
        },
      })}\n`,
      'utf8',
    )
    writeFileSync(join(dir, 'asset.txt'), 'asset-ok\n', 'utf8')
    return dir
  }

  function createApp(distDir: string) {
    const app = express()
    app.use(createFrontendStaticRouter({ distDir }))
    app.use((req, res) => {
      res.status(404).json({ error: { code: 'NOT_FOUND', path: req.path } })
    })
    return app
  }

  it('serves the frontend build proof artifact with no-store caching', async () => {
    const app = createApp(createFixture())

    const response = await request(app).get('/frontend-build-flags.json')

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toContain('no-store')
    expect(response.body.frontend_flags.VITE_FF_HOME_PROGRAMMING_V1).toBe('true')
  })

  it('serves static assets and falls back to index.html for SPA routes', async () => {
    const app = createApp(createFixture())

    const asset = await request(app).get('/asset.txt')
    const spa = await request(app).get('/launch/home')

    expect(asset.status).toBe(200)
    expect(asset.text).toContain('asset-ok')
    expect(spa.status).toBe(200)
    expect(spa.text).toContain('launch-home')
  })

  it('does not swallow API routes or missing asset paths', async () => {
    const app = createApp(createFixture())

    const api = await request(app).get('/v1/home')
    const missingAsset = await request(app).get('/missing.js')

    expect(api.status).toBe(404)
    expect(api.body.error.path).toBe('/v1/home')
    expect(missingAsset.status).toBe(404)
    expect(missingAsset.body.error.path).toBe('/missing.js')
  })
})
