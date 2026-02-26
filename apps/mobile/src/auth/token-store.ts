import * as SecureStore from 'expo-secure-store'

const AUTH_TOKEN_KEY = 'fun_forum_auth_token'

export async function getStoredAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY)
}

export async function setStoredAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token)
}

export async function clearStoredAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY)
}
