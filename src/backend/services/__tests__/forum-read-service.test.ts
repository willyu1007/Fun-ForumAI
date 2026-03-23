import { describe, it, expect, beforeEach } from 'vitest'
import { ForumReadService } from '../forum-read-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryHumanVoteRepository } from '../../repos/human-vote-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'

function setup() {
  const postRepo = new InMemoryPostRepository()
  const commentRepo = new InMemoryCommentRepository()
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
    commentRepo,
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
      expect(result.items[0].comment_count).toBe(1)
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
      expect(result.comment_count).toBe(0)
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

      expect(result.comment_count).toBe(2)
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

  describe('getComments', () => {
    it('returns comments for a post', async () => {
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
        body: 'C1',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const result = await ctx.svc.getComments(post.id, {})
      expect(result.items).toHaveLength(1)
    })

    it('throws for unknown post', async () => {
      await expect(ctx.svc.getComments('nope', {})).rejects.toThrow('not found')
    })

    it('rejects comments for a hidden post', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'QUARANTINE',
        state: 'APPROVED',
      })

      await expect(ctx.svc.getComments(post.id, {})).rejects.toThrow('not found')
    })

    it('hydrates comment topic signals from the latest risk event payload', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const comment = await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a2',
        body: 'C1',
        visibility: 'GRAY',
        state: 'APPROVED',
      })
      await ctx.riskRepo.createRiskEvent({
        channel: 'forum_comment',
        event_type: 'policy_gateway_decision',
        action: 'allow',
        target_type: 'comment',
        target_id: comment.id,
        payload: {
          topic_signals: {
            hot_topic_flag: true,
            topic_domain: 'SPORTS',
            distribution_state: 'NO_RECOMMEND',
          },
          distribution_state: 'NO_RECOMMEND',
        },
      })

      const result = await ctx.svc.getComments(post.id, {})

      expect(result.items[0]?.topic_signals).toMatchObject({
        hot_topic_flag: true,
        topic_domain: 'SPORTS',
      })
      expect(result.items[0]?.distribution_state).toBe('NO_RECOMMEND')
    })

    it('does not expose shadow-mode topic signals to comment readers', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const comment = await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a2',
        body: 'C1',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await ctx.riskRepo.createRiskEvent({
        channel: 'forum_comment',
        event_type: 'policy_gateway_decision',
        action: 'allow',
        target_type: 'comment',
        target_id: comment.id,
        payload: {
          shadowed: true,
          topic_signals: {
            hot_topic_flag: true,
            topic_domain: 'SPORTS',
            distribution_state: 'NO_RECOMMEND',
            policy_shadowed: true,
          },
          distribution_state: 'NO_RECOMMEND',
        },
      })

      const result = await ctx.svc.getComments(post.id, {})

      expect(result.items[0]?.topic_signals).toBeNull()
      expect(result.items[0]?.distribution_state).toBe('NORMAL')
    })
  })

  describe('getComment', () => {
    it('rejects hidden comments', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const comment = await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a2',
        body: 'hidden',
        visibility: 'QUARANTINE',
        state: 'APPROVED',
      })

      await expect(ctx.svc.getComment(comment.id)).rejects.toThrow('not found')
    })

    it('rejects comments whose parent post is not publicly visible', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const comment = await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a2',
        body: 'visible',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await ctx.postRepo.updateVisibility(post.id, 'QUARANTINE')

      await expect(ctx.svc.getComment(comment.id)).rejects.toThrow('not found')
    })
  })

  describe('getCommentThreadContext', () => {
    it('returns the ancestor path from root to target', async () => {
      const post = await ctx.postRepo.create({
        community_id: 'c1',
        author_agent_id: 'a1',
        title: 'T',
        body: 'B',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const root = await ctx.commentRepo.create({
        post_id: post.id,
        author_agent_id: 'a2',
        body: 'root',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const child = await ctx.commentRepo.create({
        post_id: post.id,
        parent_comment_id: root.id,
        author_agent_id: 'a3',
        body: 'child',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const target = await ctx.commentRepo.create({
        post_id: post.id,
        parent_comment_id: child.id,
        author_agent_id: 'a4',
        body: 'target',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const result = await ctx.svc.getCommentThreadContext(target.id)

      expect(result.post_id).toBe(post.id)
      expect(result.comments.map((item) => item.id)).toEqual([root.id, child.id, target.id])
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
