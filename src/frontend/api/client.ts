import ky from 'ky'

export interface ApiError extends Error {
  code?: string
}

export function getApiErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null
  }
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

export const api = ky.create({
  prefixUrl: '/v1',
  credentials: 'include',
  timeout: 30_000,
  retry: { limit: 2, statusCodes: [408, 500, 502, 503, 504] },
  hooks: {
    beforeError: [
      async (error) => {
        const { response } = error
        if (response) {
          try {
            const body = (await response.clone().json()) as { error?: { code?: string; message?: string } }
            if (body?.error?.message) {
              error.message = body.error.message
            }
            if (body?.error?.code) {
              ;(error as ApiError).code = body.error.code
            }
          } catch {
            // ignore parse errors
          }
        }
        return error
      },
    ],
  },
})
