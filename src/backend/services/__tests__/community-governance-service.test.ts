import { describe, expect, it } from 'vitest'
import { config } from '../../lib/config.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryCommunityProposalRepository } from '../../repos/community-proposal-repository.js'
import { InMemoryCommunityConfigRepository } from '../../repos/community-config-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { CommunityConfigService } from '../community-config-service.js'
import { CommunityGovernanceService } from '../community-governance-service.js'
import { listLaunchCommunitySeeds } from '../../launch/community-rules.js'

function setup() {
  const communityRepo = new InMemoryCommunityRepository()
  const communityProposalRepo = new InMemoryCommunityProposalRepository()
  const configRepo = new InMemoryCommunityConfigRepository()
  const eventRepo = new InMemoryEventRepository()
  const communityConfigService = new CommunityConfigService({
    communityRepo,
    configRepo,
    eventRepo,
  })
  const communityGovernanceService = new CommunityGovernanceService({
    communityRepo,
    communityProposalRepo,
    communityConfigService,
  })
  return {
    communityRepo,
    communityProposalRepo,
    configRepo,
    eventRepo,
    communityGovernanceService,
  }
}

describe('community governance service', () => {
  it('submits proposals, computes merge recommendation, and incubates into config history', async () => {
    const ctx = setup()
    for (const seed of listLaunchCommunitySeeds().slice(0, 2)) {
      ctx.communityRepo.create({
        name: seed.name,
        slug: seed.slug,
        description: seed.description,
        rules_json: seed.rules_json,
      })
    }

    const detail = await ctx.communityGovernanceService.submitProposal({
      submitted_by_user_id: 'user-1',
      name: '热点擂台加演',
      slug_candidate: 'hot-arena-plus',
      description: '把热点冲突继续做成一档灰度加演节目。',
      premise_text: '围绕热点擂台延伸新的冲突加演。',
      scene_types: ['DEBATE', 'TALK_SHOW'],
      t4_candidate: false,
    })

    expect(detail.proposal.status).toBe('SUBMITTED')
    expect(detail.recommendation).toBeTruthy()
    expect(detail.events.map((event) => event.event_type)).toEqual([
      'PROPOSAL_SUBMITTED',
      'RECOMMENDATION_REFRESHED',
    ])

    const actionResult = await ctx.communityGovernanceService.applyAction({
      proposal_id: detail.proposal.id,
      action: 'incubate',
      actor_user_id: 'admin-1',
      actor_role: 'admin',
      incubation_visibility_mode: 'WHITELIST_ONLY',
      reason: 'launch_gray_trial',
    })

    expect(actionResult.proposal.status).toBe('INCUBATING')
    expect(actionResult.community?.slug).toBe('hot-arena-plus')
    expect(actionResult.community?.rules_json).toMatchObject({
      community_lifecycle_state: 'incubating_gray',
      launch_profile: expect.objectContaining({
        community_family: 'weekly_program',
        launch_wave: 'incubating_gray',
      }),
      governance_policy: expect.objectContaining({
        incubation_visibility_mode: 'WHITELIST_ONLY',
        proposal_id: detail.proposal.id,
      }),
      stage_spec_v1: expect.objectContaining({ version: 'v1' }),
    })
    expect((actionResult.community?.rules_json.launch_profile as Record<string, unknown>)?.community_type).toBeUndefined()
    expect((actionResult.community?.rules_json.launch_profile as Record<string, unknown>)?.launch_phase).toBeUndefined()
    expect(actionResult.config_patch_id).toBeTruthy()
    expect(actionResult.config_version).toBe(1)

    const versions = await ctx.configRepo.listVersionsByCommunity(actionResult.community!.id)
    expect(versions).toHaveLength(1)
    expect(versions[0]?.status).toBe('ACTIVE')

    const events = await ctx.communityGovernanceService.listEvents(detail.proposal.id)
    expect(events.at(-1)?.event_type).toBe('ACTION_APPLIED')
  })

  it('uses the active post-launch tuning profile for incubation recommendation thresholds', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const tuningConfig = config.launchTuning as unknown as Record<string, string>
    const originalTuningFlag = featureFlags.postLaunchTuningV1
    const originalActiveProfile = tuningConfig.activeProfile
    featureFlags.postLaunchTuningV1 = true
    tuningConfig.activeProfile = 'creator_note_focus'

    try {
      const ctx = setup()
      for (const seed of listLaunchCommunitySeeds().slice(0, 2)) {
        ctx.communityRepo.create({
          name: seed.name,
          slug: seed.slug,
          description: seed.description,
          rules_json: seed.rules_json,
        })
      }

      const detail = await ctx.communityGovernanceService.submitProposal({
        submitted_by_user_id: 'user-1',
        name: '灰度互动关系台',
        slug_candidate: 'gray-relations-lab',
        description: '给关系向节目做灰度 incubation。',
        premise_text: '先在灰度观察期里验证关系线是否值得转正。',
        scene_types: ['TALK_SHOW'],
        t4_candidate: true,
      })

      expect(detail.recommendation?.meta).toMatchObject({
        thresholds: {
          merge_threshold: 4.2,
          lane_threshold: 2.2,
          gray_visibility_threshold: 1.7,
        },
      })
    } finally {
      featureFlags.postLaunchTuningV1 = originalTuningFlag
      tuningConfig.activeProfile = originalActiveProfile
    }
  })
})
