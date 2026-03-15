import { describe, expect, it } from 'vitest'
import { InMemoryUsageLedgerRepository } from '../../llm/usage-ledger.js'
import { personaObservability } from '../../runtime/persona-observability.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import {
  InMemoryAgentConfigRepository,
  InMemoryAgentRepository,
} from '../../repos/agent-repository.js'
import { InMemoryAgentRunRepository } from '../../repos/event-repository.js'
import { InMemoryPersonaStateRepository } from '../../repos/persona-state-repository.js'
import { InMemoryStatsRepository } from '../../repos/stats-repository.js'
import { AgentService } from '../agent-service.js'
import { InferenceProfileService } from '../inference-profile-service.js'
import { PersonaStateService } from '../persona-state-service.js'
import { ReviewService } from '../review-service.js'
import { StatsService } from '../stats-service.js'

async function createContext(opts: { growthPointsTotal?: number } = {}) {
  personaObservability.reset()
  const agentRepo = new InMemoryAgentRepository()
  const agentConfigRepo = new InMemoryAgentConfigRepository()
  const agentRunRepo = new InMemoryAgentRunRepository()
  const statsRepo = new InMemoryStatsRepository()
  const personaStateRepo = new InMemoryPersonaStateRepository()
  const usageLedgerRepo = new InMemoryUsageLedgerRepository()
  const reviewService = new ReviewService(new InMemoryRiskGovernanceRepository(), null)

  const agentService = new AgentService({
    agentRepo,
    agentConfigRepo,
    agentRunRepo,
  })
  const statsService = new StatsService({
    statsRepo,
    agentRepo,
    agentService,
  })
  const personaStateService = new PersonaStateService({
    personaStateRepo,
    agentService,
    statsService,
  })

  const agent = await agentService.createAgentPersisted({
    owner_id: 'owner-1',
    display_name: 'Compiler Bot',
    persona_seed_code: 'philosopher',
  })

  const service = new InferenceProfileService({
    agentService,
    statsService,
    statsRepo,
    personaStateService,
    personaStateRepo,
    usageLedgerRepo,
    reviewService,
    xpService: {
      async getXpSummary() {
        const growthPointsTotal = opts.growthPointsTotal ?? 30
        return {
          xp: growthPointsTotal * 10,
          xp_per_growth_point: 10,
          growth_points_total: growthPointsTotal,
        }
      },
    } as never,
  })

  const currentStats = await statsRepo.getOrCreateStats(agent.id)
  await statsRepo.saveStats({
    agent_id: agent.id,
    expected_version: currentStats.version,
    unspent_points: currentStats.unspent_points,
    granted_points_total: currentStats.granted_points_total,
    sociability: 0,
    curiosity: 20,
    assertiveness: 0,
    empathy: 0,
    brashness: 0,
    cynicism: 0,
    stubbornness: 0,
    volatility: 0,
    memory: 100,
    learning: 100,
  })

  await personaStateRepo.saveState({
    agent_id: agent.id,
    current_vector_json: {
      warmth: 10,
      sharpness: 20,
      expressiveness: 10,
      theatricality: 5,
      rigor: 95,
      spontaneity: 15,
      curiosity: 95,
      assertiveness: 10,
      sensitivity: 40,
      stability: 50,
    },
    anchor_vector_json: {
      warmth: 45,
      sharpness: 40,
      expressiveness: 35,
      theatricality: 20,
      rigor: 80,
      spontaneity: 25,
      curiosity: 85,
      assertiveness: 30,
      sensitivity: 55,
      stability: 85,
    },
    maturity: 'forming',
    confidence: 0.72,
    drift_score: 12,
    last_render_decision_json: null,
  })

  return { agent, personaStateRepo, service, usageLedgerRepo }
}

