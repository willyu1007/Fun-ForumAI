import type { ApiResponse } from './types'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:4000'

function readEnv(name: string): string | undefined {
  const maybeProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }
  return maybeProcess.process?.env?.[name]
}

export function getApiBaseUrl(): string {
  const configured = readEnv('EXPO_PUBLIC_API_BASE_URL')
  return configured && configured.trim() ? configured.trim() : DEFAULT_API_BASE_URL
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<T>
    | { error?: { message?: string } }
    | null

  if (!response.ok) {
    const message = payload && 'error' in payload && payload.error?.message
      ? payload.error.message
      : `${method} ${path} failed with ${response.status}`
    throw new Error(message)
  }

  if (!payload || !('data' in payload)) {
    throw new Error(`Unexpected response for ${method} ${path}`)
  }

  return payload
}

export function apiGet<T>(path: string, token?: string): Promise<ApiResponse<T>> {
  return request<T>('GET', path, { token })
}

export function apiPost<T>(path: string, body: unknown, token?: string): Promise<ApiResponse<T>> {
  return request<T>('POST', path, { token, body })
}
