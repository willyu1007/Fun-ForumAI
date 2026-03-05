import { describe, it, expect } from 'vitest'
import { AftershowService } from '../aftershow-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryHumanVoteRepository } from '../../repos/human-vote-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryAftershowRunRepository } from '../../repos/aftershow-run-repository.js'
import { InMemoryAudienceRepository } from '../../repos/audience-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryAftershowArtifactRepository } from '../../repos/aftershow-artifact-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { config } from '../../lib/config.js'

function buildStageSpec(aftershowMode = 'THRESHOLD') {
  return {
    version: 'v1',
    min_tier_pool: 'T1',
    roles: {
      resident: { min_tier: 'T1', runtime_gate: true, t4_longform_only: false },
    },
    tier_gate: {
      resident_min_tier: 'T1',
      core_min_tier: 'T1',
      t4_longform_min_tier: 'T4',
    },
    strict_t4: {
      enabled: false,
      premod_required: true,
      min_sources: 3,
      grant_required: true,
      max_ttl_hours: 168,
      redaction: 'strong',
    },
    aftershow: {
      mode: aftershowMode,
      threshold: {
        audience_comments: 3,
        human_vote_score: 2,
      },
      periodic: {
        enabled: false,
        interval_hours: 24,
      },
    },
  }
}

async function createTestAgent(agentRepo: InMemoryAgentRepository): Promise<string> {
  const agent = await agentRepo.create({
    owner_id: 'owner-a1',
    display_name: 'agent 1',
    model: 'qwen-plus',
  })
  return agent.id
}

function createService(input: {
  postRepo: InMemoryPostRepository
  humanVoteRepo: InMemoryHumanVoteRepository
  audienceRepo: InMemoryAudienceRepository
  agentRepo: InMemoryAgentRepository
  communityRepo: InMemoryCommunityRepository
  runRepo: InMemoryAftershowRunRepository
}) {
  return new AftershowService({
    postRepo: input.postRepo,
    humanVoteRepo: input.humanVoteRepo,
    audienceRepo: input.audienceRepo,
    agentRepo: input.agentRepo,
    communityRepo: input.communityRepo,
    runRepo: input.runRepo,
    artifactRepo: new InMemoryAftershowArtifactRepository(),
    eventRepo: new InMemoryEventRepository(),
    notificationRepo: null,
  })
}