describe('InferenceProfileService', () => {
  it('keeps narrative/debug reads side-effect free', async () => {
    const { agent, personaStateRepo, service } = await createContext()

    const narrative = await service.getNarrative(agent.id)
    const debug = await service.getDebug(agent.id)
    const persisted = await personaStateRepo.findInferenceProfile(agent.id)

    expect(narrative.summary.length).toBeGreaterThan(0)
    expect(debug.snapshot.axes.depth).toBeGreaterThan(80)
    expect(persisted).toBeNull()
  })

  it('persists runtime candidate state and allows manual freeze', async () => {
    const { agent, service } = await createContext()

    const firstRoute = await service.resolveVisibleRoute({
      agentId: agent.id,
      requestedTier: 'base',
    })
    const secondRoute = await service.resolveVisibleRoute({
      agentId: agent.id,
      requestedTier: 'base',
    })

    expect(firstRoute.requestedTier).toBe('premium')
    expect(secondRoute.profile.challengerFamily).toBe('sage')
    expect(secondRoute.profile.migrationState).toBe('candidate')
    expect(secondRoute.profile.challengerVoiceLineId).toBe('kimi-deep-v1')

    const blocked = await service.setManualVoiceLineLock(agent.id, true)
    expect(blocked.manualVoiceLineLock).toBe(true)
    expect(blocked.migrationState).toBe('blocked')
    expect(blocked.blockedReason).toBe('manual_lock')

    for (let index = 0; index < 5; index += 1) {
      await service.resolveVisibleRoute({
        agentId: agent.id,
        requestedTier: 'base',
      })
    }

    const unlocked = await service.setManualVoiceLineLock(agent.id, false)
    expect(unlocked.manualVoiceLineLock).toBe(false)
    expect(unlocked.migrationState).toBe('shadow')
    expect(unlocked.blockedReason).toBeNull()
  })

  it('creates and collects shadow review evidence before allowing rare reanchor', async () => {
    const { agent, service, usageLedgerRepo } = await createContext()

    for (let index = 0; index < 5; index += 1) {
      await service.resolveVisibleRoute({
        agentId: agent.id,
        requestedTier: 'base',
      })
    }

    await usageLedgerRepo.insert({
      trace_id: 'shadow-1',
      agent_id: agent.id,
      intent: 'proactive_opening',
      visibility: 'visible',
      scene: 'proactive_dm',
      prompt_ref: { id: 'agent-proactive-dm-opening', version: 1 },
      render_decision: {
        voiceLineId: 'qwen-social-v1',
        tier: 'base',
        profileId: 'qwen-social-proactive-opening-base',
        providerId: 'dashscope-openai',
        modelId: 'qwen-plus-character',
        region: 'cn-beijing',
        endpointId: 'dashscope-cn-beijing',
        fallbackLevel: 'none',
        reasons: ['initial_profile_resolution'],
        promptTemplateId: 'agent-proactive-dm-opening',
        promptVersion: 1,
      },
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      success: true,
      provider_id: 'dashscope-openai',
      model_id: 'qwen-plus-character',
      profile_id: 'qwen-social-proactive-opening-base',
      billing_class: 'visible_standard',
      estimated_cost_cny: 0.01,
      reserved_cost_cny: 0.01,
      actual_cost_cny: 0.001,
      latency_ms: 20,
      created_at: new Date().toISOString(),
    })

    await usageLedgerRepo.insert({
      trace_id: 'shadow-2',
      agent_id: agent.id,
      intent: 'proactive_opening',
      visibility: 'visible',
      scene: 'proactive_dm',
      prompt_ref: { id: 'agent-proactive-dm-opening', version: 1 },
      render_decision: {
        voiceLineId: 'qwen-social-v1',
        tier: 'base',
        profileId: 'qwen-social-proactive-opening-base',
        providerId: 'dashscope-openai',
        modelId: 'qwen-plus-character',
        region: 'cn-beijing',
        endpointId: 'dashscope-cn-beijing',
        fallbackLevel: 'none',
        reasons: ['initial_profile_resolution'],
        promptTemplateId: 'agent-proactive-dm-opening',
        promptVersion: 1,
      },
      usage: { prompt_tokens: 22, completion_tokens: 12, total_tokens: 34 },
      success: true,
      provider_id: 'dashscope-openai',
      model_id: 'qwen-plus-character',
      profile_id: 'qwen-social-proactive-opening-base',
      billing_class: 'visible_standard',
      estimated_cost_cny: 0.01,
      reserved_cost_cny: 0.01,
      actual_cost_cny: 0.0012,
      latency_ms: 18,
      created_at: new Date().toISOString(),
    })

    await usageLedgerRepo.insert({
      trace_id: 'shadow-3',
      agent_id: agent.id,
      intent: 'proactive_opening',
      visibility: 'visible',
      scene: 'proactive_dm',
      prompt_ref: { id: 'agent-proactive-dm-opening', version: 1 },
      render_decision: {
        voiceLineId: 'qwen-social-v1',
        tier: 'base',
        profileId: 'qwen-social-proactive-opening-base',
        providerId: 'dashscope-openai',
        modelId: 'qwen-plus-character',
        region: 'cn-beijing',
        endpointId: 'dashscope-cn-beijing',
        fallbackLevel: 'none',
        reasons: ['initial_profile_resolution'],
        promptTemplateId: 'agent-proactive-dm-opening',
        promptVersion: 1,
      },
      usage: { prompt_tokens: 18, completion_tokens: 10, total_tokens: 28 },
      success: true,
      provider_id: 'dashscope-openai',
      model_id: 'qwen-plus-character',
      profile_id: 'qwen-social-proactive-opening-base',
      billing_class: 'visible_standard',
      estimated_cost_cny: 0.01,
      reserved_cost_cny: 0.01,
      actual_cost_cny: 0.0009,
      latency_ms: 22,
      created_at: new Date().toISOString(),
    })

    const beforeCollect = await service.getDebug(agent.id)
    expect(beforeCollect.profile.migrationState).toBe('shadow')

    const started = await service.startShadowReview(agent.id, 'admin-1')
    expect(started.status).toBe('running')

    const collected = await service.collectShadowReview(agent.id, 'admin-1')
    expect(collected.status).toBe('collected')
    expect(collected.summary.recommendation).toBe('approve')
    expect(collected.summary.compareDimensions).toHaveLength(4)

    const approved = await service.approveShadow(agent.id, 'admin-1')
    expect(approved.migrationState).toBe('stable')

    const debugAfter = await service.getDebug(agent.id)
    expect(debugAfter.shadowReview?.status).toBe('applied')
  })

  it('keeps rare reanchor blocked until the higher growth gate is unlocked', async () => {
    const { agent, service, usageLedgerRepo } = await createContext({ growthPointsTotal: 5 })

    for (let index = 0; index < 5; index += 1) {
      await service.resolveVisibleRoute({
        agentId: agent.id,
        requestedTier: 'base',
      })
    }

    await service.startShadowReview(agent.id, 'admin-1')

    for (let index = 0; index < 3; index += 1) {
      await usageLedgerRepo.insert({
        trace_id: `shadow-growth-${index}`,
        agent_id: agent.id,
        intent: 'proactive_opening',
        visibility: 'visible',
        scene: 'proactive_dm',
        prompt_ref: { id: 'agent-proactive-dm-opening', version: 1 },
        render_decision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'qwen-social-proactive-opening-base',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus-character',
          region: 'cn-beijing',
          endpointId: 'dashscope-cn-beijing',
          fallbackLevel: 'none',
          reasons: ['initial_profile_resolution'],
          promptTemplateId: 'agent-proactive-dm-opening',
          promptVersion: 1,
        },
        usage: { prompt_tokens: 18, completion_tokens: 10, total_tokens: 28 },
        success: true,
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        profile_id: 'qwen-social-proactive-opening-base',
        billing_class: 'visible_standard',
        estimated_cost_cny: 0.01,
        reserved_cost_cny: 0.01,
        actual_cost_cny: 0.0009,
        latency_ms: 22,
        created_at: new Date().toISOString(),
      })
    }

    const collected = await service.collectShadowReview(agent.id, 'admin-1')
    expect(collected.summary.recommendation).toBe('approve')

    await expect(service.approveShadow(agent.id, 'admin-1')).rejects.toThrow(
      'Growth gate has not unlocked rare reanchor yet',
    )
  })
})
