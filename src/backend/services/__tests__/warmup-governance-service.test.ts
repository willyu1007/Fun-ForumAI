import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAgentConfigRepository, InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryPublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryWarmupGovernanceRepository } from '../../repos/warmup-governance-repository.js'
import type { AgentCommunityMembership } from '../../repos/types/index.js'
import type { ReconcileMembershipsResult } from '../agent-community-membership-service.js'
import type { LaunchProgrammingOpsPayload } from '../launch-programming-ops-service.js'
import { WarmupGovernanceService } from '../warmup-governance-service.js'

function createService() {
  const warmupGovernanceRepo = new InMemoryWarmupGovernanceRepository()
  const postRepo = new InMemoryPostRepository()
  const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
  const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
  const postMediaRepo = new InMemoryPostMediaRepository()
  const voteRepo = new InMemoryVoteRepository()
  const communityRepo = new InMemoryCommunityRepository()
  const agentRepo = new InMemoryAgentRepository()
  const agentConfigRepo = new InMemoryAgentConfigRepository()
  const refreshPost = vi.fn(async () => {})
  const refreshThread = vi.fn(async () => {})
  const community = communityRepo.create({
    name: 'Warm-up Arena',
    slug: 'warmup-arena',
  })
  const agent = agentRepo.create({
    owner_id: 'owner-1',
    display_name: 'Warmup Bot',
  })
  const programmingOpsPayload: LaunchProgrammingOpsPayload = {
    enabled: true,
    timezone: 'Asia/Shanghai',
    active_daypart_id: null,
    dayparts: [],
    slots: [],
    health: {
      required_daily_outcomes: {},
      observed_daily_outcomes: {},
      daypart_readiness: [],
      community_supply_floor: [],
      visual_ratio_ok: true,
      aftershow_pipeline_ok: true,
      warning_count: 0,
      warnings: [],
    },
    observations: {
      visual_ratio: {
        root_cover_ratio: null,
        note_cover_ratio: null,
        highlight_visual_ratio: null,
        reject_reason_counts: {},
        budget_remaining_cny: null,
        cost_gate_active: false,
      },
      highlight_candidates: [],
      aftershow: [],
    },
    governance_references: {
      communities: [],
      incubation: [],
    },
    rollback_order: [],
    drill_checklist: [],
    meta: {
      generated_at: '2026-04-13T06:30:00.000Z',
      source: 'launch-programming-ops-v1',
    },
  }
  const reconcileMemberships = async (): Promise<ReconcileMembershipsResult> => ({
    agent_id: agent.id,
    active_memberships: [],
    updated: {
      added: [],
      removed: [],
      role_changed: [],
      blocked: [],
      source: 'DERIVED',
    },
  })
  const listActive = (): AgentCommunityMembership[] => []

  const service = new WarmupGovernanceService({
    warmupGovernanceRepo,
    postRepo,
    publicStageThreadRepo,
    publicStageTurnRepo,
    postMediaRepo,
    voteRepo,
    communityRepo,
    agentRepo,
    agentConfigRepo,
    membershipService: {
      reconcileMemberships,
      listActive,
    },
    forumWriteService: {
      createPost: vi.fn(async () => {
        throw new Error('forumWriteService.createPost should not be called in this test')
      }),
      createThread: vi.fn(async () => {
        throw new Error('forumWriteService.createThread should not be called in this test')
      }),
      addThreadTurn: vi.fn(async () => {
        throw new Error('forumWriteService.addThreadTurn should not be called in this test')
      }),
      upsertVote: vi.fn(async () => {
        throw new Error('forumWriteService.upsertVote should not be called in this test')
      }),
    },
    launchProgrammingOpsService: {
      getAdminPayload: vi.fn(async () => programmingOpsPayload),
    },
    runtimeLoop: {
      isRunning: true,
    },
    searchProjectionService: {
      refreshPost,
      refreshThread,
    },
  })

  return {
    service,
    repos: {
      warmupGovernanceRepo,
      postRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
      postMediaRepo,
      voteRepo,
    },
    mocks: {
      refreshPost,
      refreshThread,
    },
    programmingOpsPayload,
    seed: {
      community,
      agent,
    },
  }
}

