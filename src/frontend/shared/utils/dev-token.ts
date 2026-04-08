export interface DevUser {
  userId: string
  email: string
  role: 'user' | 'admin'
}

const DEV_USERS: Record<string, DevUser> = {
  anonymous: { userId: '', email: '', role: 'user' },
  user: { userId: 'dev-user-001', email: 'dev-user@llm-forum.test', role: 'user' },
  admin: { userId: 'dev-admin-001', email: 'dev-admin@llm-forum.test', role: 'admin' },
}

export function generateDevToken(identity: 'anonymous' | 'user' | 'admin'): string {
  const user = DEV_USERS[identity]
  if (identity === 'anonymous' || !user.userId) return ''
  const payload = JSON.stringify(user)
  return btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface DevAuthSwitchResponse {
  error?: {
    message?: string
  }
}

const DEV_AUTH_BACKEND_UNAVAILABLE_MESSAGE = '开发后端未连接，请先启动本地后端服务。'

function resolveDevAuthFailureMessage(input: {
  response: Response
  payload: DevAuthSwitchResponse | null
}): string {
  const { response, payload } = input
  if (payload?.error?.message) {
    return payload.error.message
  }

  if (response.status === 404) {
    return '开发身份切换入口不可用，请确认当前处于本地开发环境。'
  }

  if (response.status >= 500) {
    return DEV_AUTH_BACKEND_UNAVAILABLE_MESSAGE
  }

  return '开发身份切换失败'
}

async function syncDevAuthCookie(identity: 'anonymous' | 'user' | 'admin'): Promise<void> {
  let response: Response
  try {
    response = await fetch('/v1/auth/dev/switch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ identity }),
    })
  } catch {
    throw new Error(DEV_AUTH_BACKEND_UNAVAILABLE_MESSAGE)
  }

  if (response.ok) return

  let payload: DevAuthSwitchResponse | null = null
  try {
    payload = (await response.json()) as DevAuthSwitchResponse
  } catch {
    // ignore non-json errors
  }

  throw new Error(resolveDevAuthFailureMessage({ response, payload }))
}

export async function setDevAuth(identity: 'anonymous' | 'user' | 'admin'): Promise<DevUser | null> {
  await syncDevAuthCookie(identity)
  return identity === 'anonymous' ? null : DEV_USERS[identity]
}

export function getCurrentDevUser(): DevUser | null {
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/)
  if (!match?.[1]) return null
  try {
    const raw = match[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(raw)) as DevUser
  } catch {
    return null
  }
}

export { DEV_USERS }
