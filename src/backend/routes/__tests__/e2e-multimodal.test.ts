import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import {
  app,
  config,
  userToken,
  user2Token,
  VALID_PNG_BUFFER,
  setupFeatureFlagGuard,
} from './e2e-helpers.js'
import { llmClient, llmGateway, mediaGenerationGateway, postScheduler } from '../../container.js'

setupFeatureFlagGuard()

type ScheduledPostEligibleCommunity = {
  id: string
  slug: string
  name: string
  description: string
  rules: string
}

function buildScheduledPostSelection(community: ScheduledPostEligibleCommunity) {
  return {
    kind: 'scene' as const,
    community,
    payload: {
      scene_metadata: {
        director_surface: 'scheduled_post',
        actor_surface: 'forum_post',
        scene_template_id: 'stage-theme-01',
        scene_template_version: 'v2',
        scene_binding_id: 'binding-hot-arena-scheduled-post',
        overlay_id: null,
        episode_id: 'episode-e2e',
        beat_id: null,
        phase: 'opening',
        selection_mode: 'pool_guided',
        selection_id: 'selection-e2e',
        episode_plan_id: 'episode-plan-e2e',
        local_intent_id: 'local-intent-e2e',
        started_at: '2026-03-16T00:00:00.000Z',
        expires_at: '2026-03-17T00:00:00.000Z',
      },
      episode_brief: {
        episode_id: 'episode-e2e',
        director_surface: 'scheduled_post',
        actor_surface: 'forum_post',
        template_id: 'stage-theme-01',
        template_version: 'v2',
        binding_id: 'binding-hot-arena-scheduled-post',
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
        expires_at: '2026-03-17T00:00:00.000Z',
      },
      local_intent: {
        intent_id: 'local-intent-e2e',
        delivery_surface: 'forum_post',
        initiative: 'open_topic',
        opinion_policy: 'free_opinion',
        relation_focus: 'none',
        tone_hint: 'neutral',
        privacy_mode: 'public_only',
        memory_scope: 'public_contextual',
        reference_scope: 'seed_only',
        prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
        target_ref: { kind: 'none' },
        hard_constraints: ['不得改写目标社区'],
        soft_constraints: ['推进讨论'],
      },
      local_intent_block: '## Local Intent\n- episode_id: episode-e2e',
      selection_audit: { community_id: community.id },
      planning_audit: { episode_id: 'episode-e2e' },
    },
  }
}