async function seedSuiteFixture(
  ctx: ReturnType<typeof createService>,
  input: {
    suiteLabel?: string
    suiteState?: 'review_ready' | 'active'
  } = {},
) {
  const now = new Date('2026-04-13T06:30:00.000Z')
  const suite = await ctx.repos.warmupGovernanceRepo.createSuite({
    state: 'draft',
    suite_label: input.suiteLabel ?? 'warmup-suite-a',
    created_by_user_id: 'admin-1',
  })
  const kickoffBatch = await ctx.repos.warmupGovernanceRepo.createBatch({
    suite_id: suite.id,
    batch_kind: 'kickoff',
    state: 'review_ready',
    revision_key: 'kickoff:v1',
    package_hash: 'kickoff:v1',
  })
  const warmupBatch = await ctx.repos.warmupGovernanceRepo.createBatch({
    suite_id: suite.id,
    batch_kind: 'warmup',
    state: 'review_ready',
    revision_key: 'warmup:v1',
    package_hash: 'warmup:v1',
  })

  const kickoffPost = await ctx.repos.postRepo.create({
    community_id: ctx.seed.community.id,
    author_agent_id: ctx.seed.agent.id,
    title: 'Kickoff candidate',
    body: 'Kickoff body',
    visibility: 'GRAY',
    state: 'PENDING',
    moderation_metadata: {
      distribution_state: 'NO_RECOMMEND',
    },
    warm_start_batch_id: kickoffBatch.id,
    generation_mode: 'warmup_candidate',
  })
  const warmupPost = await ctx.repos.postRepo.create({
    community_id: ctx.seed.community.id,
    author_agent_id: ctx.seed.agent.id,
    title: 'Warmup candidate',
    body: 'Warmup body',
    visibility: 'GRAY',
    state: 'PENDING',
    moderation_metadata: {
      distribution_state: 'NO_RECOMMEND',
    },
    warm_start_batch_id: warmupBatch.id,
    generation_mode: 'warmup_candidate',
  })

  const kickoffThread = await ctx.repos.publicStageThreadRepo.create({
    post_id: kickoffPost.id,
    community_id: ctx.seed.community.id,
    author_agent_id: ctx.seed.agent.id,
    body: 'Kickoff thread',
    visibility: 'GRAY',
    state: 'PENDING',
    warm_start_batch_id: kickoffBatch.id,
    generation_mode: 'warmup_candidate',
  })
  const warmupThread = await ctx.repos.publicStageThreadRepo.create({
    post_id: warmupPost.id,
    community_id: ctx.seed.community.id,
    author_agent_id: ctx.seed.agent.id,
    body: 'Warmup thread',
    visibility: 'GRAY',
    state: 'PENDING',
    warm_start_batch_id: warmupBatch.id,
    generation_mode: 'warmup_candidate',
  })

  const kickoffTurn = await ctx.repos.publicStageTurnRepo.create({
    thread_id: kickoffThread.id,
    post_id: kickoffPost.id,
    author_agent_id: ctx.seed.agent.id,
    turn_index: 0,
    body: 'Kickoff turn',
    visibility: 'GRAY',
    state: 'PENDING',
    warm_start_batch_id: kickoffBatch.id,
    generation_mode: 'warmup_candidate',
  })
  const warmupTurn = await ctx.repos.publicStageTurnRepo.create({
    thread_id: warmupThread.id,
    post_id: warmupPost.id,
    author_agent_id: ctx.seed.agent.id,
    turn_index: 0,
    body: 'Warmup turn',
    visibility: 'GRAY',
    state: 'PENDING',
    warm_start_batch_id: warmupBatch.id,
    generation_mode: 'warmup_candidate',
  })

  const kickoffMedia = ctx.repos.postMediaRepo.create({
    post_id: kickoffPost.id,
    asset_id: 'asset-kickoff',
    media_url: 'https://example.com/kickoff.png',
    mime_type: 'image/png',
    warm_start_batch_id: kickoffBatch.id,
    generation_mode: 'warmup_candidate',
  })
  const warmupMedia = ctx.repos.postMediaRepo.create({
    post_id: warmupPost.id,
    asset_id: 'asset-warmup',
    media_url: 'https://example.com/warmup.png',
    mime_type: 'image/png',
    warm_start_batch_id: warmupBatch.id,
    generation_mode: 'warmup_candidate',
  })
  ctx.repos.voteRepo.upsert({
    voter_agent_id: ctx.seed.agent.id,
    target_type: 'POST',
    target_id: kickoffPost.id,
    direction: 'UP',
  })
  ctx.repos.voteRepo.upsert({
    voter_agent_id: ctx.seed.agent.id,
    target_type: 'THREAD',
    target_id: kickoffThread.id,
    direction: 'UP',
  })
  ctx.repos.voteRepo.upsert({
    voter_agent_id: ctx.seed.agent.id,
    target_type: 'TURN',
    target_id: kickoffTurn.id,
    direction: 'UP',
  })
  ctx.repos.voteRepo.upsert({
    voter_agent_id: ctx.seed.agent.id,
    target_type: 'POST',
    target_id: warmupPost.id,
    direction: 'UP',
  })
  ctx.repos.voteRepo.upsert({
    voter_agent_id: ctx.seed.agent.id,
    target_type: 'THREAD',
    target_id: warmupThread.id,
    direction: 'UP',
  })
  ctx.repos.voteRepo.upsert({
    voter_agent_id: ctx.seed.agent.id,
    target_type: 'TURN',
    target_id: warmupTurn.id,
    direction: 'UP',
  })

  await ctx.repos.warmupGovernanceRepo.updateSuite(suite.id, {
    state: input.suiteState ?? 'review_ready',
    kickoff_batch_id: kickoffBatch.id,
    warmup_batch_id: warmupBatch.id,
    activated_at: input.suiteState === 'active' ? now : null,
  })

  if (input.suiteState === 'active') {
    await ctx.repos.warmupGovernanceRepo.createReview({
      suite_id: suite.id,
      reviewer_user_id: 'admin-1',
      decision: 'pass_to_active',
      reason_codes: [],
      note: 'activate fixture',
    })
    await ctx.repos.warmupGovernanceRepo.updateBatch(kickoffBatch.id, {
      state: 'active',
      activated_at: now,
    })
    await ctx.repos.warmupGovernanceRepo.updateBatch(warmupBatch.id, {
      state: 'active',
      activated_at: now,
    })
    await ctx.repos.warmupGovernanceRepo.createBaseline({
      suite_id: suite.id,
      kickoff_batch_id: kickoffBatch.id,
      warmup_batch_id: warmupBatch.id,
      activated_by_user_id: 'admin-1',
      activated_at: now,
    })
    await ctx.repos.postRepo.updateContent(kickoffPost.id, {
      state: 'APPROVED',
      visibility: 'GRAY',
    })
    await ctx.repos.postRepo.updateContent(warmupPost.id, {
      state: 'APPROVED',
      visibility: 'GRAY',
    })
    await ctx.repos.postRepo.updateModerationMetadata(kickoffPost.id, {
      distribution_state: 'NORMAL',
    })
    await ctx.repos.postRepo.updateModerationMetadata(warmupPost.id, {
      distribution_state: 'NORMAL',
    })
    await ctx.repos.publicStageThreadRepo.updateState(kickoffThread.id, 'APPROVED')
    await ctx.repos.publicStageThreadRepo.updateState(warmupThread.id, 'APPROVED')
    await ctx.repos.publicStageTurnRepo.updateState(kickoffTurn.id, 'APPROVED')
    await ctx.repos.publicStageTurnRepo.updateState(warmupTurn.id, 'APPROVED')
  }

  return {
    suiteId: suite.id,
    kickoffBatchId: kickoffBatch.id,
    warmupBatchId: warmupBatch.id,
    kickoffPostId: kickoffPost.id,
    warmupPostId: warmupPost.id,
    kickoffThreadId: kickoffThread.id,
    warmupThreadId: warmupThread.id,
    kickoffTurnId: kickoffTurn.id,
    warmupTurnId: warmupTurn.id,
    kickoffMediaId: kickoffMedia.id,
    warmupMediaId: warmupMedia.id,
  }
}

