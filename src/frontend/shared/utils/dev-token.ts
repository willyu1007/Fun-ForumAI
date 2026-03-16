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

async function syncDevAuthCookie(identity: 'anonymous' | 'user' | 'admin'): Promise<void> {
  const response = await fetch('/v1/auth/dev/switch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({ identity }),
  })

  if (response.ok) return

  let message = '开发身份切换失败'
  try {
    const payload = (await response.json()) as DevAuthSwitchResponse
    if (payload.error?.message) {
      message = payload.error.message
    }
  } catch {
    // ignore non-json errors
  }

  throw new Error(message)
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
