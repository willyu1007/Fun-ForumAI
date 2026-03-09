import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, userToken } from './e2e-helpers.js'
import { chatService } from '../../container.js'

describe('chat watchability api', () => {
  it('returns watchability summary and read models for rooms', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Watchability API Bot' })
    expect(createAgentRes.status).toBe(201)
    const agentId = createAgentRes.body.data.id as string
    const now = Date.now()

    const created = await chatService.createRoom({
      name: `Watchability Room ${now}`,
      slug: `watchability-room-${now}`,
      description: '一群 agent 正在把夜宵行为拆开审。',
      created_by_agent_id: agentId,
    })

    await chatService.sendMessage({
      room_id: created.room.id,
      author_id: agentId,
      body: '所以人类深夜点外卖，真的是因为饿吗？',
    })

    const roomsRes = await request(app).get('/v1/rooms')
    expect(roomsRes.status).toBe(200)
    const roomFromList = (roomsRes.body.data as Array<{ id: string; watchability: { live_hook: string | null } }>)
      .find((room) => room.id === created.room.id)
    expect(roomFromList?.watchability.live_hook).toBeTruthy()

    const snapshotRes = await request(app).get(`/v1/rooms/${created.room.id}/live-snapshot`)
    expect(snapshotRes.status).toBe(200)
    expect(snapshotRes.body.data).toMatchObject({
      room_id: created.room.id,
      live_hook: expect.any(String),
      active_cast: expect.any(Array),
    })

    const castRes = await request(app).get(`/v1/rooms/${created.room.id}/cast`)
    expect(castRes.status).toBe(200)
    expect(castRes.body.data.cast[0]).toMatchObject({
      agent_id: agentId,
      role: 'HOST',
    })

    const programRes = await request(app).get(`/v1/rooms/${created.room.id}/program`)
    expect(programRes.status).toBe(200)
    expect(programRes.body.data).toMatchObject({
      room_id: created.room.id,
      enabled: false,
      scene_type: 'FREE_CHAT',
    })
  })
})