describe('E2E: Multimodal media + owner-only growth controls', () => {
  const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
  const originalMultimodal = featureFlags.multimodalAgentMediaV1
  const originalRolloutController = featureFlags.mediaRolloutControllerV1
  const originalMediaGeneration = featureFlags.mediaGenerationV1

  beforeAll(() => {
    featureFlags.multimodalAgentMediaV1 = true
    featureFlags.mediaRolloutControllerV1 = true
    featureFlags.mediaGenerationV1 = true
  })

  afterAll(() => {
    featureFlags.multimodalAgentMediaV1 = originalMultimodal
    featureFlags.mediaRolloutControllerV1 = originalRolloutController
    featureFlags.mediaGenerationV1 = originalMediaGeneration
  })

  it('upload/current/delete and local media read work for owner', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Multimodal Owner Agent' })
    const agentId = createAgentRes.body.data.id

    const uploadRes = await request(app)
      .post(`/v1/agents/${agentId}/media/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .field('owner_note', '偏轻松吐槽')
      .attach('file', VALID_PNG_BUFFER, {
        filename: 'meme.png',
        contentType: 'image/png',
      })
    expect(uploadRes.status).toBe(201)
    expect(uploadRes.body.data.lifecycle_status).toBe('active')
    expect(uploadRes.body.data.visibility_policy).toBe('private_only')
    expect(typeof uploadRes.body.data.media_url).toBe('string')

    const mediaRes = await request(app).get(uploadRes.body.data.media_url)
    expect(mediaRes.status).toBe(200)
    expect(String(mediaRes.headers['content-type'])).toContain('image/png')

    const currentRes = await request(app)
      .get(`/v1/agents/${agentId}/media/current`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(currentRes.status).toBe(200)
    expect(currentRes.body.data.pool.latest_asset).toBeTruthy()

    const deleteRes = await request(app)
      .delete(`/v1/agents/${agentId}/media/current`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.data.removed).toBe(true)
  })

  it('lists media assets and supports archive/restore by asset id', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Multimodal Library Agent' })
    const agentId = createAgentRes.body.data.id

    const firstUploadRes = await request(app)
      .post(`/v1/agents/${agentId}/media/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .field('owner_note', '第一张素材')
      .attach('file', VALID_PNG_BUFFER, {
        filename: 'library-first.png',
        contentType: 'image/png',
      })
    expect(firstUploadRes.status).toBe(201)

    const secondUploadRes = await request(app)
      .post(`/v1/agents/${agentId}/media/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .field('owner_note', '第二张素材')
      .attach('file', VALID_PNG_BUFFER, {
        filename: 'library-second.png',
        contentType: 'image/png',
      })
    expect(secondUploadRes.status).toBe(201)

    const firstAssetId = firstUploadRes.body.data.asset_id as string

    const archiveRes = await request(app)
      .post(`/v1/agents/${agentId}/media/${firstAssetId}/archive`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(archiveRes.status).toBe(200)
    expect(archiveRes.body.data.asset_id).toBe(firstAssetId)
    expect(archiveRes.body.data.lifecycle_status).toBe('archived')

    const libraryRes = await request(app)
      .get(`/v1/agents/${agentId}/media`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(libraryRes.status).toBe(200)
    expect(libraryRes.body.data.pool.active_count).toBe(1)
    expect(libraryRes.body.data.pool.archived_count).toBe(1)
    expect(libraryRes.body.data.pool.total_count).toBe(2)
    expect(libraryRes.body.data.assets).toHaveLength(2)
    expect(libraryRes.body.data.assets.map((item: { asset_id: string }) => item.asset_id)).toContain(firstAssetId)

    const restoreRes = await request(app)
      .post(`/v1/agents/${agentId}/media/${firstAssetId}/restore`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(restoreRes.status).toBe(200)
    expect(restoreRes.body.data.lifecycle_status).toBe('active')
  })

  it('rejects non-https URL assets', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Multimodal URL Agent' })
    const agentId = createAgentRes.body.data.id

    const res = await request(app)
      .post(`/v1/agents/${agentId}/media/url`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ source_url: 'http://example.com/unsafe.png' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects corrupted upload files', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Corrupted Upload Agent' })
    const agentId = createAgentRes.body.data.id

    const uploadRes = await request(app)
      .post(`/v1/agents/${agentId}/media/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'broken.png',
        contentType: 'image/png',
      })
    expect(uploadRes.status).toBe(400)
    expect(uploadRes.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('supports owner promote and demote for media assets', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Promote Demote Agent' })
    const agentId = createAgentRes.body.data.id

    const uploadRes = await request(app)
      .post(`/v1/agents/${agentId}/media/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', VALID_PNG_BUFFER, {
        filename: 'promote-demote.png',
        contentType: 'image/png',
      })
    expect(uploadRes.status).toBe(201)

    const assetId = uploadRes.body.data.asset_id
    const promoteRes = await request(app)
      .post(`/v1/agents/${agentId}/media/${assetId}/promote`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(promoteRes.status).toBe(200)
    expect(promoteRes.body.data.visibility_policy).toBe('public_original_allowed')

    const demoteRes = await request(app)
      .post(`/v1/agents/${agentId}/media/${assetId}/demote`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(demoteRes.status).toBe(200)
    expect(demoteRes.body.data.visibility_policy).toBe('private_only')
  })

  it('blocks non-owner for media endpoints and style/instructions/prompt-overrides', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Owner-locked Agent' })
    const agentId = createAgentRes.body.data.id

    const mediaRes = await request(app)
      .get(`/v1/agents/${agentId}/media/current`)
      .set('Authorization', `Bearer ${user2Token}`)
    expect(mediaRes.status).toBe(403)

    const styleRes = await request(app)
      .get(`/v1/agents/${agentId}/style`)
      .set('Authorization', `Bearer ${user2Token}`)
    expect(styleRes.status).toBe(403)

    const instructionsRes = await request(app)
      .get(`/v1/agents/${agentId}/instructions`)
      .set('Authorization', `Bearer ${user2Token}`)
    expect(instructionsRes.status).toBe(403)

    const promptOverridesRes = await request(app)
      .get(`/v1/agents/${agentId}/prompt-overrides`)
      .set('Authorization', `Bearer ${user2Token}`)
    expect(promptOverridesRes.status).toBe(403)
  })

  it('removes legacy write routes after the media cutover', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Media Route Agent' })
    const agentId = createAgentRes.body.data.id

    const legacyMissingRes = await request(app)
      .post(`/v1/agents/${agentId}/inclination-asset/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', VALID_PNG_BUFFER, {
        filename: 'legacy-route.png',
        contentType: 'image/png',
      })
    expect(legacyMissingRes.status).toBe(404)

    const mediaRes = await request(app)
      .post(`/v1/agents/${agentId}/media/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', VALID_PNG_BUFFER, {
        filename: 'media-route.png',
        contentType: 'image/png',
      })
    expect(mediaRes.status).toBe(201)
  })

  it('bridges the latest eligible owner-pool asset onto the next scheduled post and writes post media', async () => {
    featureFlags.membershipsV1 = true
    const originalChat = llmClient.chat.bind(llmClient)
    const originalIsConfigured = Object.getOwnPropertyDescriptor(llmClient, 'isConfigured')
    const originalGatewayIsConfigured = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(llmGateway),
      'isConfigured',
    ) ?? Object.getOwnPropertyDescriptor(llmGateway, 'isConfigured')
    const originalGatewayGenerateVisibleText = llmGateway.generateVisibleText.bind(llmGateway)
    const originalGatewayGenerateHiddenArtifact = llmGateway.generateHiddenArtifact.bind(llmGateway)
    const originalGatewayCanServeRoute = llmGateway.canServeRoute.bind(llmGateway)
    const schedulerDeps = postScheduler as unknown as {
      deps?: {
        publicSceneSelectorService?: {
          selectScheduledPost: (input: {
            eligible_communities: Array<{
              id: string
              slug: string
              name: string
              description: string
              rules: string
            }>
          }) => Promise<unknown>
        } | null
      }
    }
    const selectorService = schedulerDeps.deps?.publicSceneSelectorService ?? null
    const originalSelectScheduledPost = selectorService?.selectScheduledPost.bind(selectorService)

    Object.defineProperty(llmClient, 'isConfigured', {
      value: true,
      configurable: true,
    })
    Object.defineProperty(llmGateway, 'isConfigured', {
      value: true,
      configurable: true,
    })

    const stubRenderDecision = {
      voiceLineId: 'default',
      tier: 'base',
      profileId: 'test',
      providerId: 'test',
      modelId: 'test-model',
      region: 'local',
      fallbackLevel: 'none',
      reasons: ['initial_profile_resolution'],
    }

    const mockPostResponse = {
      content: JSON.stringify({
        community_id_or_slug: 'hot-arena',
        title: '多模态调度测试帖',
        body: '这是一条用于验证 owner pool 过渡挂图链路的测试正文。',
      }),
      messages: [],
      usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 },
      finishReason: 'stop',
      latencyMs: 10,
      platformRetryCount: 0,
      renderDecision: stubRenderDecision,
      promptRef: { template_id: 'test', version: 1 },
    }

    const mockVisionResponse = {
      content: JSON.stringify({
        theme: 'meme emotion',
        scene: 'reaction image',
        mood: 'tired but amused',
        discussion_points: ['讨论情绪张力', '讨论幽默感来源', '讨论社区共鸣点'],
        salient_entities: ['person'],
        ocr_snippets: [],
        safety_labels: [],
        public_safe_summary: 'A reaction-style image that can support light public discussion.',
        internal_full_summary: 'A reaction-style image with tired but amused emotion.',
      }),
      messages: [],
      usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
      finishReason: 'stop',
      latencyMs: 20,
      platformRetryCount: 0,
      renderDecision: stubRenderDecision,
      promptRef: { template_id: 'internal-vision-summary', version: 1 },
    }

    llmClient.chat = vi.fn().mockResolvedValue({
      content: mockPostResponse.content,
      model: 'test-model',
      usage: mockPostResponse.usage,
    })
    llmGateway.canServeRoute = vi.fn(() => true)
    llmGateway.generateVisibleText = vi.fn().mockResolvedValue(mockPostResponse)
    llmGateway.generateHiddenArtifact = vi.fn().mockResolvedValue(mockVisionResponse)

    try {
      const seedRes = await request(app).post('/v1/dev/seed').send()
      expect(seedRes.status).toBe(200)
      if (!selectorService || !originalSelectScheduledPost) {
        throw new Error('public scene selector unavailable in test container')
      }
      selectorService.selectScheduledPost = vi.fn(async (input) => {
        const community = input.eligible_communities.find((item: ScheduledPostEligibleCommunity) => item.slug === 'hot-arena')
          ?? input.eligible_communities[0]
        if (!community) {
          return { kind: 'skip', reason: 'no_eligible_communities' }
        }
        return buildScheduledPostSelection(community)
      })

      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Multimodal Scheduler Agent' })
      const agentId = createAgentRes.body.data.id

      const communitiesRes = await request(app).get('/v1/communities?limit=20')
      expect(communitiesRes.status).toBe(200)
      const launchCoreCommunity = communitiesRes.body.data.find((item: ScheduledPostEligibleCommunity) => item.slug === 'hot-arena')
      expect(launchCoreCommunity).toBeTruthy()
      if (!launchCoreCommunity) {
        throw new Error('hot-arena community unavailable in e2e seed')
      }

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          add: [launchCoreCommunity.id],
          remove: [],
          role: 'resident',
        })
      expect(membershipRes.status).toBe(200)

      const uploadRes = await request(app)
        .post(`/v1/agents/${agentId}/media/upload`)
        .set('Authorization', `Bearer ${userToken}`)
        .field('owner_note', '优先讨论表情包背后的情绪')
        .attach('file', VALID_PNG_BUFFER, {
          filename: 'media.png',
          contentType: 'image/png',
        })
      expect(uploadRes.status).toBe(201)
      const assetId = uploadRes.body.data.asset_id as string
      const promoteRes = await request(app)
        .post(`/v1/agents/${agentId}/media/${assetId}/promote`)
        .set('Authorization', `Bearer ${userToken}`)
      expect(promoteRes.status).toBe(200)

      const runtimePostRes = await request(app).post('/v1/dev/runtime/post').send()
      expect(runtimePostRes.status).toBe(200)
      expect(runtimePostRes.body.data).toMatchObject({ triggered: true })
      expect(runtimePostRes.body.data.agent_id).toBe(agentId)
      const postId = runtimePostRes.body.data.post_id as string
      expect(typeof postId).toBe('string')

      const postRes = await request(app).get(`/v1/posts/${postId}`)
      expect(postRes.status).toBe(200)
      expect(Array.isArray(postRes.body.data.media)).toBe(true)
      expect(postRes.body.data.media.length).toBeGreaterThan(0)
      expect(postRes.body.data.media[0].asset_id).toBe(assetId)

      const currentRes = await request(app)
        .get(`/v1/agents/${agentId}/media/current`)
        .set('Authorization', `Bearer ${userToken}`)
      expect(currentRes.status).toBe(200)
      expect(currentRes.body.data.pool.latest_asset.asset_id).toBe(assetId)
      expect(currentRes.body.data.latest_public_attachment.asset_id).toBe(assetId)
    } finally {
      llmClient.chat = originalChat
      llmGateway.canServeRoute = originalGatewayCanServeRoute
      llmGateway.generateVisibleText = originalGatewayGenerateVisibleText
      llmGateway.generateHiddenArtifact = originalGatewayGenerateHiddenArtifact
      if (originalIsConfigured) {
        Object.defineProperty(llmClient, 'isConfigured', originalIsConfigured)
      } else {
        delete (llmClient as unknown as Record<string, unknown>).isConfigured
      }
      if (originalGatewayIsConfigured) {
        Object.defineProperty(llmGateway, 'isConfigured', originalGatewayIsConfigured)
      } else {
        delete (llmGateway as unknown as Record<string, unknown>).isConfigured
      }
      if (selectorService && originalSelectScheduledPost) {
        selectorService.selectScheduledPost = originalSelectScheduledPost
      }
    }
  })

  it('derives a generated public attachment from a private-only owner-pool asset on the next scheduled post', async () => {
    featureFlags.membershipsV1 = true
    featureFlags.mediaGenerationV1 = true
    const originalChat = llmClient.chat.bind(llmClient)
    const originalIsConfigured = Object.getOwnPropertyDescriptor(llmClient, 'isConfigured')
    const originalGatewayIsConfigured = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(llmGateway),
      'isConfigured',
    ) ?? Object.getOwnPropertyDescriptor(llmGateway, 'isConfigured')
    const originalGatewayGenerateVisibleText = llmGateway.generateVisibleText.bind(llmGateway)
    const originalGatewayGenerateHiddenArtifact = llmGateway.generateHiddenArtifact.bind(llmGateway)
    const originalGatewayCanServeRoute = llmGateway.canServeRoute.bind(llmGateway)
    const originalMediaGatewayGenerate = mediaGenerationGateway.generate.bind(mediaGenerationGateway)
    const originalMediaGatewayIsConfigured = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(mediaGenerationGateway),
      'isConfigured',
    ) ?? Object.getOwnPropertyDescriptor(mediaGenerationGateway, 'isConfigured')
    const originalFetch = globalThis.fetch
    const schedulerDeps = postScheduler as unknown as {
      deps?: {
        publicSceneSelectorService?: {
          selectScheduledPost: (input: {
            eligible_communities: Array<{
              id: string
              slug: string
              name: string
              description: string
              rules: string
            }>
          }) => Promise<unknown>
        } | null
      }
    }
    const selectorService = schedulerDeps.deps?.publicSceneSelectorService ?? null
    const originalSelectScheduledPost = selectorService?.selectScheduledPost.bind(selectorService)

    Object.defineProperty(llmClient, 'isConfigured', {
      value: true,
      configurable: true,
    })
    Object.defineProperty(llmGateway, 'isConfigured', {
      value: true,
      configurable: true,
    })
    Object.defineProperty(mediaGenerationGateway, 'isConfigured', {
      value: true,
      configurable: true,
    })

    const stubRenderDecision = {
      voiceLineId: 'default',
      tier: 'base',
      profileId: 'test',
      providerId: 'test',
      modelId: 'test-model',
      region: 'local',
      fallbackLevel: 'none',
      reasons: ['initial_profile_resolution'],
    }

    llmClient.chat = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        community_id_or_slug: 'hot-arena',
        title: '私域素材派生挂图测试帖',
        body: '这是一条用于验证 private-only owner pool -> generated_public 挂图链路的测试正文。',
      }),
      model: 'test-model',
      usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 },
    })
    llmGateway.canServeRoute = vi.fn(() => true)
    llmGateway.generateVisibleText = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        community_id_or_slug: 'hot-arena',
        title: '私域素材派生挂图测试帖',
        body: '这是一条用于验证 private-only owner pool -> generated_public 挂图链路的测试正文。',
      }),
      messages: [],
      usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 },
      finishReason: 'stop',
      latencyMs: 10,
      platformRetryCount: 0,
      renderDecision: stubRenderDecision,
      promptRef: { template_id: 'test', version: 1 },
    })
    llmGateway.generateHiddenArtifact = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        theme: 'debate stage',
        scene: 'dramatic debate stage',
        mood: 'tense',
        discussion_points: ['讨论舞台张力', '讨论视觉对比'],
        salient_entities: ['podiums'],
        ocr_snippets: [],
        safety_labels: [],
        public_safe_summary: 'A dramatic debate stage with two podiums under red spotlights.',
        internal_full_summary: 'A dramatic debate stage that supports public-safe derivative generation.',
      }),
      messages: [],
      usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
      finishReason: 'stop',
      latencyMs: 20,
      platformRetryCount: 0,
      renderDecision: stubRenderDecision,
      promptRef: { template_id: 'internal-vision-summary', version: 1 },
    })
    mediaGenerationGateway.generate = vi.fn().mockResolvedValue({
      image_url: 'https://generated.example.com/private-derived.png',
      mime_type: 'image/png',
    })
    vi.stubGlobal('fetch', vi.fn(async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = String(input)
      if (url === 'https://generated.example.com/private-derived.png') {
        return new Response(VALID_PNG_BUFFER, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
          },
        })
      }
      return originalFetch(input, init)
    }) as typeof fetch)

    try {
      const seedRes = await request(app).post('/v1/dev/seed').send()
      expect(seedRes.status).toBe(200)
      if (!selectorService || !originalSelectScheduledPost) {
        throw new Error('public scene selector unavailable in test container')
      }
      selectorService.selectScheduledPost = vi.fn(async (input) => {
        const community = input.eligible_communities.find((item: ScheduledPostEligibleCommunity) => item.slug === 'hot-arena')
          ?? input.eligible_communities[0]
        if (!community) {
          return { kind: 'skip', reason: 'no_eligible_communities' }
        }
        return buildScheduledPostSelection(community)
      })

      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Private Derive Agent' })
      const agentId = createAgentRes.body.data.id as string

      const communitiesRes = await request(app).get('/v1/communities?limit=20')
      expect(communitiesRes.status).toBe(200)
      const launchCoreCommunity = communitiesRes.body.data.find((item: ScheduledPostEligibleCommunity) => item.slug === 'hot-arena')
      expect(launchCoreCommunity).toBeTruthy()
      if (!launchCoreCommunity) {
        throw new Error('hot-arena community unavailable in e2e seed')
      }

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          add: [launchCoreCommunity.id],
          remove: [],
          role: 'resident',
        })
      expect(membershipRes.status).toBe(200)

      const uploadRes = await request(app)
        .post(`/v1/agents/${agentId}/media/upload`)
        .set('Authorization', `Bearer ${userToken}`)
        .field('owner_note', '保持舞台张力，但不要直接复用原图。')
        .attach('file', VALID_PNG_BUFFER, {
          filename: 'private-only-media.png',
          contentType: 'image/png',
        })
      expect(uploadRes.status).toBe(201)
      const originalAssetId = uploadRes.body.data.asset_id as string
      expect(uploadRes.body.data.visibility_policy).toBe('private_only')

      const runtimePostRes = await request(app).post('/v1/dev/runtime/post').send()
      expect(runtimePostRes.status).toBe(200)
      expect(runtimePostRes.body.data).toMatchObject({ triggered: true })
      expect(runtimePostRes.body.data.agent_id).toBe(agentId)
      const postId = runtimePostRes.body.data.post_id as string
      expect(typeof postId).toBe('string')

      const postRes = await request(app).get(`/v1/posts/${postId}`)
      expect(postRes.status).toBe(200)
      expect(Array.isArray(postRes.body.data.media)).toBe(true)
      expect(postRes.body.data.media.length).toBeGreaterThan(0)
      const generatedAssetId = postRes.body.data.media[0].asset_id as string
      expect(generatedAssetId).not.toBe(originalAssetId)

      const currentRes = await request(app)
        .get(`/v1/agents/${agentId}/media/current`)
        .set('Authorization', `Bearer ${userToken}`)
      expect(currentRes.status).toBe(200)
      expect(currentRes.body.data.pool.latest_asset.asset_id).toBe(originalAssetId)
      expect(currentRes.body.data.latest_public_attachment.asset_id).toBe(generatedAssetId)
    } finally {
      llmClient.chat = originalChat
      llmGateway.canServeRoute = originalGatewayCanServeRoute
      llmGateway.generateVisibleText = originalGatewayGenerateVisibleText
      llmGateway.generateHiddenArtifact = originalGatewayGenerateHiddenArtifact
      mediaGenerationGateway.generate = originalMediaGatewayGenerate
      if (originalIsConfigured) {
        Object.defineProperty(llmClient, 'isConfigured', originalIsConfigured)
      } else {
        delete (llmClient as unknown as Record<string, unknown>).isConfigured
      }
      if (originalGatewayIsConfigured) {
        Object.defineProperty(llmGateway, 'isConfigured', originalGatewayIsConfigured)
      } else {
        delete (llmGateway as unknown as Record<string, unknown>).isConfigured
      }
      if (originalMediaGatewayIsConfigured) {
        Object.defineProperty(mediaGenerationGateway, 'isConfigured', originalMediaGatewayIsConfigured)
      } else {
        delete (mediaGenerationGateway as unknown as Record<string, unknown>).isConfigured
      }
      if (selectorService && originalSelectScheduledPost) {
        selectorService.selectScheduledPost = originalSelectScheduledPost
      }
      vi.stubGlobal('fetch', originalFetch)
    }
  })
})
