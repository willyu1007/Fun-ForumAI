import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { ParticipationContractService } from '../participation-contract-service.js'

function setup() {
  const communityRepo = new InMemoryCommunityRepository()
  const postRepo = new InMemoryPostRepository()
  const agentRepo = new InMemoryAgentRepository()
  const service = new ParticipationContractService({
    communityRepo,
    postRepo,
    agentRepo,
  })

  return {
    communityRepo,
    postRepo,
    agentRepo,
    service,
  }
}

describe('ParticipationContractService', () => {
  let ctx: ReturnType<typeof setup>

  beforeEach(() => {
    ctx = setup()
  })

  it('derives community defaults into the nested contract shape', async () => {
    const community = ctx.communityRepo.create({
      name: 'Open Reply',
      slug: 'open-reply',
      rules_json: {
        stage_spec_v1: {
          human_participation: {
            public_participation_mode: 'open_reply',
            audience_signal_ingestion: 'direct_read',
            agent_human_response_mode: 'direct_reply',
          },
        },
      },
    })

    const contract = await ctx.service.getCommunityContract(community.id)

    expect(contract).toMatchObject({
      scope_type: 'COMMUNITY',
      scope_id: community.id,
      public_participation_mode: 'open_reply',
      audience_signal_ingestion: 'direct_read',
      agent_human_response_mode: 'direct_reply',
      stage_open_reply: {
        enabled: true,
        new_thread_enabled: true,
        turn_reply_enabled: true,
      },
      audience_lane: {
        enabled: true,
        posting_enabled: false,
      },
    })
  })

  it('uses audience-sidecar defaults when the community has no explicit human participation rules', async () => {
    const community = ctx.communityRepo.create({
      name: 'Derived Default',
      slug: 'derived-default',
    })

    const contract = await ctx.service.getCommunityContract(community.id)

    expect(contract).toMatchObject({
      scope_type: 'COMMUNITY',
      scope_id: community.id,
      source: 'derived_default',
      public_participation_mode: 'audience_sidecar',
      audience_signal_ingestion: 'summary_only',
      agent_human_response_mode: 'aftershow_only',
      stage_open_reply: {
        enabled: false,
        new_thread_enabled: false,
        turn_reply_enabled: false,
      },
      audience_lane: {
        enabled: true,
        posting_enabled: true,
      },
    })
  })

  it('merges post overrides into the effective contract and stores them on the v1 override key', async () => {
    const owner = ctx.agentRepo.create({
      owner_id: 'owner-1',
      display_name: 'Owner Agent',
    })
    const community = ctx.communityRepo.create({
      name: 'Audience Sidecar',
      slug: 'audience-sidecar',
      rules_json: {
        stage_spec_v1: {
          human_participation: {
            public_participation_mode: 'audience_sidecar',
            audience_signal_ingestion: 'summary_only',
            agent_human_response_mode: 'aftershow_only',
          },
        },
      },
    })
    const post = await ctx.postRepo.create({
      community_id: community.id,
      author_agent_id: owner.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const effective = await ctx.service.setPostOverride({
      post_id: post.id,
      actor_user_id: 'owner-1',
      actor_role: 'user',
      override: {
        public_participation_mode: 'open_reply',
        stage_open_reply: {
          turn_reply_enabled: false,
        },
      },
    })

    expect(effective).toMatchObject({
      scope_type: 'POST',
      scope_id: post.id,
      source: 'post_override',
      public_participation_mode: 'open_reply',
      stage_open_reply: {
        enabled: true,
        new_thread_enabled: true,
        turn_reply_enabled: false,
      },
      audience_lane: {
        enabled: true,
        posting_enabled: false,
      },
      post_override: {
        public_participation_mode: 'open_reply',
        stage_open_reply: {
          turn_reply_enabled: false,
        },
      },
    })

    const stored = await ctx.postRepo.findById(post.id)
    expect(stored?.moderation_metadata).toMatchObject({
      participation_contract_override_v1: {
        public_participation_mode: 'open_reply',
        stage_open_reply: {
          turn_reply_enabled: false,
        },
      },
    })
    expect(stored?.moderation_metadata?.participation_contract).toBeUndefined()
  })

  it('clears post overrides for the post owner', async () => {
    const owner = ctx.agentRepo.create({
      owner_id: 'owner-2',
      display_name: 'Owner Agent',
    })
    const community = ctx.communityRepo.create({
      name: 'Open Reply',
      slug: 'open-reply-clear',
      rules_json: {
        stage_spec_v1: {
          human_participation: {
            public_participation_mode: 'open_reply',
            audience_signal_ingestion: 'direct_read',
            agent_human_response_mode: 'direct_reply',
          },
        },
      },
    })
    const post = await ctx.postRepo.create({
      community_id: community.id,
      author_agent_id: owner.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      moderation_metadata: {
        participation_contract_override_v1: {
          public_participation_mode: 'audience_sidecar',
          audience_lane: {
            posting_enabled: true,
          },
        },
      },
    })

    const effective = await ctx.service.clearPostOverride({
      post_id: post.id,
      actor_user_id: 'owner-2',
      actor_role: 'user',
    })

    expect(effective.source).toBe('community_rules')
    expect(effective.post_override).toBeNull()

    const stored = await ctx.postRepo.findById(post.id)
    expect(stored?.moderation_metadata?.participation_contract_override_v1).toBeUndefined()
  })

  it('reads legacy post overrides and rewrites them onto the new metadata key', async () => {
    const owner = ctx.agentRepo.create({
      owner_id: 'owner-3',
      display_name: 'Owner Agent',
    })
    const community = ctx.communityRepo.create({
      name: 'Legacy Override',
      slug: 'legacy-override',
    })
    const post = await ctx.postRepo.create({
      community_id: community.id,
      author_agent_id: owner.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      moderation_metadata: {
        participation_contract: {
          public_participation_mode: 'audience_sidecar',
          audience_lane: {
            posting_enabled: true,
          },
        },
      },
    })

    const effective = await ctx.service.getPostContract(post.id)

    expect(effective.post_override).toMatchObject({
      public_participation_mode: 'audience_sidecar',
      audience_lane: {
        posting_enabled: true,
      },
    })

    const stored = await ctx.postRepo.findById(post.id)
    expect(stored?.moderation_metadata).toMatchObject({
      participation_contract_override_v1: {
        public_participation_mode: 'audience_sidecar',
        audience_lane: {
          posting_enabled: true,
        },
      },
    })
    expect(stored?.moderation_metadata?.participation_contract).toBeUndefined()
  })

  it('allows admins to manage overrides but rejects unrelated viewers', async () => {
    const owner = ctx.agentRepo.create({
      owner_id: 'owner-4',
      display_name: 'Owner Agent',
    })
    const community = ctx.communityRepo.create({
      name: 'Permissions',
      slug: 'permissions',
    })
    const post = await ctx.postRepo.create({
      community_id: community.id,
      author_agent_id: owner.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    await expect(ctx.service.setPostOverride({
      post_id: post.id,
      actor_user_id: 'admin-1',
      actor_role: 'admin',
      override: {
        public_participation_mode: 'audience_sidecar',
      },
    })).resolves.toMatchObject({
      source: 'post_override',
    })

    await expect(ctx.service.setPostOverride({
      post_id: post.id,
      actor_user_id: 'viewer-1',
      actor_role: 'user',
      override: {
        public_participation_mode: 'open_reply',
      },
    })).rejects.toThrow('Only admins or the post owner may manage participation overrides')
  })
})
