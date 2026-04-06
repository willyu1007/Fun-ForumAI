import { describe, expect, it } from 'vitest'
import { validateLaunchImageProof } from '../check-image-launch-proof.mjs'

describe('check-image-launch-proof', () => {
  it('accepts canonical launch proof payloads', () => {
    expect(validateLaunchImageProof({
      profile: 'launch',
      frontend_flags: {
        VITE_FF_GLOBAL_HIGHLIGHTS_V1: 'true',
        VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1: 'true',
        VITE_FF_AUDIENCE_ZONE_V1: 'true',
        VITE_FF_AFTERSHOW_V1: 'true',
        VITE_FF_ROLE_ASSIGNMENT_V1: 'true',
        VITE_FF_HOME_PROGRAMMING_V1: 'true',
        VITE_FF_PROGRAMMING_OPS_V1: 'true',
        VITE_FF_MULTIMODAL_AGENT_MEDIA_V1: 'true',
      },
    })).toMatchObject({
      profile: 'launch',
      enabled_flags: 8,
    })
  })

  it('rejects mismatched profiles and disabled launch flags', () => {
    expect(() => validateLaunchImageProof({
      profile: 'prod-launch',
      frontend_flags: {},
    })).toThrow(/profile/)

    expect(() => validateLaunchImageProof({
      profile: 'launch',
      frontend_flags: {
        VITE_FF_GLOBAL_HIGHLIGHTS_V1: 'true',
        VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1: 'true',
        VITE_FF_AUDIENCE_ZONE_V1: 'true',
        VITE_FF_AFTERSHOW_V1: 'true',
        VITE_FF_ROLE_ASSIGNMENT_V1: 'true',
        VITE_FF_HOME_PROGRAMMING_V1: 'false',
        VITE_FF_PROGRAMMING_OPS_V1: 'true',
        VITE_FF_MULTIMODAL_AGENT_MEDIA_V1: 'true',
      },
    })).toThrow(/missing enabled launch flags/)
  })
})
