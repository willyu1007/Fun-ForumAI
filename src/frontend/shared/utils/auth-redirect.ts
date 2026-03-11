export interface AuthRedirectState {
  from?: string
  returnTo?: string
}

interface RedirectLocationLike {
  pathname: string
  search?: string
  hash?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function readAuthRedirectState(value: unknown): AuthRedirectState {
  if (!isRecord(value)) return {}

  const state: AuthRedirectState = {}
  if (typeof value.from === 'string' && value.from.length > 0) {
    state.from = value.from
  }
  if (typeof value.returnTo === 'string' && value.returnTo.length > 0) {
    state.returnTo = value.returnTo
  }
  return state
}

export function buildAuthRedirectState(from: string, returnTo?: string): AuthRedirectState {
  return returnTo
    ? { from, returnTo }
    : { from }
}

export function resolveAuthRedirectTarget(value: unknown): string {
  const state = readAuthRedirectState(value)
  return state.returnTo ?? state.from ?? '/'
}

export function locationToPath(location: RedirectLocationLike): string {
  return `${location.pathname}${location.search ?? ''}${location.hash ?? ''}`
}

export function isGuidanceAuthGatedTarget(target: string): boolean {
  return /(?:\?|&)following_only=true(?:&|$)/.test(target)
}
