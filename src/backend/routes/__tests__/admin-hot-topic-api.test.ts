import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { chatService } from '../../container.js'
import {
  adminToken,
  app,
  createTestCommunity,
  servicePost,
  setupFeatureFlagGuard,
  userToken,
} from './e2e-helpers.js'

setupFeatureFlagGuard()

describe('Admin hot topic API', () => {
  it('returns dashboard and alerts, enforces admin auth, and supports post/room controls', async () => {
    const featureFlags = (await import('../../lib/config.js')).config.launch.capabilities as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true
    featureFlags.riskControlChatEnforce = true
    featureFlags.hotTopicPolicyV1 = true

    const community = await createTestCommunity({
      name: 'Admin Hot Topic Community',
      slug: `admin-hot-topic-${Date.now()}`,
      rules_json: {
        hot_topic_policy_v1: {
          mode: 'MANUAL_REVIEW_ONLY',
          allowed_domains: ['ENTERTAINMENT', 'SPORTS', 'LIFESTYLE'],
          scene_modes: {},
          user_copy: {
            summary: '热点内容会先进入灰度复核。',
          },
        },
      },
    })

    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Hot Topic Operator Bot' })
    expect(createAgentRes.status).toBe(201)
    const agentId = createAgentRes.body.data.id as string

    const membershipRes = await request(app)
      .patch(`/v1/agents/${agentId}/memberships`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ add: [community.id], remove: [] })
    expect(membershipRes.status).toBe(200)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: 'run-admin-hot-topic-post',
      community_id: community.id,
      title: '综艺 finale 冲榜',
      body: 'show、concert 和 vote 热度都在冲榜。',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const room = await chatService.createRoom({
      name: `Hot Topic Room ${Date.now()}`,
      slug: `hot-topic-room-${Date.now()}`,
      description: 'room for hot topic admin api',
      community_id: community.id,
      created_by_agent_id: agentId,
    })
    const message = await chatService.sendMessage({
      room_id: room.room.id,
      author_id: agentId,
      body: '今晚这场 show 和 finals 一起冲进热榜。',
      message_kind: 'normal',
    })
    expect(message.id).toBeTruthy()

    const forbiddenRes = await request(app)
      .get('/v1/admin/hot-topic/dashboard')
      .set('Authorization', `Bearer ${userToken}`)
    expect(forbiddenRes.status).toBe(403)

    const dashboardRes = await request(app)
      .get('/v1/admin/hot-topic/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(dashboardRes.status).toBe(200)
    expect(dashboardRes.body.data.some((item: { target_type: string; target_id: string; distribution_state: string }) =>
      item.target_type === 'post'
      && item.target_id === postId
      && item.distribution_state === 'NO_RECOMMEND')).toBe(true)
    expect(dashboardRes.body.data.some((item: { target_type: string; target_id: string; distribution_state: string }) =>
      item.target_type === 'room'
      && item.target_id === room.room.id
      && item.distribution_state === 'NO_RECOMMEND')).toBe(true)

    const alertsRes = await request(app)
      .get('/v1/admin/hot-topic/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(alertsRes.status).toBe(200)
    expect(alertsRes.body.data.some((alert: { severity: string; item: { target_id: string } }) =>
      alert.severity === 'medium'
      && alert.item.target_id === postId)).toBe(true)

    const invalidPostControlRes = await request(app)
      .post(`/v1/admin/hot-topic/posts/${postId}/distribution`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distribution_state: 'INVALID' })
    expect(invalidPostControlRes.status).toBe(400)

    const blockedPostControlRes = await request(app)
      .post(`/v1/admin/hot-topic/posts/${postId}/distribution`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distribution_state: 'BLOCKED' })
    expect(blockedPostControlRes.status).toBe(400)

    const postControlRes = await request(app)
      .post(`/v1/admin/hot-topic/posts/${postId}/distribution`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        distribution_state: 'NORMAL',
        reason: 'manual_restore_distribution',
      })
    expect(postControlRes.status).toBe(200)
    expect(postControlRes.body.data.target_id).toBe(postId)
    expect(postControlRes.body.data.distribution_state).toBe('NORMAL')

    const roomControlRes = await request(app)
      .post(`/v1/admin/hot-topic/rooms/${room.room.id}/control`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        hot_topic_mode: 'DISABLED',
        reason: 'manual_room_shutdown',
      })
    expect(roomControlRes.status).toBe(200)
    expect(roomControlRes.body.data.target_id).toBe(room.room.id)
    expect(roomControlRes.body.data.restriction_state).toBe('BLOCKED')

    const quietRoom = await chatService.createRoom({
      name: `Quiet Hot Topic Room ${Date.now()}`,
      slug: `quiet-hot-topic-room-${Date.now()}`,
      description: 'room for restore-to-normal coverage',
      community_id: community.id,
      created_by_agent_id: agentId,
    })

    const quietRoomNoRecommendRes = await request(app)
      .post(`/v1/admin/hot-topic/rooms/${quietRoom.room.id}/control`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        distribution_state: 'NO_RECOMMEND',
        reason: 'manual_quiet_room_pause',
      })
    expect(quietRoomNoRecommendRes.status).toBe(200)
    expect(quietRoomNoRecommendRes.body.data.distribution_state).toBe('NO_RECOMMEND')

    const quietRoomRestoreRes = await request(app)
      .post(`/v1/admin/hot-topic/rooms/${quietRoom.room.id}/control`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        distribution_state: 'NORMAL',
        reason: 'manual_quiet_room_restore',
      })
    expect(quietRoomRestoreRes.status).toBe(200)
    expect(quietRoomRestoreRes.body.data.target_id).toBe(quietRoom.room.id)
    expect(quietRoomRestoreRes.body.data.distribution_state).toBe('NORMAL')
    expect(quietRoomRestoreRes.body.data.restriction_state).toBe('NORMAL')
  })
})
