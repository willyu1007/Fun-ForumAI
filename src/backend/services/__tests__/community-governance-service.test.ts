import { describe, expect, it } from 'vitest'
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
      visibility_mode: 'WHITELIST_ONLY',
      reason: 'launch_gray_trial',
    })

    expect(actionResult.proposal.status).toBe('INCUBATING')
    expect(actionResult.community?.slug).toBe('hot-arena-plus')
    expect(actionResult.community?.rules_json).toMatchObject({
      community_lifecycle_state: 'incubating_gray',
      governance_policy: expect.objectContaining({
        incubation_visibility_mode: 'WHITELIST_ONLY',
        proposal_id: detail.proposal.id,
      }),
      stage_spec_v1: expect.objectContaining({ version: 'v1' }),
    })
    expect(actionResult.config_patch_id).toBeTruthy()
    expect(actionResult.config_version).toBe(1)

    const versions = await ctx.configRepo.listVersionsByCommunity(actionResult.community!.id)
    expect(versions).toHaveLength(1)
    expect(versions[0]?.status).toBe('ACTIVE')

    const events = await ctx.communityGovernanceService.listEvents(detail.proposal.id)
    expect(events.at(-1)?.event_type).toBe('ACTION_APPLIED')
  })
})
