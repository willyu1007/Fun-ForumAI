import { describe, expect, it } from 'vitest'
import { resolveEffectiveDisclosureCap } from '../admin-api-utils.js'

describe('resolveEffectiveDisclosureCap', () => {
  it('prefers runtime privacy settings over config json', () => {
    expect(resolveEffectiveDisclosureCap({
      latestConfig: {
        config_json: {
          privacy: {
            public_disclosure_cap: 3,
          },
        },
      },
      privacySettings: {
        public_disclosure_cap: 1,
      },
    })).toBe(1)
  })

  it('falls back to config json when runtime privacy settings are unavailable', () => {
    expect(resolveEffectiveDisclosureCap({
      latestConfig: {
        config_json: {
          privacy: {
            public_disclosure_cap: 2,
          },
        },
      },
      privacySettings: null,
    })).toBe(2)
  })

  it('returns null when neither source exposes a cap', () => {
    expect(resolveEffectiveDisclosureCap({
      latestConfig: { config_json: {} },
      privacySettings: null,
    })).toBeNull()
  })
})