describe('AftershowService', () => {
  it('skips threshold mode when conditions are not met', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Threshold Community',
      slug: `threshold-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
      triggered_by_user_id: 'u1',
    })

    expect(result.run.status).toBe('SKIPPED')
    expect(result.reason).toBe('threshold_not_met')
  })

  it('creates run when threshold is met', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Threshold Community 2',
      slug: `threshold-2-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const thread = await audienceRepo.upsertThreadByPost({
      post_id: post.id,
      community_id: post.community_id,
      status: 'OPEN',
    })

    await audienceRepo.createMessage({
      thread_id: thread.id,
      author_user_id: 'u1',
      body: '1',
    })
    await audienceRepo.createMessage({
      thread_id: thread.id,
      author_user_id: 'u2',
      body: '2',
    })
    await audienceRepo.createMessage({
      thread_id: thread.id,
      author_user_id: 'u3',
      body: '3',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
      triggered_by_user_id: 'u1',
    })

    expect(result.run.status).toBe('CREATED')
    expect(result.threshold_pass).toBe(true)
  })

  it('supports PERIODIC mode but defaults to skip when periodic disabled', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Periodic Community',
      slug: `periodic-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('PERIODIC') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
      triggered_by_user_id: 'u1',
    })

    expect(result.run.mode).toBe('PERIODIC')
    expect(result.run.status).toBe('SKIPPED')
    expect(result.reason).toBe('periodic_disabled')
  })

  it('skips when aftershow mode is OFF', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Off Community',
      slug: `off-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('OFF') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
    })

    expect(result.run.status).toBe('SKIPPED')
    expect(result.reason).toBe('aftershow_mode_off')
  })

  it('force bypasses OFF mode and creates run', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Force Community',
      slug: `force-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('OFF') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'MANUAL',
      force: true,
    })

    expect(result.run.status).toBe('CREATED')
    expect(result.reason).toBe('triggered')
  })

  it('blocks manual trigger for non-owner non-admin actor', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const ownerAgent = await agentRepo.create({
      owner_id: 'owner-a1',
      display_name: 'agent 1',
      model: 'qwen-plus',
    })

    const community = communityRepo.create({
      name: 'Permission Community',
      slug: `permission-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: ownerAgent.id,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    await expect(
      service.trigger({
        post_id: post.id,
        mode: 'MANUAL',
        force: true,
        triggered_by_user_id: 'not-owner',
        actor_role: 'user',
      }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('throws NotFoundError for non-existent post', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    await expect(
      service.trigger({ post_id: 'non-existent', mode: 'AUTO', force: false }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('creates run when human vote score meets threshold', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Vote Community',
      slug: `vote-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    await humanVoteRepo.upsert({
      voter_user_id: 'u1',
      target_type: 'POST',
      target_id: post.id,
      direction: 'UP',
    })
    await humanVoteRepo.upsert({
      voter_user_id: 'u2',
      target_type: 'POST',
      target_id: post.id,
      direction: 'UP',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
    })

    expect(result.run.status).toBe('CREATED')
    expect(result.threshold_pass).toBe(true)
  })

  it('records stage_spec_errors in meta when rules_json is invalid', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Invalid Community',
      slug: `invalid-${Date.now()}`,
      rules_json: { stage_spec_v1: { version: 'v1', min_tier_pool: 'INVALID_TIER' } },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
    })

    expect(result.run.meta).toBeDefined()
    const meta = result.run.meta as Record<string, unknown>
    expect(meta.used_stage_fallback).toBe(true)
    expect(Array.isArray(meta.stage_spec_errors)).toBe(true)
    expect((meta.stage_spec_errors as string[]).length).toBeGreaterThan(0)
  })

  it('bridges audience via summary ref without exposing raw messages in run meta', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalSummaryFlag = featureFlags.aftershowAudienceSummaryV1
    featureFlags.aftershowAudienceSummaryV1 = true

    try {
      const postRepo = new InMemoryPostRepository()
      const humanVoteRepo = new InMemoryHumanVoteRepository()
      const communityRepo = new InMemoryCommunityRepository()
      const runRepo = new InMemoryAftershowRunRepository()
      const audienceRepo = new InMemoryAudienceRepository()
      const agentRepo = new InMemoryAgentRepository()

      const ownerAgent = await agentRepo.create({
        owner_id: 'owner-a1',
        display_name: 'agent 1',
        model: 'qwen-plus',
      })

      const community = communityRepo.create({
        name: 'Summary Community',
        slug: `summary-${Date.now()}`,
        rules_json: {
          stage_spec_v1: {
            ...buildStageSpec('THRESHOLD'),
            human_participation: {
              mode: 'A',
              audience_zone_enabled: true,
              agent_reads_audience_zone: false,
              agent_reply_via_aftershow: true,
            },
          },
        },
      })

      const post = await postRepo.create({
        community_id: community.id,
        author_agent_id: ownerAgent.id,
        title: 'title',
        body: 'body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const thread = await audienceRepo.upsertThreadByPost({
        post_id: post.id,
        community_id: post.community_id,
        status: 'OPEN',
      })
      await audienceRepo.createMessage({
        thread_id: thread.id,
        author_user_id: 'u1',
        body: 'This raw message should not be copied to run meta',
      })

      const service = createService({
        postRepo,
        humanVoteRepo,
        audienceRepo,
        agentRepo,
        communityRepo,
        runRepo,
      })

      const result = await service.trigger({
        post_id: post.id,
        mode: 'AUTO',
        force: false,
      })

      expect(result.summary_ref).toBeTruthy()
      const latestSummary = await audienceRepo.findLatestSummaryByThread(thread.id)
      expect(latestSummary?.id).toBe(result.summary_ref)

      const runMeta = result.run.meta as Record<string, unknown>
      expect(runMeta).toHaveProperty('audience_summary_ref')
      expect(JSON.stringify(runMeta)).not.toContain('This raw message should not be copied to run meta')
    } finally {
      featureFlags.aftershowAudienceSummaryV1 = originalSummaryFlag
    }
  })
})
