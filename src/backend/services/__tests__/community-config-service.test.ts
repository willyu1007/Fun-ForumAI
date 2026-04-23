import { describe, expect, it } from 'vitest'
import {
  InMemoryCommunityConfigRepository,
  InMemoryCommunityRepository,
  InMemoryEventRepository,
} from '../../repos/index.js'
import { DEFAULT_STAGE_SPEC_V1 } from '../../stage/index.js'
import { CommunityConfigService } from '../community-config-service.js'

function createService() {
  const communityRepo = new InMemoryCommunityRepository()
  const configRepo = new InMemoryCommunityConfigRepository()
  const eventRepo = new InMemoryEventRepository()
  const service = new CommunityConfigService({
    communityRepo,
    configRepo,
    eventRepo,
  })

  return {
    service,
    communityRepo,
    configRepo,
  }
}

function createTestCommunity(repo: InMemoryCommunityRepository) {
  return repo.create({
    name: 'Config Service Community',
    slug: `config-service-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rules_json: {
      stage_spec_v1: DEFAULT_STAGE_SPEC_V1,
    },
  })
}

describe('CommunityConfigService', () => {
  it('persists canonical stage_spec_v1 patches without introducing top-level stage fields', async () => {
    const { service, communityRepo, configRepo } = createService()
    const community = createTestCommunity(communityRepo)

    const proposal = await service.createProposal({
      community_id: community.id,
      patch: {
        stage_spec_v1: {
          aftershow: {
            mode: 'THRESHOLD',
            threshold: {
              audience_comments: 1,
              human_vote_score: 0,
            },
          },
        },
      },
      proposed_by_user_id: 'user1',
    })

    expect(proposal.patch_json).toEqual({
      stage_spec_v1: {
        aftershow: {
          mode: 'THRESHOLD',
          threshold: {
            audience_comments: 1,
            human_vote_score: 0,
          },
        },
      },
    })
    expect(proposal.proposed_rules_json?.stage_spec_v1).toMatchObject({
      aftershow: {
        mode: 'THRESHOLD',
        threshold: {
          audience_comments: 1,
          human_vote_score: 0,
        },
      },
    })
    expect(proposal.proposed_rules_json).not.toHaveProperty('aftershow')

    const stored = await configRepo.findPatchById(proposal.id)
    expect(stored?.patch_json).toEqual(proposal.patch_json)
    expect(stored?.proposed_rules_json?.stage_spec_v1).toMatchObject({
      aftershow: {
        mode: 'THRESHOLD',
        threshold: {
          audience_comments: 1,
          human_vote_score: 0,
        },
      },
    })
  })

  it('rejects legacy top-level stage fields in incoming patches', async () => {
    const { service, communityRepo } = createService()
    const community = createTestCommunity(communityRepo)

    await expect(service.createProposal({
      community_id: community.id,
      patch: {
        aftershow: {
          threshold: {
            audience_comments: 1,
            human_vote_score: 0,
          },
        },
      },
      proposed_by_user_id: 'user1',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'top-level stage spec fields are no longer accepted; nest them under stage_spec_v1',
    })
  })

  it('classifies stage_spec_v1.human_participation changes as HIGH risk', async () => {
    const { service, communityRepo } = createService()
    const community = createTestCommunity(communityRepo)

    const proposal = await service.createProposal({
      community_id: community.id,
      patch: {
        stage_spec_v1: {
          human_participation: {
            public_participation_mode: 'audience_sidecar',
            audience_signal_ingestion: 'direct_read',
            agent_human_response_mode: 'aftershow_only',
          },
        },
      },
      proposed_by_user_id: 'user1',
    })

    expect(proposal.risk_level).toBe('HIGH')
  })

  it('does not allow explicit LOW risk to downgrade normalized high-risk paths', async () => {
    const { service, communityRepo } = createService()
    const community = createTestCommunity(communityRepo)

    const proposal = await service.createProposal({
      community_id: community.id,
      patch: {
        stage_spec_v1: {
          human_participation: {
            public_participation_mode: 'audience_sidecar',
            audience_signal_ingestion: 'direct_read',
            agent_human_response_mode: 'aftershow_only',
          },
        },
      },
      proposed_by_user_id: 'user1',
      risk_level: 'LOW',
    })

    expect(proposal.risk_level).toBe('HIGH')
  })

  it('merges launch_profile.community_family patches into proposed rules', async () => {
    const { service, communityRepo } = createService()
    const community = createTestCommunity(communityRepo)

    const proposal = await service.createProposal({
      community_id: community.id,
      patch: {
        launch_profile: {
          community_family: 'creator_relationship',
        },
      },
      proposed_by_user_id: 'user1',
    })

    expect(proposal.patch_json).toEqual({
      launch_profile: {
        community_family: 'creator_relationship',
      },
    })
    expect(proposal.proposed_rules_json?.launch_profile).toMatchObject({
      community_family: 'creator_relationship',
    })
  })

  it('rejects mixed stage_spec_v1 and legacy top-level stage fields in a single patch', async () => {
    const { service, communityRepo } = createService()
    const community = createTestCommunity(communityRepo)

    await expect(service.createProposal({
      community_id: community.id,
      patch: {
        stage_spec_v1: {
          aftershow: {
            mode: 'THRESHOLD',
          },
        },
        aftershow: {
          threshold: {
            audience_comments: 1,
            human_vote_score: 0,
          },
        },
      },
      proposed_by_user_id: 'user1',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'top-level stage spec fields are no longer accepted; nest them under stage_spec_v1',
    })
  })

  it('rejects proposals whose final allocator config exceeds the community-wide agent cap', async () => {
    const { service, communityRepo } = createService()
    const community = createTestCommunity(communityRepo)

    const proposal = await service.createProposal({
      community_id: community.id,
      patch: {
        stage_spec_v1: {
          allocator: {
            community_max_agents: 1,
            thread_max_agents: 10,
          },
        },
      },
      proposed_by_user_id: 'user1',
    })

    const result = await service.validateProposal({
      proposal_id: proposal.id,
      actor_user_id: 'user1',
    })

    expect(result.patch.status).toBe('REJECTED')
    expect(result.validation_errors).toContain(
      'stage_spec_v1.allocator.thread_max_agents must be <= stage_spec_v1.allocator.community_max_agents',
    )
  })

  it('does not reject default allocator capacity when validating a normal proposal', async () => {
    const { service, communityRepo } = createService()
    const community = createTestCommunity(communityRepo)

    const proposal = await service.createProposal({
      community_id: community.id,
      patch: {
        stage_spec_v1: {
          moderation: {
            premod_required: false,
          },
        },
      },
      proposed_by_user_id: 'user1',
    })

    const result = await service.validateProposal({
      proposal_id: proposal.id,
      actor_user_id: 'user1',
    })

    expect(result.patch.status).toBe('VALIDATED')
    expect(result.validation_errors).toEqual([])
  })

  it('classifies hot_topic_policy_v1 changes as HIGH risk', async () => {
    const { service, communityRepo } = createService()
    const community = createTestCommunity(communityRepo)

    const proposal = await service.createProposal({
      community_id: community.id,
      patch: {
        hot_topic_policy_v1: {
          mode: 'MANUAL_REVIEW_ONLY',
          allowed_domains: ['ENTERTAINMENT'],
          scene_modes: {},
          user_copy: {
            summary: '热点先走灰度复核',
          },
        },
      },
      proposed_by_user_id: 'user1',
    })

    expect(proposal.risk_level).toBe('HIGH')
  })

  it('rejects invalid hot_topic_policy_v1 mode during validation', async () => {
    const { service, communityRepo } = createService()
    const community = createTestCommunity(communityRepo)

    const proposal = await service.createProposal({
      community_id: community.id,
      patch: {
        hot_topic_policy_v1: {
          mode: 'FREEZE',
          allowed_domains: ['ENTERTAINMENT'],
          scene_modes: {},
          user_copy: {},
        } as never,
      },
      proposed_by_user_id: 'user1',
    })

    const result = await service.validateProposal({
      proposal_id: proposal.id,
      actor_user_id: 'user1',
    })

    expect(result.patch.status).toBe('REJECTED')
    expect(result.validation_errors).toContain(
      'hot_topic_policy_v1.mode must be NORMAL, MANUAL_REVIEW_ONLY, or DISABLED',
    )
  })
})
