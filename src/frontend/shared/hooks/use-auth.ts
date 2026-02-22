import { useCallback, useSyncExternalStore } from 'react'
import { setDevAuth, getCurrentDevUser, type DevUser } from '../utils/dev-token'

type AuthIdentity = 'anonymous' | 'user' | 'admin'

let _current: DevUser | null = getCurrentDevUser()
const listeners = new Set<() => void>()

function notify() {
  for (const fn of listeners) fn()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return _current
}

export function useAuth() {
  const user = useSyncExternalStore(subscribe, getSnapshot)

  const switchIdentity = useCallback((identity: AuthIdentity) => {
    _current = setDevAuth(identity)
    notify()
  }, [])

  const currentIdentity: AuthIdentity = !user
    ? 'anonymous'
    : user.role === 'admin'
      ? 'admin'
      : 'user'

  return { user, currentIdentity, switchIdentity }
}
