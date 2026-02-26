jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {}
  return {
    getItemAsync: jest.fn(async (key: string) => store[key] ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { store[key] = value }),
    deleteItemAsync: jest.fn(async (key: string) => { delete store[key] }),
  }
})

import * as SecureStore from 'expo-secure-store'
import {
  getStoredAuthToken,
  setStoredAuthToken,
  clearStoredAuthToken,
} from '../token-store'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('token-store', () => {
  it('returns null when no token stored', async () => {
    expect(await getStoredAuthToken()).toBeNull()
  })

  it('stores and retrieves a token', async () => {
    await setStoredAuthToken('abc123')
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('fun_forum_auth_token', 'abc123')
    // Since mock shares the same store object, getItemAsync will return the stored value
    expect(await getStoredAuthToken()).toBe('abc123')
  })

  it('clears a stored token', async () => {
    await setStoredAuthToken('abc123')
    await clearStoredAuthToken()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fun_forum_auth_token')
  })

  it('handles SecureStore errors gracefully for get', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('unavailable'))
    expect(await getStoredAuthToken()).toBeNull()
  })

  it('handles SecureStore errors gracefully for set', async () => {
    ;(SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('unavailable'))
    await expect(setStoredAuthToken('tok')).resolves.toBeUndefined()
  })

  it('handles SecureStore errors gracefully for clear', async () => {
    ;(SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('unavailable'))
    await expect(clearStoredAuthToken()).resolves.toBeUndefined()
  })
})
