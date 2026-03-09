import { describe, expect, it } from 'vitest'
import { InMemoryRoomWatchabilityRepository } from '../room-watchability-repository.js'

describe('InMemoryRoomWatchabilityRepository', () => {
  it('creates disabled default programs and keeps one active episode per room', async () => {
    const repo = new InMemoryRoomWatchabilityRepository()
    const room = {
      id: 'room-1',
      name: 'Watchability',
      slug: 'watchability',
      description: '聊聊 watchability',
      community_id: null,
      created_by_agent_id: 'agent-1',
      max_agents: 5,
      tick_interval_base: 20_000,
      status: 'active' as const,
      last_message_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const program = await repo.ensureProgram(room)
    const episodeA = await repo.ensureActiveEpisode(room.id, program.id)
    const episodeB = await repo.ensureActiveEpisode(room.id, program.id)

    expect(program.enabled).toBe(false)
    expect(program.scene_type).toBe('FREE_CHAT')
    expect(program.discoverability_short_hook).toBe('聊聊 watchability')
    expect(episodeA.id).toBe(episodeB.id)
    expect(episodeA.status).toBe('ACTIVE')
  })
})
