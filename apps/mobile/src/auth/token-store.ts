import * as SecureStore from 'expo-secure-store'

const AUTH_TOKEN_KEY = 'fun_forum_auth_token'

export async function getStoredAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export async function setStoredAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token)
  } catch {
    /* SecureStore unavailable — token kept in memory only */
  }
}

export async function clearStoredAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY)
  } catch {
    /* best-effort */
  }
}
