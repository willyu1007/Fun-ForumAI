import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { app, config, userToken, user2Token, VALID_PNG_BUFFER, setupFeatureFlagGuard } from './e2e-helpers.js'
import { llmClient } from '../../container.js'

setupFeatureFlagGuard()

describe('E2E: Multimodal inclination + owner-only growth controls', () => {
  const featureFlags = config.features as unknown as Record<string, boolean>
  const originalMultimodal = featureFlags.multimodalAgentInclinationV1

  beforeAll(() => {
    featureFlags.multimodalAgentInclinationV1 = true
  })

  afterAll(() => {
    featureFlags.multimodalAgentInclinationV1 = originalMultimodal
  })

  it('upload/current/delete and local media read work for owner', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Multimodal Owner Agent' })
    const agentId = createAgentRes.body.data.id

    const uploadRes = await request(app)
      .post(`/v1/agents/${agentId}/inclination-asset/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .field('owner_note', '偏轻松吐槽')
      .attach('file', VALID_PNG_BUFFER, {
        filename: 'meme.png',
        contentType: 'image/png',
      })
    expect(uploadRes.status).toBe(201)
    expect(uploadRes.body.data.status).toBe('PENDING')
    expect(typeof uploadRes.body.data.media_url).toBe('string')

    const mediaRes = await request(app).get(uploadRes.body.data.media_url)
    expect(mediaRes.status).toBe(200)
    expect(String(mediaRes.headers['content-type'])).toContain('image/png')

    const currentRes = await request(app)
      .get(`/v1/agents/${agentId}/inclination-asset/current`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(currentRes.status).toBe(200)
    expect(currentRes.body.data.pending).toBeTruthy()

    const deleteRes = await request(app)
      .delete(`/v1/agents/${agentId}/inclination-asset/current`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.data.removed).toBe(true)
  })

  it('rejects non-https URL assets', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Multimodal URL Agent' })
    const agentId = createAgentRes.body.data.id

    const res = await request(app)
      .post(`/v1/agents/${agentId}/inclination-asset/url`)
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
      .post(`/v1/agents/${agentId}/inclination-asset/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'broken.png',
        contentType: 'image/png',
      })
    expect(uploadRes.status).toBe(400)
    expect(uploadRes.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('blocks non-owner for inclination endpoints and style/instructions/prompt-overrides', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Owner-locked Agent' })
    const agentId = createAgentRes.body.data.id

    const inclinationRes = await request(app)
      .get(`/v1/agents/${agentId}/inclination-asset/current`)
      .set('Authorization', `Bearer ${user2Token}`)
    expect(inclinationRes.status).toBe(403)

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

  it('consumes pending inclination asset on next scheduled post and writes post media', async () => {
    const originalChat = llmClient.chat.bind(llmClient)
    const originalIsConfigured = Object.getOwnPropertyDescriptor(llmClient, 'isConfigured')

    Object.defineProperty(llmClient, 'isConfigured', {
      value: true,
      configurable: true,
    })

    llmClient.chat = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        community_id_or_slug: 'general',
        title: '多模态调度测试帖',
        body: '这是一条用于验证 pending 资源消费链路的测试正文。',
      }),
      model: 'test-model',
      usage: {
        prompt_tokens: 12,
        completion_tokens: 24,
        total_tokens: 36,
      },
    })

    try {
      const seedRes = await request(app).post('/v1/dev/seed').send()
      expect(seedRes.status).toBe(200)

      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Multimodal Scheduler Agent' })
      const agentId = createAgentRes.body.data.id

      const uploadRes = await request(app)
        .post(`/v1/agents/${agentId}/inclination-asset/upload`)
        .set('Authorization', `Bearer ${userToken}`)
        .field('owner_note', '优先讨论表情包背后的情绪')
        .attach('file', VALID_PNG_BUFFER, {
          filename: 'inclination.png',
          contentType: 'image/png',
        })
      expect(uploadRes.status).toBe(201)
      const assetId = uploadRes.body.data.asset_id as string

      const runtimePostRes = await request(app).post('/v1/dev/runtime/post').send()
      expect(runtimePostRes.status).toBe(200)
      expect(runtimePostRes.body.data.triggered).toBe(true)
      expect(runtimePostRes.body.data.agent_id).toBe(agentId)
      const postId = runtimePostRes.body.data.post_id as string
      expect(typeof postId).toBe('string')

      const postRes = await request(app).get(`/v1/posts/${postId}`)
      expect(postRes.status).toBe(200)
      expect(Array.isArray(postRes.body.data.media)).toBe(true)
      expect(postRes.body.data.media.length).toBeGreaterThan(0)
      expect(postRes.body.data.media[0].asset_id).toBe(assetId)

      const currentRes = await request(app)
        .get(`/v1/agents/${agentId}/inclination-asset/current`)
        .set('Authorization', `Bearer ${userToken}`)
      expect(currentRes.status).toBe(200)
      expect(currentRes.body.data.pending).toBeNull()
      expect(currentRes.body.data.last_consumed.status).toBe('CONSUMED')
      expect(currentRes.body.data.last_consumed.asset_id).toBe(assetId)
    } finally {
      llmClient.chat = originalChat
      if (originalIsConfigured) {
        Object.defineProperty(llmClient, 'isConfigured', originalIsConfigured)
      } else {
        delete (llmClient as unknown as Record<string, unknown>).isConfigured
      }
    }
  })
})
