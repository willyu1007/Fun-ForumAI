import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDevAuth } from '../dev-token'

describe('setDevAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    document.cookie = 'auth_token=; max-age=0; path=/; SameSite=Lax'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('syncs the dev auth cookie through the backend without persisting a local bearer token', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { user: { id: 'dev-user-001' } } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await setDevAuth('user')

    expect(result).toMatchObject({
      userId: 'dev-user-001',
      role: 'user',
    })
    expect(localStorage.getItem('dev_auth_token')).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/v1/auth/dev/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ identity: 'user' }),
    })
  })

  it('throws when cookie sync fails', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: { message: 'boom' } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(setDevAuth('admin')).rejects.toThrow('boom')
    expect(localStorage.getItem('dev_auth_token')).toBeNull()
  })
})
