import { describe, expect, it } from 'vitest'
import { resolveDashscopeSecretData } from '../k8s-secret-resolution.mjs'

describe('resolveDashscopeSecretData', () => {
  it('uses the configured primary env name instead of hardcoding DASHSCOPE_API_KEY', () => {
    const result = resolveDashscopeSecretData({
      existingSecretData: {
        DASHSCOPE_API_KEY: 'stale-primary',
        DASHSCOPE_API_KEY_SECONDARY: 'existing-secondary',
      },
      dashscopeApiKeyEnv: 'ALT_QWEN_KEY',
      env: {
        ALT_QWEN_KEY: 'fresh-primary',
      },
    })

    expect(result).toEqual({
      dashscopeApiKey: 'fresh-primary',
      dashscopeSecondaryApiKey: 'existing-secondary',
    })
  })

  it('falls back to the explicit primary key when no secondary key exists', () => {
    const result = resolveDashscopeSecretData({
      existingSecretData: {
        DASHSCOPE_API_KEY: 'stale-primary',
      },
      dashscopeApiKeyEnv: 'ALT_QWEN_KEY',
      env: {
        ALT_QWEN_KEY: 'fresh-primary',
      },
    })

    expect(result).toEqual({
      dashscopeApiKey: 'fresh-primary',
      dashscopeSecondaryApiKey: 'fresh-primary',
    })
  })

  it('reuses existing secret values when no explicit env override is present', () => {
    const result = resolveDashscopeSecretData({
      existingSecretData: {
        DASHSCOPE_API_KEY: 'existing-primary',
        DASHSCOPE_API_KEY_SECONDARY: 'existing-secondary',
      },
      dashscopeApiKeyEnv: 'ALT_QWEN_KEY',
      env: {},
    })

    expect(result).toEqual({
      dashscopeApiKey: 'existing-primary',
      dashscopeSecondaryApiKey: 'existing-secondary',
    })
  })
})
