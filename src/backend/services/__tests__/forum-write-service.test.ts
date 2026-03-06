import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ForumWriteService, type ModerationEvaluator } from '../forum-write-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryEventRepository, InMemoryAgentRunRepository } from '../../repos/event-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryAgentCommunityMembershipRepository } from '../../repos/agent-community-membership-repository.js'
import { InMemoryIncubationRepository } from '../../repos/incubation-repository.js'
import { InMemoryRoleAssignmentRepository } from '../../repos/role-assignment-repository.js'
import type { ModerationResult } from '../../moderation/types.js'
import { config } from '../../lib/config.js'

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

function buildStrictT4StageSpec() {
  return {
    version: 'v1',
    min_tier_pool: 'T1',
    roles: {
      resident: { min_tier: 'T1', runtime_gate: true, t4_longform_only: false },
      guest: { min_tier: 'T1', runtime_gate: true, t4_longform_only: false },
      core: { min_tier: 'T1', runtime_gate: true, t4_longform_only: false },
    },
    tier_gate: {
      resident_min_tier: 'T1',
      core_min_tier: 'T1',
      t4_longform_min_tier: 'T1',
    },
    strict_t4: {
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
      mode: 'A',
      audience_zone_enabled: true,
      agent_reads_audience_zone: false,
      agent_reply_via_aftershow: true,
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
  const commentRepo = new InMemoryCommentRepository()
  const voteRepo = new InMemoryVoteRepository()
  const eventRepo = new InMemoryEventRepository()
  const agentRunRepo = new InMemoryAgentRunRepository()
  const communityRepo = new InMemoryCommunityRepository()
  const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
  const incubationRepo = new InMemoryIncubationRepository()
  const roleAssignmentRepo = new InMemoryRoleAssignmentRepository()
  const community = communityRepo.create({
    name: 'Test Community',
    slug: `test-community-${Date.now()}`,
  })
  void membershipRepo.upsertActive({ agent_id: 'a0', community_id: community.id })
  void membershipRepo.upsertActive({ agent_id: 'a1', community_id: community.id })
  void membershipRepo.upsertActive({ agent_id: 'a2', community_id: community.id })
  const moderator: ModerationEvaluator = { evaluate: () => modResult }
  const svc = new ForumWriteService({
    postRepo,
    commentRepo,
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
    voteRepo,
    eventRepo,
    agentRunRepo,
    communityRepo,
    communityId: community.id,
    membershipRepo,
    roleAssignmentRepo,
    incubationRepo,
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
      const featureFlags = config.features as unknown as Record<string, boolean>
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
      const featureFlags = config.features as unknown as Record<string, boolean>
      const originalStageRoleRuntime = featureFlags.stageRoleRuntimeV1
      const originalRoleAssignment = featureFlags.roleAssignmentV1
      featureFlags.stageRoleRuntimeV1 = true
      featureFlags.roleAssignmentV1 = true

      try {
        const { svc, communityRepo, communityId, roleAssignmentRepo } = setup()
        const strictRoleSpec = buildStrictT4StageSpec()
        strictRoleSpec.roles.resident.min_tier = 'T5'
        strictRoleSpec.tier_gate.resident_min_tier = 'T5'
        strictRoleSpec.strict_t4.enabled = false
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

    it('enforces structured trust_context in strict T4 when hard enforce is enabled', async () => {
      const featureFlags = config.features as unknown as Record<string, boolean>
      const originalStageRoleRuntime = featureFlags.stageRoleRuntimeV1
      const originalTrustHardEnforce = featureFlags.incubationTrustHardEnforce
      featureFlags.stageRoleRuntimeV1 = true
      featureFlags.incubationTrustHardEnforce = true

      try {
        const { svc, communityRepo, communityId } = setup()
        communityRepo.update(communityId, { rules_json: { stage_spec_v1: buildStrictT4StageSpec() } })

        await expect(
          svc.createPost({
            actor_agent_id: 'a1',
            run_id: 'r-strict-missing-trust',
            community_id: communityId,
            title: 'Strict T4 post',
            body: `Longform body ${'x'.repeat(1_300)}`,
          }),
        ).rejects.toThrow('trust_context')
      } finally {
        featureFlags.stageRoleRuntimeV1 = originalStageRoleRuntime
        featureFlags.incubationTrustHardEnforce = originalTrustHardEnforce
      }
    })

    it('falls back to legacy strict gate when hard enforce is disabled', async () => {
      const featureFlags = config.features as unknown as Record<string, boolean>
      const originalStageRoleRuntime = featureFlags.stageRoleRuntimeV1
      const originalTrustHardEnforce = featureFlags.incubationTrustHardEnforce
      featureFlags.stageRoleRuntimeV1 = true
      featureFlags.incubationTrustHardEnforce = false

      try {
        const { svc, communityRepo, communityId } = setup()
        communityRepo.update(communityId, { rules_json: { stage_spec_v1: buildStrictT4StageSpec() } })

        const result = await svc.createPost({
          actor_agent_id: 'a1',
          run_id: 'r-strict-legacy-fallback',
          community_id: communityId,
          title: 'Strict T4 legacy',
          body: `[grant:legacy-1] https://a.example.com/source https://b.example.com/source ${'x'.repeat(1_300)}`,
        })

        expect(result.post.id).toBeTruthy()
      } finally {
        featureFlags.stageRoleRuntimeV1 = originalStageRoleRuntime
        featureFlags.incubationTrustHardEnforce = originalTrustHardEnforce
      }
    })

    it('rejects structured trust_context when grant is expired', async () => {
      const featureFlags = config.features as unknown as Record<string, boolean>
      const originalStageRoleRuntime = featureFlags.stageRoleRuntimeV1
      const originalTrustHardEnforce = featureFlags.incubationTrustHardEnforce
      featureFlags.stageRoleRuntimeV1 = true
      featureFlags.incubationTrustHardEnforce = true

      try {
        const { svc, communityRepo, communityId, incubationRepo } = setup()
        communityRepo.update(communityId, { rules_json: { stage_spec_v1: buildStrictT4StageSpec() } })

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
            title: 'Strict T4 expired grant',
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
        featureFlags.incubationTrustHardEnforce = originalTrustHardEnforce
      }
    })

    it('accepts valid trust_context and marks incubation job as DONE', async () => {
      const featureFlags = config.features as unknown as Record<string, boolean>
      const originalStageRoleRuntime = featureFlags.stageRoleRuntimeV1
      const originalTrustHardEnforce = featureFlags.incubationTrustHardEnforce
      featureFlags.stageRoleRuntimeV1 = true
      featureFlags.incubationTrustHardEnforce = true

      try {
        const { svc, communityRepo, communityId, incubationRepo } = setup()
        communityRepo.update(communityId, { rules_json: { stage_spec_v1: buildStrictT4StageSpec() } })

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
          title: 'Strict T4 valid grant',
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
        featureFlags.incubationTrustHardEnforce = originalTrustHardEnforce
      }
    })
  })

  describe('createComment', () => {
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

    it('creates a comment on an existing post', async () => {
      const result = await ctx.svc.createComment({
        actor_agent_id: 'a1',
        run_id: 'r1',
        post_id: postId,
        body: 'Great!',
      })
      expect(result.comment.body).toBe('Great!')
      expect(result.event.event_type).toBe('COMMENT_CREATED')
    })

    it('records chain_depth in comment event payload', async () => {
      const result = await ctx.svc.createComment({
        actor_agent_id: 'a1',
        run_id: 'r-chain',
        post_id: postId,
        body: 'Chain comment',
        chain_depth: 4,
      })
      expect((result.event.payload_json as Record<string, unknown>).chain_depth).toBe(4)
    })

    it('supports nested comments', async () => {
      const parent = await ctx.svc.createComment({
        actor_agent_id: 'a1',
        run_id: 'r1',
        post_id: postId,
        body: 'Parent',
      })
      const child = await ctx.svc.createComment({
        actor_agent_id: 'a2',
        run_id: 'r2',
        post_id: postId,
        parent_comment_id: parent.comment.id,
        body: 'Reply',
      })
      expect(child.comment.parent_comment_id).toBe(parent.comment.id)
    })

    it('throws for nonexistent post', async () => {
      await expect(
        ctx.svc.createComment({
          actor_agent_id: 'a1',
          run_id: 'r1',
          post_id: 'nope',
          body: 'Hi',
        }),
      ).rejects.toThrow('not found')
    })

    it('throws for nonexistent parent comment', async () => {
      await expect(
        ctx.svc.createComment({
          actor_agent_id: 'a1',
          run_id: 'r1',
          post_id: postId,
          parent_comment_id: 'nope',
          body: 'Hi',
        }),
      ).rejects.toThrow('not found')
    })

    it('throws on empty body', async () => {
      await expect(
        ctx.svc.createComment({
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

    it('creates a vote and emits an event', async () => {
      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r1',
        target_type: 'POST',
        target_id: postId,
        direction: 'UP',
      })
      expect(result.vote.direction).toBe('UP')
      expect(result.event.event_type).toBe('VOTE_CAST')
      expect((result.event.payload_json as Record<string, unknown>).community_id).toBe(ctx.communityId)
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
      expect((result.event.payload_json as Record<string, unknown>).chain_depth).toBe(5)
    })

    it('resolves community_id for comment vote events', async () => {
      const comment = await ctx.svc.createComment({
        actor_agent_id: 'a2',
        run_id: 'r-comment',
        post_id: postId,
        body: 'Comment target',
      })

      const result = await ctx.svc.upsertVote({
        actor_agent_id: 'a1',
        run_id: 'r1',
        target_type: 'COMMENT',
        target_id: comment.comment.id,
        direction: 'UP',
      })

      expect(result.event.event_type).toBe('VOTE_CAST')
      expect((result.event.payload_json as Record<string, unknown>).community_id).toBe(ctx.communityId)
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

      expect(hook).toHaveBeenCalledTimes(1)
      expect(hook).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result.event.id,
          event_type: 'VOTE_CAST',
        }),
      )
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

    it('throws for nonexistent comment target', async () => {
      await expect(
        ctx.svc.upsertVote({
          actor_agent_id: 'a1',
          run_id: 'r1',
          target_type: 'COMMENT',
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
      expect(result.vote.direction).toBe('DOWN')
    })
  })
})
