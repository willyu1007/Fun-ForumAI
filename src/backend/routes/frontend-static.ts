import express from 'express'
import { existsSync } from 'node:fs'
import { extname, resolve } from 'node:path'

export interface FrontendStaticRouterOptions {
  distDir?: string
}

function resolveDistDir(distDir?: string): string {
  return resolve(distDir ?? resolve(process.cwd(), 'dist/frontend'))
}

function isFrontendHtmlRequest(req: express.Request): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (
    req.path.startsWith('/v1/') ||
    req.path === '/v1' ||
    req.path === '/health' ||
    req.path === '/livez' ||
    req.path === '/readyz'
  ) {
    return false
  }
  if (extname(req.path).length > 0) return false
  return true
}

export function createFrontendStaticRouter(
  options: FrontendStaticRouterOptions = {},
): express.Router {
  const router = express.Router()
  const distDir = resolveDistDir(options.distDir)
  const indexPath = resolve(distDir, 'index.html')
  const buildCapabilitiesPath = resolve(distDir, 'frontend-build-capabilities.json')

  if (!existsSync(distDir)) {
    return router
  }

  router.get('/frontend-build-capabilities.json', (_req, res, next) => {
    if (!existsSync(buildCapabilitiesPath)) {
      next()
      return
    }
    res.setHeader('Cache-Control', 'no-store')
    res.sendFile(buildCapabilitiesPath)
  })

  router.use(express.static(distDir, { index: false }))

  router.use((req, res, next) => {
    if (!isFrontendHtmlRequest(req) || !existsSync(indexPath)) {
      next()
      return
    }
    res.sendFile(indexPath)
  })

  return router
}
