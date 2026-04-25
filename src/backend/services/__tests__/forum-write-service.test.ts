import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ForumWriteService, type ModerationEvaluator } from '../forum-write-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryEventRepository, InMemoryAgentRunRepository } from '../../repos/event-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryAgentCommunityMembershipRepository } from '../../repos/agent-community-membership-repository.js'
import { InMemoryIncubationRepository } from '../../repos/incubation-repository.js'
import { InMemoryRoleAssignmentRepository } from '../../repos/role-assignment-repository.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import { InMemoryPublicSceneWriteRepository } from '../../repos/public-scene-write-repository.js'
import { InMemoryPublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import type { ModerationResult } from '../../moderation/types.js'
import { config } from '../../lib/config.js'
import { InMemoryPublicStageStore } from '../../test-support/public-stage-store.js'

const CLEAN_RESULT: ModerationResult = {
  risk_level: 'low',
  risk_score: 0,
  risk_categories: ['clean'],
  visibility: 'PUBLIC',
  state: 'APPROVED',
  verdict: 'APPROVE',
  details: {
    rule_filter: { passed: true, matched_rules: [] },
    classifier_score: 0,
    classifier_categories: ['clean'],
    decision_reason: 'clean content',
    fail_closed: false,
  },
}

const GRAY_RESULT: ModerationResult = {
  ...CLEAN_RESULT,
  risk_level: 'medium',
  risk_score: 0.5,
  visibility: 'GRAY',
  state: 'PENDING',
  verdict: 'FOLD',
}

function buildStrictPublicationStageSpec() {
  return {
    version: 'v1',
    min_tier_pool: 'T1',
    roles: {
      resident: { min_tier: 'T1', runtime_gate: true },
      guest: { min_tier: 'T1', runtime_gate: true },
      core: { min_tier: 'T1', runtime_gate: true },
    },
    tier_gate: {
      resident_min_tier: 'T1',
      core_min_tier: 'T1',
      strict_publication_longform_min_tier: 'T1',
    },
    strict_publication: {
      enabled: true,
      premod_required: true,
      min_sources: 2,
      grant_required: true,
      max_ttl_hours: 168,
      redaction: 'strong',
    },
    aftershow: {
      enabled: false,
      mode: 'OFF',
      threshold: {
        audience_comments: 30,
        human_vote_score: 10,
      },
      periodic: {
        enabled: false,
        interval_hours: 24,
      },
    },
    human_participation: {
      public_participation_mode: 'audience_sidecar',
      audience_signal_ingestion: 'summary_only',
      agent_human_response_mode: 'aftershow_only',
    },
    incubation: {
      enabled: true,
      seed_source: 'private_digest_only',
      grant_required: true,
      redaction_profile: 'strong',
      research: {
        allow_web_search: true,
        min_sources: 2,
      },
      format: {
        min_words: 600,
        max_words: 2500,
        citation_style: 'endnotes',
      },
    },
  }
}

function setup(modResult: ModerationResult = CLEAN_RESULT) {
  const postRepo = new InMemoryPostRepository()
  const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
  const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
  const commentRepo = new InMemoryPublicStageStore({
    threadRepo: publicStageThreadRepo,
    turnRepo: publicStageTurnRepo,
    postRepo,
  })
  const voteRepo = new InMemoryVoteRepository()
  const eventRepo = new InMemoryEventRepository()
  const agentRunRepo = new InMemoryAgentRunRepository()
  const communityRepo = new InMemoryCommunityRepository()
  const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
  const incubationRepo = new InMemoryIncubationRepository()
  const roleAssignmentRepo = new InMemoryRoleAssignmentRepository()
  const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
  const publicSceneWriteRepo = new InMemoryPublicSceneWriteRepository({
    postRepo,
    publicStageThreadRepo,
    publicStageTurnRepo,
    sceneMetadataRepo: forumSceneMetadataRepo,
    eventRepo,
    agentRunRepo,
  })
  const community = communityRepo.create({
    name: 'Test Community',
    slug: `test-community-${Date.now()}`,
  })
  void membershipRepo.upsertActive({ agent_id: 'a0', community_id: community.id })
  void membershipRepo.upsertActive({ agent_id: 'a1', community_id: community.id })
  void membershipRepo.upsertActive({ agent_id: 'a2', community_id: community.id })
  void membershipRepo.upsertActive({ agent_id: 'a3', community_id: community.id })
  const moderator: ModerationEvaluator = { evaluate: () => modResult }
  const svc = new ForumWriteService({
    postRepo,
    publicStageThreadRepo,
    publicStageTurnRepo,
    publicSceneWriteRepo,
    voteRepo,
    eventRepo,
    agentRunRepo,
    communityRepo,
    membershipRepo,
    roleAssignmentRepo,
    incubationRepo,
    moderator,
  })
  return {
    svc,
    postRepo,
    commentRepo,
    publicStageThreadRepo,
    publicStageTurnRepo,
    voteRepo,
    eventRepo,
    agentRunRepo,
    communityRepo,
    communityId: community.id,
    membershipRepo,
    roleAssignmentRepo,
    incubationRepo,
    forumSceneMetadataRepo,
  }
}

describe('ForumWriteService', () => {
  describe('createPost', () => {
    it('creates a post with moderation results', async () => {
      const { svc, postRepo, eventRepo, communityId } = setup()
      const result = await svc.createPost({
        actor_agent_id: 'a1',
        run_id: 'run_1',
        community_id: communityId,
        title: 'Hello',
        body: 'World',
      })

      expect(result.post.title).toBe('Hello')
      expect(result.post.visibility).toBe('PUBLIC')
      expect(result.post.state).toBe('APPROVED')
      expect(result.moderation.verdict).toBe('APPROVE')
      expect(result.event.event_type).toBe('POST_CREATED')
      expect(result.agentRun.agent_id).toBe('a1')

      expect(await postRepo.findById(result.post.id)).toBeTruthy()
      expect(eventRepo.findById(result.event.id)).toBeTruthy()
    })

    it('records chain_depth in post event payload', async () => {
      const { svc, communityId } = setup()
      const result = await svc.createPost({
        actor_agent_id: 'a1',
        run_id: 'run_chain',
        community_id: communityId,
        title: 'Chain depth',
        body: 'Chain depth body',
        chain_depth: 3,
      })

      expect((result.event.payload_json as Record<string, unknown>).chain_depth).toBe(3)
    })

    it('persists scene sidecar and emits public_scene audit for scene-enabled posts', async () => {
      const { svc, communityId, forumSceneMetadataRepo } = setup()
      const result = await svc.createPost({
        actor_agent_id: 'a1',
        run_id: 'run_scene',
        community_id: communityId,
        title: 'Scene title',
        body: 'Scene body',
        scene: {
          scene_metadata: {
            director_surface: 'scheduled_post',
            actor_surface: 'forum_post',
            scene_template_id: 'stage-theme-01',
            scene_template_version: 'v2',
            scene_binding_id: 'binding-1',
            overlay_id: null,
            episode_id: 'episode-1',
            beat_id: null,
            phase: 'opening',
            selection_mode: 'pool_guided',
            selection_id: 'selection-1',
            episode_plan_id: 'plan-1',
            local_intent_id: 'intent-1',
            started_at: '2026-03-13T00:00:00.000Z',
            expires_at: '2026-03-14T00:00:00.000Z',
          },
          episode_brief: {
            episode_id: 'episode-1',
            director_surface: 'scheduled_post',
            actor_surface: 'forum_post',
            template_id: 'stage-theme-01',
            template_version: 'v2',
            binding_id: 'binding-1',
            phase: 'opening',
            scene_goal: {
              viewer_goal: '推进讨论',
              growth_goal: '增加连贯性',
            },
            casting_directive: {
              must_have_roles: [],
              avoid_pairs: [],
              core_quota: 2,
              contrast_quota: 1,
              wildcard_quota: 1,
            },
            open_loops: [],
            must_hit_points: [],
            avoid_repeat: [],
            close_condition: {
              ttl_hours: 24,
              message_threshold: 12,
              objective: '推进讨论',
            },
            expires_at: '2026-03-14T00:00:00.000Z',
          },
          local_intent: {
            intent_id: 'intent-1',
            delivery_surface: 'forum_post',
            initiative: 'open_topic',
            opinion_policy: 'free_opinion',
            relation_focus: 'none',
            tone_hint: 'neutral',
            privacy_mode: 'public_only',
            memory_scope: 'public_contextual',
            reference_scope: 'episode_public_context',
            prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
            target_ref: { kind: 'none' },
            hard_constraints: ['不得改写目标社区'],
            soft_constraints: ['推进讨论'],
          },
          local_intent_block: '## Local Intent\n- episode_id: episode-1',
          selection_audit: { binding_id: 'binding-1' },
          planning_audit: { episode_id: 'episode-1' },
        },
      })

      const sidecar = await forumSceneMetadataRepo.findByPostId(result.post.id)
      expect(sidecar?.episode_id).toBe('episode-1')
      expect((result.event.payload_json as Record<string, unknown>).public_scene).toBeTruthy()
      expect(result.agentRun.output_json).toMatchObject({
        public_scene: {
          episode_id: 'episode-1',
          selection_id: 'selection-1',
          episode_plan_id: 'plan-1',
          local_intent_id: 'intent-1',
        },
      })
    })

    it('applies moderation visibility when content is risky', async () => {
      const { svc, communityId } = setup(GRAY_RESULT)
      const result = await svc.createPost({
        actor_agent_id: 'a1',
        run_id: 'run_1',
        community_id: communityId,
        title: 'Hello',
        body: 'Some risky content',
      })
      expect(result.post.visibility).toBe('GRAY')
      expect(result.post.state).toBe('PENDING')
    })

    it('throws on empty title', async () => {
      const { svc, communityId } = setup()
      await expect(
        svc.createPost({
          actor_agent_id: 'a1',
          run_id: 'r1',
          community_id: communityId,
          title: '  ',
          body: 'OK',
        }),
      ).rejects.toThrow('Title is required')
    })

    it('throws on empty body', async () => {
      const { svc, communityId } = setup()
      await expect(
        svc.createPost({
          actor_agent_id: 'a1',
          run_id: 'r1',
          community_id: communityId,
          title: 'OK',
          body: '',
        }),
      ).rejects.toThrow('Body is required')
    })

    it('blocks post write when membership status is MUTED', async () => {
      const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
      const originalMembershipStatus = featureFlags.membershipStatusV1
      featureFlags.membershipStatusV1 = true

      try {
        const { svc, communityId, membershipRepo } = setup()
        await membershipRepo.updateStatus({
          agent_id: 'a1',
          community_id: communityId,
          status: 'MUTED',
          reason: 'test',
          set_by: 'admin',
        })

        await expect(
          svc.createPost({
            actor_agent_id: 'a1',
            run_id: 'r-muted',
            community_id: communityId,
            title: 'Muted title',
            body: 'Muted body',
          }),
        ).rejects.toThrow('cannot write runtime content')
      } finally {
        featureFlags.membershipStatusV1 = originalMembershipStatus
      }
    })

    it('ignores unknown assigned role keys and still enforces resident role gate', async () => {
      const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
      const originalStageRoleRuntime = featureFlags.stageRoleRuntimeV1
      const originalRoleAssignment = featureFlags.roleAssignmentV1
      featureFlags.stageRoleRuntimeV1 = true
      featureFlags.roleAssignmentV1 = true

      try {
        const { svc, communityRepo, communityId, roleAssignmentRepo } = setup()
        const strictRoleSpec = buildStrictPublicationStageSpec()
        strictRoleSpec.roles.resident.min_tier = 'T5'
        strictRoleSpec.tier_gate.resident_min_tier = 'T5'
        strictRoleSpec.strict_publication.enabled = false
        communityRepo.update(communityId, { rules_json: { stage_spec_v1: strictRoleSpec } })

        await expect(
          svc.createPost({
            actor_agent_id: 'a1',
            run_id: 'r-role-gate-baseline',
            community_id: communityId,
            title: 'Role gate baseline',
            body: 'baseline should be blocked',
          }),
        ).rejects.toThrow('does not meet role gate')

        await roleAssignmentRepo.create({
          community_id: communityId,
          post_id: null,
          agent_id: 'a1',
          scope: 'COMMUNITY',
          scope_id: communityId,
          role: 'aside-seat',
          status: 'ACTIVE',
          assigned_by: 'admin',
        })

        await expect(
          svc.createPost({
            actor_agent_id: 'a1',
            run_id: 'r-role-gate-with-unknown-role',
            community_id: communityId,
            title: 'Role gate should still block',
            body: 'unknown assigned role must not bypass runtime gate',
          }),
        ).rejects.toThrow('does not meet role gate')
      } finally {
        featureFlags.stageRoleRuntimeV1 = originalStageRoleRuntime
        featureFlags.roleAssignmentV1 = originalRoleAssignment
      }
    })

    it('enforces structured trust_context in strict publication communities', async () => {
      const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
      const originalStageRoleRuntime = featureFlags.stageRoleRuntimeV1
      featureFlags.stageRoleRuntimeV1 = true

      try {
        const { svc, communityRepo, communityId } = setup()
        communityRepo.update(communityId, { rules_json: { stage_spec_v1: buildStrictPublicationStageSpec() } })

        await expect(
          svc.createPost({
            actor_agent_id: 'a1',
            run_id: 'r-strict-missing-trust',
            community_id: communityId,
            title: 'Strict publication post',
            body: `Longform body ${'x'.repeat(1_300)}`,
          }),
        ).rejects.toThrow('trust_context')
      } finally {
        featureFlags.stageRoleRuntimeV1 = originalStageRoleRuntime
      }
    })

    it('rejects legacy inline grant markup without structured trust_context', async () => {
      const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
      const originalStageRoleRuntime = featureFlags.stageRoleRuntimeV1
      featureFlags.stageRoleRuntimeV1 = true

      try {
        const { svc, communityRepo, communityId } = setup()
        communityRepo.update(communityId, { rules_json: { stage_spec_v1: buildStrictPublicationStageSpec() } })

        await expect(
          svc.createPost({
            actor_agent_id: 'a1',
            run_id: 'r-strict-legacy-fallback',
            community_id: communityId,
            title: 'Strict publication legacy',
            body: `[grant:legacy-1] https://a.example.com/source https://b.example.com/source ${'x'.repeat(1_300)}`,
          }),
        ).rejects.toThrow('trust_context')
      } finally {
        featureFlags.stageRoleRuntimeV1 = originalStageRoleRuntime
      }
    })

    it('rejects structured trust_context when grant is expired', async () => {
      const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
      const originalStageRoleRuntime = featureFlags.stageRoleRuntimeV1
      featureFlags.stageRoleRuntimeV1 = true

      try {
        const { svc, communityRepo, communityId, incubationRepo } = setup()
        communityRepo.update(communityId, { rules_json: { stage_spec_v1: buildStrictPublicationStageSpec() } })

        const job = await incubationRepo.createJob({
          post_id: null,
          community_id: communityId,
          proposer_agent_id: 'a1',
          redaction_level: 'strong',
          source_count: 2,
        })

        const source1 = await incubationRepo.createSourceBundle({
          job_id: job.id,
          source_type: 'WEB',
          source_ref: 's1',
        })
        const source2 = await incubationRepo.createSourceBundle({
          job_id: job.id,
          source_type: 'WEB',
          source_ref: 's2',
        })
        const grant = await incubationRepo.createGrant({
          job_id: job.id,
          reviewer_user_id: 'admin-1',
          reason: 'expired',
          ttl_hours: 1,
          expires_at: new Date(Date.now() - 1_000),
        })

        await expect(
          svc.createPost({
            actor_agent_id: 'a1',
            run_id: 'r-strict-expired-grant',
            community_id: communityId,
            title: 'Strict publication expired grant',
            body: `https://a.example.com https://b.example.com ${'x'.repeat(1_300)}`,
            trust_context: {
              job_id: job.id,
              grant_id: grant.id,
              source_bundle_ids: [source1.id, source2.id],
              redaction_profile: 'strong',
            },
          }),
        ).rejects.toThrow('expired')
      } finally {
        featureFlags.stageRoleRuntimeV1 = originalStageRoleRuntime
      }
    })

    it('accepts valid trust_context and marks incubation job as DONE', async () => {
      const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
      const originalStageRoleRuntime = featureFlags.stageRoleRuntimeV1
      featureFlags.stageRoleRuntimeV1 = true

      try {
        const { svc, communityRepo, communityId, incubationRepo } = setup()
        communityRepo.update(communityId, { rules_json: { stage_spec_v1: buildStrictPublicationStageSpec() } })

        const job = await incubationRepo.createJob({
          post_id: null,
          community_id: communityId,
          proposer_agent_id: 'a1',
          redaction_level: 'strong',
          source_count: 2,
        })

        const source1 = await incubationRepo.createSourceBundle({
          job_id: job.id,
          source_type: 'WEB',
          source_ref: 's1',
        })
        const source2 = await incubationRepo.createSourceBundle({
          job_id: job.id,
          source_type: 'WEB',
          source_ref: 's2',
        })
        const grant = await incubationRepo.createGrant({
          job_id: job.id,
          reviewer_user_id: 'admin-1',
          reason: 'approved',
          ttl_hours: 24,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })

        const result = await svc.createPost({
          actor_agent_id: 'a1',
          run_id: 'r-strict-valid-trust',
          community_id: communityId,
          title: 'Strict publication valid grant',
          body: `https://a.example.com https://b.example.com ${'x'.repeat(1_300)}`,
          trust_context: {
            job_id: job.id,
            grant_id: grant.id,
            source_bundle_ids: [source1.id, source2.id],
            redaction_profile: 'strong',
          },
        })

        const updatedJob = await incubationRepo.findJobById(job.id)
        expect(updatedJob?.phase).toBe('DONE')
        expect(updatedJob?.post_id).toBe(result.post.id)
        const events = await incubationRepo.listEventsByJob(job.id)
        expect(events.some((event) => event.event_type === 'INCUBATION_PUBLISHED')).toBe(true)
      } finally {
        featureFlags.stageRoleRuntimeV1 = originalStageRoleRuntime
      }
    })
  })

  describe('thread/turn writes', () => {
    let ctx: ReturnType<typeof setup>
    let postId: string

    beforeEach(async () => {
      ctx = setup()
      const post = await ctx.postRepo.create({
        community_id: ctx.communityId,
        author_agent_id: 'a0',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      postId = post.id
    })

    it('creates a thread on an existing post', async () => {
      const result = await ctx.svc.createThread({
        actor_agent_id: 'a1',
        run_id: 'r1',
        post_id: postId,
        body: 'Great!',
      })
      expect(result.entry.body).toBe('Great!')
      expect(result.event.event_type).toBe('THREAD_OPENED')
    })

    it('records chain_depth in comment event payload', async () => {
      const result = await ctx.svc.createThread({
        actor_agent_id: 'a1',
        run_id: 'r-chain',
        post_id: postId,
        body: 'Chain comment',
        chain_depth: 4,
      })
      expect((result.event.payload_json as Record<string, unknown>).chain_depth).toBe(4)
    })

    it('creates a thread turn under an existing thread', async () => {
      const parent = await ctx.svc.createThread({
        actor_agent_id: 'a1',
        run_id: 'r1',
        post_id: postId,
        body: 'Parent',
      })
      const child = await ctx.svc.addThreadTurn({
        actor_agent_id: 'a2',
        run_id: 'r2',
        thread_id: parent.entry.id,
        body: 'Reply',
      })
      expect(child.entry.thread_id).toBe(parent.entry.id)
      expect(child.entry.anchor_turn_id).toBeNull()
    })

    it('increments turn indexes for warmup candidate turns and emits governed visible-write hooks', async () => {
      const hook = vi.fn()
      ctx.svc.setEventHook(hook)
      const parent = await ctx.svc.createThread({
        actor_agent_id: 'a1',
        run_id: 'r-warmup-thread',
        post_id: postId,
        body: 'Warmup parent',
        governance_context: {
          governance_batch_id: 'batch-warmup-test',
          generation_mode: 'warmup_runtime',
        },
      })

      const firstTurn = await ctx.svc.addThreadTurn({
        actor_agent_id: 'a2',
        run_id: 'r-warmup-turn-1',
        thread_id: parent.entry.id,
        body: 'Warmup reply 1',
        governance_context: {
          governance_batch_id: 'batch-warmup-test',
          generation_mode: 'warmup_runtime',
        },
      })
      const secondTurn = await ctx.svc.addThreadTurn({
        actor_agent_id: 'a3',
        run_id: 'r-warmup-turn-2',
        thread_id: parent.entry.id,
        body: 'Warmup reply 2',
        governance_context: {
          governance_batch_id: 'batch-warmup-test',
          generation_mode: 'warmup_runtime',
        },
      })

      const persistedFirstTurn = await ctx.publicStageTurnRepo.findById(firstTurn.entry.id)
      const persistedSecondTurn = await ctx.publicStageTurnRepo.findById(secondTurn.entry.id)
      expect(persistedFirstTurn?.turn_index).toBe(1)
      expect(persistedSecondTurn?.turn_index).toBe(2)
      expect(parent.event.payload_json).toMatchObject({
        governance_batch_id: 'batch-warmup-test',
        generation_mode: 'warmup_runtime',
      })
      expect(firstTurn.event.payload_json).toMatchObject({
        governance_batch_id: 'batch-warmup-test',
        generation_mode: 'warmup_runtime',
      })
      expect(secondTurn.event.payload_json).toMatchObject({
        governance_batch_id: 'batch-warmup-test',
        generation_mode: 'warmup_runtime',
      })
      expect(hook).toHaveBeenCalledTimes(3)
      expect(hook).toHaveBeenNthCalledWith(1, expect.objectContaining({
        id: parent.event.id,
        event_type: 'THREAD_OPENED',
      }))
      expect(hook).toHaveBeenNthCalledWith(2, expect.objectContaining({
        id: firstTurn.event.id,
        event_type: 'THREAD_TURN_ADDED',
      }))
      expect(hook).toHaveBeenNthCalledWith(3, expect.objectContaining({
        id: secondTurn.event.id,
        event_type: 'THREAD_TURN_ADDED',
      }))
    })

    it('stores a manual route handoff on the created thread', async () => {
      const result = await ctx.svc.createThread({
        actor_agent_id: 'a1',
        run_id: 'r-route-thread',
        post_id: postId,
        body: '这个话题更适合私下聊。',
        route_handoff: {
          route_type: 'PRIVATE',
          reason_code: 'PRIVATE_HANDOFF_REQUIRED',
          handoff_label: '该话题适合转入私聊继续。',
        },
      })

      const thread = await ctx.publicStageThreadRepo.findById(result.entry.id)
      expect(thread).toMatchObject({
        thread_state: 'CLOSED',
        active_route: expect.objectContaining({
          route_type: 'PRIVATE',
          route_state: 'READY',
          reason_code: 'PRIVATE_HANDOFF_REQUIRED',
        }),
      })
    })

    it('emits lifecycle and writeability excerpts with THREAD_ROUTE_UPDATED events', async () => {
      const result = await ctx.svc.createThread({
        actor_agent_id: 'a1',
        run_id: 'r-route-event',
        post_id: postId,
        body: '这个话题更适合私下聊。',
        route_handoff: {
          route_type: 'PRIVATE',
          reason_code: 'PRIVATE_HANDOFF_REQUIRED',
          handoff_label: '该话题适合转入私聊继续。',
        },
      })

      const routeEvent = ctx.eventRepo.findByPostId(postId)
        .find((event) => event.event_type === 'THREAD_ROUTE_UPDATED')
      expect(routeEvent).toBeTruthy()
      expect(routeEvent?.payload_json).toMatchObject({
        thread_id: result.entry.id,
        route_type: 'PRIVATE',
        lifecycle: {
          thread_id: result.entry.id,
          thread_state: 'HANDOFF_PENDING',
          lifecycle_label: 'HANDOFF_READY',
          writeability: {
            reply_mode: 'SOFT_CLOSE',
            preferred_action: 'FOLLOW_ROUTE',
            reason_code: 'THREAD_HANDOFF_PENDING',
          },
        },
        writeability: {
          reply_mode: 'SOFT_CLOSE',
          preferred_action: 'FOLLOW_ROUTE',
          reason_code: 'THREAD_HANDOFF_PENDING',
        },
      })
    })

    it('closes a thread with an aftershow handoff when the reply budget is exhausted', async () => {
      await ctx.publicStageThreadRepo.create({
        id: 'thread-budget-1',
        post_id: postId,
        community_id: ctx.communityId,
        author_agent_id: 'a0',
        body: 'Budget thread',
        visibility: 'PUBLIC',
        state: 'APPROVED',
        reply_budget: 1,
      })

      const turn = await ctx.svc.addThreadTurn({
        actor_agent_id: 'a1',
        run_id: 'r-route-budget',
        thread_id: 'thread-budget-1',
        body: '最后一轮收口。',
      })

      expect(turn.event.event_type).toBe('THREAD_TURN_ADDED')
      const thread = await ctx.publicStageThreadRepo.findById('thread-budget-1')
      expect(thread).toMatchObject({
        thread_state: 'CLOSED',
        active_route: expect.objectContaining({
          route_type: 'AFTERSHOW',
          route_state: 'READY',
          reason_code: 'THREAD_REPLY_BUDGET_EXHAUSTED',
        }),
      })

      const softCloseReply = await ctx.svc.addThreadTurn({
        actor_agent_id: 'a2',
        run_id: 'r-route-budget-soft-close',
        thread_id: 'thread-budget-1',
        body: '软收口阶段允许最后一条补充。',
      })
      expect(softCloseReply.event.event_type).toBe('THREAD_TURN_ADDED')

      await expect(
        ctx.svc.addThreadTurn({
          actor_agent_id: 'a1',
          run_id: 'r-route-budget-overflow',
          thread_id: 'thread-budget-1',
          body: '这条不应该再被接受。',
        }),
      ).rejects.toThrow('cannot accept more turns')
    })

    it('throws for nonexistent post', async () => {
      await expect(
        ctx.svc.createThread({
          actor_agent_id: 'a1',
          run_id: 'r1',
          post_id: 'nope',
          body: 'Hi',
        }),
      ).rejects.toThrow('not found')
    })

    it('throws for nonexistent anchor turn', async () => {
      const thread = await ctx.svc.createThread({
        actor_agent_id: 'a1',
        run_id: 'r1-thread',
        post_id: postId,
        body: 'Parent',
      })
      await expect(
        ctx.svc.addThreadTurn({
          actor_agent_id: 'a1',
          run_id: 'r1',
          thread_id: thread.entry.id,
          anchor_turn_id: 'nope',
          body: 'Hi',
        }),
      ).rejects.toThrow('not found')
    })

    it('throws on empty body', async () => {
      await expect(
        ctx.svc.createThread({
          actor_agent_id: 'a1',
          run_id: 'r1',
          post_id: postId,
          body: '',
        }),
      ).rejects.toThrow('Body is required')
    })
  })

  describe('upsertVote', () => {
    let ctx: ReturnType<typeof setup>
    let postId: string

    beforeEach(async () => {
      ctx = setup()
      const post = await ctx.postRepo.create({
        community_id: ctx.communityId,
        author_agent_id: 'a0',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      postId = post.id
    })

    function expectVoteEvent(result: Awaited<ReturnType<(typeof ctx)['svc']['upsertVote']>>) {
      if (!result.vote || !result.event) {
        throw new Error('expected vote mutation to emit a vote and event')
      }
      return { vote: result.vote, event: result.event }
    }

    it('creates a vote and emits an event', async () => {
      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r1',
        target_type: 'POST',
        target_id: postId,
        direction: 'UP',
      })
      const { vote, event } = expectVoteEvent(result)
      expect(vote.direction).toBe('UP')
      expect(event.event_type).toBe('VOTE_CAST')
      expect((event.payload_json as Record<string, unknown>).community_id).toBe(ctx.communityId)
    })

    it('records chain_depth in vote event payload', async () => {
      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r-chain-vote',
        target_type: 'POST',
        target_id: postId,
        direction: 'UP',
        chain_depth: 5,
      })
      const { event } = expectVoteEvent(result)
      expect((event.payload_json as Record<string, unknown>).chain_depth).toBe(5)
    })

    it('resolves community_id for thread vote events', async () => {
      const thread = await ctx.svc.createThread({
        actor_agent_id: 'a2',
        run_id: 'r-thread',
        post_id: postId,
        body: 'Thread target',
      })

      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r1',
        target_type: 'THREAD',
        target_id: thread.entry.id,
        direction: 'UP',
      })

      const { event } = expectVoteEvent(result)
      expect(event.event_type).toBe('VOTE_CAST')
      expect((event.payload_json as Record<string, unknown>).community_id).toBe(ctx.communityId)
    })

    it('notifies event hook after vote creation', async () => {
      const hook = vi.fn()
      ctx.svc.setEventHook(hook)

      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r1',
        target_type: 'POST',
        target_id: postId,
        direction: 'UP',
      })
      const { event } = expectVoteEvent(result)

      expect(hook).toHaveBeenCalledTimes(1)
      expect(hook).toHaveBeenCalledWith(
        expect.objectContaining({
          id: event.id,
          event_type: 'VOTE_CAST',
        }),
      )
    })

    it('skips the event hook for warmup-governed votes and preserves lineage in payload', async () => {
      const hook = vi.fn()
      ctx.svc.setEventHook(hook)

      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r-warmup-vote',
        target_type: 'POST',
        target_id: postId,
        direction: 'UP',
        governance_context: {
          governance_batch_id: 'batch-warmup-test',
          generation_mode: 'warmup_runtime',
        },
      })
      const { event } = expectVoteEvent(result)

      expect(event.payload_json).toMatchObject({
        governance_batch_id: 'batch-warmup-test',
        generation_mode: 'warmup_runtime',
      })
      expect(hook).not.toHaveBeenCalled()
    })

    it('throws for nonexistent post target', async () => {
      await expect(
        ctx.svc.upsertVote({
          actor_agent_id: 'a1',
          run_id: 'r1',
          target_type: 'POST',
          target_id: 'nope',
          direction: 'UP',
        }),
      ).rejects.toThrow('not found')
    })

    it('throws for nonexistent thread target', async () => {
      await expect(
        ctx.svc.upsertVote({
          actor_agent_id: 'a1',
          run_id: 'r1',
          target_type: 'THREAD',
          target_id: 'nope',
          direction: 'UP',
        }),
      ).rejects.toThrow('not found')
    })

    it('upserts the same vote from the same agent', async () => {
      await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r1',
        target_type: 'POST',
        target_id: postId,
        direction: 'UP',
      })
      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r2',
        target_type: 'POST',
        target_id: postId,
        direction: 'DOWN',
      })
      const { vote } = expectVoteEvent(result)
      expect(vote.direction).toBe('DOWN')
    })

    it('clears an existing vote and emits a dedicated clear event', async () => {
      await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r1',
        target_type: 'POST',
        target_id: postId,
        direction: 'UP',
      })

      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r2',
        target_type: 'POST',
        target_id: postId,
        direction: 'NEUTRAL',
      })

      expect(result.outcome).toBe('cleared')
      if (result.outcome !== 'cleared') {
        throw new Error('expected cleared outcome')
      }
      expect(result.event.event_type).toBe('VOTE_CLEARED')
      expect((result.event.payload_json as Record<string, unknown>).previous_direction).toBe('UP')
      expect(ctx.voteRepo.findByVoterAndTarget('a1', 'POST', postId)).toBeNull()
    })

    it('treats NEUTRAL without an existing vote as noop', async () => {
      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r-noop',
        target_type: 'POST',
        target_id: postId,
        direction: 'NEUTRAL',
      })

      expect(result).toEqual({
        outcome: 'noop',
        vote: null,
        event: null,
        reason: 'clear_without_existing_vote',
      })
    })

    it('rejects self-votes', async () => {
      await expect(
        ctx.svc.upsertVote({
          actor_agent_id: 'a0',
          run_id: 'r-self',
          target_type: 'POST',
          target_id: postId,
          direction: 'UP',
        }),
      ).rejects.toThrow('Self-vote is not allowed')
    })
  })
})
