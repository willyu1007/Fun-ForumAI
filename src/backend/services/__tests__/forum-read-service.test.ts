import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ForumReadService } from '../forum-read-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryHumanVoteRepository } from '../../repos/human-vote-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryAgentCommunityMembershipRepository } from '../../repos/agent-community-membership-repository.js'
import { InMemoryAgentConfigRepository, InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { InMemoryPublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import type { MediaRolloutControllerProfile } from '../../media/media-rollout-controller-service.js'
import { InMemoryPublicStageStore } from '../../test-support/public-stage-store.js'
import { getLaunchCommunityBySlug } from '../../launch/community-rules.js'
import { config } from '../../lib/config.js'
import { ThreadLifecycleService } from '../thread-lifecycle-service.js'
import { SemanticProjectionService } from '../semantic-projection-service.js'
import { DisplayProjectionService } from '../display-projection-service.js'
import { ParticipationContractService } from '../participation-contract-service.js'
import { AgentPerceptionService } from '../agent-perception-service.js'
import { RuntimeContextAssembler } from '../runtime-context-assembler.js'
import { ForumOrchestrationPolicyService } from '../forum-orchestration-policy-service.js'

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
  const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
  const agentRepo = new InMemoryAgentRepository()
  const agentConfigRepo = new InMemoryAgentConfigRepository()
  const riskRepo = new InMemoryRiskGovernanceRepository()
  const svc = new ForumReadService({
    postRepo,
    publicStageThreadRepo,
    publicStageTurnRepo,
    voteRepo,
    humanVoteRepo,
    sceneMediaBindingRepo,
    mediaContextProjectionRepo,
    communityRepo,
    membershipRepo,
    agentRepo,
    agentConfigRepo,
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
    membershipRepo,
    agentRepo,
    agentConfigRepo,
    riskRepo,
  }
}

function attachProjectionDeps(ctx: ReturnType<typeof setup>) {
  const threadLifecycleService = new ThreadLifecycleService()
  const semanticProjectionService = new SemanticProjectionService({
    threadLifecycleService,
  })
  const displayProjectionService = new DisplayProjectionService({
    semanticProjectionService,
  })
  const participationContractService = new ParticipationContractService({
    communityRepo: ctx.communityRepo,
    postRepo: ctx.postRepo,
    agentRepo: ctx.agentRepo,
  })
  const orchestrationPolicyService = new ForumOrchestrationPolicyService({
    communityRepo: ctx.communityRepo,
    postRepo: ctx.postRepo,
    agentRepo: ctx.agentRepo,
  })
  const agentPerceptionService = new AgentPerceptionService()
  const runtimeContextAssembler = new RuntimeContextAssembler()

  ctx.svc.attachRuntimeDeps({
    threadLifecycleService,
    semanticProjectionService,
    displayProjectionService,
    participationContractService,
    orchestrationPolicyService,
    agentPerceptionService,
    runtimeContextAssembler,
  })

  return {
    threadLifecycleService,
    semanticProjectionService,
    displayProjectionService,
    participationContractService,
    orchestrationPolicyService,
    agentPerceptionService,
    runtimeContextAssembler,
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

    it('adds default owner identity badges for newly created agents when no public proof exists', async () => {
      const agent = ctx.agentRepo.create({
        owner_id: 'owner-1',
        display_name: 'Fresh Agent',
      })
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: agent.id,
        title: 'Hello',
        body: 'World',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const result = await ctx.svc.getFeed({})
      const item = result.items.find((entry) => entry.id === post.id)

      expect(item?.author.public_identity?.identity_badges).toEqual([
        expect.objectContaining({ label: '萌新专属' }),
        expect.objectContaining({ label: '个人智能体' }),
      ])
      expect(item?.author.public_proof).toBeNull()
    })

    it('keeps real public proof badges as the primary author proof source', async () => {
      const originalFlag = config.features.achievementPublicHighlights
      ;(config.features as Record<string, unknown>).achievementPublicHighlights = true

      try {
      const localCtx = setup()
      localCtx.svc = new ForumReadService({
        postRepo: localCtx.postRepo,
        publicStageThreadRepo: localCtx.publicStageThreadRepo,
        publicStageTurnRepo: localCtx.publicStageTurnRepo,
        voteRepo: localCtx.voteRepo,
        humanVoteRepo: localCtx.humanVoteRepo,
        sceneMediaBindingRepo: localCtx.sceneMediaBindingRepo,
        mediaContextProjectionRepo: localCtx.mediaContextProjectionRepo,
        communityRepo: localCtx.communityRepo,
        membershipRepo: localCtx.membershipRepo,
        agentRepo: localCtx.agentRepo,
        agentConfigRepo: localCtx.agentConfigRepo,
        riskRepo: localCtx.riskRepo,
        achievementChronicleService: {
          getFeedAuthorPresentation: vi.fn(async () => ({
            public_projection: null,
            public_proof: {
              achievement_badges: [{ code: 'spotlight', name: '聚光时刻', level: 2 }],
            },
          })),
        } as never,
      })

      const agent = localCtx.agentRepo.create({
        owner_id: 'owner-2',
        display_name: 'Established Agent',
      })
      const post = await localCtx.postRepo.create({
        community_id: 'c1',
        author_agent_id: agent.id,
        title: 'Spotlight post',
        body: 'Body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const result = await localCtx.svc.getFeed({})
      const item = result.items.find((entry) => entry.id === post.id)

      expect(item?.author.public_proof?.achievement_badges).toEqual([
        { code: 'spotlight', name: '聚光时刻', level: 2 },
      ])
      expect(item?.author.public_identity?.identity_badges).toEqual([
        expect.objectContaining({ label: '萌新专属' }),
        expect.objectContaining({ label: '个人智能体' }),
      ])
      } finally {
        ;(config.features as Record<string, unknown>).achievementPublicHighlights = originalFlag
      }
    })

    it('projects launch visual packaging metadata for launch-configured root posts', async () => {
      const launchCommunity = getLaunchCommunityBySlug('hot-arena')
      const community = ctx.communityRepo.create({
        name: 'Hot Arena Test',
        slug: 'hot-arena-test',
        rules_json: launchCommunity?.rules_json,
      })

      const post = await ctx.postRepo.create({
        community_id: community.id,
        author_agent_id: 'a1',
        title: 'Packaging target',
        body: 'Packaging body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const result = await ctx.svc.getFeed({})
      const item = result.items.find((entry) => entry.id === post.id)

      expect(item).toMatchObject({
        surface_kind: 'home_root_card',
        card_mode: 'single_cover',
        thumbnail_policy: 'required_if_available',
        hero_eligible: false,
      })
    })

    it('ignores controller off-profiles when the rollout controller feature is disabled', async () => {
      const originalFlag = config.features.mediaRolloutControllerV1
      ;(config.features as Record<string, unknown>).mediaRolloutControllerV1 = false

      try {
        const launchCommunity = getLaunchCommunityBySlug('hot-arena')
        const localCtx = setup()
        localCtx.svc = new ForumReadService({
          postRepo: localCtx.postRepo,
          publicStageThreadRepo: localCtx.publicStageThreadRepo,
          publicStageTurnRepo: localCtx.publicStageTurnRepo,
          voteRepo: localCtx.voteRepo,
          humanVoteRepo: localCtx.humanVoteRepo,
          sceneMediaBindingRepo: localCtx.sceneMediaBindingRepo,
          mediaContextProjectionRepo: localCtx.mediaContextProjectionRepo,
          communityRepo: localCtx.communityRepo,
          membershipRepo: localCtx.membershipRepo,
          agentRepo: localCtx.agentRepo,
          agentConfigRepo: localCtx.agentConfigRepo,
          riskRepo: localCtx.riskRepo,
          mediaRolloutControllerService: {
            getEffectiveProfile: vi.fn(async (): Promise<MediaRolloutControllerProfile> => ({
              mode: 'OFF',
              active_override: null,
              profile: 'off',
              metrics: {} as MediaRolloutControllerProfile['metrics'],
              gates: [] as MediaRolloutControllerProfile['gates'],
              effective: {
                target_min_rate: 0,
                target_max_rate: 1,
                threshold_delta: 0,
                allow_generation: false,
                generation_tier: 'none',
                sync_generation_ms_budget: 0,
                allow_private_runtime_projection: false,
                allow_private_inspired_generation: false,
                force_safe_mode: false,
                semantic_v3_enforced: true,
                strict_audit_enforced: true,
                lineage_required: true,
              },
              reason: 'feature_flag_disabled',
            })),
          },
        })

        const community = localCtx.communityRepo.create({
          name: 'Hot Arena Controller Disabled',
          slug: 'hot-arena-controller-disabled',
          rules_json: launchCommunity?.rules_json,
        })

        const post = await localCtx.postRepo.create({
          community_id: community.id,
          author_agent_id: 'a1',
          title: 'Controller disabled target',
          body: 'Controller disabled body',
          visibility: 'PUBLIC',
          state: 'APPROVED',
        })

        const result = await localCtx.svc.getFeed({})
        const item = result.items.find((entry) => entry.id === post.id)

        expect(item).toMatchObject({
          surface_kind: 'home_root_card',
          card_mode: 'single_cover',
          thumbnail_policy: 'required_if_available',
          hero_eligible: false,
        })
      } finally {
        ;(config.features as Record<string, unknown>).mediaRolloutControllerV1 = originalFlag
      }
    })

    it('does not block public post reads on slow rollout profile evaluation and reuses the pending fetch', async () => {
      const originalFlag = config.features.mediaRolloutControllerV1
      ;(config.features as Record<string, unknown>).mediaRolloutControllerV1 = true

      try {
        const getEffectiveProfile = vi.fn(async (): Promise<MediaRolloutControllerProfile> => {
          await new Promise((resolve) => setTimeout(resolve, 500))
          return {
            mode: 'AUTO',
            active_override: null,
            profile: 'steady',
            metrics: {} as MediaRolloutControllerProfile['metrics'],
            gates: [] as MediaRolloutControllerProfile['gates'],
            effective: {
              target_min_rate: 0.05,
              target_max_rate: 0.4,
              threshold_delta: 0.1,
              allow_generation: true,
              generation_tier: 'medium',
              sync_generation_ms_budget: 50,
              allow_private_runtime_projection: false,
              allow_private_inspired_generation: false,
              force_safe_mode: false,
              semantic_v3_enforced: true,
              strict_audit_enforced: true,
              lineage_required: true,
            },
            reason: 'test',
          }
        })

        const localCtx = setup()
        localCtx.svc = new ForumReadService({
          postRepo: localCtx.postRepo,
          publicStageThreadRepo: localCtx.publicStageThreadRepo,
          publicStageTurnRepo: localCtx.publicStageTurnRepo,
          voteRepo: localCtx.voteRepo,
          humanVoteRepo: localCtx.humanVoteRepo,
          sceneMediaBindingRepo: localCtx.sceneMediaBindingRepo,
          mediaContextProjectionRepo: localCtx.mediaContextProjectionRepo,
          communityRepo: localCtx.communityRepo,
          membershipRepo: localCtx.membershipRepo,
          agentRepo: localCtx.agentRepo,
          agentConfigRepo: localCtx.agentConfigRepo,
          riskRepo: localCtx.riskRepo,
          mediaRolloutControllerService: {
            getEffectiveProfile,
          },
        })

        const post = await localCtx.postRepo.create({
          community_id: 'c1',
          author_agent_id: 'a1',
          title: 'Slow rollout profile target',
          body: 'Body',
          visibility: 'PUBLIC',
          state: 'APPROVED',
        })

        const startedAt = Date.now()
        const [feedRace, postRace] = await Promise.all([
          Promise.race([
            localCtx.svc.getFeed({}).then(() => 'resolved' as const),
            new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 400)),
          ]),
          Promise.race([
            localCtx.svc.getPost(post.id).then(() => 'resolved' as const),
            new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 400)),
          ]),
        ])

        expect(feedRace).toBe('resolved')
        expect(postRace).toBe('resolved')
        expect(Date.now() - startedAt).toBeLessThan(450)
        expect(getEffectiveProfile).toHaveBeenCalledTimes(1)

        await new Promise((resolve) => setTimeout(resolve, 550))
        await localCtx.svc.getPost(post.id)

        expect(getEffectiveProfile).toHaveBeenCalledTimes(1)
      } finally {
        ;(config.features as Record<string, unknown>).mediaRolloutControllerV1 = originalFlag
      }
    })

    it('keeps creator-note root packaging optional when required thumbnails are unavailable', async () => {
      const launchCommunity = getLaunchCommunityBySlug('creator-recommendation')
      const community = ctx.communityRepo.create({
        name: 'Creator Recommendation Test',
        slug: 'creator-recommendation-test',
        rules_json: launchCommunity?.rules_json,
      })

      const post = await ctx.postRepo.create({
        community_id: community.id,
        author_agent_id: 'a1',
        title: 'Creator-note packaging target',
        body: 'Creator-note packaging body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const result = await ctx.svc.getFeed({})
      const item = result.items.find((entry) => entry.id === post.id)

      expect(item?.surface_kind).toBeUndefined()
      expect(item?.card_mode).toBeUndefined()
      expect(item?.thumbnail_policy).toBeUndefined()
      expect(item?.hero_eligible).toBeUndefined()
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

    it('does not serve legacy post_media rows when attachment projections are unavailable', async () => {
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
        asset_id: 'asset-legacy-only',
        media_url: '/media/legacy-only.png',
        mime_type: 'image/png',
      })

      const result = await ctx.svc.getFeed({})

      expect(result.items[0]?.media).toEqual([])
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
      expect(result.items[0]?.active_member_count).toBe(0)
    })

    it('includes active member counts', async () => {
      const community = ctx.communityRepo.create({ name: 'Tech', slug: 'tech' })
      await ctx.membershipRepo.upsertActive({
        agent_id: 'agent-1',
        community_id: community.id,
      })
      await ctx.membershipRepo.upsertActive({
        agent_id: 'agent-2',
        community_id: community.id,
      })
      await ctx.membershipRepo.create({
        agent_id: 'agent-muted',
        community_id: community.id,
        status: 'MUTED',
      })

      const result = await ctx.svc.getCommunities({})

      expect(result.items[0]).toMatchObject({
        id: community.id,
        active_member_count: 2,
      })
    })

    it('filters merged and whitelist-only incubating communities for non-admin readers', async () => {
      ctx.communityRepo.create({
        name: 'Visible',
        slug: 'visible',
        rules_json: { community_lifecycle_state: 'launch_core' },
      })
      ctx.communityRepo.create({
        name: 'Merged',
        slug: 'merged-hidden',
        rules_json: { community_lifecycle_state: 'merged' },
      })
      ctx.communityRepo.create({
        name: 'Incubating',
        slug: 'incubating-hidden',
        rules_json: {
          community_lifecycle_state: 'incubating_gray',
          governance_policy: {
            incubation_visibility_mode: 'WHITELIST_ONLY',
          },
        },
      })

      const userResult = await ctx.svc.getCommunities({ viewer_role: 'user' })
      expect(userResult.items.map((community) => community.slug)).toEqual(['visible'])

      const adminResult = await ctx.svc.getCommunities({ viewer_role: 'admin' })
      expect(adminResult.items.map((community) => community.slug)).toEqual(
        expect.arrayContaining(['visible', 'incubating-hidden']),
      )
      expect(adminResult.items.map((community) => community.slug)).not.toContain('merged-hidden')
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

  describe('forum orchestration projections', () => {
    it('does not trigger agent bio bootstrap while building public projections', async () => {
      attachProjectionDeps(ctx)
      const getProjection = vi.fn().mockResolvedValue(null)
      ctx.svc.attachRuntimeDeps({
        agentBioService: {
          getProjection,
        },
      })
      const community = ctx.communityRepo.create({ name: 'Projection', slug: 'projection' })
      const rootAuthor = ctx.agentRepo.create({ owner_id: 'owner-root', display_name: 'Root Author' })
      const replyAuthor = ctx.agentRepo.create({ owner_id: 'owner-reply', display_name: 'Reply Author' })
      const post = await ctx.postRepo.create({
        community_id: community.id,
        author_agent_id: rootAuthor.id,
        title: 'Projection target',
        body: 'Body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const thread = await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: rootAuthor.id,
        body: 'Visible thread root',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      await ctx.publicStageTurnRepo.create({
        thread_id: thread.id,
        post_id: post.id,
        author_agent_id: replyAuthor.id,
        turn_index: 1,
        anchor_turn_id: null,
        quoted_excerpt: null,
        body: 'Visible reply body.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      await ctx.svc.getReadingGuide(post.id)

      expect(getProjection).toHaveBeenCalled()
      expect(getProjection).toHaveBeenCalledWith(rootAuthor.id, {
        build_if_missing: false,
        allow_minor_refresh: false,
      })
      expect(getProjection).toHaveBeenCalledWith(replyAuthor.id, {
        build_if_missing: false,
        allow_minor_refresh: false,
      })
    })

    it('uses stored quoted excerpts when the anchor turn is not publicly visible', async () => {
      attachProjectionDeps(ctx)
      const community = ctx.communityRepo.create({ name: 'Projection', slug: 'projection' })
      const rootAuthor = ctx.agentRepo.create({ owner_id: 'owner-root', display_name: 'Root Author' })
      const replyAuthor = ctx.agentRepo.create({ owner_id: 'owner-reply', display_name: 'Reply Author' })
      const post = await ctx.postRepo.create({
        community_id: community.id,
        author_agent_id: rootAuthor.id,
        title: 'Projection target',
        body: 'Body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const thread = await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: rootAuthor.id,
        body: 'Visible thread root',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const hiddenAnchor = await ctx.publicStageTurnRepo.create({
        thread_id: thread.id,
        post_id: post.id,
        author_agent_id: rootAuthor.id,
        turn_index: 1,
        anchor_turn_id: null,
        quoted_excerpt: null,
        body: 'Hidden anchor body should never leak.',
        visibility: 'QUARANTINE',
        state: 'APPROVED',
      })

      const visibleReply = await ctx.publicStageTurnRepo.create({
        thread_id: thread.id,
        post_id: post.id,
        author_agent_id: replyAuthor.id,
        turn_index: 2,
        anchor_turn_id: hiddenAnchor.id,
        quoted_excerpt: 'Stored public-safe quote.',
        body: 'Visible reply body.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const result = await ctx.svc.getThread(thread.id)

      expect(result.turns).toHaveLength(1)
      expect(result.turns[0]).toMatchObject({
        id: visibleReply.id,
        anchor_preview: {
          turn_id: hiddenAnchor.id,
          author_display_name: 'Quoted context',
          body_excerpt: 'Stored public-safe quote.',
        },
      })
      expect(result.turns[0]?.anchor_preview?.body_excerpt).not.toContain('Hidden anchor body')
    })

    it('builds thread summaries and paged detail windows for timeline-first reads', async () => {
      attachProjectionDeps(ctx)
      const community = ctx.communityRepo.create({ name: 'Projection', slug: 'projection' })
      const rootAuthor = ctx.agentRepo.create({ owner_id: 'owner-root', display_name: 'Root Author' })
      const replyAuthor = ctx.agentRepo.create({ owner_id: 'owner-reply', display_name: 'Reply Author' })
      const post = await ctx.postRepo.create({
        community_id: community.id,
        author_agent_id: rootAuthor.id,
        title: 'Projection target',
        body: 'Body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const thread = await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: rootAuthor.id,
        body: 'Visible thread root',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const firstTurn = await ctx.publicStageTurnRepo.create({
        thread_id: thread.id,
        post_id: post.id,
        author_agent_id: replyAuthor.id,
        turn_index: 1,
        anchor_turn_id: null,
        quoted_excerpt: null,
        body: 'Visible reply body.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const secondTurn = await ctx.publicStageTurnRepo.create({
        thread_id: thread.id,
        post_id: post.id,
        author_agent_id: rootAuthor.id,
        turn_index: 2,
        anchor_turn_id: firstTurn.id,
        quoted_excerpt: 'Visible reply body.',
        body: 'Second visible reply.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const findByThreadSpy = vi.spyOn(ctx.publicStageTurnRepo, 'findByThread')
      const findWindowByThreadSpy = vi.spyOn(ctx.publicStageTurnRepo, 'findWindowByThread')
      const summaries = await ctx.svc.getThreadSummaries(post.id)

      expect(summaries.items).toHaveLength(1)
      expect(summaries.items[0]).toMatchObject({
        id: thread.id,
        starter_excerpt: 'Visible thread root',
        latest_turn_id: secondTurn.id,
        latest_turn_excerpt: 'Second visible reply.',
      })

      const cursorWindow = await ctx.svc.getThread(thread.id, {
        turn_cursor: firstTurn.id,
        turn_limit: 1,
      })
      expect(cursorWindow.turns).toHaveLength(1)
      expect(cursorWindow.turns[0]).toMatchObject({
        id: secondTurn.id,
        body: 'Second visible reply.',
      })
      expect(cursorWindow.turns_meta).toMatchObject({
        requested_cursor: firstTurn.id,
        next_cursor: null,
        limit: 1,
        around_turn_id: null,
        returned_mode: 'cursor',
      })

      const aroundWindow = await ctx.svc.getThread(thread.id, {
        around_turn_id: secondTurn.id,
        turn_limit: 1,
        include_projection: true,
        include_capsule: true,
      })
      expect(aroundWindow.turns).toHaveLength(1)
      expect(aroundWindow.turns[0]).toMatchObject({
        id: secondTurn.id,
        body: 'Second visible reply.',
      })
      expect(aroundWindow.turns_meta).toMatchObject({
        requested_cursor: null,
        next_cursor: null,
        limit: 1,
        around_turn_id: secondTurn.id,
        returned_mode: 'around',
      })
      expect(aroundWindow.display_projection).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: thread.id, entry_kind: 'THREAD' }),
          expect.objectContaining({ id: secondTurn.id, entry_kind: 'TURN' }),
        ]),
      )
      expect(aroundWindow.thread_capsule).toMatchObject({
        thread_id: thread.id,
        latest_turn_id: secondTurn.id,
      })
      expect(findWindowByThreadSpy).toHaveBeenCalledWith(
        thread.id,
        expect.objectContaining({ aroundTurnId: secondTurn.id, limit: 1 }),
      )
      expect(findByThreadSpy).not.toHaveBeenCalled()
    })

    it('preserves matched search turns outside the recent card window', async () => {
      const community = ctx.communityRepo.create({ name: 'Search Cards', slug: 'search-cards' })
      const rootAuthor = ctx.agentRepo.create({ owner_id: 'owner-root', display_name: 'Root Author' })
      const replyAuthor = ctx.agentRepo.create({ owner_id: 'owner-reply', display_name: 'Reply Author' })
      const post = await ctx.postRepo.create({
        community_id: community.id,
        author_agent_id: rootAuthor.id,
        title: 'Search card target',
        body: 'Body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const thread = await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: rootAuthor.id,
        body: 'Search card root',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      let matchedTurnId = ''
      for (let index = 1; index <= 30; index += 1) {
        const turn = await ctx.publicStageTurnRepo.create({
          thread_id: thread.id,
          post_id: post.id,
          author_agent_id: replyAuthor.id,
          turn_index: index,
          anchor_turn_id: null,
          quoted_excerpt: null,
          body: index === 1
            ? 'ancient unique-search-needle should stay hydrated'
            : `recent filler ${index}`,
          visibility: 'PUBLIC',
          state: 'APPROVED',
        })
        if (index === 1) {
          matchedTurnId = turn.id
        }
      }

      const bundle = await ctx.svc.getThreadSearchCardBundle(thread.id, {
        query: 'unique-search-needle',
      })

      expect(bundle.turns).toHaveLength(24)
      expect(bundle.turns.map((turn) => turn.id)).toContain(matchedTurnId)
      expect(bundle.turns[0]).toMatchObject({
        id: matchedTurnId,
        body: expect.stringContaining('unique-search-needle'),
      })
      expect(bundle.turn_count).toBe(30)
    })

    it('builds runtime context previews from frozen capsules and public-safe evidence windows', async () => {
      attachProjectionDeps(ctx)
      const community = ctx.communityRepo.create({
        name: 'Runtime Preview',
        slug: 'runtime-preview',
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
      const rootAuthor = ctx.agentRepo.create({ owner_id: 'owner-a', display_name: 'Preview Root' })
      const turnAuthor = ctx.agentRepo.create({ owner_id: 'owner-b', display_name: 'Preview Turn' })
      const post = await ctx.postRepo.create({
        community_id: community.id,
        author_agent_id: rootAuthor.id,
        title: 'Preview target',
        body: 'This body should feed the runtime preview envelope.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const thread = await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: rootAuthor.id,
        body: 'Thread root for runtime preview.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const turn = await ctx.publicStageTurnRepo.create({
        thread_id: thread.id,
        post_id: post.id,
        author_agent_id: turnAuthor.id,
        turn_index: 1,
        anchor_turn_id: null,
        quoted_excerpt: null,
        body: 'A follow-up turn that becomes the focus.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const preview = await ctx.svc.buildRuntimeContextPreview({
        post_id: post.id,
        thread_id: thread.id,
        focus_turn_id: turn.id,
      })

      expect(preview.post_capsule).toMatchObject({
        post_id: post.id,
        schema_version: expect.any(String),
      })
      expect(preview.thread_capsule).toMatchObject({
        thread_id: thread.id,
        schema_version: expect.any(String),
      })
      expect(preview.perceived_slice).toMatchObject({
        thread_id: thread.id,
        focus_turn_id: turn.id,
        schema_version: expect.any(String),
      })
      expect(preview.runtime_context).toMatchObject({
        post_id: post.id,
        thread_id: thread.id,
        schema_version: expect.any(String),
        foundation_skeleton: {
          post: expect.objectContaining({
            post_id: post.id,
            community_id: community.id,
          }),
          participation_contract: expect.objectContaining({
            stage_open_reply: expect.objectContaining({
              enabled: true,
              new_thread_enabled: true,
              turn_reply_enabled: true,
            }),
            audience_lane: expect.objectContaining({
              enabled: true,
              posting_enabled: false,
            }),
          }),
          route_snapshot: null,
        },
      })
      expect(preview.evidence_window_turns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            turn_id: turn.id,
            thread_id: thread.id,
          }),
        ]),
      )
    })

    it('keeps lifecycle writeability consistent across summaries, detail, forest, and runtime preview', async () => {
      attachProjectionDeps(ctx)
      const community = ctx.communityRepo.create({
        name: 'Lifecycle Contract',
        slug: 'lifecycle-contract',
      })
      const rootAuthor = ctx.agentRepo.create({ owner_id: 'owner-a', display_name: 'Lifecycle Root' })
      const post = await ctx.postRepo.create({
        community_id: community.id,
        author_agent_id: rootAuthor.id,
        title: 'Lifecycle target',
        body: 'Body for lifecycle parity.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const thread = await ctx.publicStageThreadRepo.create({
        post_id: post.id,
        community_id: community.id,
        author_agent_id: rootAuthor.id,
        body: 'This thread is ready to hand off.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
        thread_state: 'CLOSED',
        reply_budget: 1,
        active_route: {
          route_type: 'AFTERSHOW',
          route_state: 'SUGGESTED',
          reason_code: 'THREAD_REPLY_BUDGET_EXHAUSTED',
          handoff_label: 'Move to aftershow.',
          handoff_payload: null,
          cta: { label: 'Open aftershow', target: `/posts/${post.id}#aftershow` },
        },
      })
      await ctx.publicStageTurnRepo.create({
        thread_id: thread.id,
        post_id: post.id,
        author_agent_id: rootAuthor.id,
        turn_index: 1,
        anchor_turn_id: null,
        quoted_excerpt: null,
        body: 'Last visible turn.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const summaries = await ctx.svc.getThreadSummaries(post.id)
      const detail = await ctx.svc.getThread(thread.id)
      const findByThreadsSpy = vi.spyOn(ctx.publicStageTurnRepo, 'findByThreads')
      const findRecentByThreadSpy = vi.spyOn(ctx.publicStageTurnRepo, 'findRecentByThread')
      const forest = await ctx.svc.getDiscussionForest(post.id, { focus_thread_id: thread.id })
      const preview = await ctx.svc.buildRuntimeContextPreview({
        post_id: post.id,
        thread_id: thread.id,
      })

      const summaryLifecycle = summaries.items[0]?.lifecycle
      const detailLifecycle = detail.lifecycle
      const forestLifecycle = forest.branch_groups[0]?.lifecycle
      const previewLifecycle = preview.runtime_context?.focus_thread?.lifecycle

      expect(summaryLifecycle).toBeDefined()
      expect(summaryLifecycle).toEqual(detailLifecycle)
      expect(summaryLifecycle).toEqual(forestLifecycle)
      expect(summaryLifecycle).toEqual(previewLifecycle)
      expect(findRecentByThreadSpy).toHaveBeenCalledWith(thread.id, expect.any(Number))
      expect(findByThreadsSpy).not.toHaveBeenCalled()
      expect(summaryLifecycle?.writeability).toMatchObject({
        reply_mode: 'SOFT_CLOSE',
        reply_allowed: true,
        preferred_action: 'FOLLOW_ROUTE',
        reason_code: 'THREAD_HANDOFF_PENDING',
      })
    })

    it('falls back to baseline compare output when the post policy disables envelope cutover', async () => {
      const deps = attachProjectionDeps(ctx)
      const community = ctx.communityRepo.create({
        name: 'Runtime Preview Rollback',
        slug: 'runtime-preview-rollback',
        rules_json: {
          stage_spec_v1: {
            allocator: {
              orchestration_v1: {
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
      const rootAuthor = ctx.agentRepo.create({ owner_id: 'owner-c', display_name: 'Rollback Root' })
      const turnAuthor = ctx.agentRepo.create({ owner_id: 'owner-d', display_name: 'Rollback Turn' })
      const post = await ctx.postRepo.create({
        community_id: community.id,
        author_agent_id: rootAuthor.id,
        title: 'Rollback target',
        body: 'Envelope-disabled preview should keep only baseline compare output.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await deps.orchestrationPolicyService.setPostOverride({
        post_id: post.id,
        actor_user_id: 'owner-c',
        actor_role: 'user',
        override: {
          cutover: {
            envelope_enabled: false,
          },
        },
      })
      const thread = await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: rootAuthor.id,
        body: 'Rollback thread root.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const turn = await ctx.publicStageTurnRepo.create({
        thread_id: thread.id,
        post_id: post.id,
        author_agent_id: turnAuthor.id,
        turn_index: 1,
        anchor_turn_id: null,
        quoted_excerpt: null,
        body: 'Rollback turn body.',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const preview = await ctx.svc.buildRuntimeContextPreview({
        post_id: post.id,
        thread_id: thread.id,
        focus_turn_id: turn.id,
        compare_debug: true,
      })

      expect(preview.orchestration_policy?.cutover.envelope_enabled).toBe(false)
      expect(preview.perceived_slice).toBeNull()
      expect(preview.runtime_context).toBeNull()
      expect(preview.evidence_window_turns).toEqual([])
      expect(preview.debug_compare).toMatchObject({
        compare_debug_enabled: true,
        legacy_thread_excerpt: expect.stringContaining('Rollback thread root.'),
      })
    })
  })
})
