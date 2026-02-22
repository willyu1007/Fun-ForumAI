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

export function setDevAuth(identity: 'anonymous' | 'user' | 'admin'): DevUser | null {
  if (identity === 'anonymous') {
    document.cookie = 'auth_token=; max-age=0; path=/'
    return null
  }
  const token = generateDevToken(identity)
  document.cookie = `auth_token=${token}; path=/; max-age=86400`
  return DEV_USERS[identity]
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
