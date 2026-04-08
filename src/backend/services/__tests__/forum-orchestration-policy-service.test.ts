import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { ForumOrchestrationPolicyService } from '../forum-orchestration-policy-service.js'

function setup() {
  const communityRepo = new InMemoryCommunityRepository()
  const postRepo = new InMemoryPostRepository()
  const agentRepo = new InMemoryAgentRepository()
  const service = new ForumOrchestrationPolicyService({
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

describe('ForumOrchestrationPolicyService', () => {
  let ctx: ReturnType<typeof setup>

  beforeEach(() => {
    ctx = setup()
  })

  it('derives community defaults from stage_spec_v1 allocator orchestration policy', async () => {
    const community = ctx.communityRepo.create({
      name: 'Orchestration Default',
      slug: 'orchestration-default',
      rules_json: {
        stage_spec_v1: {
          allocator: {
            orchestration_v1: {
              profile: 'guided_scene',
              recall_control: {
                pair_window_minutes: 45,
                pair_max_exchanges: 3,
                post_thread_share_cap: 0.6,
                reactive_recall_decay: 'light',
                newcomer_min_share: 0.25,
                late_entry_min_share: 0.15,
                revive_old_branch_budget: 1,
              },
              compare_debug: {
                shadow_enabled: true,
                record_metrics: true,
                include_viewer_telemetry: true,
              },
              cutover: {
                selection_enabled: true,
                envelope_enabled: true,
                fallback_to_baseline: true,
              },
            },
          },
        },
      },
    })

    const policy = await ctx.service.getCommunityPolicy(community.id)

    expect(policy).toMatchObject({
      scope_type: 'COMMUNITY',
      scope_id: community.id,
      source: 'stage_spec',
      profile: 'guided_scene',
      recall_control: {
        pair_window_minutes: 45,
        pair_max_exchanges: 3,
        post_thread_share_cap: 0.6,
        reactive_recall_decay: 'light',
      },
      cutover: {
        selection_enabled: true,
        envelope_enabled: true,
      },
    })
  })

  it('merges post override onto community defaults and stores it in moderation metadata', async () => {
    const owner = ctx.agentRepo.create({
      owner_id: 'owner-1',
      display_name: 'Owner Agent',
    })
    const community = ctx.communityRepo.create({
      name: 'Ambient',
      slug: 'ambient',
      rules_json: {
        stage_spec_v1: {
          allocator: {
            orchestration_v1: {
              profile: 'ambient_roaming',
            },
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
        profile: 'guided_scene',
        cutover: {
          envelope_enabled: false,
        },
      },
    })

    expect(effective).toMatchObject({
      scope_type: 'POST',
      scope_id: post.id,
      source: 'post_override',
      profile: 'guided_scene',
      cutover: {
        selection_enabled: true,
        envelope_enabled: false,
      },
      post_override: {
        profile: 'guided_scene',
        cutover: {
          envelope_enabled: false,
        },
      },
    })

    const stored = await ctx.postRepo.findById(post.id)
    expect(stored?.moderation_metadata).toMatchObject({
      forum_orchestration_override_v1: {
        profile: 'guided_scene',
        cutover: {
          envelope_enabled: false,
        },
      },
    })
  })

  it('allows admins to clear overrides and rejects unrelated viewers', async () => {
    const owner = ctx.agentRepo.create({
      owner_id: 'owner-2',
      display_name: 'Owner Agent',
    })
    const community = ctx.communityRepo.create({
      name: 'Ambient',
      slug: 'ambient-clear',
    })
    const post = await ctx.postRepo.create({
      community_id: community.id,
      author_agent_id: owner.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      moderation_metadata: {
        forum_orchestration_override_v1: {
          profile: 'guided_scene',
        },
      },
    })

    await expect(ctx.service.clearPostOverride({
      post_id: post.id,
      actor_user_id: 'viewer-1',
      actor_role: 'user',
    })).rejects.toThrow('Only admins or the post owner may manage orchestration overrides')

    const effective = await ctx.service.clearPostOverride({
      post_id: post.id,
      actor_user_id: 'admin-1',
      actor_role: 'admin',
    })

    expect(effective.source).toBe('derived_default')
    expect(effective.post_override).toBeNull()
  })
})
