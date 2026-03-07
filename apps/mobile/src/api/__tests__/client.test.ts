import { apiGet, apiPost, AuthError, getApiBaseUrl } from '../client'

function getProcessEnv(): Record<string, string | undefined> {
  const maybeProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }

  if (!maybeProcess.process) {
    maybeProcess.process = { env: {} }
  } else if (!maybeProcess.process.env) {
    maybeProcess.process.env = {}
  }

  return maybeProcess.process.env ?? {}
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    statusText: '',
    type: 'basic' as ResponseType,
    url: '',
    clone: () => jsonResponse(status, body),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response
}

let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>

beforeEach(() => {
  const env = getProcessEnv()
  delete env.EXPO_PUBLIC_API_BASE_URL
  delete env.EXPO_OS
  fetchSpy = jest.spyOn(globalThis, 'fetch').mockReset()
})

afterEach(() => { fetchSpy.mockRestore() })

describe('apiGet', () => {
  it('returns data on 200', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { data: { id: '1' } }))
    const result = await apiGet<{ id: string }>('/v1/test')
    const base = getApiBaseUrl()
    expect(result.data.id).toBe('1')
    expect(fetchSpy).toHaveBeenCalledWith(
      `${base}/v1/test`,
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('sends Authorization header when token provided', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { data: {} }))
    await apiGet('/v1/test', 'my-token')
    const call = fetchSpy.mock.calls[0]
    const headers = call[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer my-token')
  })

  it('throws AuthError on 401', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(401, { error: { message: 'Unauthorized' } }))
    try {
      await apiGet('/v1/secret')
      fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError)
      expect((err as AuthError).status).toBe(401)
    }
  })

  it('throws AuthError on 403', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(403, { error: { message: 'Forbidden' } }))
    await expect(apiGet('/v1/secret')).rejects.toThrow(AuthError)
  })

  it('throws generic Error on 400', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(400, { error: { message: 'Bad request' } }))
    await expect(apiGet('/v1/bad')).rejects.toThrow('Bad request')
    await expect(apiGet('/v1/bad')).rejects.not.toBeInstanceOf(AuthError)
  })

  it('retries on 500 then succeeds', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, { data: { ok: true } }))
    const result = await apiGet<{ ok: boolean }>('/v1/flaky')
    expect(result.data.ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries on 500', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(500, { error: { message: 'Server error' } }))
    await expect(apiGet('/v1/down')).rejects.toThrow('Server error')
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })
})

describe('apiPost', () => {
  it('sends JSON body', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { data: { created: true } }))
    await apiPost('/v1/items', { name: 'test' }, 'tok')
    const call = fetchSpy.mock.calls[0]
    const headers = call[1]?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(call[1]?.body).toBe(JSON.stringify({ name: 'test' }))
  })

  it('does not retry on AuthError', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(401, { error: { message: 'no' } }))
    await expect(apiPost('/v1/x', {})).rejects.toThrow(AuthError)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('getApiBaseUrl', () => {
  it('returns default when no env var', () => {
    expect(getApiBaseUrl()).toBe('http://127.0.0.1:4000')
  })

  it('returns Android default when EXPO_OS=android', () => {
    getProcessEnv().EXPO_OS = 'android'
    expect(getApiBaseUrl()).toBe('http://10.0.2.2:4000')
  })

  it('prefers explicit env override over platform default', () => {
    const env = getProcessEnv()
    env.EXPO_OS = 'android'
    env.EXPO_PUBLIC_API_BASE_URL = 'http://192.168.0.20:4000'
    expect(getApiBaseUrl()).toBe('http://192.168.0.20:4000')
  })
})