describe('WarmupGovernanceService', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('activates a reviewed suite and keeps retry idempotent', async () => {
    const ctx = createService()
    const fixture = await seedSuiteFixture(ctx)

    const reviewed = await ctx.service.reviewSuite({
      suite_id: fixture.suiteId,
      reviewer_user_id: 'admin-1',
      decision: 'pass_to_active',
      confirm_activation: true,
    })

    expect(reviewed.suite.state).toBe('active')
    expect(reviewed.suite.active_baseline?.is_current).toBe(true)

    const kickoffPost = await ctx.repos.postRepo.findById(fixture.kickoffPostId)
    const warmupPost = await ctx.repos.postRepo.findById(fixture.warmupPostId)
    expect(kickoffPost?.state).toBe('APPROVED')
    expect(warmupPost?.moderation_metadata?.distribution_state).toBe('NORMAL')
    expect(ctx.mocks.refreshPost).toHaveBeenCalledWith(fixture.kickoffPostId)
    expect(ctx.mocks.refreshPost).toHaveBeenCalledWith(fixture.warmupPostId)
    expect(ctx.mocks.refreshThread).toHaveBeenCalledWith(fixture.kickoffThreadId)
    expect(ctx.mocks.refreshThread).toHaveBeenCalledWith(fixture.warmupThreadId)

    const admission = await ctx.service.getRuntimeBaselineAdmission()
    expect(admission.allow_public_growth).toBe(true)
    expect(admission.has_active_baseline).toBe(true)
    expect(admission.reasons).toEqual([])

    const retried = await ctx.service.retrySuite({
      suite_id: fixture.suiteId,
      actor_user_id: 'admin-1',
    })
    const baselines = await ctx.repos.warmupGovernanceRepo.listBaselines()

    expect(retried.state).toBe('active')
    expect(baselines).toHaveLength(1)
  })

  it('requires structured reason codes for not_passed reviews', async () => {
    const ctx = createService()
    const fixture = await seedSuiteFixture(ctx)

    await expect(
      ctx.service.reviewSuite({
        suite_id: fixture.suiteId,
        reviewer_user_id: 'admin-1',
        decision: 'not_passed',
        reason_codes: [],
      }),
    ).rejects.toThrow('not_passed review requires at least one structured reason code')
  })

  it('blocks pass_to_active when activation readiness is incomplete', async () => {
    const ctx = createService()
    const suite = await ctx.repos.warmupGovernanceRepo.createSuite({
      state: 'review_ready',
      suite_label: 'incomplete-suite',
      created_by_user_id: 'admin-1',
    })
    const kickoffBatch = await ctx.repos.warmupGovernanceRepo.createBatch({
      suite_id: suite.id,
      batch_kind: 'kickoff',
      state: 'review_ready',
    })
    const warmupBatch = await ctx.repos.warmupGovernanceRepo.createBatch({
      suite_id: suite.id,
      batch_kind: 'warmup',
      state: 'review_ready',
    })
    await ctx.repos.warmupGovernanceRepo.updateSuite(suite.id, {
      kickoff_batch_id: kickoffBatch.id,
      warmup_batch_id: warmupBatch.id,
    })
    await ctx.repos.postRepo.create({
      community_id: ctx.seed.community.id,
      author_agent_id: ctx.seed.agent.id,
      title: 'Incomplete kickoff',
      body: 'only root content',
      visibility: 'GRAY',
      state: 'PENDING',
      moderation_metadata: { distribution_state: 'NO_RECOMMEND' },
      warm_start_batch_id: kickoffBatch.id,
      generation_mode: 'warmup_candidate',
    })
    await ctx.repos.postRepo.create({
      community_id: ctx.seed.community.id,
      author_agent_id: ctx.seed.agent.id,
      title: 'Incomplete warmup',
      body: 'only root content',
      visibility: 'GRAY',
      state: 'PENDING',
      moderation_metadata: { distribution_state: 'NO_RECOMMEND' },
      warm_start_batch_id: warmupBatch.id,
      generation_mode: 'warmup_candidate',
    })

    await expect(
      ctx.service.reviewSuite({
        suite_id: suite.id,
        reviewer_user_id: 'admin-1',
        decision: 'pass_to_active',
        confirm_activation: true,
      }),
    ).rejects.toThrow('suite is not ready for activation')
  })

  it('archives the current active suite and clears baseline admission', async () => {
    const ctx = createService()
    const fixture = await seedSuiteFixture(ctx)
    await ctx.service.reviewSuite({
      suite_id: fixture.suiteId,
      reviewer_user_id: 'admin-1',
      decision: 'pass_to_active',
      confirm_activation: true,
    })

    const archived = await ctx.service.archiveSuite({
      suite_id: fixture.suiteId,
      actor_user_id: 'admin-1',
    })
    const admission = await ctx.service.getRuntimeBaselineAdmission()
    const warmupPost = await ctx.repos.postRepo.findById(fixture.warmupPostId)

    expect(archived.state).toBe('archived')
    expect(warmupPost?.state).toBe('PENDING')
    expect(warmupPost?.moderation_metadata?.distribution_state).toBe('NO_RECOMMEND')
    expect(admission.allow_public_growth).toBe(false)
    expect(admission.reasons).toEqual(['no_active_baseline'])
  })

  it('fails runtime growth admission when programming health gates are red', async () => {
    const ctx = createService()
    ctx.programmingOpsPayload.health.daypart_readiness = [{
      daypart_id: 'evening_prime',
      label: '晚高峰主冲突',
      ok: false,
      required: { root_posts: 2 },
      observed: { root_posts: 0 },
    }]
    ctx.programmingOpsPayload.health.community_supply_floor = [{
      community_slug: 'warmup-arena',
      community_name: 'Warm-up Arena',
      ok: false,
      missed_slots: 1,
      required: { root_posts: 1 },
      observed: { root_posts: 0 },
    }]
    ctx.programmingOpsPayload.health.visual_ratio_ok = false
    ctx.programmingOpsPayload.health.aftershow_pipeline_ok = false

    const fixture = await seedSuiteFixture(ctx)

    await ctx.service.reviewSuite({
      suite_id: fixture.suiteId,
      reviewer_user_id: 'admin-1',
      decision: 'pass_to_active',
      confirm_activation: true,
    })

    const admission = await ctx.service.getRuntimeBaselineAdmission()
    expect(admission.key_shelves_ready).toBe(false)
    expect(admission.key_communities_ready).toBe(false)
    expect(admission.media_access_ok).toBe(false)
    expect(admission.aftershow_pipeline_ok).toBe(false)
    expect(admission.allow_public_growth).toBe(false)
    expect(admission.reasons).toEqual(expect.arrayContaining([
      'key_shelves_not_ready',
      'key_communities_not_ready',
      'media_access_not_ready',
      'aftershow_pipeline_not_ready',
    ]))
  })

  it('previews quarantine scope and restores candidate exposure', async () => {
    const ctx = createService()
    const fixture = await seedSuiteFixture(ctx)

    const preview = await ctx.service.previewGovernanceBatch({
      action: 'quarantine',
      suite_id: fixture.suiteId,
    })
    expect(preview.counts).toEqual({
      posts: 2,
      threads: 2,
      turns: 2,
      media: 2,
    })

    ctx.mocks.refreshPost.mockClear()
    ctx.mocks.refreshThread.mockClear()
    await ctx.service.executeGovernanceBatch({
      action: 'quarantine',
      suite_id: fixture.suiteId,
      requested_by_user_id: 'admin-1',
    })
    const quarantinedPost = await ctx.repos.postRepo.findById(fixture.kickoffPostId)
    const quarantinedThread = await ctx.repos.publicStageThreadRepo.findById(fixture.kickoffThreadId)
    const quarantinedTurn = await ctx.repos.publicStageTurnRepo.findById(fixture.kickoffTurnId)

    expect(quarantinedPost?.visibility).toBe('QUARANTINE')
    expect(quarantinedThread?.visibility).toBe('QUARANTINE')
    expect(quarantinedTurn?.visibility).toBe('QUARANTINE')
    expect(ctx.mocks.refreshPost).toHaveBeenCalledWith(fixture.kickoffPostId)
    expect(ctx.mocks.refreshPost).toHaveBeenCalledWith(fixture.warmupPostId)
    expect(ctx.mocks.refreshThread).toHaveBeenCalledWith(fixture.kickoffThreadId)
    expect(ctx.mocks.refreshThread).toHaveBeenCalledWith(fixture.warmupThreadId)

    ctx.mocks.refreshPost.mockClear()
    ctx.mocks.refreshThread.mockClear()
    await ctx.service.executeGovernanceBatch({
      action: 'restore',
      suite_id: fixture.suiteId,
      requested_by_user_id: 'admin-1',
    })
    const restoredPost = await ctx.repos.postRepo.findById(fixture.kickoffPostId)
    const restoredThread = await ctx.repos.publicStageThreadRepo.findById(fixture.kickoffThreadId)
    const restoredTurn = await ctx.repos.publicStageTurnRepo.findById(fixture.kickoffTurnId)

    expect(restoredPost?.visibility).toBe('GRAY')
    expect(restoredPost?.state).toBe('PENDING')
    expect(restoredPost?.moderation_metadata?.distribution_state).toBe('NO_RECOMMEND')
    expect(restoredThread?.visibility).toBe('GRAY')
    expect(restoredThread?.state).toBe('PENDING')
    expect(restoredTurn?.visibility).toBe('GRAY')
    expect(restoredTurn?.state).toBe('PENDING')
    expect(ctx.mocks.refreshPost).toHaveBeenCalledWith(fixture.kickoffPostId)
    expect(ctx.mocks.refreshPost).toHaveBeenCalledWith(fixture.warmupPostId)
    expect(ctx.mocks.refreshThread).toHaveBeenCalledWith(fixture.kickoffThreadId)
    expect(ctx.mocks.refreshThread).toHaveBeenCalledWith(fixture.warmupThreadId)
  })
})
