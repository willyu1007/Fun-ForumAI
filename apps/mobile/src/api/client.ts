import type { ApiResponse } from './types'

const DEFAULT_IOS_API_BASE_URL = 'http://127.0.0.1:4000'
const DEFAULT_ANDROID_API_BASE_URL = 'http://10.0.2.2:4000'
const REQUEST_TIMEOUT_MS = 15_000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1_000

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

function readEnv(name: string): string | undefined {
  const maybeProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }
  return maybeProcess.process?.env?.[name]
}

function detectExpoOs(): 'ios' | 'android' | null {
  const expoOs = readEnv('EXPO_OS')?.trim().toLowerCase()
  if (expoOs === 'ios' || expoOs === 'android') {
    return expoOs
  }

  const userAgent = globalThis.navigator?.userAgent?.toLowerCase()
  if (!userAgent) return null
  if (userAgent.includes('android')) return 'android'
  if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ios')) {
    return 'ios'
  }
  return null
}

export function getApiBaseUrl(): string {
  const configured = readEnv('EXPO_PUBLIC_API_BASE_URL')
  if (configured && configured.trim()) {
    return configured.trim()
  }

  return detectExpoOs() === 'android'
    ? DEFAULT_ANDROID_API_BASE_URL
    : DEFAULT_IOS_API_BASE_URL
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

function isRetryable(err: unknown): boolean {
  if (err instanceof AuthError) return false
  if (err instanceof TypeError) return true
  if (err instanceof DOMException && err.name === 'AbortError') return true
  return false
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
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

  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await wait(RETRY_DELAY_MS * attempt)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(buildUrl(path), {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      if (attempt < MAX_RETRIES && isRetryable(err)) continue
      throw err
    } finally {
      clearTimeout(timer)
    }

    if (response.status >= 500 && attempt < MAX_RETRIES) {
      lastError = new Error(`${method} ${path} returned ${response.status}`)
      continue
    }

    const payload = (await response.json().catch(() => null)) as
      | ApiResponse<T>
      | { error?: { message?: string } }
      | null

    if (!response.ok) {
      const message = payload && 'error' in payload && payload.error?.message
        ? payload.error.message
        : `${method} ${path} failed with ${response.status}`

      if (response.status === 401 || response.status === 403) {
        throw new AuthError(response.status, message)
      }
      throw new Error(message)
    }

    if (!payload || !('data' in payload)) {
      throw new Error(`Unexpected response for ${method} ${path}`)
    }

    return payload
  }

  throw lastError
}

export function apiGet<T>(path: string, token?: string): Promise<ApiResponse<T>> {
  return request<T>('GET', path, { token })
}

export function apiPost<T>(path: string, body: unknown, token?: string): Promise<ApiResponse<T>> {
  return request<T>('POST', path, { token, body })
}
