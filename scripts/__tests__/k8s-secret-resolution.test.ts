import { describe, expect, it } from 'vitest'
import {
  isPlaceholderSecretValue,
  resolveDashscopeSecretData,
  resolveEnvBackedSecretValue,
  sanitizeSecretValue,
} from '../lib/k8s-secret-resolution.mjs'

describe('k8s secret resolution helpers', () => {
  it('treats common placeholder values as unusable secrets', () => {
    expect(isPlaceholderSecretValue('REPLACE_ME')).toBe(true)
    expect(isPlaceholderSecretValue('changeme')).toBe(true)
    expect(isPlaceholderSecretValue('example_api_key')).toBe(true)
    expect(isPlaceholderSecretValue('real-secret-value')).toBe(false)
  })

  it('sanitizes blank and placeholder values to fallback output', () => {
    expect(sanitizeSecretValue('  ')).toBe('')
    expect(sanitizeSecretValue('REPLACE_ME')).toBe('')
    expect(sanitizeSecretValue(' usable-secret ')).toBe('usable-secret')
    expect(sanitizeSecretValue(undefined, 'fallback')).toBe('fallback')
  })

  it('prefers explicit env values but ignores placeholder env and secret values', () => {
    expect(resolveEnvBackedSecretValue({
      existingSecretData: {
        TOKEN_PLAN_OPENAI_API_KEY: 'REPLACE_ME',
      },
      envKey: 'TOKEN_PLAN_OPENAI_API_KEY',
      secretKey: 'TOKEN_PLAN_OPENAI_API_KEY',
      env: {
        TOKEN_PLAN_OPENAI_API_KEY: 'actual-token-plan-key',
      },
    })).toBe('actual-token-plan-key')

    expect(resolveEnvBackedSecretValue({
      existingSecretData: {
        TOKEN_PLAN_OPENAI_API_KEY: 'persisted-token-plan-key',
      },
      envKey: 'TOKEN_PLAN_OPENAI_API_KEY',
      secretKey: 'TOKEN_PLAN_OPENAI_API_KEY',
      env: {
        TOKEN_PLAN_OPENAI_API_KEY: 'REPLACE_ME',
      },
    })).toBe('persisted-token-plan-key')

    expect(resolveEnvBackedSecretValue({
      existingSecretData: {
        TOKEN_PLAN_OPENAI_API_KEY: 'REPLACE_ME',
      },
      envKey: 'TOKEN_PLAN_OPENAI_API_KEY',
      secretKey: 'TOKEN_PLAN_OPENAI_API_KEY',
      env: {},
      fallback: 'fallback-token',
    })).toBe('fallback-token')
  })

  it('scrubs placeholder dashscope credentials before reuse', () => {
    expect(resolveDashscopeSecretData({
      existingSecretData: {
        DASHSCOPE_API_KEY: 'REPLACE_ME',
        DASHSCOPE_API_KEY_SECONDARY: 'REPLACE_ME',
      },
      env: {},
    })).toEqual({
      dashscopeApiKey: '',
      dashscopeSecondaryApiKey: '',
    })

    expect(resolveDashscopeSecretData({
      existingSecretData: {
        DASHSCOPE_API_KEY: 'persisted-primary',
        DASHSCOPE_API_KEY_SECONDARY: 'persisted-secondary',
      },
      env: {
        DASHSCOPE_API_KEY: 'explicit-primary',
        DASHSCOPE_API_KEY_SECONDARY: 'REPLACE_ME',
      },
    })).toEqual({
      dashscopeApiKey: 'explicit-primary',
      dashscopeSecondaryApiKey: 'persisted-secondary',
    })
  })
})
