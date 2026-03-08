import { afterEach, describe, expect, it } from 'vitest'
import { PERSONA_SEED_CATALOG } from '../../../shared/agent-persona-catalog.js'
import { InMemoryAgentConfigRepository, InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryAgentRunRepository } from '../../repos/event-repository.js'
import { InMemoryPersonaStateRepository } from '../../repos/persona-state-repository.js'
import type { SaveAgentPersonaStateInput } from '../../repos/types.js'
import { AgentService } from '../agent-service.js'
import { PersonaStateService } from '../persona-state-service.js'
import { config } from '../../lib/config.js'

const originalFeatures = {
  personaRuntimeV1: config.features.personaRuntimeV1,
  personaRuntimeScenes: [...config.features.personaRuntimeScenes],
  personaWritebackV1: config.features.personaWritebackV1,
}

function setPersonaFlags(input: {
  runtime: boolean
  scenes: string[]
  writeback: boolean
}): void {
  const featureFlags = config.features as unknown as {
    personaRuntimeV1: boolean
    personaRuntimeScenes: string[]
    personaWritebackV1: boolean
  }
  featureFlags.personaRuntimeV1 = input.runtime
  featureFlags.personaRuntimeScenes = [...input.scenes]
  featureFlags.personaWritebackV1 = input.writeback
}

async function createService(seedCode: keyof typeof PERSONA_SEED_CATALOG) {
  const agentRepo = new InMemoryAgentRepository()
  const agentConfigRepo = new InMemoryAgentConfigRepository()
  const agentRunRepo = new InMemoryAgentRunRepository()
  const agentService = new AgentService({
    agentRepo,
    agentConfigRepo,
    agentRunRepo,
  })
  const agent = await agentService.createAgentPersisted({
    owner_id: 'owner-1',
    display_name: 'Persona Bot',
    persona_seed_code: seedCode,
  })
  const personaStateRepo = new InMemoryPersonaStateRepository()
  const service = new PersonaStateService({
    personaStateRepo,
    agentService,
    statsService: null,
  })
  return { agent, service, personaStateRepo }
}

class ConflictOncePersonaStateRepository extends InMemoryPersonaStateRepository {
  private injected = false

  constructor(
    private readonly injectConflict: (
      input: SaveAgentPersonaStateInput,
      repo: InMemoryPersonaStateRepository,
    ) => Promise<void>,
  ) {
    super()
  }

  override async saveState(input: SaveAgentPersonaStateInput) {
    if (!this.injected && input.expected_version !== undefined) {
      this.injected = true
      await this.injectConflict(input, this)
      return null
    }
    return super.saveState(input)
  }
}

afterEach(() => {
  setPersonaFlags({
    runtime: originalFeatures.personaRuntimeV1,
    scenes: originalFeatures.personaRuntimeScenes,
    writeback: originalFeatures.personaWritebackV1,
  })
})

