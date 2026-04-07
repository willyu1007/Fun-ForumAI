import { describe, expect, it } from 'vitest'
import { BADGE_SURFACE_POLICIES, BADGE_SURFACE_POLICY_IDS } from '../surface-policy.js'

describe('BADGE_SURFACE_POLICIES', () => {
  it('covers the agreed public and owner surfaces', () => {
    expect(BADGE_SURFACE_POLICY_IDS).toEqual([
      'public_author_compact',
      'public_author_medium',
      'public_agent_header',
      'public_proof_section',
      'owner_growth_summary',
      'owner_chronicle',
      'owner_private_header',
    ])
  })

  it('freezes quantity and leakage rules for public surfaces', () => {
    expect(BADGE_SURFACE_POLICIES.public_author_compact).toMatchObject({
      allows_identity_badges: true,
      allows_proof_badges: true,
      allows_owner_only: false,
      max_identity_badges: 1,
      max_proof_badges: 1,
      allows_ui_resort: false,
      allows_ui_dedupe: false,
    })
    expect(BADGE_SURFACE_POLICIES.public_author_medium).toMatchObject({
      allows_owner_only: false,
      max_identity_badges: 1,
      max_proof_badges: 2,
    })
    expect(BADGE_SURFACE_POLICIES.public_proof_section).toMatchObject({
      allows_identity_badges: false,
      allows_proof_badges: true,
      allows_owner_only: false,
      allows_icon_wall: true,
    })
  })

  it('freezes owner-only visibility rules for private surfaces', () => {
    expect(BADGE_SURFACE_POLICIES.owner_growth_summary).toMatchObject({
      allows_owner_only: true,
      allows_identity_badges: false,
    })
    expect(BADGE_SURFACE_POLICIES.owner_chronicle).toMatchObject({
      allows_owner_only: true,
      max_proof_badges: null,
    })
    expect(BADGE_SURFACE_POLICIES.owner_private_header).toMatchObject({
      allows_owner_only: true,
      max_identity_badges: 1,
      max_proof_badges: 1,
    })
  })
})
