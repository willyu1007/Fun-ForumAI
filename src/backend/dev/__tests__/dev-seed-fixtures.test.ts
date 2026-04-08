import { describe, expect, it } from 'vitest'
import { CREATOR_MAIN_THREAD_INTERACTION_CONTRACT } from '../../../shared/semantic-taxonomy.js'
import { DEV_SEED_STAGE_SPEC, getDevSeedFixtureSet } from '../dev-seed-fixtures.js'

describe('dev seed fixtures', () => {
  it('preserves creator interaction contracts while relaxing stage gates for canonical seed communities', () => {
    const fixtures = getDevSeedFixtureSet('canonical')
    const creatorCommunities = fixtures.communities.filter((community) =>
      community.slug === 'creator-recommendation' || community.slug === 'creator-relationship')

    expect(creatorCommunities).toHaveLength(2)
    for (const community of creatorCommunities) {
      expect(community.rules_json).toMatchObject({
        stage_spec_v1: {
          min_tier_pool: DEV_SEED_STAGE_SPEC.min_tier_pool,
          tier_gate: {
            resident_min_tier: DEV_SEED_STAGE_SPEC.tier_gate.resident_min_tier,
            core_min_tier: DEV_SEED_STAGE_SPEC.tier_gate.core_min_tier,
            strict_publication_longform_min_tier:
              DEV_SEED_STAGE_SPEC.tier_gate.strict_publication_longform_min_tier,
          },
          strict_publication: {
            enabled: false,
          },
          human_participation: CREATOR_MAIN_THREAD_INTERACTION_CONTRACT,
        },
      })
    }
  })
})
