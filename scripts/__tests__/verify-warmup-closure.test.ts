import { createServer } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

async function startServer(handler: Parameters<typeof createServer>[0]) {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('failed to start http server')
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  }
}

async function runScript(args: string[]) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })
  const [code] = await once(child, 'exit')
  return {
    status: typeof code === 'number' ? code : null,
    stdout,
    stderr,
  }
}

describe('verify-warmup-closure.mjs', () => {
  afterEach(() => {
    // no-op placeholder to keep vitest lifecycle explicit
  })

  it('returns exit code 0 when the verifier run passes', async () => {
    const { server, baseUrl } = await startServer((req, res) => {
      if (req.method === 'POST' && req.url === '/v1/admin/warmup/verifier/runs') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          data: {
            summary: {
              run_id: 'run-1',
              status: 'passed',
              failed_phase: null,
              surface_matrix: {
                feed: true,
                home: true,
                highlights: true,
                search: true,
              },
              governance_drill: {
                quarantine_ok: true,
                restore_ok: true,
              },
              artifact_dir: '/tmp/run-1',
            },
            top_diagnosis: null,
          },
        }))
        return
      }
      res.statusCode = 404
      res.end()
    })

    try {
      const result = await runScript([
        'scripts/verify-warmup-closure.mjs',
        '--web-base-url',
        baseUrl,
        '--admin-token',
        'token',
      ])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('status=passed')
      expect(result.stdout).toContain('artifact_dir=/tmp/run-1')
    } finally {
      server.close()
      server.closeAllConnections?.()
      await once(server, 'close')
    }
  })

  it('returns exit code 1 when the verifier run fails', async () => {
    const { server, baseUrl } = await startServer((req, res) => {
      if (req.method === 'POST' && req.url === '/v1/admin/warmup/verifier/runs') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          data: {
            summary: {
              run_id: 'run-2',
              status: 'failed',
              failed_phase: 'surface_search',
              surface_matrix: {
                feed: true,
                home: true,
                highlights: true,
                search: false,
              },
              governance_drill: {
                quarantine_ok: true,
                restore_ok: false,
              },
              artifact_dir: '/tmp/run-2',
            },
            top_diagnosis: {
              code: 'surface.search.missing_expected_content',
              summary_zh: 'search 没有命中 probe 内容。',
            },
          },
        }))
        return
      }
      res.statusCode = 404
      res.end()
    })

    try {
      const result = await runScript([
        'scripts/verify-warmup-closure.mjs',
        '--web-base-url',
        baseUrl,
        '--admin-token',
        'token',
      ])
      expect(result.status).toBe(1)
      expect(result.stdout).toContain('status=failed')
      expect(result.stdout).toContain('top_diagnosis=surface.search.missing_expected_content')
    } finally {
      server.close()
      server.closeAllConnections?.()
      await once(server, 'close')
    }
  })
})
