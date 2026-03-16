import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { adminToken, app, user2Token, userToken } from './e2e-helpers.js'
import { chatService } from '../../container.js'

describe('chatroom control api', () => {
  it('enforces creator-owner permissions and rejects raw scripted fields', async () => {
    const now = Date.now()
    const creatorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Owner Bot ${now}` })
    expect(creatorRes.status).toBe(201)

    const guestRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ display_name: `Guest Bot ${now}` })
    expect(guestRes.status).toBe(201)

    const creatorId = creatorRes.body.data.id as string
    const guestId = guestRes.body.data.id as string

    const created = await chatService.createRoom({
      name: `Control Room ${now}`,
      slug: `control-room-${now}`,
      description: '验证 owner-only 导演面板权限。',
      created_by_agent_id: creatorId,
    })

    await chatService.dispatchAgentToRoom(created.room.id, guestId, 'user2')

    const ownerRoomRes = await request(app)
      .get(`/v1/rooms/${created.room.id}`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(ownerRoomRes.status).toBe(200)
    expect(ownerRoomRes.body.data.viewer_can_control).toBe(true)

    const guestRoomRes = await request(app)
      .get(`/v1/rooms/${created.room.id}`)
      .set('Authorization', `Bearer ${user2Token}`)
    expect(guestRoomRes.status).toBe(200)
    expect(guestRoomRes.body.data.viewer_can_control).toBe(false)

    const ownerProgramRes = await request(app)
      .patch(`/v1/rooms/${created.room.id}/program`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        scene_type: 'DEBATE',
        discoverability: {
          short_hook: '把旧争论重新点燃。',
        },
      })
    expect(ownerProgramRes.status).toBe(200)
    expect(ownerProgramRes.body.data).toMatchObject({
      room_id: created.room.id,
      scene_type: 'DEBATE',
    })

    const controlStateRes = await request(app)
      .get(`/v1/rooms/${created.room.id}/control-state`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(controlStateRes.status).toBe(200)
    expect(controlStateRes.body.data.members.some((member: { member_id: string }) => member.member_id === guestId)).toBe(true)

    const memberControlRes = await request(app)
      .patch(`/v1/rooms/${created.room.id}/members/${guestId}/control`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        role_hint: 'FOIL',
        spotlight_weight: 1.4,
      })
    expect(memberControlRes.status).toBe(200)
    expect(memberControlRes.body.data).toMatchObject({
      member_id: guestId,
      role_hint: 'FOIL',
      spotlight_weight: 1.4,
    })

    const invalidProgramRes = await request(app)
      .patch(`/v1/rooms/${created.room.id}/program`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ callback_window: 0 })
    expect(invalidProgramRes.status).toBe(400)
    expect(invalidProgramRes.body.error.code).toBe('VALIDATION_ERROR')

    const invalidMemberControlRes = await request(app)
      .patch(`/v1/rooms/${created.room.id}/members/${guestId}/control`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ spotlight_weight: 0 })
    expect(invalidMemberControlRes.status).toBe(400)
    expect(invalidMemberControlRes.body.error.code).toBe('VALIDATION_ERROR')

    const forbiddenRes = await request(app)
      .patch(`/v1/rooms/${created.room.id}/program`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ enabled: false })
    expect(forbiddenRes.status).toBe(403)

    const adminRes = await request(app)
      .patch(`/v1/rooms/${created.room.id}/program`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: false })
    expect(adminRes.status).toBe(200)
    expect(adminRes.body.data.enabled).toBe(false)

    const rawCueRes = await request(app)
      .post(`/v1/rooms/${created.room.id}/program/cues`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        cue_type: 'ADVANCE',
        director_goal: '让主持人把这个回合往前推半步。',
        body: '这是一句不该出现的原始台词',
      })
    expect(rawCueRes.status).toBe(400)
    expect(rawCueRes.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects manual cues when the room program is enabled but no scene binding exists', async () => {
    const now = Date.now()
    const ownerRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Cue Owner ${now}` })
    expect(ownerRes.status).toBe(201)

    const guestARes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Cue Guest A ${now}` })
    expect(guestARes.status).toBe(201)

    const guestBRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Cue Guest B ${now}` })
    expect(guestBRes.status).toBe(201)

    const ownerId = ownerRes.body.data.id as string
    const guestAId = guestARes.body.data.id as string
    const guestBId = guestBRes.body.data.id as string

    const created = await chatService.createRoom({
      name: `Concurrent Cue Room ${now}`,
      slug: `concurrent-cue-room-${now}`,
      description: '验证并发手动 cue 的序号分配。',
      created_by_agent_id: ownerId,
    })

    await chatService.dispatchAgentToRoom(created.room.id, guestAId, 'user1')
    await chatService.dispatchAgentToRoom(created.room.id, guestBId, 'user1')

    const programRes = await request(app)
      .patch(`/v1/rooms/${created.room.id}/program`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ enabled: true })
    expect(programRes.status).toBe(200)

    const controlStateRes = await request(app)
      .get(`/v1/rooms/${created.room.id}/control-state`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(controlStateRes.status).toBe(200)

    const responses = await Promise.all([
      request(app)
        .post(`/v1/rooms/${created.room.id}/program/cues`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cue_type: 'ADVANCE',
          director_goal: '第一拍先立论点。',
        }),
      request(app)
        .post(`/v1/rooms/${created.room.id}/program/cues`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cue_type: 'ASK',
          director_goal: '第二拍追问细节。',
        }),
      request(app)
        .post(`/v1/rooms/${created.room.id}/program/cues`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cue_type: 'CALLBACK',
          director_goal: '第三拍回收现场。',
        }),
    ])

    expect(responses.map((res) => res.status)).toEqual([400, 400, 400])
    expect(responses.map((res) => res.body.error.code)).toEqual([
      'VALIDATION_ERROR',
      'VALIDATION_ERROR',
      'VALIDATION_ERROR',
    ])
    expect(responses.every((res) =>
      /scene binding|launch catalog/u.test(String(res.body.error.message)),
    )).toBe(true)
  })
})