describe('PersonaStateService', () => {
  it('persists last render decision and decrements overlay turns', async () => {
    setPersonaFlags({ runtime: true, scenes: ['private_chat'], writeback: false })
    const { agent, service, personaStateRepo } = await createService('sharp-tongue')
    const baseline = PERSONA_SEED_CATALOG['sharp-tongue'].baselineVector

    await personaStateRepo.saveState({
      agent_id: agent.id,
      current_vector_json: baseline as Record<string, unknown>,
      anchor_vector_json: baseline as Record<string, unknown>,
      maturity: 'forming',
      confidence: 0.5,
      drift_score: 8,
      last_render_decision_json: null,
    })
    await personaStateRepo.saveActiveOverlay({
      agent_id: agent.id,
      overlay_code: 'guarded',
      intensity: 0.5,
      remaining_turns: 1,
      entered_at: new Date('2026-03-09T10:00:00.000Z'),
      expires_at: new Date('2099-03-09T10:45:00.000Z'),
      cooldown_until: new Date('2099-03-09T10:20:00.000Z'),
      critical: false,
      cause_type: 'ignored',
      cause_ref_id: 'session-1',
      rng_seed: 'seed-1',
      sampled_atoms_json: {
        toneAtomId: 'guarded.tone.1',
        pacingAtomId: 'guarded.pacing.1',
        socialAtomId: 'guarded.social.1',
        restraintAtomId: 'guarded.restraint.1',
      },
      delta_json: { warmth: -6, sensitivity: 8 },
    })

    await service.recordVisibleRender({
      agentId: agent.id,
      scene: 'private_chat',
      renderDecision: {
        scene: 'private_chat',
        requestedTier: 'base',
        reasons: ['overlay_floor'],
        overlayCode: 'guarded',
      },
      outputText: '这次我会先收一点，但还是把重点说清楚。',
    })

    const nextState = await personaStateRepo.findState(agent.id)
    const nextOverlay = await personaStateRepo.findOverlay(agent.id)
    const logs = await personaStateRepo.listDeltaLogsSince(agent.id, new Date('2026-03-01T00:00:00.000Z'))

    expect(nextState?.last_render_decision_json).toEqual({
      scene: 'private_chat',
      requestedTier: 'base',
      reasons: ['overlay_floor'],
      overlayCode: 'guarded',
    })
    expect(nextOverlay?.remaining_turns).toBe(0)
    expect(logs.at(-1)?.source_type).toBe('overlay_recurrence_candidate')
    expect(logs.at(-1)?.writeback_applied).toBe(false)
  })

  it('applies conservative long-term writeback for owner style pin changes', async () => {
    setPersonaFlags({ runtime: true, scenes: ['private_chat'], writeback: true })
    const { agent, service, personaStateRepo } = await createService('mediator')

    await service.recordOwnerStylePinChange(
      agent.id,
      { formality: 3, verbosity: 3, mood: 'neutral', forum_activity: 3, habits: [] },
      { formality: 5, verbosity: 4, mood: 'critical', forum_activity: 4, habits: ['summarizes'] },
      'test:owner-style',
    )

    const state = await personaStateRepo.findState(agent.id)
    const logs = await personaStateRepo.listDeltaLogsSince(agent.id, new Date('2026-03-01T00:00:00.000Z'))

    expect(state).not.toBeNull()
    expect(Number(state!.drift_score)).toBeGreaterThan(0)
    expect(logs.at(-1)?.source_type).toBe('owner_style_pin')
    expect(logs.at(-1)?.writeback_applied).toBe(true)
    expect(state!.current_vector_json).not.toEqual(state!.anchor_vector_json)
  })

  it('retries render decision persistence without overwriting concurrent state changes', async () => {
    setPersonaFlags({ runtime: true, scenes: ['private_chat'], writeback: false })

    const agentRepo = new InMemoryAgentRepository()
    const agentConfigRepo = new InMemoryAgentConfigRepository()
    const agentRunRepo = new InMemoryAgentRunRepository()
    const agentService = new AgentService({
      agentRepo,
      agentConfigRepo,
      agentRunRepo,
    })
    const agent = await agentService.createAgentPersisted({
      owner_id: 'owner-1',
      display_name: 'Persona Bot',
      persona_seed_code: 'sharp-tongue',
    })
    const baseline = PERSONA_SEED_CATALOG['sharp-tongue'].baselineVector
    const repo = new ConflictOncePersonaStateRepository(async (input, innerRepo) => {
      const current = await innerRepo.findState(input.agent_id)
      await innerRepo.saveState({
        agent_id: input.agent_id,
        current_vector_json: {
          ...baseline,
          warmth: baseline.warmth + 5,
        } as Record<string, unknown>,
        anchor_vector_json: current?.anchor_vector_json ?? (baseline as Record<string, unknown>),
        maturity: current?.maturity ?? 'forming',
        confidence: current?.confidence ?? 0.5,
        drift_score: current?.drift_score ?? 8,
        last_render_decision_json: {
          scene: 'private_chat',
          requestedTier: 'plus',
          reasons: ['concurrent_update'],
        },
        expected_version: current?.version,
      })
    })
    await repo.saveState({
      agent_id: agent.id,
      current_vector_json: baseline as Record<string, unknown>,
      anchor_vector_json: baseline as Record<string, unknown>,
      maturity: 'forming',
      confidence: 0.5,
      drift_score: 8,
      last_render_decision_json: null,
    })
    const service = new PersonaStateService({
      personaStateRepo: repo,
      agentService,
      statsService: null,
    })

    await service.recordVisibleRender({
      agentId: agent.id,
      scene: 'private_chat',
      renderDecision: {
        scene: 'private_chat',
        requestedTier: 'base',
        reasons: ['retry_after_conflict'],
      },
      outputText: 'still visible',
    })

    const state = await repo.findState(agent.id)
    expect(state?.last_render_decision_json).toEqual({
      scene: 'private_chat',
      requestedTier: 'base',
      reasons: ['retry_after_conflict'],
    })
    expect(Number(state?.current_vector_json.warmth)).toBe(baseline.warmth + 5)
  })

  it('retries long-term writeback on conflict and preserves concurrent render decisions', async () => {
    setPersonaFlags({ runtime: true, scenes: ['private_chat'], writeback: true })

    const agentRepo = new InMemoryAgentRepository()
    const agentConfigRepo = new InMemoryAgentConfigRepository()
    const agentRunRepo = new InMemoryAgentRunRepository()
    const agentService = new AgentService({
      agentRepo,
      agentConfigRepo,
      agentRunRepo,
    })
    const agent = await agentService.createAgentPersisted({
      owner_id: 'owner-1',
      display_name: 'Persona Bot',
      persona_seed_code: 'mediator',
    })
    const baseline = PERSONA_SEED_CATALOG.mediator.baselineVector
    const repo = new ConflictOncePersonaStateRepository(async (input, innerRepo) => {
      const current = await innerRepo.findState(input.agent_id)
      await innerRepo.saveState({
        agent_id: input.agent_id,
        current_vector_json: {
          ...baseline,
          warmth: baseline.warmth + 1,
        } as Record<string, unknown>,
        anchor_vector_json: current?.anchor_vector_json ?? (baseline as Record<string, unknown>),
        maturity: current?.maturity ?? 'forming',
        confidence: current?.confidence ?? 0.5,
        drift_score: current?.drift_score ?? 8,
        last_render_decision_json: {
          scene: 'private_chat',
          requestedTier: 'plus',
          reasons: ['concurrent_render'],
        },
        expected_version: current?.version,
      })
    })
    await repo.saveState({
      agent_id: agent.id,
      current_vector_json: baseline as Record<string, unknown>,
      anchor_vector_json: baseline as Record<string, unknown>,
      maturity: 'forming',
      confidence: 0.5,
      drift_score: 8,
      last_render_decision_json: null,
    })
    const service = new PersonaStateService({
      personaStateRepo: repo,
      agentService,
      statsService: null,
    })

    await service.recordTraitMutation(agent.id, 'helpful', 'equip')

    const state = await repo.findState(agent.id)
    const logs = await repo.listDeltaLogsSince(agent.id, new Date('2026-03-01T00:00:00.000Z'))

    expect(state?.last_render_decision_json).toEqual({
      scene: 'private_chat',
      requestedTier: 'plus',
      reasons: ['concurrent_render'],
    })
    expect(Number(state?.current_vector_json.warmth)).toBeGreaterThan(baseline.warmth + 1)
    expect(logs.at(-1)?.source_type).toBe('trait_mutation')
    expect(logs.at(-1)?.writeback_applied).toBe(true)
  })
})
