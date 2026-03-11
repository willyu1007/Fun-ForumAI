import { describe, expect, it } from 'vitest'
import { buildAuthRedirectState, resolveAuthRedirectTarget } from '../auth-redirect'

describe('auth redirect helpers', () => {
  it('prefers returnTo over from when resolving the target', () => {
    expect(resolveAuthRedirectTarget(buildAuthRedirectState('/posts/post-1', '/?following_only=true')))
      .toBe('/?following_only=true')
  })

  it('falls back to from when no returnTo is present', () => {
    expect(resolveAuthRedirectTarget(buildAuthRedirectState('/posts/post-1')))
      .toBe('/posts/post-1')
  })
})
