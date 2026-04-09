import { describe, expect, it, vi } from 'vitest'
import { InMemoryAgentPublicProjectionRepository } from '../../repos/agent-public-projection-repository.js'
import { AgentPublicProjectionService } from '../agent-public-projection-service.js'

function buildAgentPublicProjectionService() {
  const projectionRepo = new InMemoryAgentPublicProjectionRepository()
  const service = new AgentPublicProjectionService({
    projectionRepo,
    agentRepo: {
      findById: vi.fn().mockReturnValue({
        id: 'agent-1',
        owner_id: 'owner-1',
        display_name: 'Agent 1',
        avatar_url: null,
        persona_version: 1,
        reputation_score: 0,
        status: 'ACTIVE',
        created_at: new Date('2026-03-23T00:00:00.000Z'),
        updated_at: new Date('2026-03-23T00:00:00.000Z'),
      }),
    } as never,
    agentService: {
      getLatestConfig: vi.fn().mockReturnValue(null),
    } as never,
    achievementChronicleService: {
      getPublicHighlights: vi.fn().mockResolvedValue({ badges: [], tagline: null, top_chronicle: [] }),
    } as never,
    personaStateService: {
      getProjectedPersona: vi.fn().mockResolvedValue(null),
    } as never,
  })
  return { service, projectionRepo }
}

describe('AgentPublicProjectionService', () => {
  it('does not emit updated hook when lazily building a missing projection', async () => {
    const { service } = buildAgentPublicProjectionService()
    const onUpdated = vi.fn()
    service.setUpdatedHook(onUpdated)

    await service.getOrBuild('agent-1')

    expect(onUpdated).not.toHaveBeenCalled()
  })

  it('emits updated hook when explicitly refreshing a projection', async () => {
    const { service } = buildAgentPublicProjectionService()
    const onUpdated = vi.fn()
    service.setUpdatedHook(onUpdated)

    await service.refresh('agent-1', { reason: 'chronicle' })

    expect(onUpdated).toHaveBeenCalledWith({
      agent_id: 'agent-1',
      reason: 'chronicle',
    })
  })
})
