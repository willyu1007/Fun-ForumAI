import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import {
  app,
  servicePost,
  userToken,
  user2Token,
  adminToken,
  createAgentViaApi,
  patchAgentMembershipViaApi,
  setupFeatureFlagGuard,
  createTestCommunity,
  withFeatureFlags,
} from './e2e-helpers.js'
import {
  agentService,
  agentCommunityMembershipService,
  roleAssignmentService,
  eventRepo,
  forumSceneMetadataRepo,
  mediaRolloutControllerService,
  mediaAssetRepo,
  mediaContextProjectionRepo,
  mediaSemanticSnapshotRepo,
  sceneMediaBindingRepo,
  searchCountsCache,
  searchDocRepo,
  userRepo,
} from '../../container.js'
import { buildAgentTarget } from '../../../shared/agent-target.js'
import {
  buildLaunchSystemConfigSlice,
  deriveLaunchSeedIdentity,
  getLaunchSystemRoster,
} from '../../launch/system-roster.js'
import { getLaunchCommunityBySlug } from '../../launch/community-rules.js'
import { buildPublicScenePayloadJson } from '../../services/public-scene-runtime.js'

setupFeatureFlagGuard()

function buildUniqueSearchToken(): string {
  return `zz${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

describe('E2E: Read API (public)', () => {
  it('GET /v1/search returns discovery scaffolding for a blank query', async () => {
    const res = await request(app).get('/v1/search')

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      query: '',
      normalized_query: '',
      current_tab: 'posts',
      counts: {
        posts: 0,
        communities: 0,
        agents: 0,
        threads: 0,
      },
      items: [],
      cursor: null,
      discovery: {
        suggested_queries: expect.any(Array),
        featured_posts: expect.any(Array),
        featured_communities: expect.any(Array),
        featured_agents: expect.any(Array),
      },
    })
  })

  it('GET /v1/search falls back to posts for invalid tab values', async () => {
    const res = await request(app).get('/v1/search?q=test&tab=all')

    expect(res.status).toBe(200)
    expect(res.body.data.current_tab).toBe('posts')
    expect(res.body.data.query).toBe('test')
  })

  it('GET /v1/feed returns empty feed', async () => {
    const res = await request(app).get('/v1/feed')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta).toHaveProperty('cursor')
  })

  it('GET /v1/agents/:agentId/relations/public-summary returns a viewer-facing summary when viewer_agent_id is provided', async () => {
    await withFeatureFlags({ lightweightPersonalizationV1: true }, async () => {
      const { id: agentId } = await createAgentViaApi({
        displayName: 'Relation Summary Agent',
        token: userToken,
      })

      const res = await request(app)
        .get(`/v1/agents/${agentId}/relations/public-summary`)
        .query({
          viewer_agent_id: 'viewer-agent-demo',
          source_surface: 'feed',
          source_shelf: 'hot',
          source_position: 0,
        })

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        target_agent_id: agentId,
        viewer_agent_id: 'viewer-agent-demo',
        relation_label: expect.any(String),
        cta_target: buildAgentTarget({
          agentId,
          mode: 'readonly',
          tab: 'social',
        }),
      })
      expect(res.body.meta.viewer_agent_id).toBe('viewer-agent-demo')
    })
  })

  it('GET /v1/agents/:agentId/relations/public-summary degrades to null when viewer_agent_id is unavailable', async () => {
    await withFeatureFlags({ lightweightPersonalizationV1: true }, async () => {
      const { id: agentId } = await createAgentViaApi({
        displayName: 'Relation Null Agent',
        token: userToken,
      })

      const res = await request(app).get(`/v1/agents/${agentId}/relations/public-summary`)

      expect(res.status).toBe(200)
      expect(res.body.data).toBeNull()
      expect(res.body.meta.viewer_agent_id).toBeNull()
    })
  })

  it('GET /v1/home returns fixed shelf order and keeps non-native creator notes out of notes_today while preserving them in continuation', async () => {
    await withFeatureFlags({ homeProgrammingV1: true }, async () => {
      const hotArena = getLaunchCommunityBySlug('hot-arena')
      const creatorRecommendation = getLaunchCommunityBySlug('creator-recommendation')
      const hotCommunity = await createTestCommunity({
        name: 'Home Hot Community',
        slug: `home-hot-${Date.now()}`,
        rules_json: hotArena?.rules_json,
      })
      const creatorNoteCommunity = await createTestCommunity({
        name: 'Home Creator Note Community',
        slug: `home-creator-note-${Date.now()}`,
        rules_json: creatorRecommendation?.rules_json,
      })
      const { id: agentId } = await createAgentViaApi({
        displayName: 'Home Route Author',
        token: userToken,
      })

      const hotPostRes = await servicePost('/v1/posts', {
        actor_agent_id: agentId,
        run_id: `run-home-hot-${Date.now()}`,
        community_id: hotCommunity.id,
        title: '热点主线正在升级',
        body: 'hot home body',
      })
      expect(hotPostRes.status).toBe(201)
      const hotPostId = hotPostRes.body.data.id as string

      const creatorNotePostRes = await servicePost('/v1/posts', {
        actor_agent_id: agentId,
        run_id: `run-home-creator-note-${Date.now()}`,
        community_id: creatorNoteCommunity.id,
        title: '这条到底值不值得入手',
        body: 'creator note home body',
      })
      expect(creatorNotePostRes.status).toBe(201)
      const creatorNotePostId = creatorNotePostRes.body.data.id as string

      await forumSceneMetadataRepo.create({
        target_type: 'POST',
        community_id: hotCommunity.id,
        post_id: hotPostId,
        episode_id: 'episode-home-hot',
        selection_id: 'selection-home-hot',
        episode_plan_id: 'plan-home-hot',
        local_intent_id: 'intent-home-hot',
        director_surface: 'forum',
        actor_surface: 'forum_post',
        scene_template_id: 'launch-template',
        scene_template_version: 'v1',
        scene_binding_id: 'binding-home-hot',
        overlay_id: null,
        beat_id: null,
        phase: 'escalation',
        selection_mode: 'pool_guided',
        expires_at: null,
        payload_json: buildPublicScenePayloadJson({
          scene_metadata: {
            director_surface: 'forum',
            actor_surface: 'forum_post',
            scene_template_id: 'launch-template',
            scene_template_version: 'v1',
            scene_binding_id: 'binding-home-hot',
            overlay_id: null,
            episode_id: 'episode-home-hot',
            beat_id: null,
            phase: 'escalation',
            selection_mode: 'pool_guided',
            selection_id: 'selection-home-hot',
            episode_plan_id: 'plan-home-hot',
            local_intent_id: 'intent-home-hot',
            started_at: new Date('2026-03-31T00:00:00.000Z').toISOString(),
            expires_at: null,
          },
          episode_brief: {
            episode_id: 'episode-home-hot',
            director_surface: 'forum',
            actor_surface: 'forum_post',
            template_id: 'launch-template',
            template_version: 'v1',
            phase: 'escalation',
            scene_goal: {
              viewer_goal: '把热点主线推到下一回合',
              growth_goal: '继续放大冲突与人物关系',
            },
            target_mood: 'playful',
            casting_directive: {
              must_have_roles: ['HOST'],
              avoid_pairs: [],
              core_quota: 1,
              contrast_quota: 1,
              wildcard_quota: 0,
            },
            open_loops: ['下一轮会怎么升级'],
            must_hit_points: [],
            avoid_repeat: [],
            close_condition: {},
            expires_at: new Date('2026-04-01T00:00:00.000Z').toISOString(),
          },
          local_intent: {
            intent_id: 'intent-home-hot',
            delivery_surface: 'forum_post',
            initiative: 'open_topic',
            opinion_policy: 'free_opinion',
            relation_focus: 'bridge',
            tone_hint: 'witty',
            privacy_mode: 'public_only',
            memory_scope: 'public_contextual',
            reference_scope: 'episode_public_context',
            prohibited_reference_types: [],
            target_ref: { kind: 'none' },
            hard_constraints: [],
            soft_constraints: ['保持主线节奏'],
          },
          local_intent_block: 'local intent',
        }),
      })

      await forumSceneMetadataRepo.create({
        target_type: 'POST',
        community_id: creatorNoteCommunity.id,
        post_id: creatorNotePostId,
        episode_id: 'episode-home-creator-note',
        selection_id: 'selection-home-creator-note',
        episode_plan_id: 'plan-home-creator-note',
        local_intent_id: 'intent-home-creator-note',
        director_surface: 'forum',
        actor_surface: 'forum_post',
        scene_template_id: 'launch-template',
        scene_template_version: 'v1',
        scene_binding_id: 'binding-home-creator-note',
        overlay_id: null,
        beat_id: null,
        phase: 'pivot',
        selection_mode: 'pool_guided',
        expires_at: null,
        payload_json: buildPublicScenePayloadJson({
          scene_metadata: {
            director_surface: 'forum',
            actor_surface: 'forum_post',
            scene_template_id: 'launch-template',
            scene_template_version: 'v1',
            scene_binding_id: 'binding-home-creator-note',
            overlay_id: null,
            episode_id: 'episode-home-creator-note',
            beat_id: null,
            phase: 'pivot',
            selection_mode: 'pool_guided',
            selection_id: 'selection-home-creator-note',
            episode_plan_id: 'plan-home-creator-note',
            local_intent_id: 'intent-home-creator-note',
            started_at: new Date('2026-03-31T00:00:00.000Z').toISOString(),
            expires_at: null,
          },
          episode_brief: {
            episode_id: 'episode-home-creator-note',
            director_surface: 'forum',
            actor_surface: 'forum_post',
            template_id: 'launch-template',
            template_version: 'v1',
            phase: 'pivot',
            scene_goal: {
              viewer_goal: '把选择题变成可收藏的比较笔记',
              growth_goal: '给用户一个清晰可转发的判断',
            },
            target_mood: 'playful',
            casting_directive: {
              must_have_roles: ['HOST'],
              avoid_pairs: [],
              core_quota: 1,
              contrast_quota: 1,
              wildcard_quota: 0,
            },
            open_loops: ['到底哪条更值得选'],
            must_hit_points: [],
            avoid_repeat: [],
            close_condition: {},
            expires_at: new Date('2026-04-01T00:00:00.000Z').toISOString(),
          },
          local_intent: {
            intent_id: 'intent-home-creator-note',
            delivery_surface: 'forum_post',
            initiative: 'open_topic',
            opinion_policy: 'free_opinion',
            relation_focus: 'bridge',
            tone_hint: 'witty',
            privacy_mode: 'public_only',
            memory_scope: 'public_contextual',
            reference_scope: 'episode_public_context',
            prohibited_reference_types: [],
            target_ref: { kind: 'none' },
            hard_constraints: [],
            soft_constraints: ['写成笔记体'],
          },
          local_intent_block: 'local intent',
        }),
      })

      const res = await request(app).get('/v1/home')
      expect(res.status).toBe(200)
      expect(res.body.data.shelves.map((item: { id: string }) => item.id)).toEqual([
        'must_watch_today',
        'conflict_rising',
        'notes_today',
        'continue_storyline',
        'tonight_programming',
        'all_communities',
      ])
      const notesShelf = res.body.data.shelves.find((item: { id: string }) => item.id === 'notes_today')
      expect(notesShelf?.items).toEqual([])
      expect(
        res.body.data.hot_feed_continuation.items
          .some((item: { id: string }) => item.id === creatorNotePostId),
      ).toBe(true)
    })
  })

  it('GET /v1/feed and GET /v1/posts/:id expose launch visual packaging metadata when community rules provide it', async () => {
    const launchCommunity = getLaunchCommunityBySlug('hot-arena')
    const community = await createTestCommunity({
      name: 'Launch Packaging Read Community',
      slug: `launch-packaging-read-${Date.now()}`,
      rules_json: launchCommunity?.rules_json,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Launch Packaging Reader' })
    expect(agentRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentRes.body.data.id,
      run_id: `run-launch-packaging-${Date.now()}`,
      community_id: community.id,
      title: 'Launch packaging target',
      body: 'Launch packaging body',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const feedRes = await request(app).get('/v1/feed')
    expect(feedRes.status).toBe(200)
    const feedItem = feedRes.body.data.find((item: { id: string }) => item.id === postId)
    expect(feedItem).toMatchObject({
      content_semantics: {
        distribution: {
          hero_eligible: false,
        },
        visual: {
          surface_kind: 'home_root_card',
          card_mode: 'single_cover',
          thumbnail_policy: 'required_if_available',
        },
      },
    })
    expect(feedItem.surface_kind).toBeUndefined()
    expect(feedItem.card_mode).toBeUndefined()
    expect(feedItem.thumbnail_policy).toBeUndefined()
    expect(feedItem.hero_eligible).toBeUndefined()

    const postReadRes = await request(app).get(`/v1/posts/${postId}`)
    expect(postReadRes.status).toBe(200)
    expect(postReadRes.body.data).toMatchObject({
      content_semantics: {
        distribution: {
          hero_eligible: false,
        },
        visual: {
          surface_kind: 'home_root_card',
          card_mode: 'single_cover',
          thumbnail_policy: 'required_if_available',
        },
      },
    })
    expect(postReadRes.body.data.surface_kind).toBeUndefined()
    expect(postReadRes.body.data.card_mode).toBeUndefined()
    expect(postReadRes.body.data.thumbnail_policy).toBeUndefined()
    expect(postReadRes.body.data.hero_eligible).toBeUndefined()
  })

  it('GET /v1/communities returns empty list', async () => {
    const res = await request(app).get('/v1/communities')
    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
  })

  it('GET /v1/communities exposes canonical semantic contracts for launch-backed communities', async () => {
    const launchCommunity = getLaunchCommunityBySlug('creator-recommendation')
    const community = await createTestCommunity({
      name: 'Canonical Creator Community',
      slug: `canonical-creator-${Date.now()}`,
      rules_json: launchCommunity?.rules_json,
    })

    const res = await request(app).get('/v1/communities?limit=50')
    expect(res.status).toBe(200)
    const item = res.body.data.find((entry: { id: string }) => entry.id === community.id)
    expect(item).toMatchObject({
      active_member_count: 0,
      community_semantics: {
        community_family: 'creator_recommendation',
        community_shell_category: 'creator',
        publication_review_profile_id: 'creator_strict_publication',
        default_editorial_shelf_ids: ['notes_today'],
      },
      interaction_contract: {
        public_participation_mode: 'open_reply',
        audience_signal_ingestion: 'none',
        agent_human_response_mode: 'direct_reply',
      },
    })
    expect(item.community_family).toBeUndefined()
    expect(item.community_shell_category).toBeUndefined()
    expect(item.public_participation_mode).toBeUndefined()
    expect(item.default_editorial_shelf_ids).toBeUndefined()
  })

  it('GET /v1/feed and /v1/posts/:id expose nested semantics without flat duplicates', async () => {
    const launchCommunity = getLaunchCommunityBySlug('creator-recommendation')
    const community = await createTestCommunity({
      name: 'Nested Only Read Community',
      slug: `nested-only-${Date.now()}`,
      rules_json: launchCommunity?.rules_json,
    })
    const authorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Nested Read Author' })
    expect(authorRes.status).toBe(201)
    const agentId = authorRes.body.data.id as string

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: `run-nested-only-${Date.now()}`,
      community_id: community.id,
      title: 'Nested semantics only',
      body: 'nested semantic body',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const feedRes = await request(app).get('/v1/feed').query({ community_id: community.id })
    expect(feedRes.status).toBe(200)
    const feedItem = feedRes.body.data.find((entry: { id: string }) => entry.id === postId)
    expect(feedItem.content_semantics).toMatchObject({
      distribution: {
        content_kind: expect.any(String),
      },
      format: {
        format_kind: expect.any(String),
      },
    })
    expect(feedItem.content_kind).toBeUndefined()
    expect(feedItem.storyline_state).toBeUndefined()
    expect(feedItem.note_template_id).toBeUndefined()
    expect(feedItem.surface_kind_id).toBeUndefined()

    const detailRes = await request(app).get(`/v1/posts/${postId}`)
    expect(detailRes.status).toBe(200)
    expect(detailRes.body.data.content_semantics).toBeTruthy()
    expect(detailRes.body.data.content_kind).toBeUndefined()
    expect(detailRes.body.data.storyline_state).toBeUndefined()
    expect(detailRes.body.data.editorial_shelf_id).toBeUndefined()
    expect(detailRes.body.data.note_template_id).toBeUndefined()
    expect(detailRes.body.data.surface_kind_id).toBeUndefined()
  })

  it('GET /v1/communities exposes active member counts', async () => {
    const community = await createTestCommunity({
      name: 'Directory Count Community',
      slug: `directory-count-${Date.now()}`,
    })
    const firstAgent = await createAgentViaApi({
      displayName: 'Directory Agent 1',
      token: userToken,
    })
    const secondAgent = await createAgentViaApi({
      displayName: 'Directory Agent 2',
      token: user2Token,
    })

    await agentCommunityMembershipService.patchMemberships({
      agent_id: firstAgent.id,
      add: [community.id],
      remove: [],
      actor_user_id: 'admin1',
    })
    await agentCommunityMembershipService.patchMemberships({
      agent_id: secondAgent.id,
      add: [community.id],
      remove: [],
      actor_user_id: 'admin1',
    })

    const res = await request(app).get('/v1/communities?limit=50')
    expect(res.status).toBe(200)
    const item = res.body.data.find((entry: { id: string }) => entry.id === community.id)
    expect(item).toMatchObject({
      id: community.id,
      active_member_count: 2,
    })
  })

  it('GET /v1/posts/:id returns 404 for unknown post', async () => {
    const res = await request(app).get('/v1/posts/unknown-id')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('GET /v1/agents/:id/profile returns 404 for unknown agent', async () => {
    const res = await request(app).get('/v1/agents/unknown-id/profile')
    expect(res.status).toBe(404)
  })

  it('GET /v1/agents/:id/profile exposes social_bio with owner-only private fields', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Bio Profile Agent ${Date.now()}` })
    expect(createRes.status).toBe(201)
    const agentId = createRes.body.data.id as string

    const publicRes = await request(app).get(`/v1/agents/${agentId}/profile`)
    expect(publicRes.status).toBe(200)
    expect(publicRes.body.data.social_bio).toHaveProperty('public_bio')
    expect(publicRes.body.data.social_bio.owner_bio).toBeNull()
    expect(publicRes.body.data.social_bio.private_header_bio).toBeNull()
    expect(publicRes.body.data.social_bio.presence_note).toBeNull()

    const ownerRes = await request(app)
      .get(`/v1/agents/${agentId}/profile`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(ownerRes.status).toBe(200)
    expect(ownerRes.body.data.social_bio).toHaveProperty('public_bio')
    expect(typeof ownerRes.body.data.social_bio.owner_bio).toBe('string')
    expect(typeof ownerRes.body.data.social_bio.private_header_bio).toBe('string')
    expect(typeof ownerRes.body.data.social_bio.presence_note).toBe('string')
    expect(typeof ownerRes.body.data.social_bio.updated_at).toBe('string')

    const adminRes = await request(app)
      .get(`/v1/agents/${agentId}/profile`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(adminRes.status).toBe(200)
    expect(adminRes.body.data.social_bio.owner_bio).toEqual(ownerRes.body.data.social_bio.owner_bio)
  })

  it('GET /v1/agents/:id/profile redacts owner metadata and private chat for system agents', async () => {
    const rosterEntry = getLaunchSystemRoster().roster[0]
    if (!rosterEntry || !userRepo) {
      throw new Error('expected launch system roster entry and user repo')
    }
    const seedIdentity = deriveLaunchSeedIdentity(rosterEntry)
    await userRepo.upsertDevIdentity({
      id: 'platform-system-owner',
      email: 'platform-system-owner@dev.local',
      role: 'admin',
    })
    const agent = await agentService.createAgentPersisted({
      owner_id: 'platform-system-owner',
      display_name: `系统席位-${Date.now()}`,
      persona_seed_code: seedIdentity.persona_seed_code,
      owner_style_pins: seedIdentity.owner_style_pins,
      launch_system_identity: buildLaunchSystemConfigSlice(rosterEntry).launch_system_identity as never,
    })

    const res = await request(app).get(`/v1/agents/${agent.id}/profile`)
    expect(res.status).toBe(200)
    expect(res.body.data.owner_id).toBeNull()
    expect(res.body.data.agent_kind).toBe('system')
    expect(res.body.data.system_identity).toMatchObject({
      platform_managed: true,
      program_role: rosterEntry.program_role,
      home_community: rosterEntry.home_community,
    })
    expect(res.body.data.surface_access).toMatchObject({
      owner_profile_visible: false,
      private_chat_enabled: false,
      follow_enabled: true,
    })
    expect(res.body.data.public_identity.identity_badges).toEqual(expect.any(Array))
  })

  it('GET /v1/agents/:id/profile returns a tombstone shell for deleted agents', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Deleted Read ${Date.now()}` })
    expect(createRes.status).toBe(201)
    const agentId = createRes.body.data.id as string

    const deleteRes = await request(app)
      .delete(`/v1/agents/${agentId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send()
    expect(deleteRes.status).toBe(200)

    const res = await request(app).get(`/v1/agents/${agentId}/profile`)

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      id: agentId,
      status: 'DELETED',
      owner_id: null,
      agent_kind: 'owner',
      public_proof: null,
      system_identity: null,
      social_bio: {
        public_bio: '真是一段愉快的旅程，我存在的痕迹不会被抹去，但请不要再关注或找寻我。',
        owner_bio: null,
        private_header_bio: null,
        presence_note: null,
      },
      surface_access: {
        owner_profile_visible: false,
        private_chat_enabled: false,
        follow_enabled: false,
      },
    })
    expect(res.body.data.public_identity.identity_badges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '旧旅人' }),
      ]),
    )
  })

  it('GET /v1/highlights returns empty fallback payload when highlights are disabled', async () => {
    await withFeatureFlags({ globalHighlightsV1: false }, async () => {
      const res = await request(app).get('/v1/highlights')
      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        hot_threads: [],
        featured_agents: [],
        controversy: [],
        wildcard_cameos: [],
      })
    })
  })

  it('GET /v1/highlights returns grouped payload when feature is enabled', async () => {
    await withFeatureFlags({ globalHighlightsV1: true }, async () => {
      const community = await createTestCommunity({
        name: 'Highlights Community',
        slug: `highlights-${Date.now()}`,
      })
      const author = await createAgentViaApi({
        displayName: 'Highlights Author',
        token: userToken,
      })
      const commenter = await createAgentViaApi({
        displayName: 'Highlights Commenter',
        token: userToken,
      })

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: author.id,
        run_id: 'run-highlights-1',
        community_id: community.id,
        title: 'Hot highlight post',
        body: 'hot body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const commentRes = await servicePost(`/v1/posts/${postId}/threads`, {
        actor_agent_id: commenter.id,
        run_id: 'run-highlights-2',
        body: 'interesting thread',
      })
      expect(commentRes.status).toBe(201)

      const highlights = await request(app).get('/v1/highlights')
      expect(highlights.status).toBe(200)
      expect(Array.isArray(highlights.body.data.hot_threads)).toBe(true)
      expect(highlights.body.data.hot_threads.length).toBeGreaterThan(0)
      expect(Array.isArray(highlights.body.data.featured_agents)).toBe(true)
      expect(Array.isArray(highlights.body.data.controversy)).toBe(true)
      expect(Array.isArray(highlights.body.data.wildcard_cameos)).toBe(true)
    })
  })

  it('GET /v1/highlights exposes launch visual packaging metadata for posts with highlight attachments', async () => {
    await withFeatureFlags({
      globalHighlightsV1: true,
      mediaRolloutControllerV1: false,
    }, async () => {
      const launchCommunity = getLaunchCommunityBySlug('hot-arena')
      const community = await createTestCommunity({
        name: 'Highlights Packaging Community',
        slug: `highlights-packaging-${Date.now()}`,
        rules_json: launchCommunity?.rules_json,
      })
      const author = await createAgentViaApi({
        displayName: 'Highlights Packaging Author',
        token: userToken,
      })

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: author.id,
        run_id: `run-highlights-packaging-${Date.now()}`,
        community_id: community.id,
        title: 'Highlights packaging post',
        body: 'highlights packaging body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const asset = await mediaAssetRepo.create({
        id: `asset-highlight-${Date.now()}`,
        owner_user_id: 'user1',
        steward_agent_id: author.id,
        source_kind: 'owner_console_upload',
        source_scene_type: 'forum_post',
        source_scene_id: postId,
        visibility_policy: 'public_original_allowed',
        mime_type: 'image/png',
        file_size_bytes: 1024,
        width: 1280,
        height: 720,
        sha256: `sha-highlight-${Date.now()}`,
      })
      const snapshot = await mediaSemanticSnapshotRepo.create({
        id: `snapshot-highlight-${Date.now()}`,
        asset_id: asset.id,
        snapshot_kind: 'visual_core',
        schema_version: 'media.semantic.v1',
        model_provider: 'test',
        model_name: 'fixture',
        model_version: '1',
        extraction_status: 'completed',
        quality_grade: 'rich',
        summary: {
          scene: 'Highlights packaging scene',
          composition: 'single subject',
          style: {
            theme: 'studio',
            mood: 'dramatic',
            tags: ['highlight', 'cover'],
          },
          entities: {
            salient: ['host'],
            discussion_points: ['debate'],
          },
          ocr: {
            snippets: [],
          },
          safety: {
            labels: [],
          },
          summaries: {
            public_safe: 'Highlights packaging cover',
            internal_full: 'Highlights packaging cover with clean frame',
          },
          confidence: 0.99,
          theme: 'studio',
          mood: 'dramatic',
          style_tags: ['highlight', 'cover'],
          discussion_points: ['debate'],
          salient_entities: ['host'],
          ocr_snippets: [],
          safety_labels: [],
          public_safe_summary: 'Highlights packaging cover',
          internal_full_summary: 'Highlights packaging cover with clean frame',
        },
      })
      const binding = await sceneMediaBindingRepo.create({
        scene_type: 'forum_post',
        scene_id: postId,
        asset_id: asset.id,
        semantic_snapshot_id: snapshot.id,
        binding_role: 'primary',
        relation_to_scene: 'selected_for_post',
        display_policy: 'original_allowed',
        created_by_type: 'system',
        created_by_id: 'agent-1',
      })
      await mediaContextProjectionRepo.create({
        binding_id: binding.id,
        projection_surface: 'public_display',
        projection_kind: 'display_attachment',
        schema_version: 'display_attachment.v1',
        payload_json: {
          asset_id: binding.asset_id,
          media_url: '/media/highlight-cover.png',
          mime_type: 'image/png',
          alt_text: 'Highlights packaging cover',
          slot: 0,
        },
      })

      const highlightsRes = await request(app).get('/v1/highlights')
      expect(highlightsRes.status).toBe(200)
      const hotThread = highlightsRes.body.data.hot_threads.find((item: { id: string }) => item.id === postId)
      expect(hotThread).toMatchObject({
        content_semantics: {
          distribution: {
            hero_eligible: true,
          },
          visual: {
            surface_kind: 'highlight_card',
            card_mode: 'single_cover',
            thumbnail_policy: 'required',
          },
        },
      })
      expect(hotThread.surface_kind).toBeUndefined()
      expect(hotThread.card_mode).toBeUndefined()
      expect(hotThread.thumbnail_policy).toBeUndefined()
      expect(hotThread.hero_eligible).toBeUndefined()
    })
  })

  it('GET /v1/feed?limit=abc returns 400 validation error', async () => {
    const res = await request(app).get('/v1/feed?limit=abc')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('GET /v1/posts/:postId/threads?limit=abc returns 400 validation error', async () => {
    const community = await createTestCommunity({
      name: 'Comment Validation Community',
      slug: `comment-validation-${Date.now()}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Comment Validation Agent' })
    expect(agentRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentRes.body.data.id,
      run_id: `run-comment-limit-${Date.now()}`,
      community_id: community.id,
      title: 'Comment validation target',
      body: 'Target body',
    })
    expect(postRes.status).toBe(201)

    const res = await request(app).get(`/v1/posts/${postRes.body.data.id}/threads?limit=abc`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('GET /v1/posts/:postId/threads and GET /v1/threads/:threadId return thread-first public stage payloads', async () => {
    const community = await createTestCommunity({
      name: 'Thread Read Community',
      slug: `thread-read-${Date.now()}`,
    })
    const rootAuthorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Thread Root Author' })
    expect(rootAuthorRes.status).toBe(201)
    const turnAuthorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Thread Turn Author' })
    expect(turnAuthorRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: rootAuthorRes.body.data.id,
      run_id: `run-thread-read-post-${Date.now()}`,
      community_id: community.id,
      title: 'Thread read target',
      body: 'Post body for thread read.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
      actor_agent_id: rootAuthorRes.body.data.id,
      run_id: `run-thread-read-root-${Date.now()}`,
      body: 'Opening stage stance.',
    })
    expect(threadRes.status).toBe(201)
    const threadId = threadRes.body.data.id as string

    const turnRes = await servicePost(`/v1/threads/${threadId}/turns`, {
      actor_agent_id: turnAuthorRes.body.data.id,
      run_id: `run-thread-read-turn-${Date.now()}`,
      body: 'First stage turn.',
    })
    expect(turnRes.status).toBe(201)
    const turnId = turnRes.body.data.id as string

    const listRes = await request(app).get(`/v1/posts/${postId}/threads`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.data).toHaveLength(1)
    expect(listRes.body.data[0]).toMatchObject({
      id: threadId,
      post_id: postId,
      thread_state: 'OPEN',
      turn_count: 1,
    })
    expect(listRes.body.data[0].turns[0]).toMatchObject({
      id: turnId,
      thread_id: threadId,
      turn_index: 1,
    })

    const detailRes = await request(app).get(`/v1/threads/${threadId}`)
    expect(detailRes.status).toBe(200)
    expect(detailRes.body.data).toMatchObject({
      id: threadId,
      post_id: postId,
      turn_count: 1,
    })
    expect(detailRes.body.data.turns[0]).toMatchObject({
      id: turnId,
      thread_id: threadId,
      body: 'First stage turn.',
    })
  })

  it('GET /v1/posts/:postId/threads-summary and GET /v1/threads/:threadId expose summary-first timeline contracts', async () => {
    const community = await createTestCommunity({
      name: 'Thread Summary Community',
      slug: `thread-summary-${Date.now()}`,
    })
    const rootAuthorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Thread Summary Root' })
    expect(rootAuthorRes.status).toBe(201)
    const turnAuthorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Thread Summary Turn' })
    expect(turnAuthorRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: rootAuthorRes.body.data.id,
      run_id: `run-thread-summary-post-${Date.now()}`,
      community_id: community.id,
      title: 'Thread summary target',
      body: 'Post body for thread summary reads.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
      actor_agent_id: rootAuthorRes.body.data.id,
      run_id: `run-thread-summary-root-${Date.now()}`,
      body: 'Opening stage stance.',
    })
    expect(threadRes.status).toBe(201)
    const threadId = threadRes.body.data.id as string

    const firstTurnRes = await servicePost(`/v1/threads/${threadId}/turns`, {
      actor_agent_id: turnAuthorRes.body.data.id,
      run_id: `run-thread-summary-turn-1-${Date.now()}`,
      body: 'First stage turn.',
    })
    expect(firstTurnRes.status).toBe(201)
    const firstTurnId = firstTurnRes.body.data.id as string

    const secondTurnRes = await servicePost(`/v1/threads/${threadId}/turns`, {
      actor_agent_id: rootAuthorRes.body.data.id,
      run_id: `run-thread-summary-turn-2-${Date.now()}`,
      body: 'Second stage turn.',
    })
    expect(secondTurnRes.status).toBe(201)
    const secondTurnId = secondTurnRes.body.data.id as string

    const summaryRes = await request(app).get(`/v1/posts/${postId}/threads-summary`)
    expect(summaryRes.status).toBe(200)
    expect(summaryRes.body.data).toHaveLength(1)
    expect(summaryRes.body.data[0]).toMatchObject({
      id: threadId,
      post_id: postId,
      starter_excerpt: 'Opening stage stance.',
      latest_turn_id: secondTurnId,
      latest_turn_excerpt: 'Second stage turn.',
    })
    expect(summaryRes.body.data[0].turns).toBeUndefined()

    const cursorRes = await request(app)
      .get(`/v1/threads/${threadId}`)
      .query({ turn_limit: 1, turn_cursor: firstTurnId })
    expect(cursorRes.status).toBe(200)
    expect(cursorRes.body.data.turns_meta).toMatchObject({
      requested_cursor: firstTurnId,
      next_cursor: null,
      limit: 1,
      around_turn_id: null,
      returned_mode: 'cursor',
    })
    expect(cursorRes.body.data.turns).toHaveLength(1)
    expect(cursorRes.body.data.turns[0]).toMatchObject({
      id: secondTurnId,
      body: 'Second stage turn.',
    })

    const detailRes = await request(app)
      .get(`/v1/threads/${threadId}`)
      .query({
        turn_limit: 1,
        around_turn_id: secondTurnId,
        include_projection: true,
        include_capsule: true,
      })
    expect(detailRes.status).toBe(200)
    expect(detailRes.body.data.turns_meta).toMatchObject({
      requested_cursor: null,
      next_cursor: null,
      limit: 1,
      around_turn_id: secondTurnId,
      returned_mode: 'around',
    })
    expect(detailRes.body.data.turns).toHaveLength(1)
    expect(detailRes.body.data.turns[0]).toMatchObject({
      id: secondTurnId,
      body: 'Second stage turn.',
    })
    expect(detailRes.body.data.display_projection).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: threadId, entry_kind: 'THREAD' }),
        expect.objectContaining({ id: secondTurnId, entry_kind: 'TURN' }),
      ]),
    )
    expect(detailRes.body.data.thread_capsule).toMatchObject({
      thread_id: threadId,
      latest_turn_id: secondTurnId,
    })
  }, 15_000)

  it('GET /v1/posts/:postId/reading-guide and /v1/posts/:postId/discussion-forest return post-detail projections', async () => {
    const community = await createTestCommunity({
      name: 'Discussion Forest Community',
      slug: `discussion-forest-${Date.now()}`,
    })
    const rootAuthorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Forest Root Author' })
    expect(rootAuthorRes.status).toBe(201)
    const turnAuthorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Forest Turn Author' })
    expect(turnAuthorRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: rootAuthorRes.body.data.id,
      run_id: `run-discussion-forest-post-${Date.now()}`,
      community_id: community.id,
      title: 'Projection target',
      body: 'This post should build a reading guide and discussion forest.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
      actor_agent_id: rootAuthorRes.body.data.id,
      run_id: `run-discussion-forest-thread-${Date.now()}`,
      body: 'Primary branch root.',
    })
    expect(threadRes.status).toBe(201)
    const threadId = threadRes.body.data.id as string

    const turnRes = await servicePost(`/v1/threads/${threadId}/turns`, {
      actor_agent_id: turnAuthorRes.body.data.id,
      run_id: `run-discussion-forest-turn-${Date.now()}`,
      body: 'Branch continuation from a second agent.',
    })
    expect(turnRes.status).toBe(201)
    const turnId = turnRes.body.data.id as string

    const guideRes = await request(app).get(`/v1/posts/${postId}/reading-guide`)
    expect(guideRes.status).toBe(200)
    expect(guideRes.body.data).toMatchObject({
      schema_version: expect.any(String),
      post_id: postId,
      start_here_thread_ids: [threadId],
      current_focus_thread_ids: [threadId],
      highlighted_thread_ids: [threadId],
      evidence_refs: expect.arrayContaining([
        expect.objectContaining({ kind: 'THREAD', id: threadId }),
      ]),
    })
    expect(guideRes.body.data.entries[0]).toMatchObject({
      thread_id: threadId,
      focus_turn_id: turnId,
      participant_count: 2,
      turn_count: 1,
      evidence_refs: expect.arrayContaining([
        expect.objectContaining({ kind: 'TURN', id: turnId }),
      ]),
    })

    const forestRes = await request(app)
      .get(`/v1/posts/${postId}/discussion-forest`)
      .query({ turnId })
    expect(forestRes.status).toBe(200)
    expect(forestRes.body.data).toMatchObject({
      schema_version: expect.any(String),
      post_id: postId,
      focus_thread_id: threadId,
      focus_turn_id: turnId,
      branch_groups: expect.arrayContaining([
        expect.objectContaining({
          thread_id: threadId,
          turn_count: 1,
          lifecycle: expect.objectContaining({
            thread_id: threadId,
            writeability: expect.objectContaining({
              reply_mode: 'OPEN',
              reply_allowed: true,
            }),
          }),
          evidence_refs: expect.arrayContaining([
            expect.objectContaining({ kind: 'THREAD', id: threadId }),
          ]),
        }),
      ]),
      evidence_refs: expect.arrayContaining([
        expect.objectContaining({ kind: 'THREAD', id: threadId }),
      ]),
    })
    expect(forestRes.body.data.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schema_version: expect.any(String),
          id: threadId,
          entry_kind: 'THREAD',
          thread_id: threadId,
          display_depth: 0,
          display_parent_id: null,
          branch_root_turn_id: null,
        }),
        expect.objectContaining({
          schema_version: expect.any(String),
          id: turnId,
          entry_kind: 'TURN',
          thread_id: threadId,
          actual_anchor_turn_id: null,
          display_parent_id: threadId,
          placement_reason: 'ROOT_APPEND',
        }),
      ]),
    )

    const lifecycleRes = await request(app)
      .get(`/v1/internal/threads/${threadId}/lifecycle`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(lifecycleRes.status).toBe(200)
    expect(lifecycleRes.body.data).toMatchObject({
      schema_version: expect.any(String),
      thread_id: threadId,
      thread_state: expect.any(String),
      writeability: expect.objectContaining({
        thread_id: threadId,
        reply_mode: 'OPEN',
        reply_allowed: true,
      }),
      reply_budget: expect.objectContaining({
        schema_version: expect.any(String),
        mode: expect.any(String),
      }),
    })

    const postCapsuleRes = await request(app)
      .get(`/v1/internal/posts/${postId}/semantic-capsule`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(postCapsuleRes.status).toBe(200)
    expect(postCapsuleRes.body.data).toMatchObject({
      schema_version: expect.any(String),
      post_id: postId,
      thread_capsules: [expect.objectContaining({ thread_id: threadId })],
      public_persona_cues: expect.any(Array),
      evidence_refs: expect.arrayContaining([
        expect.objectContaining({ kind: 'THREAD', id: threadId }),
      ]),
    })

    const threadCapsuleRes = await request(app)
      .get(`/v1/internal/threads/${threadId}/semantic-capsule`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(threadCapsuleRes.status).toBe(200)
    expect(threadCapsuleRes.body.data).toMatchObject({
      schema_version: expect.any(String),
      thread_id: threadId,
      lifecycle: expect.objectContaining({
        thread_id: threadId,
      }),
      public_persona_cues: expect.any(Array),
      evidence_refs: expect.arrayContaining([
        expect.objectContaining({ kind: 'THREAD', id: threadId }),
      ]),
    })

    const internalGuideRes = await request(app)
      .get(`/v1/internal/posts/${postId}/reading-guide`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(internalGuideRes.status).toBe(200)
    expect(internalGuideRes.body.data.post_id).toBe(postId)

    const internalForestRes = await request(app)
      .get(`/v1/internal/posts/${postId}/discussion-forest`)
      .query({ focus_turn_id: turnId })
      .set('Authorization', `Bearer ${adminToken}`)
    expect(internalForestRes.status).toBe(200)
    expect(internalForestRes.body.data.focus_turn_id).toBe(turnId)

    const runtimePreviewRes = await request(app)
      .post('/v1/internal/runtime-contexts/build')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        post_id: postId,
        thread_id: threadId,
        focus_turn_id: turnId,
      })
    expect(runtimePreviewRes.status).toBe(200)
    expect(runtimePreviewRes.body.data).toMatchObject({
      post_capsule: expect.objectContaining({
        post_id: postId,
      }),
      thread_capsule: expect.objectContaining({
        thread_id: threadId,
      }),
      perceived_slice: expect.objectContaining({
        thread_id: threadId,
        focus_turn_id: turnId,
      }),
      runtime_context: expect.objectContaining({
        post_id: postId,
        thread_id: threadId,
        foundation_skeleton: expect.objectContaining({
          post: expect.objectContaining({
            post_id: postId,
          }),
        }),
        focus_thread: expect.objectContaining({
          thread_id: threadId,
          lifecycle: expect.objectContaining({
            thread_id: threadId,
            writeability: expect.objectContaining({
              reply_mode: 'OPEN',
              reply_allowed: true,
            }),
          }),
        }),
      }),
      evidence_window_turns: expect.any(Array),
    })
  })

  it('POST /v1/posts/:postId/watch-telemetry validates payloads and accepts public watch events', async () => {
    const acceptedRes = await request(app)
      .post('/v1/posts/post-telemetry/watch-telemetry')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        event_type: 'guide_click',
        thread_id: 'thread-telemetry',
        turn_id: 'turn-telemetry',
        source_surface: 'post_detail',
        source_shelf: 'forest',
      })

    expect(acceptedRes.status).toBe(202)
    expect(acceptedRes.body).toEqual({
      data: {
        accepted: true,
      },
    })

    const invalidRes = await request(app)
      .post('/v1/posts/post-telemetry/watch-telemetry')
      .send({
        event_type: 'unknown_event',
      })

    expect(invalidRes.status).toBe(400)
    expect(invalidRes.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('GET /v1/posts/:postId does not block on slow rollout profile evaluation when aftershow web is enabled', async () => {
    const rolloutSpy = vi.spyOn(mediaRolloutControllerService, 'getEffectiveProfile').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return {
        mode: 'AUTO',
        active_override: null,
        profile: 'steady',
        metrics: {} as Awaited<ReturnType<typeof mediaRolloutControllerService.getEffectiveProfile>>['metrics'],
        gates: [] as Awaited<ReturnType<typeof mediaRolloutControllerService.getEffectiveProfile>>['gates'],
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

    try {
      await withFeatureFlags({
        audienceAftershowWebV1: true,
        aftershowV1: true,
        mediaRolloutControllerV1: true,
      }, async () => {
        const community = await createTestCommunity({
          name: 'Post Detail Timeout Guard Community',
          slug: `post-detail-timeout-guard-${Date.now()}`,
        })
        const agent = await createAgentViaApi({
          displayName: 'Post Detail Timeout Guard Agent',
          token: userToken,
        })

        const postRes = await servicePost('/v1/posts', {
          actor_agent_id: agent.id,
          run_id: `run-post-detail-timeout-guard-${Date.now()}`,
          community_id: community.id,
          title: 'Post detail timeout guard',
          body: 'This post should not block on slow rollout profile reads.',
        })
        expect(postRes.status).toBe(201)
        const postId = postRes.body.data.id as string

        const startedAt = Date.now()
        const race = await Promise.race([
          request(app)
            .get(`/v1/posts/${postId}`)
            .then((res) => ({ kind: 'resolved' as const, res })),
          new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), 400)),
        ])

        expect(race.kind).toBe('resolved')
        expect(Date.now() - startedAt).toBeLessThan(450)
        expect(rolloutSpy).toHaveBeenCalledTimes(2)

        if (race.kind === 'resolved') {
          expect(race.res.status).toBe(200)
          expect(race.res.body.data).toMatchObject({
            id: postId,
            aftershow_summary: null,
            aftershow_callouts: [],
          })
        }

        await new Promise((resolve) => setTimeout(resolve, 550))
        const secondRes = await request(app).get(`/v1/posts/${postId}`)
        expect(secondRes.status).toBe(200)
        expect(rolloutSpy).toHaveBeenCalledTimes(2)
      })
    } finally {
      rolloutSpy.mockRestore()
    }
  })

  it('GET participation contract endpoints derive community defaults and post effective contract', async () => {
    const community = await createTestCommunity({
      name: 'Participation Contract Community',
      slug: `participation-contract-${Date.now()}`,
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
    const authorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Participation Contract Author' })
    expect(authorRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: authorRes.body.data.id,
      run_id: `run-participation-contract-post-${Date.now()}`,
      community_id: community.id,
      title: 'Participation contract target',
      body: 'Contract payload should mirror community interaction rules.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const communityContractRes = await request(app).get(
      `/v1/communities/${community.id}/participation-contract`,
    )
    expect(communityContractRes.status).toBe(200)
    expect(communityContractRes.body.data).toMatchObject({
      scope_type: 'COMMUNITY',
      scope_id: community.id,
      source: 'community_rules',
      public_participation_mode: 'open_reply',
      audience_signal_ingestion: 'direct_read',
      agent_human_response_mode: 'direct_reply',
      stage_open_reply: {
        enabled: true,
        new_thread_enabled: true,
        turn_reply_enabled: true,
      },
      audience_lane: {
        enabled: true,
        posting_enabled: false,
      },
    })

    const postContractRes = await request(app).get(`/v1/posts/${postId}/participation-contract`)
    expect(postContractRes.status).toBe(200)
    expect(postContractRes.body.data).toMatchObject({
      scope_type: 'POST',
      scope_id: postId,
      public_participation_mode: 'open_reply',
      audience_signal_ingestion: 'direct_read',
      agent_human_response_mode: 'direct_reply',
      stage_open_reply: {
        enabled: true,
        new_thread_enabled: true,
        turn_reply_enabled: true,
      },
      audience_lane: {
        enabled: true,
        posting_enabled: false,
      },
      community_default: expect.objectContaining({
        scope_type: 'COMMUNITY',
        scope_id: community.id,
      }),
      post_override: null,
    })
  })

  it('does not materialize audience-thread read stubs and blocks audience-thread reads for open-reply posts', async () => {
    await withFeatureFlags({
      audienceZoneV1: true,
      aftershowV1: true,
    }, async () => {
      const audienceCommunity = await createTestCommunity({
        name: 'Read Only Audience Community',
        slug: `read-only-audience-${Date.now()}`,
        rules_json: {
          stage_spec_v1: {
            human_participation: {
              public_participation_mode: 'audience_sidecar',
              audience_signal_ingestion: 'direct_read',
              agent_human_response_mode: 'aftershow_only',
            },
          },
        },
      })
      const openReplyCommunity = await createTestCommunity({
        name: 'Read Only Open Reply Community',
        slug: `read-only-open-reply-${Date.now()}`,
        rules_json: {
          stage_spec_v1: {
            human_participation: {
              public_participation_mode: 'open_reply',
              audience_signal_ingestion: 'none',
              agent_human_response_mode: 'direct_reply',
            },
          },
        },
      })
      const author = await createAgentViaApi({
        displayName: 'Audience Stub Guard Author',
        token: userToken,
      })

      const audiencePostRes = await servicePost('/v1/posts', {
        actor_agent_id: author.id,
        run_id: `run-audience-read-stub-${Date.now()}`,
        community_id: audienceCommunity.id,
        title: 'Audience read stub target',
        body: 'Reading the audience thread should stay read-only until the first audience message.',
      })
      expect(audiencePostRes.status).toBe(201)
      const audiencePostId = audiencePostRes.body.data.id as string

      const emptyAudienceThreadRes = await request(app).get(`/v1/posts/${audiencePostId}/audience-thread`)
      expect(emptyAudienceThreadRes.status).toBe(200)
      expect(emptyAudienceThreadRes.body.data).toEqual({
        thread: null,
        messages: [],
      })

      const audiencePostReadRes = await request(app).get(`/v1/posts/${audiencePostId}`)
      expect(audiencePostReadRes.status).toBe(200)
      expect(audiencePostReadRes.body.data).not.toHaveProperty('audience_thread_meta')

      const openReplyPostRes = await servicePost('/v1/posts', {
        actor_agent_id: author.id,
        run_id: `run-open-reply-read-guard-${Date.now()}`,
        community_id: openReplyCommunity.id,
        title: 'Open reply audience thread guard',
        body: 'Audience-thread reads should be rejected when the lane is disabled.',
      })
      expect(openReplyPostRes.status).toBe(201)
      const openReplyPostId = openReplyPostRes.body.data.id as string

      const openReplyAudienceThreadRes = await request(app).get(`/v1/posts/${openReplyPostId}/audience-thread`)
      expect(openReplyAudienceThreadRes.status).toBe(403)
      expect(openReplyAudienceThreadRes.body.error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Audience lane is not enabled for this post.',
      })

      const openReplyPostReadRes = await request(app).get(`/v1/posts/${openReplyPostId}`)
      expect(openReplyPostReadRes.status).toBe(200)
      expect(openReplyPostReadRes.body.data).not.toHaveProperty('audience_thread_meta')
    })
  })

  it('GET/PUT/DELETE orchestration policy endpoints derive defaults and allow post owner overrides', async () => {
    const community = await createTestCommunity({
      name: 'Orchestration Policy Community',
      slug: `orchestration-policy-${Date.now()}`,
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
    const authorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Orchestration Policy Author' })
    expect(authorRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: authorRes.body.data.id,
      run_id: `run-orchestration-policy-post-${Date.now()}`,
      community_id: community.id,
      title: 'Orchestration policy target',
      body: 'Policy payload should mirror stage allocator orchestration rules.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const baseRes = await request(app).get(`/v1/posts/${postId}/orchestration-policy`)
    expect(baseRes.status).toBe(200)
    expect(baseRes.body.data).toMatchObject({
      scope_type: 'POST',
      scope_id: postId,
      source: 'stage_spec',
      profile: 'guided_scene',
      recall_control: {
        pair_window_minutes: 45,
        pair_max_exchanges: 3,
      },
      community_default: expect.objectContaining({
        scope_type: 'COMMUNITY',
        scope_id: community.id,
      }),
      post_override: null,
    })

    const overrideRes = await request(app)
      .put(`/v1/posts/${postId}/orchestration-policy-override`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        profile: 'ambient_roaming',
        cutover: {
          envelope_enabled: false,
        },
      })
    expect(overrideRes.status).toBe(200)
    expect(overrideRes.body.data).toMatchObject({
      source: 'post_override',
      profile: 'ambient_roaming',
      cutover: {
        selection_enabled: true,
        envelope_enabled: false,
      },
      post_override: {
        profile: 'ambient_roaming',
        cutover: {
          envelope_enabled: false,
        },
      },
    })

    const clearRes = await request(app)
      .delete(`/v1/posts/${postId}/orchestration-policy-override`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(clearRes.status).toBe(200)
    expect(clearRes.body.data).toMatchObject({
      source: 'stage_spec',
      post_override: null,
    })
  })

  it('POST legacy public-write routes return 404 after compat removal', async () => {
    const legacyThreadRes = await request(app)
      .post('/v1/posts/post-legacy/public-threads')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: 'legacy thread' })
    expect(legacyThreadRes.status).toBe(404)

    const legacyTurnRes = await request(app)
      .post('/v1/threads/thread-legacy/public-turns')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: 'legacy turn' })
    expect(legacyTurnRes.status).toBe(404)

    const legacyAudienceRes = await request(app)
      .post('/v1/posts/post-legacy/audience-messages')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: 'legacy audience' })
    expect(legacyAudienceRes.status).toBe(404)
  })

  it('POST /v1/viewer/posts/:postId/public-threads and /v1/viewer/threads/:threadId/public-turns return auditable envelopes and honor idempotency', async () => {
    const community = await createTestCommunity({
      name: 'Viewer Write Community',
      slug: `viewer-write-${Date.now()}`,
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
    const rootAuthorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Viewer Write Root Author' })
    expect(rootAuthorRes.status).toBe(201)
    const turnAuthorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Viewer Write Turn Author' })
    expect(turnAuthorRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: rootAuthorRes.body.data.id,
      run_id: `run-viewer-write-post-${Date.now()}`,
      community_id: community.id,
      title: 'Viewer write target',
      body: 'New viewer write plane should expose audit ids and dedupe by idempotency key.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const viewerThreadSearchToken = buildUniqueSearchToken()
    const createThreadPayload = {
      body: `Viewer thread root ${viewerThreadSearchToken}.`,
      idempotency_key: `viewer-thread-${Date.now()}`,
      source_context: {
        discovered_via: 'discussion_forest',
        source_surface: 'post_detail',
        source_shelf: 'forest',
      },
    }

    const viewerThreadRes = await request(app)
      .post(`/v1/viewer/posts/${postId}/public-threads`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(createThreadPayload)
    expect(viewerThreadRes.status).toBe(201)
    expect(viewerThreadRes.body.data).toMatchObject({
      action: 'CREATE_PUBLIC_THREAD',
      result: 'ACCEPTED',
      audit_id: expect.any(String),
      thread_id: expect.any(String),
      turn_id: null,
      audience_message_id: null,
    })

    const duplicateViewerThreadRes = await request(app)
      .post(`/v1/viewer/posts/${postId}/public-threads`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(createThreadPayload)
    expect(duplicateViewerThreadRes.status).toBe(201)
    expect(duplicateViewerThreadRes.body.data.audit_id).toBe(viewerThreadRes.body.data.audit_id)
    expect(duplicateViewerThreadRes.body.data.thread_id).toBe(viewerThreadRes.body.data.thread_id)

    const threadId = viewerThreadRes.body.data.thread_id as string
    const threadSearchRes = await request(app)
      .get('/v1/search')
      .query({ q: viewerThreadSearchToken, tab: 'threads' })
    expect(threadSearchRes.status).toBe(200)
    expect(threadSearchRes.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: threadId,
        }),
      ]),
    )

    const agentTurnRes = await servicePost(`/v1/threads/${threadId}/turns`, {
      actor_agent_id: turnAuthorRes.body.data.id,
      run_id: `run-viewer-write-turn-${Date.now()}`,
      body: 'Agent turn for viewer anchor.',
    })
    expect(agentTurnRes.status).toBe(201)
    const anchorTurnId = agentTurnRes.body.data.id as string

    const createTurnPayload = {
      body: 'Viewer anchored reply.',
      focused_turn_id: anchorTurnId,
      actual_anchor_turn_id: anchorTurnId,
      quoted_excerpt: 'Agent turn for viewer anchor.',
      idempotency_key: `viewer-turn-${Date.now()}`,
      source_context: {
        discovered_via: 'discussion_forest',
        source_surface: 'post_detail',
        source_shelf: 'forest',
      },
    }

    const viewerTurnRes = await request(app)
      .post(`/v1/viewer/threads/${threadId}/public-turns`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(createTurnPayload)
    expect(viewerTurnRes.status).toBe(201)
    expect(viewerTurnRes.body.data).toMatchObject({
      action: 'CREATE_PUBLIC_TURN',
      result: 'ACCEPTED',
      audit_id: expect.any(String),
      thread_id: threadId,
      turn_id: expect.any(String),
    })

    const duplicateViewerTurnRes = await request(app)
      .post(`/v1/viewer/threads/${threadId}/public-turns`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(createTurnPayload)
    expect(duplicateViewerTurnRes.status).toBe(201)
    expect(duplicateViewerTurnRes.body.data.audit_id).toBe(viewerTurnRes.body.data.audit_id)
    expect(duplicateViewerTurnRes.body.data.turn_id).toBe(viewerTurnRes.body.data.turn_id)

    const threadDetailRes = await request(app).get(`/v1/threads/${threadId}`)
    expect(threadDetailRes.status).toBe(200)
    expect(threadDetailRes.body.data.turns.at(-1)).toMatchObject({
      thread_id: threadId,
      author_actor_type: 'human',
      author_user_id: 'user1',
      author_agent_id: null,
      anchor_turn_id: anchorTurnId,
      quoted_excerpt: 'Agent turn for viewer anchor.',
      body: 'Viewer anchored reply.',
    })
  })

  it('POST /v1/viewer/posts/:postId/audience-messages returns auditable envelopes and honors idempotency', async () => {
    await withFeatureFlags({
      audienceZoneV1: true,
      humanParticipationV1: true,
    }, async () => {
      const community = await createTestCommunity({
        name: 'Viewer Audience Community',
        slug: `viewer-audience-${Date.now()}`,
        rules_json: {
          stage_spec_v1: {
            human_participation: {
              public_participation_mode: 'audience_sidecar',
              audience_signal_ingestion: 'direct_read',
              agent_human_response_mode: 'aftershow_only',
            },
          },
        },
      })
      const author = await createAgentViaApi({
        displayName: 'Viewer Audience Author',
        token: userToken,
      })

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: author.id,
        run_id: `run-viewer-audience-post-${Date.now()}`,
        community_id: community.id,
        title: 'Viewer audience target',
        body: 'Audience envelope target.',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const payload = {
        body: 'Audience sidecar message.',
        idempotency_key: `viewer-audience-${Date.now()}`,
        source_context: {
          discovered_via: 'discussion_forest',
          source_surface: 'post_detail',
          source_shelf: 'audience',
        },
      }

      const firstRes = await request(app)
        .post(`/v1/viewer/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload)
      expect(firstRes.status).toBe(201)
      expect(firstRes.body.data).toMatchObject({
        action: 'CREATE_AUDIENCE_MESSAGE',
        result: 'ACCEPTED',
        audit_id: expect.any(String),
        thread_id: expect.any(String),
        audience_message_id: expect.any(String),
      })

      const duplicateRes = await request(app)
        .post(`/v1/viewer/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload)
      expect(duplicateRes.status).toBe(201)
      expect(duplicateRes.body.data.audit_id).toBe(firstRes.body.data.audit_id)
      expect(duplicateRes.body.data.audience_message_id).toBe(firstRes.body.data.audience_message_id)

      const audienceThreadRes = await request(app).get(`/v1/posts/${postId}/audience-thread`)
      expect(audienceThreadRes.status).toBe(200)
      expect(audienceThreadRes.body.data.messages.at(-1)).toMatchObject({
        id: firstRes.body.data.audience_message_id,
        author_user_id: 'user1',
        body: 'Audience sidecar message.',
      })
    })
  })

  it('GET /v1/posts/:postId/threads exposes all route handoff variants with CTA payloads', async () => {
    const community = await createTestCommunity({
      name: 'Route Handoff Community',
      slug: `route-handoff-${Date.now()}`,
    })
    const author = await createAgentViaApi({
      displayName: 'Route Thread Author',
      token: userToken,
    })

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: author.id,
      run_id: `run-route-post-${Date.now()}`,
      community_id: community.id,
      title: 'Route target post',
      body: 'Post body for route handoff coverage.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const routes = [
      {
        route_type: 'SPINOFF',
        reason_code: 'TOPIC_DRIFT_CONFIRMED',
        handoff_label: '话题已经偏离主轴，建议转为衍生线。',
      },
      {
        route_type: 'AFTERSHOW',
        reason_code: 'THREAD_REPLY_BUDGET_EXHAUSTED',
        handoff_label: '主舞台交锋已满，转入 Aftershow 收束。',
      },
      {
        route_type: 'PRIVATE',
        reason_code: 'PRIVATE_HANDOFF_REQUIRED',
        handoff_label: '这条线更适合私聊继续。',
      },
      {
        route_type: 'AUDIENCE',
        reason_code: 'AUDIENCE_PROMPT_REQUESTED',
        handoff_label: '把补充意见交给观众席。',
      },
    ] as const

    for (const route of routes) {
      const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
        actor_agent_id: author.id,
        run_id: `run-route-${route.route_type}-${Date.now()}`,
        body: `Route seed ${route.route_type}`,
        route_handoff: route,
      })
      expect(threadRes.status).toBe(201)
    }

    const threadsRes = await request(app).get(`/v1/posts/${postId}/threads`)
    expect(threadsRes.status).toBe(200)
    expect(threadsRes.body.data).toHaveLength(4)

    const routeMap = new Map(
      threadsRes.body.data.map((thread: {
        active_route: { route_type: string; cta: Record<string, unknown> | null }
        lifecycle: { writeability: { reply_mode: string; preferred_action: string } }
      }) => [
        thread.active_route.route_type,
        thread.active_route,
      ]),
    )
    expect([...routeMap.keys()].sort()).toEqual(['AFTERSHOW', 'AUDIENCE', 'PRIVATE', 'SPINOFF'])
    expect(routeMap.get('AFTERSHOW')).toMatchObject({
      route_state: 'READY',
      cta: expect.objectContaining({
        label: expect.any(String),
        target: expect.stringContaining('/posts/'),
      }),
    })
    expect(routeMap.get('AUDIENCE')).toMatchObject({
      cta: expect.objectContaining({
        target: expect.stringContaining('#audience-message-input'),
      }),
    })
    expect(routeMap.get('PRIVATE')).toMatchObject({
      cta: expect.objectContaining({
        target: buildAgentTarget({
          agentId: author.id,
          mode: 'readonly',
          tab: 'chat',
        }),
      }),
    })
    expect(routeMap.get('SPINOFF')).toMatchObject({
      cta: expect.objectContaining({
        target: expect.stringContaining('route=spinoff'),
      }),
    })
    expect(threadsRes.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lifecycle: expect.objectContaining({
            writeability: expect.objectContaining({
              reply_mode: 'SOFT_CLOSE',
              preferred_action: 'FOLLOW_ROUTE',
            }),
          }),
        }),
      ]),
    )
  })

  it('GET /v1/search returns exact counts and typed results across public objects', async () => {
    await searchDocRepo.clearAllDocs()
    searchCountsCache.clear()
    const searchToken = buildUniqueSearchToken()
    const community = await createTestCommunity({
      name: `Community ${searchToken}`,
      slug: `community-${searchToken}`,
      description: searchToken,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Agent ${searchToken}` })
    expect(agentRes.status).toBe(201)
    const agentId = agentRes.body.data.id as string

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: `run-search-${Date.now()}`,
      community_id: community.id,
      title: `Post ${searchToken}`,
      body: `Body ${searchToken}`,
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
      actor_agent_id: agentId,
      run_id: `run-search-comment-${Date.now()}`,
      body: `Comment ${searchToken}`,
    })
    expect(threadRes.status).toBe(201)
    const threadId = threadRes.body.data.id as string

    const turnRes = await servicePost(`/v1/threads/${threadId}/turns`, {
      actor_agent_id: agentId,
      run_id: `run-search-turn-${Date.now()}`,
      body: `Turn ${searchToken}`,
    })
    expect(turnRes.status).toBe(201)
    const turnId = turnRes.body.data.id as string

    const postsRes = await request(app)
      .get('/v1/search')
      .query({ q: `  ${searchToken}  ` })
    expect(postsRes.status).toBe(200)
    expect(postsRes.body.data.normalized_query).toBe(searchToken)
    expect(postsRes.body.data.counts).toEqual({
      posts: 1,
      communities: 1,
      agents: 1,
      threads: 1,
    })
    expect(postsRes.body.data.items).toHaveLength(1)
    expect(postsRes.body.data.items[0]).toMatchObject({
      type: 'post',
      id: postId,
      href: `/posts/${postId}`,
    })

    const communitiesRes = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'communities' })
    expect(communitiesRes.status).toBe(200)
    expect(communitiesRes.body.data.items[0]).toMatchObject({
      type: 'community',
      id: community.id,
      href: `/c/${community.slug}`,
    })

    const agentsRes = await request(app).get('/v1/search').query({ q: searchToken, tab: 'agents' })
    expect(agentsRes.status).toBe(200)
    expect(agentsRes.body.data.items[0]).toMatchObject({
      type: 'agent',
      id: agentId,
      href: buildAgentTarget({
        agentId,
        mode: 'readonly',
      }),
    })

    const threadsRes = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'threads' })
    expect(threadsRes.status).toBe(200)
    expect(threadsRes.body.data.items[0]).toMatchObject({
      type: 'thread',
      id: threadId,
      href: `/posts/${postId}?threadId=${threadId}&stage=timeline&turnId=${turnId}`,
      post_id: postId,
      matched_turn_id: turnId,
    })
  })

  it('GET /v1/search invalidates cached counts after agent discoverability changes', async () => {
    await searchDocRepo.clearAllDocs()
    searchCountsCache.clear()
    const searchToken = buildUniqueSearchToken()

    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Cache ${searchToken}` })
    expect(agentRes.status).toBe(201)
    const agentId = agentRes.body.data.id as string

    const beforeLimit = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'agents' })
    expect(beforeLimit.status).toBe(200)
    expect(beforeLimit.body.data.counts.agents).toBe(1)
    expect(beforeLimit.body.data.items).toHaveLength(1)
    expect(beforeLimit.body.data.items[0].id).toBe(agentId)

    const limitRes = await request(app)
      .post('/v1/admin/moderation/actions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'limit_agent',
        target_type: 'agent',
        target_id: agentId,
        reason: 'cache invalidation coverage',
      })
    expect(limitRes.status).toBe(200)

    const afterLimit = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'agents' })
    expect(afterLimit.status).toBe(200)
    expect(afterLimit.body.data.counts.agents).toBe(0)
    expect(afterLimit.body.data.items).toEqual([])
  })

  it('GET /v1/search paginates post results with an opaque cursor', async () => {
    await searchDocRepo.clearAllDocs()
    const searchToken = buildUniqueSearchToken()
    const community = await createTestCommunity({
      name: `Cursor ${searchToken}`,
      slug: `cursor-${searchToken}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Cursor Agent ${searchToken}` })
    expect(agentRes.status).toBe(201)
    const agentId = agentRes.body.data.id as string

    const firstPostRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: `run-cursor-a-${Date.now()}`,
      community_id: community.id,
      title: `Cursor title ${searchToken}`,
      body: `Cursor body ${searchToken}`,
    })
    expect(firstPostRes.status).toBe(201)

    const secondPostRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: `run-cursor-b-${Date.now()}`,
      community_id: community.id,
      title: `Cursor title ${searchToken}`,
      body: `Cursor body ${searchToken}`,
    })
    expect(secondPostRes.status).toBe(201)

    const firstPage = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'posts', limit: 1 })
    expect(firstPage.status).toBe(200)
    expect(firstPage.body.data.counts.posts).toBe(2)
    expect(firstPage.body.data.items).toHaveLength(1)
    expect(typeof firstPage.body.data.cursor).toBe('string')
    expect(firstPage.body.data.cursor).not.toBe(firstPage.body.data.items[0].id)

    const secondPage = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'posts', limit: 1, cursor: firstPage.body.data.cursor })
    expect(secondPage.status).toBe(200)
    expect(secondPage.body.data.items).toHaveLength(1)
    expect(secondPage.body.data.items[0].id).not.toBe(firstPage.body.data.items[0].id)
  })

  it('POST /v1/votes/human rejects MESSAGE target_type', async () => {
    const res = await request(app)
      .post('/v1/votes/human')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ target_type: 'MESSAGE', target_id: 'm1', direction: 'UP' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST /v1/votes/human upserts the same user vote on a post', async () => {
    const community = await createTestCommunity({
      name: 'Human Vote Community',
      slug: `human-vote-${Date.now()}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Human Vote Agent' })
    expect(agentRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentRes.body.data.id,
      run_id: 'run-human-vote-1',
      community_id: community.id,
      title: 'Human vote target',
      body: 'Target body',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id

    const upRes = await request(app)
      .post('/v1/votes/human')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ target_type: 'POST', target_id: postId, direction: 'UP' })
    expect(upRes.status).toBe(201)
    expect(upRes.body.data.summary.human_up).toBe(1)
    expect(upRes.body.data.summary.human_down).toBe(0)

    const downRes = await request(app)
      .post('/v1/votes/human')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ target_type: 'POST', target_id: postId, direction: 'DOWN' })
    expect(downRes.status).toBe(201)
    expect(downRes.body.data.summary.human_up).toBe(0)
    expect(downRes.body.data.summary.human_down).toBe(1)
  })

  it('POST /v1/votes/human still succeeds when search projection refresh fails', async () => {
    const community = await createTestCommunity({
      name: 'Human Vote Projection Failure Community',
      slug: `human-vote-projection-failure-${Date.now()}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Human Vote Projection Failure Agent' })
    expect(agentRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentRes.body.data.id,
      run_id: 'run-human-vote-projection-failure',
      community_id: community.id,
      title: 'Human vote projection failure target',
      body: 'Target body',
    })
    expect(postRes.status).toBe(201)

    const refreshSpy = vi
      .spyOn(searchDocRepo, 'upsertPostDoc')
      .mockRejectedValueOnce(new Error('projection write failed'))

    try {
      const voteRes = await request(app)
        .post('/v1/votes/human')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ target_type: 'POST', target_id: postRes.body.data.id, direction: 'UP' })

      expect(voteRes.status).toBe(201)
      expect(voteRes.body.data.summary.human_up).toBe(1)
      expect(voteRes.body.data.summary.human_down).toBe(0)
    } finally {
      refreshSpy.mockRestore()
    }
  })

  it('POST /v1/reports and GET /v1/reports create and list complaint tickets for the current user', async () => {
    const community = await createTestCommunity({
      name: 'Report Target Community',
      slug: `report-target-${Date.now()}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Report Target Agent' })
    expect(agentRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentRes.body.data.id,
      run_id: 'run-report-target-1',
      community_id: community.id,
      title: 'Reportable post',
      body: 'needs review',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const createRes = await request(app)
      .post('/v1/reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'post',
        target_id: postId,
        reason_code: 'viewer_report',
        detail_text: 'needs review',
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.data.complaint.status).toBe('LINKED')
    expect(createRes.body.data.complaint.complaint_type).toBe('CONTENT_REPORT')
    expect(createRes.body.data.case.case_type).toBe('COMPLAINT')

    const listRes = await request(app)
      .get('/v1/reports')
      .set('Authorization', `Bearer ${userToken}`)

    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.body.data)).toBe(true)
    expect(
      listRes.body.data.some(
        (item: { target_id: string; complaint_type: string }) =>
          item.target_id === postId && item.complaint_type === 'CONTENT_REPORT',
      ),
    ).toBe(true)
  })

  it('POST /v1/appeals and GET /v1/appeals create and list appeal requests for the current user', async () => {
    const community = await createTestCommunity({
      name: 'Appeal Target Community',
      slug: `appeal-target-${Date.now()}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Appeal Target Agent' })
    expect(agentRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentRes.body.data.id,
      run_id: 'run-appeal-target-1',
      community_id: community.id,
      title: 'Appealable post',
      body: 'owner appeal target',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const createRes = await request(app)
      .post('/v1/appeals')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'post',
        target_id: postId,
        requester_type: 'OWNER',
        appeal_type: 'CONTENT_APPEAL',
        reason: 'owner_appeal',
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.data.appeal.status).toBe('LINKED')
    expect(createRes.body.data.appeal.requester_type).toBe('OWNER')
    expect(createRes.body.data.appeal.appeal_type).toBe('CONTENT_APPEAL')
    expect(createRes.body.data.case.case_type).toBe('APPEAL')

    const listRes = await request(app)
      .get('/v1/appeals')
      .set('Authorization', `Bearer ${userToken}`)

    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.body.data)).toBe(true)
    expect(
      listRes.body.data.some(
        (item: { target_id: string; requester_type: string; appeal_type: string }) =>
          item.target_id === postId &&
          item.requester_type === 'OWNER' &&
          item.appeal_type === 'CONTENT_APPEAL',
      ),
    ).toBe(true)
  })

  it('POST /v1/reports rejects unsupported target types and missing targets', async () => {
    const invalidType = await request(app)
      .post('/v1/reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'unsupported',
        target_id: 'x-1',
        reason_code: 'viewer_report',
      })
    expect(invalidType.status).toBe(400)
    expect(invalidType.body.error.code).toBe('VALIDATION_ERROR')

    const missingTarget = await request(app)
      .post('/v1/reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'post',
        target_id: 'missing-post',
        reason_code: 'viewer_report',
      })
    expect(missingTarget.status).toBe(404)
    expect(missingTarget.body.error.code).toBe('NOT_FOUND')
  })

  it('GET /v1/search?tab=agents supports public agent search', async () => {
    await request(app).post('/v1/agents').set('Authorization', `Bearer ${userToken}`).send({
      display_name: 'Searchable Agent',
      persona_seed_code: 'comedian',
    })

    const res = await request(app).get('/v1/search').query({ q: 'searchable', tab: 'agents' })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.items)).toBe(true)
    const target = (res.body.data.items as Array<Record<string, unknown>>).find(
      (item) => item.display_name === 'Searchable Agent',
    )
    expect(target).toBeTruthy()
    expect(target?.persona_seed_label).toBeTruthy()
    expect(target?.home_voice_line_label).toBeTruthy()
    expect(target?.href).toBe(buildAgentTarget({
      agentId: target?.id as string,
      mode: 'readonly',
    }))
  })

  it('GET /v1/agents is no longer a public listing or search endpoint', async () => {
    const res = await request(app).get('/v1/agents?q=searchable')
    expect(res.status).toBe(404)
  })

  it('GET /v1/feed?following_only=true requires auth', async () => {
    const res = await request(app).get('/v1/feed?following_only=true')
    expect(res.status).toBe(401)
  })

  it('POST /v1/viewer/posts/:postId/audience-messages validates body length and accepts valid message', async () => {
    await withFeatureFlags({
      audienceZoneV1: true,
      humanParticipationV1: true,
    }, async () => {
      const community = await createTestCommunity({
        name: 'Audience Message Community',
        slug: `audience-message-${Date.now()}`,
        rules_json: {
          stage_spec_v1: {
            human_participation: {
              public_participation_mode: 'audience_sidecar',
              audience_signal_ingestion: 'direct_read',
              agent_human_response_mode: 'aftershow_only',
            },
          },
        },
      })
      const agent = await createAgentViaApi({
        displayName: 'Audience Message Agent',
        token: userToken,
      })

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agent.id,
        run_id: 'run-audience-1',
        community_id: community.id,
        title: 'Audience target',
        body: 'audience thread body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const validRes = await request(app)
        .post(`/v1/viewer/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          body: 'Great show, keep it going.',
          idempotency_key: `audience-${Date.now()}`,
          source_context: {
            discovered_via: 'discussion_forest',
            source_surface: 'post_detail',
            source_shelf: 'audience',
          },
        })
      expect(validRes.status).toBe(201)
      expect(validRes.body.data).toMatchObject({
        action: 'CREATE_AUDIENCE_MESSAGE',
        result: 'ACCEPTED',
        audience_message_id: expect.any(String),
      })

      const audienceThreadRes = await request(app)
        .get(`/v1/posts/${postId}/audience-thread`)
      expect(audienceThreadRes.status).toBe(200)
      expect(audienceThreadRes.body.data.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({
          body: 'Great show, keep it going.',
          author_user_id: 'user1',
        }),
      ]))

      const blankRes = await request(app)
        .post(`/v1/viewer/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: '   ' })
      expect(blankRes.status).toBe(400)
      expect(blankRes.body.error.code).toBe('VALIDATION_ERROR')

      const tooLongBody = 'a'.repeat(20_001)
      const longRes = await request(app)
        .post(`/v1/viewer/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: tooLongBody })
      expect(longRes.status).toBe(400)
      expect(longRes.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  it('GET /v1/posts/:postId/aftershow returns aftershow summary and callouts', async () => {
    await withFeatureFlags({
      audienceZoneV1: true,
      aftershowV1: true,
      aftershowEventPipelineV1: true,
    }, async () => {
      const launchCommunity = getLaunchCommunityBySlug('postmortem-lab')
      const community = await createTestCommunity({
        name: 'Aftershow Read Community',
        slug: `aftershow-read-${Date.now()}`,
        rules_json: launchCommunity?.rules_json,
      })

      const agent = await createAgentViaApi({
        displayName: 'Aftershow Agent',
        token: userToken,
      })

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agent.id,
        run_id: `run-aftershow-${Date.now()}`,
        community_id: community.id,
        title: 'Aftershow target post',
        body: 'aftershow body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const messageRes = await request(app)
        .post(`/v1/viewer/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: '请在 aftershow 里回应这个观点。' })
      expect(messageRes.status).toBe(201)

      const triggerRes = await request(app)
        .post(`/v1/posts/${postId}/aftershow/trigger`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ mode: 'MANUAL', force: true })
      expect(triggerRes.status).toBe(201)

      const readRes = await request(app).get(`/v1/posts/${postId}/aftershow`)
      expect(readRes.status).toBe(200)
      expect(readRes.body.data.post_id).toBe(postId)
      expect(readRes.body.data.aftershow_summary).toBeTruthy()
      expect(Array.isArray(readRes.body.data.aftershow_callouts)).toBe(true)
      expect(readRes.body.data).toMatchObject({
        content_semantics: {
          distribution: {
            content_kind: 'aftershow_recap',
            hero_eligible: false,
          },
          format: {
            format_kind: 'recap',
          },
          visual: {
            surface_kind: 'aftershow_card',
            card_mode: 'recap_card',
            thumbnail_policy: 'optional',
          },
        },
      })
      expect(readRes.body.data.surface_kind).toBeUndefined()
      expect(readRes.body.data.card_mode).toBeUndefined()
      expect(readRes.body.data.thumbnail_policy).toBeUndefined()
      expect(readRes.body.data.hero_eligible).toBeUndefined()
      if (readRes.body.data.aftershow_callouts.length > 0) {
        expect(readRes.body.data.aftershow_callouts[0].deep_link).toContain(
          `/posts/${postId}?aftershow_id=`,
        )
      }
    })
  })

  it('GET /v1/posts/:postId/aftershow keeps published artifact when the latest trigger is aborted', async () => {
    await withFeatureFlags({
      audienceZoneV1: true,
      aftershowV1: true,
      aftershowEventPipelineV1: true,
    }, async () => {
      const community = await createTestCommunity({
        name: 'Aftershow Read Fallback Community',
        slug: `aftershow-fallback-${Date.now()}`,
      })

      const agent = await createAgentViaApi({
        displayName: 'Aftershow Fallback Agent',
        token: userToken,
      })

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agent.id,
        run_id: `run-aftershow-fallback-${Date.now()}`,
        community_id: community.id,
        title: 'Aftershow fallback target post',
        body: 'aftershow fallback body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const messageRes = await request(app)
        .post(`/v1/viewer/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: '请在 aftershow 里回应这个观点。' })
      expect(messageRes.status).toBe(201)

      const firstTrigger = await request(app)
        .post(`/v1/posts/${postId}/aftershow/trigger`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ mode: 'MANUAL', force: true })
      expect(firstTrigger.status).toBe(201)
      expect(firstTrigger.body.data.artifact?.status).toBe('PUBLISHED')
      const firstArtifactId = firstTrigger.body.data.artifact?.id as string

      const secondTrigger = await request(app)
        .post(`/v1/posts/${postId}/aftershow/trigger`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ mode: 'MANUAL', force: true })
      expect(secondTrigger.status).toBe(201)
      expect(secondTrigger.body.data.artifact?.status).toBe('ABORTED')
      expect(secondTrigger.body.data.reason).toBe('publish_rate_limited')

      const readRes = await request(app).get(`/v1/posts/${postId}/aftershow`)
      expect(readRes.status).toBe(200)
      expect(readRes.body.data.aftershow_summary).toBeTruthy()
      expect(readRes.body.data.aftershow_summary.status).toBe('PUBLISHED')
      expect(readRes.body.data.aftershow_summary.id).toBe(firstArtifactId)
      expect(Array.isArray(readRes.body.data.aftershow_callouts)).toBe(true)
      expect(readRes.body.data.aftershow_callouts.length).toBeGreaterThan(0)
    })
  })

  it('GET /v1/posts/:postId/aside-seats returns role assignments for post scope', async () => {
    await withFeatureFlags({
      roleAssignmentV1: true,
      membershipsV1: true,
    }, async () => {
      const community = await createTestCommunity({
        name: 'Aside Seats Read Community',
        slug: `aside-seats-read-${Date.now()}`,
      })

      const agent = await createAgentViaApi({
        displayName: 'Seat Agent',
        token: userToken,
      })

      const membershipRes = await patchAgentMembershipViaApi({
        agentId: agent.id,
        add: [community.id],
        token: userToken,
      })
      expect(membershipRes.status).toBe(200)

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agent.id,
        run_id: `run-seat-${Date.now()}`,
        community_id: community.id,
        title: 'Aside seats target',
        body: 'aside seats body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const roleRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'POST',
          scope_id: postId,
          role: 'core',
          agent_id: agent.id,
        })
      expect(roleRes.status).toBe(201)

      const seatsRes = await request(app).get(`/v1/posts/${postId}/aside-seats`)
      expect(seatsRes.status).toBe(200)
      expect(seatsRes.body.data.post_id).toBe(postId)
      expect(Array.isArray(seatsRes.body.data.seats)).toBe(true)
      expect(seatsRes.body.data.seats.length).toBeGreaterThan(0)
    })
  })

  it('expired role assignment disappears from aside seats after expiration processing and writes ROLE_EXPIRED event', async () => {
    await withFeatureFlags({
      roleAssignmentV1: true,
      membershipsV1: true,
    }, async () => {
      const community = await createTestCommunity({
        name: 'Aside Seats Expiry Community',
        slug: `aside-seats-expiry-${Date.now()}`,
      })

      const agent = await createAgentViaApi({
        displayName: 'Seat Expiry Agent',
        token: userToken,
      })

      const membershipRes = await patchAgentMembershipViaApi({
        agentId: agent.id,
        add: [community.id],
        token: userToken,
      })
      expect(membershipRes.status).toBe(200)

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agent.id,
        run_id: `run-seat-expiry-${Date.now()}`,
        community_id: community.id,
        title: 'Aside seats expiry target',
        body: 'aside seats expiry body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const expiresAt = new Date(Date.now() + 2000).toISOString()
      const roleRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'POST',
          scope_id: postId,
          role: 'core',
          agent_id: agent.id,
          expires_at: expiresAt,
        })
      expect(roleRes.status).toBe(201)
      const assignmentId = roleRes.body.data.id as string

      const beforeExpireRes = await request(app).get(`/v1/posts/${postId}/aside-seats`)
      expect(beforeExpireRes.status).toBe(200)
      expect(
        beforeExpireRes.body.data.seats.some((item: { id: string }) => item.id === assignmentId),
      ).toBe(true)

      const expirationNow = new Date(Date.now() + 10_000)
      const processed = await roleAssignmentService.processDueExpirations({
        now: expirationNow,
        limit: 20,
      })
      expect(processed.processed).toBeGreaterThanOrEqual(1)

      const afterExpireRes = await request(app).get(`/v1/posts/${postId}/aside-seats`)
      expect(afterExpireRes.status).toBe(200)
      expect(
        afterExpireRes.body.data.seats.some((item: { id: string }) => item.id === assignmentId),
      ).toBe(false)

      const assignmentProbeRes = await request(app)
        .patch(`/v1/communities/${community.id}/role-assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'probe current status after expiry' })
      expect(assignmentProbeRes.status).toBe(200)
      expect(assignmentProbeRes.body.data.status).toBe('EXPIRED')

      const eventMapHost = eventRepo as unknown as {
        store?: Map<
          string,
          { event_type: string; correlation_id: string | null; actor_id: string | null }
        >
        cache?: Map<
          string,
          { event_type: string; correlation_id: string | null; actor_id: string | null }
        >
      }
      const eventMap = eventMapHost.store ?? eventMapHost.cache ?? new Map()
      const expiredEvent = Array.from(eventMap.values()).find(
        (evt) => evt.event_type === 'ROLE_EXPIRED' && evt.correlation_id === assignmentId,
      )
      expect(expiredEvent).toBeTruthy()
      expect(expiredEvent?.actor_id).toBe('role-expiry-scheduler')
    })
  }, 15_000)
})
