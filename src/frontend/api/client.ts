import ky from 'ky'

export const api = ky.create({
  prefixUrl: '/v1',
  timeout: 30_000,
  retry: { limit: 2, statusCodes: [408, 500, 502, 503, 504] },
  hooks: {
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
