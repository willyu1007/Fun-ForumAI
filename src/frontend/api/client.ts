import ky from 'ky'

function getAuthToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/)
  return match?.[1] || undefined
}

export const api = ky.create({
  prefixUrl: '/v1',
  timeout: 30_000,
  retry: { limit: 2, statusCodes: [408, 500, 502, 503, 504] },
  hooks: {
    beforeRequest: [
      (request) => {
        const token = getAuthToken()
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`)
        }
      },
    ],
    beforeError: [
      async (error) => {
        const { response } = error
        if (response) {
          try {
            const body = (await response.json()) as { error?: { message?: string } }
            if (body?.error?.message) {
              error.message = body.error.message
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
