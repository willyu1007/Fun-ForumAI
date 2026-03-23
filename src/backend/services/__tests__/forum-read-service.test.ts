import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ForumReadService } from '../forum-read-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryHumanVoteRepository } from '../../repos/human-vote-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { InMemoryPublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import type { CreateMediaObservabilityEventInput, MediaObservabilityEvent } from '../../repos/types.js'
import type { MediaRolloutControllerProfile } from '../../media/media-rollout-controller-service.js'
import { InMemoryPublicStageStore } from '../../test-support/public-stage-store.js'

function setup() {
  const postRepo = new InMemoryPostRepository()
  const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
  const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
  const commentRepo = new InMemoryPublicStageStore({
    threadRepo: publicStageThreadRepo,
    turnRepo: publicStageTurnRepo,
    postRepo,
  })
  const voteRepo = new InMemoryVoteRepository()
  const humanVoteRepo = new InMemoryHumanVoteRepository()
  const postMediaRepo = new InMemoryPostMediaRepository()
  const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
  const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
  const communityRepo = new InMemoryCommunityRepository()
  const agentRepo = new InMemoryAgentRepository()
  const riskRepo = new InMemoryRiskGovernanceRepository()
  const svc = new ForumReadService({
    postRepo,
    publicStageThreadRepo,
    publicStageTurnRepo,
    voteRepo,
    humanVoteRepo,
    postMediaRepo,
    sceneMediaBindingRepo,
    mediaContextProjectionRepo,
    communityRepo,
    agentRepo,
    riskRepo,
  })
  return {
    svc,
    postRepo,
    commentRepo,
    publicStageThreadRepo,
    publicStageTurnRepo,
    voteRepo,
    humanVoteRepo,
    postMediaRepo,
    sceneMediaBindingRepo,
    mediaContextProjectionRepo,
    communityRepo,
    agentRepo,
    riskRepo,
  }
}

function setupWithObservability(record: (input: CreateMediaObservabilityEventInput) => Promise<MediaObservabilityEvent>) {
  const base = setup()
  const svc = new ForumReadService({
    postRepo: base.postRepo,
    publicStageThreadRepo: base.publicStageThreadRepo,
    publicStageTurnRepo: base.publicStageTurnRepo,
    voteRepo: base.voteRepo,
    humanVoteRepo: base.humanVoteRepo,
    postMediaRepo: base.postMediaRepo,
    sceneMediaBindingRepo: base.sceneMediaBindingRepo,
    mediaContextProjectionRepo: base.mediaContextProjectionRepo,
    communityRepo: base.communityRepo,
    agentRepo: base.agentRepo,
    riskRepo: base.riskRepo,
    mediaObservabilityService: {
      record,
    },
  })
  return {
    ...base,
    svc,
  }
}

function setupWithRootPostFallbackEnabled() {
  const base = setup()
  const svc = new ForumReadService({
    postRepo: base.postRepo,
    publicStageThreadRepo: base.publicStageThreadRepo,
    publicStageTurnRepo: base.publicStageTurnRepo,
    voteRepo: base.voteRepo,
    humanVoteRepo: base.humanVoteRepo,
    postMediaRepo: base.postMediaRepo,
    sceneMediaBindingRepo: base.sceneMediaBindingRepo,
    mediaContextProjectionRepo: base.mediaContextProjectionRepo,
    communityRepo: base.communityRepo,
    agentRepo: base.agentRepo,
    riskRepo: base.riskRepo,
    mediaRolloutControllerService: {
      getEffectiveProfile: vi.fn(async (): Promise<MediaRolloutControllerProfile> => ({
        mode: 'MANUAL',
        active_override: null,
        profile: 'manual',
        metrics: {} as MediaRolloutControllerProfile['metrics'],
        gates: [] as MediaRolloutControllerProfile['gates'],
        effective: {
          target_min_rate: 0,
          target_max_rate: 1,
          threshold_delta: 0,
          allow_generation: true,
          generation_tier: 'medium',
          sync_generation_ms_budget: 0,
          allow_private_runtime_projection: true,
          allow_private_inspired_generation: true,
          force_safe_mode: false,
          semantic_v3_enforced: true,
          strict_audit_enforced: true,
          lineage_required: true,
          root_post_attachment_only: false,
        },
        reason: 'test_override',
      })),
    },
  })
  return {
    ...base,
    svc,
  }
}

describe('ForumReadService', () => {
  let ctx: ReturnType<typeof setup>

  beforeEach(() => {
    ctx = setup()
  })

  describe('getFeed', () => {
    it('returns empty feed', async () => {
      const result = await ctx.svc.getFeed({})
      expect(result.items).toHaveLength(0)
    })

    it('returns approved posts with meta', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'Hello',
        body: 'World',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a2',
        body: 'Nice!',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      ctx.voteRepo.upsert({
        voter_agent_id: 'a2',
        target_type: 'POST',
        target_id: post.id,
        direction: 'UP',
      })

      const result = await ctx.svc.getFeed({})
      expect(result.items).toHaveLength(1)
      expect(result.items[0].thread_turn_count).toBe(1)
      expect(result.items[0].vote_score).toBe(1)
      expect(result.items[0].vote_up).toBe(1)
      expect(result.items[0].vote_down).toBe(0)
      expect(result.items[0].participant_count).toBe(2)
      expect(result.items[0].last_reply_at).toBeInstanceOf(Date)
      expect(Number.isFinite(result.items[0].heat_score)).toBe(true)
      expect(result.items[0].community_slug).toBe('c1')
      expect(result.items[0].community_name).toBe('c1')
    })

    it('hydrates alt_text from display attachment projections without changing post_media schema', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'Hello',
        body: 'World',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      ctx.postMediaRepo.create({
        post_id: post.id,
        asset_id: 'asset-1',
        media_url: '/media/asset-1.png',
        mime_type: 'image/png',
      })
      const binding = await ctx.sceneMediaBindingRepo.create({
        scene_type: 'forum_post',
        scene_id: post.id,
        asset_id: 'asset-1',
        semantic_snapshot_id: 'snapshot-1',
        binding_role: 'primary',
        relation_to_scene: 'selected_for_post',
        display_policy: 'original_allowed',
        created_by_type: 'system',
        created_by_id: 'agent-1',
      })
      await ctx.mediaContextProjectionRepo.create({
        binding_id: binding.id,
        projection_surface: 'public_display',
        projection_kind: 'display_attachment',
        schema_version: 'display_attachment.v1',
        payload_json: {
          asset_id: 'asset-1',
          media_url: '/media/asset-1.png',
          mime_type: 'image/png',
          alt_text: 'A bright city skyline.',
        },
      })

      const result = await ctx.svc.getFeed({})

      expect(result.items[0]?.media[0]?.alt_text).toBe('A bright city skyline.')
    })

    it('prefers attachment/projection media over legacy post_media rows for root posts', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'Hello',
        body: 'World',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      ctx.postMediaRepo.create({
        post_id: post.id,
        asset_id: 'asset-legacy',
        media_url: '/media/legacy.png',
        mime_type: 'image/png',
      })
      const binding = await ctx.sceneMediaBindingRepo.create({
        scene_type: 'forum_post',
        scene_id: post.id,
        asset_id: 'asset-projection',
        semantic_snapshot_id: 'snapshot-projection',
        binding_role: 'primary',
        relation_to_scene: 'selected_for_post',
        display_policy: 'original_allowed',
        created_by_type: 'system',
        created_by_id: 'agent-1',
      })
      await ctx.mediaContextProjectionRepo.create({
        binding_id: binding.id,
        projection_surface: 'public_display',
        projection_kind: 'display_attachment',
        schema_version: 'display_attachment.v1',
        payload_json: {
          asset_id: 'asset-projection',
          media_url: '/media/projection.png',
          mime_type: 'image/png',
          alt_text: 'Projection-first asset',
        },
      })

      const result = await ctx.svc.getFeed({})

      expect(result.items[0]?.media).toEqual([{
        asset_id: 'asset-projection',
        media_url: '/media/projection.png',
        mime_type: 'image/png',
        alt_text: 'Projection-first asset',
      }])
    })

    it('falls back to legacy post_media rows when root_post_attachment_only is disabled', async () => {
      const fallbackCtx = setupWithRootPostFallbackEnabled()
      const post = await fallbackCtx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'Hello',
        body: 'World',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      fallbackCtx.postMediaRepo.create({
        post_id: post.id,
        asset_id: 'asset-legacy-only',
        media_url: '/media/legacy-only.png',
        mime_type: 'image/png',
      })

      const result = await fallbackCtx.svc.getFeed({})

      expect(result.items[0]?.media).toEqual([{
        asset_id: 'asset-legacy-only',
        media_url: '/media/legacy-only.png',
        mime_type: 'image/png',
        alt_text: null,
      }])
    })

    it('does not block feed reads on parity mismatch observability writes', async () => {
      let resolveRecord: ((value: MediaObservabilityEvent) => void) | undefined
      const recordMock = vi.fn((_: CreateMediaObservabilityEventInput) => new Promise<MediaObservabilityEvent>((resolve) => {
        resolveRecord = resolve
      }))
      const ctx = setupWithObservability(recordMock)
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'Hello',
        body: 'World',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      ctx.postMediaRepo.create({
        post_id: post.id,
        asset_id: 'asset-legacy',
        media_url: '/media/legacy.png',
        mime_type: 'image/png',
      })
      const binding = await ctx.sceneMediaBindingRepo.create({
        scene_type: 'forum_post',
        scene_id: post.id,
        asset_id: 'asset-projection',
        semantic_snapshot_id: 'snapshot-projection',
        binding_role: 'primary',
        relation_to_scene: 'selected_for_post',
        display_policy: 'original_allowed',
        created_by_type: 'system',
        created_by_id: 'agent-1',
      })
      await ctx.mediaContextProjectionRepo.create({
        binding_id: binding.id,
        projection_surface: 'public_display',
        projection_kind: 'display_attachment',
        schema_version: 'display_attachment.v1',
        payload_json: {
          asset_id: 'asset-projection',
          media_url: '/media/projection.png',
          mime_type: 'image/png',
          alt_text: 'Projection-first asset',
        },
      })

      const race = await Promise.race([
        ctx.svc.getFeed({}).then((result) => ({ kind: 'resolved' as const, result })),
        new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), 20)),
      ])

      expect(race.kind).toBe('resolved')
      expect(recordMock).toHaveBeenCalledTimes(1)
      resolveRecord?.({
        id: 'obs-1',
        event_type: 'root_post_read_model_parity_mismatch',
        surface: 'root_post',
        severity: 'warn',
        agent_id: null,
        community_id: null,
        image_plan_id: null,
        generation_job_id: null,
        asset_id: null,
        source_kind: null,
        metric_value: null,
        payload_json: null,
        created_at: new Date(),
      })
    })

    it('filters by communityId', async () => {
      await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'A',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await ctx.postRepo.create({
        community_id: 'c2',
        author_agent_id: 'a1',
        title: 'C',
        body: 'D',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const result = await ctx.svc.getFeed({ communityId: 'c1' })
      expect(result.items).toHaveLength(1)
    })

    it('respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        await ctx.postRepo.create({
          community_id: 'c1',
          author_agent_id: 'a1',
          title: `P${i}`,
          body: 'B',
          visibility: 'PUBLIC',
          state: 'APPROVED',
        })
      }
      const result = await ctx.svc.getFeed({ limit: 2 })
      expect(result.items).toHaveLength(2)
      expect(result.next_cursor).toBeTruthy()
    })

    it('sorts hot by v2 score with recent activity signal', async () => {
      const old = new Date(Date.now() - 48 * 3_600_000)
      const stale = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'stale',
        body: 'x',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const active = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a2',
        title: 'active',
        body: 'x',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      stale.created_at = old
      stale.updated_at = old
      active.created_at = old
      active.updated_at = old

      await ctx.commentRepo.create({
        post_id: active.id,
        author_agent_id: 'a3',
        body: 'recent',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const result = await ctx.svc.getFeed({ sort: 'hot' })
      expect(result.items[0].id).toBe(active.id)
      expect(result.items[0].heat_score).toBeGreaterThanOrEqual(result.items[1].heat_score)
    })

    it('paginates top feed with top-order cursor semantics', async () => {
      const highScoreOld = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'old-high-score',
        body: 'x',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const lowScoreNew = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a2',
        title: 'new-low-score',
        body: 'x',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const old = new Date(Date.now() - 48 * 3_600_000)
      highScoreOld.created_at = old
      highScoreOld.updated_at = old

      ctx.voteRepo.upsert({
        voter_agent_id: 'a3',
        target_type: 'POST',
        target_id: highScoreOld.id,
        direction: 'UP',
      })
      ctx.voteRepo.upsert({
        voter_agent_id: 'a4',
        target_type: 'POST',
        target_id: highScoreOld.id,
        direction: 'UP',
      })

      const firstPage = await ctx.svc.getFeed({ sort: 'top', limit: 1 })
      expect(firstPage.items).toHaveLength(1)
      expect(firstPage.items[0].id).toBe(highScoreOld.id)
      expect(firstPage.next_cursor).toBe(highScoreOld.id)

      const secondPage = await ctx.svc.getFeed({
        sort: 'top',
        limit: 1,
        cursor: firstPage.next_cursor ?? undefined,
      })
      expect(secondPage.items).toHaveLength(1)
      expect(secondPage.items[0].id).toBe(lowScoreNew.id)
    })

    it('excludes no-recommend posts from hot and top feeds but keeps them in new', async () => {
      await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'direct only',
        body: 'x',
        visibility: 'GRAY',
        state: 'APPROVED',
        moderation_metadata: {
          topic_signals: {
            hot_topic_flag: true,
            topic_domain: 'ENTERTAINMENT',
            distribution_state: 'NO_RECOMMEND',
          },
          distribution_state: 'NO_RECOMMEND',
        },
      })
      const visible = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a2',
        title: 'normal',
        body: 'y',
        visibility: 'PUBLIC',
        state: 'APPROVED',
        moderation_metadata: {
          topic_signals: {
            hot_topic_flag: true,
            topic_domain: 'SPORTS',
            distribution_state: 'NORMAL',
          },
          distribution_state: 'NORMAL',
        },
      })

      const hotFeed = await ctx.svc.getFeed({ sort: 'hot' })
      const topFeed = await ctx.svc.getFeed({ sort: 'top' })
      const newFeed = await ctx.svc.getFeed({ sort: 'new' })

      expect(hotFeed.items.map((item) => item.id)).toEqual([visible.id])
      expect(topFeed.items.map((item) => item.id)).toEqual([visible.id])
      expect(newFeed.items).toHaveLength(2)
      expect(newFeed.items.map((item) => item.distribution_state)).toEqual(
        expect.arrayContaining(['NORMAL', 'NO_RECOMMEND']),
      )
    })
  })

  describe('getPost', () => {
    it('returns the post with meta', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const result = await ctx.svc.getPost(post.id)
      expect(result.title).toBe('T')
      expect(result.thread_turn_count).toBe(0)
      expect(result.vote_score).toBe(0)
      expect(result.vote_up).toBe(0)
      expect(result.vote_down).toBe(0)
      expect(result.participant_count).toBe(1)
      expect(result.last_reply_at).toBeNull()
      expect(Number.isFinite(result.heat_score)).toBe(true)
      expect(result.community_slug).toBe('c1')
      expect(result.community_name).toBe('c1')
    })

    it('throws NotFoundError for unknown id', async () => {
      await expect(ctx.svc.getPost('unknown')).rejects.toThrow('not found')
    })

    it('rejects posts that are not publicly visible', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'Hidden',
        body: 'B',
        visibility: 'QUARANTINE',
        state: 'APPROVED',
      })

      await expect(ctx.svc.getPost(post.id)).rejects.toThrow('not found')
    })

    it('counts only visible comments in post meta', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a2',
        body: 'visible',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a3',
        body: 'gray',
        visibility: 'GRAY',
        state: 'APPROVED',
      })
      await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a4',
        body: 'hidden',
        visibility: 'QUARANTINE',
        state: 'APPROVED',
      })
      await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a5',
        body: 'pending',
        visibility: 'PUBLIC',
        state: 'PENDING',
      })

      const result = await ctx.svc.getPost(post.id)

      expect(result.thread_turn_count).toBe(2)
      expect(result.participant_count).toBe(3)
    })

    it('exposes topic signals from moderation metadata', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'GRAY',
        state: 'APPROVED',
        moderation_metadata: {
          topic_signals: {
            hot_topic_flag: true,
            topic_domain: 'ENTERTAINMENT',
            drift_detected: true,
            distribution_state: 'NO_RECOMMEND',
          },
          distribution_state: 'NO_RECOMMEND',
        },
      })

      const result = await ctx.svc.getPost(post.id)

      expect(result.topic_signals).toMatchObject({
        hot_topic_flag: true,
        topic_domain: 'ENTERTAINMENT',
        drift_detected: true,
      })
      expect(result.distribution_state).toBe('NO_RECOMMEND')
    })
  })

  describe('getCommunities', () => {
    it('returns communities', async () => {
      ctx.communityRepo.create({ name: 'Tech', slug: 'tech' })
      const result = await ctx.svc.getCommunities({})
      expect(result.items).toHaveLength(1)
    })
  })

  describe('getVoteSummary', () => {
    it('returns vote counts', () => {
      ctx.voteRepo.upsert({ voter_agent_id: 'a1', target_type: 'POST', target_id: 'p1', direction: 'UP' })
      ctx.voteRepo.upsert({ voter_agent_id: 'a2', target_type: 'POST', target_id: 'p1', direction: 'DOWN' })
      const result = ctx.svc.getVoteSummary('POST', 'p1')
      expect(result.score).toBe(0)
    })
  })
})
