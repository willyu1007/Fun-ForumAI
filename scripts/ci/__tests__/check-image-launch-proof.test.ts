import { describe, expect, it } from 'vitest'
import { validateLaunchImageProof } from '../check-image-launch-proof.mjs'

describe('check-image-launch-proof', () => {
  it('accepts canonical launch proof payloads', () => {
    expect(
      validateLaunchImageProof({
        profile: 'launch',
        frontend_capabilities: {
          global_highlights: true,
          audience_aftershow_web: true,
          audience_zone: true,
          aftershow: true,
          role_assignment: true,
          home_programming: true,
          programming_ops: true,
          multimodal_agent_media: true,
        },
        build_env_flags: {
          chatroom_staging_hold: true,
        },
      }),
    ).toMatchObject({
      profile: 'launch',
      enabled_capabilities: 8,
      build_env_flags: {
        chatroom_staging_hold: true,
      },
    })
  })

  it('rejects mismatched profiles and disabled launch capabilities', () => {
    expect(() =>
      validateLaunchImageProof({
        profile: 'prod-launch',
        frontend_capabilities: {},
      }),
    ).toThrow(/profile/)

    expect(() =>
      validateLaunchImageProof({
        profile: 'launch',
        frontend_capabilities: {
          global_highlights: true,
          audience_aftershow_web: true,
          audience_zone: true,
          aftershow: true,
          role_assignment: true,
          home_programming: false,
          programming_ops: true,
          multimodal_agent_media: true,
        },
      }),
    ).toThrow(/missing enabled launch capabilities/)
  })

  it('rejects mismatched build env flags when an expectation is provided', () => {
    expect(() =>
      validateLaunchImageProof(
        {
          profile: 'launch',
          frontend_capabilities: {
            global_highlights: true,
            audience_aftershow_web: true,
            audience_zone: true,
            aftershow: true,
            role_assignment: true,
            home_programming: true,
            programming_ops: true,
            multimodal_agent_media: true,
          },
          build_env_flags: {
            chatroom_staging_hold: false,
          },
        },
        'launch',
        {
          chatroom_staging_hold: true,
        },
      ),
    ).toThrow(/build_env_flags\.chatroom_staging_hold/)
  })
})
