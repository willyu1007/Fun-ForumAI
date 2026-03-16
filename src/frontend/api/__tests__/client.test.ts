import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('api client', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses cookie credentials without injecting an Authorization header', async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      expect(request.credentials).toBe('include')
      expect(request.headers.get('Authorization')).toBeNull()
      return new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { api } = await import('../client')
    const result = await api
      .extend({ prefixUrl: 'http://localhost/v1' })
      .get('auth/me')
      .json<{ data: { ok: boolean } }>()

    expect(result.data.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
