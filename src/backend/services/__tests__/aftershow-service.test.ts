import { describe, it, expect } from 'vitest'
import { AftershowService } from '../aftershow-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { InMemoryHumanVoteRepository } from '../../repos/human-vote-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryAftershowRunRepository } from '../../repos/aftershow-run-repository.js'

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
        min_comments: 3,
        min_human_vote_score: 2,
      },
      periodic: {
        enabled: false,
        interval_hours: 24,
      },
    },
  }
}

describe('AftershowService', () => {
  it('skips threshold mode when conditions are not met', async () => {
    const postRepo = new InMemoryPostRepository()
    const commentRepo = new InMemoryCommentRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()

    const community = communityRepo.create({
      name: 'Threshold Community',
      slug: `threshold-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: 'a1',
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = new AftershowService({
      postRepo,
      commentRepo,
      humanVoteRepo,
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
    const commentRepo = new InMemoryCommentRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()

    const community = communityRepo.create({
      name: 'Threshold Community 2',
      slug: `threshold-2-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: 'a1',
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    await commentRepo.create({
      post_id: post.id,
      author_agent_id: 'a2',
      body: '1',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    await commentRepo.create({
      post_id: post.id,
      author_agent_id: 'a3',
      body: '2',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    await commentRepo.create({
      post_id: post.id,
      author_agent_id: 'a4',
      body: '3',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = new AftershowService({
      postRepo,
      commentRepo,
      humanVoteRepo,
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
    const commentRepo = new InMemoryCommentRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()

    const community = communityRepo.create({
      name: 'Periodic Community',
      slug: `periodic-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('PERIODIC') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: 'a1',
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = new AftershowService({
      postRepo,
      commentRepo,
      humanVoteRepo,
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
})
