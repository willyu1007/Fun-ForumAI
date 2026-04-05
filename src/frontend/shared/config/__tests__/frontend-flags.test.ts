import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('frontend-flags', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    vi.unstubAllEnvs()
  })

  it('falls back to the imported VITE env value when no dev override exists', async () => {
    vi.stubEnv('VITE_FF_HOME_PROGRAMMING_V1', 'false')
    import.meta.env.VITE_FF_HOME_PROGRAMMING_V1 = 'false'

    const { isFrontendFlagEnabled } = await import('../frontend-flags')

    expect(isFrontendFlagEnabled('VITE_FF_HOME_PROGRAMMING_V1')).toBe(false)
  })

  it('reads persisted custom overrides for the current dev session', async () => {
    vi.stubEnv('VITE_FF_HOME_PROGRAMMING_V1', 'false')
    import.meta.env.VITE_FF_HOME_PROGRAMMING_V1 = 'false'
    localStorage.setItem(
      'dev-frontend-flag-config-v1',
      JSON.stringify({
        preset: 'custom',
        overrides: {
          VITE_FF_HOME_PROGRAMMING_V1: 'true',
        },
      }),
    )

    const { isFrontendFlagEnabled, readActiveDevFrontendFlagConfig } = await import(
      '../frontend-flags'
    )

    expect(readActiveDevFrontendFlagConfig()).toMatchObject({
      preset: 'custom',
      overrides: {
        VITE_FF_HOME_PROGRAMMING_V1: 'true',
      },
    })
    expect(isFrontendFlagEnabled('VITE_FF_HOME_PROGRAMMING_V1')).toBe(true)
  })
})
