import { describe, expect, it } from 'vitest'
import { getAppShellContentSafeAreaClass } from '../dev-auth-toolbar'

describe('dev auth toolbar layout helpers', () => {
  it('keeps the larger shell safe area when the dev toolbar is rendered', () => {
    expect(getAppShellContentSafeAreaClass(true)).toBe('pb-16')
  })

  it('falls back to a smaller production-safe bottom padding when the dev toolbar is absent', () => {
    expect(getAppShellContentSafeAreaClass(false)).toBe('pb-6')
  })
})
