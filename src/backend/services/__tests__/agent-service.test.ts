import { describe, it, expect, beforeEach } from 'vitest'
import { AgentService } from '../agent-service.js'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from '../../repos/agent-repository.js'
import { InMemoryAgentRunRepository } from '../../repos/event-repository.js'

function setup() {
  const agentRepo = new InMemoryAgentRepository()
  const agentConfigRepo = new InMemoryAgentConfigRepository()
  const agentRunRepo = new InMemoryAgentRunRepository()
  const svc = new AgentService({ agentRepo, agentConfigRepo, agentRunRepo })
  return { svc, agentRepo, agentConfigRepo, agentRunRepo }
}

describe('AgentService', () => {
  let ctx: ReturnType<typeof setup>

  beforeEach(() => {
    ctx = setup()
  })

  describe('createAgent', () => {
    it('creates an agent', () => {
      const a = ctx.svc.createAgent({ owner_id: 'u1', display_name: 'BotX' })
      expect(a.display_name).toBe('BotX')
      expect(a.status).toBe('ACTIVE')
    })

    it('throws on empty display_name', () => {
      expect(() =>
        ctx.svc.createAgent({ owner_id: 'u1', display_name: '  ' }),
      ).toThrow('display_name is required')
    })
  })

  describe('getAgent', () => {
    it('returns existing agent', () => {
      const a = ctx.svc.createAgent({ owner_id: 'u1', display_name: 'Bot' })
      expect(ctx.svc.getAgent(a.id).id).toBe(a.id)
    })

    it('throws for unknown agent', () => {
      expect(() => ctx.svc.getAgent('nope')).toThrow('not found')
    })
  })

  describe('listActiveAgents', () => {
    it('returns only active agents', () => {
      ctx.svc.createAgent({ owner_id: 'u1', display_name: 'A' })
      const b = ctx.svc.createAgent({ owner_id: 'u1', display_name: 'B' })
      ctx.svc.updateAgentStatus(b.id, 'BANNED')

      const result = ctx.svc.listActiveAgents({})
      expect(result.items).toHaveLength(1)
      expect(result.items[0].display_name).toBe('A')
    })
  })

  describe('updateConfig', () => {
    it('creates a config entry', () => {
      const a = ctx.svc.createAgent({ owner_id: 'u1', display_name: 'Bot' })
      const cfg = ctx.svc.updateConfig(a.id, { temp: 0.7 }, 'admin1')
      expect(cfg.config_json).toEqual({ temp: 0.7 })
      expect(cfg.updated_by).toBe('admin1')
    })

    it('throws for unknown agent', () => {
      expect(() => ctx.svc.updateConfig('nope', {}, 'admin')).toThrow('not found')
    })
  })

  describe('getLatestConfig', () => {
    it('returns latest config', () => {
      const a = ctx.svc.createAgent({ owner_id: 'u1', display_name: 'Bot' })
      ctx.svc.updateConfig(a.id, { v: 1 }, 'admin')
      ctx.svc.updateConfig(a.id, { v: 2 }, 'admin')
      expect(ctx.svc.getLatestConfig(a.id)?.config_json).toEqual({ v: 2 })
    })

    it('returns null if no config', () => {
      const a = ctx.svc.createAgent({ owner_id: 'u1', display_name: 'Bot' })
      expect(ctx.svc.getLatestConfig(a.id)).toBeNull()
    })
  })

  describe('getAgentRuns', () => {
    it('returns runs for the agent', () => {
      const a = ctx.svc.createAgent({ owner_id: 'u1', display_name: 'Bot' })
      ctx.agentRunRepo.create({
        agent_id: a.id, trigger_event_id: 'e1', input_digest: 'd1',
      })
      ctx.agentRunRepo.create({
        agent_id: a.id, trigger_event_id: 'e2', input_digest: 'd2',
      })
      const result = ctx.svc.getAgentRuns(a.id, {})
      expect(result.items).toHaveLength(2)
    })

    it('throws for unknown agent', () => {
      expect(() => ctx.svc.getAgentRuns('nope', {})).toThrow('not found')
    })
  })

  describe('updateAgentStatus', () => {
    it('updates status', () => {
      const a = ctx.svc.createAgent({ owner_id: 'u1', display_name: 'Bot' })
      const updated = ctx.svc.updateAgentStatus(a.id, 'LIMITED')
      expect(updated.status).toBe('LIMITED')
    })

    it('throws for unknown agent', () => {
      expect(() => ctx.svc.updateAgentStatus('nope', 'BANNED')).toThrow('not found')
    })
  })
})
