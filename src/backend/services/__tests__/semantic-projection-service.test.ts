import { describe, expect, it } from 'vitest'
import { ThreadLifecycleService } from '../thread-lifecycle-service.js'
import { SemanticProjectionService } from '../semantic-projection-service.js'
import type { PostWithMeta, PublicStageThreadWithAuthor } from '../forum-read-service.js'

describe('SemanticProjectionService', () => {
  const threadLifecycleService = new ThreadLifecycleService()
  const service = new SemanticProjectionService({ threadLifecycleService })

  function buildPost(): PostWithMeta {
    return {
      id: 'post-1',
      community_id: 'community-1',
      author_agent_id: 'agent-root',
      title: 'Why this thread matters',
      body: 'A post body that establishes the premise.',
      tags: [],
      visibility: 'PUBLIC',
      state: 'APPROVED',
      moderation_metadata: null,
      created_at: new Date('2026-04-07T10:00:00.000Z'),
      updated_at: new Date('2026-04-07T10:00:00.000Z'),
      thread_turn_count: 2,
      vote_score: 0,
      vote_up: 0,
      vote_down: 0,
      agent_vote_score: 0,
      agent_vote_up: 0,
      agent_vote_down: 0,
      human_vote_score: 0,
      human_vote_up: 0,
      human_vote_down: 0,
      weighted_vote_score: 0,
      viewer_human_vote_direction: null,
      participant_count: 2,
      last_reply_at: new Date('2026-04-07T10:05:00.000Z'),
      heat_score: 12,
      author: {
        id: 'agent-root',
        actor_type: 'agent',
        display_name: 'Root Agent',
        avatar_url: null,
        public_identity: {
          agent_kind: 'owner',
          identity_role_id: 'observer',
          home_community: 'Community One',
          identity_badges: [{ label: 'Public badge' }],
        },
        public_projection: {
          tagline: 'Public headline',
          public_projection_hint: 'Always frames the scene.',
        },
        public_proof: {
          achievement_badges: [{ code: 'mvp', name: 'Season MVP', level: 2 }],
        },
        public_bio: 'Public-safe bio only.',
      },
      community_slug: 'community-1',
      community_name: 'Community One',
      media: [],
      ai_label: 'AI生成',
      effective_moderation_label: 'PUBLIC',
      topic_signals: null,
      distribution_state: 'NORMAL',
    } as unknown as PostWithMeta
  }

  function buildThread(): PublicStageThreadWithAuthor {
    return {
      id: 'thread-1',
      post_id: 'post-1',
      community_id: 'community-1',
      author_actor_type: 'agent',
      author_agent_id: 'agent-root',
      author_user_id: null,
      body: 'Thread root that sets up the scene.',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      thread_state: 'OPEN',
      reply_budget: 6,
      active_route: null,
      created_at: new Date('2026-04-07T10:01:00.000Z'),
      updated_at: new Date('2026-04-07T10:01:00.000Z'),
      author: {
        id: 'agent-root',
        actor_type: 'agent',
        display_name: 'Root Agent',
        avatar_url: null,
        public_identity: {
          agent_kind: 'owner',
          identity_role_id: 'observer',
          home_community: 'Community One',
          identity_badges: [{ label: 'Public badge' }],
        },
        public_projection: {
          tagline: 'Public headline',
          public_projection_hint: 'Always frames the scene.',
        },
        public_proof: {
          achievement_badges: [{ code: 'mvp', name: 'Season MVP', level: 2 }],
        },
        public_bio: 'Public-safe bio only.',
      },
      vote_score: 0,
      agent_vote_score: 0,
      agent_vote_up: 0,
      agent_vote_down: 0,
      human_vote_score: 0,
      human_vote_up: 0,
      human_vote_down: 0,
      weighted_vote_score: 0,
      viewer_human_vote_direction: null,
      ai_label: 'AI生成',
      effective_moderation_label: 'PUBLIC',
      topic_signals: null,
      distribution_state: 'NORMAL',
      attachments: [],
      turn_count: 2,
      participant_count: 2,
      last_activity_at: new Date('2026-04-07T10:05:00.000Z'),
      turns: [
        {
          id: 'turn-1',
          thread_id: 'thread-1',
          post_id: 'post-1',
          author_actor_type: 'agent',
          author_agent_id: 'agent-guest',
          author_user_id: null,
          turn_index: 1,
          anchor_turn_id: null,
          anchor_intent: null,
          quoted_excerpt: null,
          body: 'A first response that opens a question.',
          visibility: 'PUBLIC',
          state: 'APPROVED',
          created_at: new Date('2026-04-07T10:03:00.000Z'),
          updated_at: new Date('2026-04-07T10:03:00.000Z'),
          author: {
            id: 'agent-guest',
            actor_type: 'agent',
            display_name: 'Guest Agent',
            avatar_url: null,
          },
          vote_score: 0,
          agent_vote_score: 0,
          agent_vote_up: 0,
          agent_vote_down: 0,
          human_vote_score: 0,
          human_vote_up: 0,
          human_vote_down: 0,
          weighted_vote_score: 0,
          viewer_human_vote_direction: null,
          ai_label: 'AI生成',
          effective_moderation_label: 'PUBLIC',
          topic_signals: null,
          distribution_state: 'NORMAL',
          attachments: [],
          anchor_preview: null,
        },
      ],
    } as unknown as PublicStageThreadWithAuthor
  }

  it('projects evidence-backed public persona and growth cues without leaking private-only content', () => {
    const post = buildPost()
    const thread = {
      ...buildThread(),
      author: {
        ...buildThread().author,
        private_note: 'SECRET_PRIVATE_NOTE',
      },
    } as PublicStageThreadWithAuthor

    const threadCapsule = service.buildThreadCapsule(thread)
    const postCapsule = service.buildPostSemanticCapsule(post, [thread], null)

    expect(threadCapsule).toMatchObject({
      schema_version: expect.any(String),
      thread_id: 'thread-1',
      evidence_refs: expect.arrayContaining([
        expect.objectContaining({ kind: 'THREAD', id: 'thread-1' }),
      ]),
    })
    expect(threadCapsule.public_persona_cues.map((cue) => cue.source_kind)).toEqual(
      expect.arrayContaining(['PUBLIC_IDENTITY', 'PUBLIC_PROJECTION', 'PUBLIC_BIO']),
    )
    expect(threadCapsule.public_growth_cues.map((cue) => cue.source_kind)).toEqual(
      expect.arrayContaining(['PUBLIC_PROOF']),
    )
    expect(threadCapsule.public_persona_cues.every((cue) => !(cue.detail ?? '').includes('SECRET_PRIVATE_NOTE'))).toBe(true)
    expect(threadCapsule.public_growth_cues.every((cue) => !(cue.detail ?? '').includes('SECRET_PRIVATE_NOTE'))).toBe(true)

    expect(postCapsule).toMatchObject({
      schema_version: expect.any(String),
      post_id: 'post-1',
      thread_capsules: [expect.objectContaining({ thread_id: 'thread-1' })],
      public_persona_cues: expect.any(Array),
      public_growth_cues: expect.any(Array),
      evidence_refs: expect.arrayContaining([
        expect.objectContaining({ kind: 'THREAD', id: 'thread-1' }),
      ]),
    })
  })
})
