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
  it('normalizes legacy top-level stage patches into stage_spec_v1 before persisting', async () => {
    const { service, communityRepo, configRepo } = createService()
    const community = createTestCommunity(communityRepo)

    const proposal = await service.createProposal({
      community_id: community.id,
      patch: {
        aftershow: {
          mode: 'THRESHOLD',
          threshold: {
            audience_comments: 1,
            human_vote_score: 0,
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

  it('classifies stage_spec_v1.human_participation changes as HIGH risk', async () => {
    const { service, communityRepo } = createService()
    const community = createTestCommunity(communityRepo)

    const proposal = await service.createProposal({
      community_id: community.id,
      patch: {
        stage_spec_v1: {
          human_participation: {
            agent_reads_audience_zone: true,
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
            agent_reads_audience_zone: true,
          },
        },
      },
      proposed_by_user_id: 'user1',
      risk_level: 'LOW',
    })

    expect(proposal.risk_level).toBe('HIGH')
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
      message: 'stage_spec_v1 cannot be combined with top-level stage spec fields in the same patch',
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
})
