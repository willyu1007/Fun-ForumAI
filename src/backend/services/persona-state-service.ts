import { config } from '../lib/config.js'
import type { PersonaStateRepository } from '../repos/persona-state-repository.js'
import type {
  AgentActiveOverlayEntity,
  AgentPersonaStateEntity,
  SaveAgentActiveOverlayInput,
} from '../repos/types.js'
import type { AgentService } from './agent-service.js'
import type { StatsService } from './stats-service.js'
import type { AgentPersona } from '../runtime/types.js'
import {
  PERSONA_SEED_CATALOG,
  type PersonaSeedCatalogEntry,
} from '../../shared/agent-persona-catalog.js'
import type { PersonaVector } from '../../shared/persona-vector.js'
import { resolveAgentIdentity, type OwnerStylePins } from '../identity/agent-identity.js'
import {
  clampPersonaVector,
  projectPersonaVector,
  sumAbsoluteDelta,
  vectorToPartialJson,
} from '../runtime/persona-projector.js'
import {
  isOverlayActive,
  isOverlayCooling,
  maybeActivateOverlay,
  OVERLAY_TEMPLATES,
  renderOverlaySceneRule,
  renderOverlayShortTermState,
} from '../runtime/overlay-engine.js'
import { decideRenderTier } from '../runtime/render-tier-policy.js'
import {
  ARC_EVENT_MAX_STEP,
  ARC_SHIFT_WEEKLY_DRIFT_CAP,
  NORMAL_EVENT_MAX_STEP,
  NORMAL_WEEKLY_DRIFT_CAP,
  type ActiveOverlay,
  type PersonaDeltaInput,
  type PersonaRuntimeEnvelope,
  type PersonaRenderCueInput,
  type PersonaRuntimeScene,
  type PersonaState,
  type RenderTierDecisionResult,
} from '../runtime/persona-runtime-types.js'

export interface PersonaStateServiceDeps {
  personaStateRepo: PersonaStateRepository
  agentService: AgentService
  statsService?: StatsService | null
}

export class PersonaStateService {
  constructor(private readonly deps: PersonaStateServiceDeps) {}

  isEnabled(): boolean {
    return config.launch.capabilities.personaRuntimeV1
  }

  isSceneEnabled(scene: PersonaRuntimeScene): boolean {
    if (!this.isEnabled()) return false
    const whitelist = config.launch.capabilities.personaRuntimeScenes
    if (whitelist.length === 0) return true
    return whitelist.includes(scene)
  }

  async getProjectedPersona(agentId: string): Promise<{
    persona: AgentPersona
    projection: ReturnType<typeof projectPersonaVector>
    state: PersonaState
  }> {
    const identity = this.resolveIdentity(agentId)
    const state = await this.getOrCreateState(agentId, identity.seed)
    const projection = projectPersonaVector(state.current, identity.ownerStylePins)
    return {
      persona: {
        name: identity.visiblePersona.name,
        style: projection.visibleStyle || identity.visiblePersona.style,
        interests: identity.ownerStylePins.interests?.length
          ? [...identity.ownerStylePins.interests]
          : [...identity.visiblePersona.interests],
        language: identity.visiblePersona.language,
      },
      projection,
      state,
    }
  }

  async getCurrentState(agentId: string): Promise<PersonaState> {
    const identity = this.resolveIdentity(agentId)
    return this.getOrCreateState(agentId, identity.seed)
  }

  async getCurrentOverlay(agentId: string): Promise<ActiveOverlay | null> {
    const stored = await this.deps.personaStateRepo.findOverlay(agentId)
    return stored ? this.overlayFromEntity(stored) : null
  }

  async prepareRuntimeEnvelope(input: PersonaRenderCueInput): Promise<PersonaRuntimeEnvelope> {
    const identity = this.resolveIdentity(input.agentId)
    const state = await this.getOrCreateState(input.agentId, identity.seed)
    const projection = projectPersonaVector(state.current, identity.ownerStylePins)
    const now = new Date()

    let storedOverlay = await this.deps.personaStateRepo.findOverlay(input.agentId)
    let overlay = storedOverlay ? this.overlayFromEntity(storedOverlay) : null

    if (overlay && !isOverlayActive(overlay, now) && !isOverlayCooling(overlay, now)) {
      await this.deps.personaStateRepo.clearActiveOverlay(input.agentId)
      overlay = null
      storedOverlay = null
    }

    if (!isOverlayActive(overlay, now)) {
      const activated = maybeActivateOverlay({
        agentId: input.agentId,
        scene: input.scene,
        conversationText: input.conversationText,
        topicHints: input.topicHints ?? [],
        seed: identity.seed,
        state,
        lastOverlay: overlay,
        now,
        externalRefId: input.externalRefId ?? undefined,
      })

      if (activated) {
        overlay = activated
        storedOverlay = await this.deps.personaStateRepo.saveActiveOverlay(
          this.overlayToSaveInput(activated, input.agentId),
        )
      } else {
        overlay = overlay && isOverlayCooling(overlay, now) ? null : null
      }
    }

    const derived = this.deps.statsService?.getDerivedSync(input.agentId)
    const driftGuard = state.driftScore + (derived ? Math.max(0, (derived.expression.temperature - 0.7) * 20) : 0)
    const failureGuard = derived && derived.expression.caution_rate >= 0.75 ? 1 : 0

    const renderTierDecision = decideRenderTier({
      scene: input.scene,
      maturity: state.maturity,
      overlay,
      qualityGuard: {
        recentDriftScore: driftGuard,
        recentFailures: failureGuard,
      },
    })

    const overlayShortTermState = renderOverlayShortTermState(overlay, input.scene)
    const overlaySceneRule = renderOverlaySceneRule(overlay)
    const cacheSalt = [
      `state:${state.version}`,
      `overlay:${storedOverlay?.overlay_code ?? overlay?.code ?? 'none'}`,
      `overlay_turns:${storedOverlay?.remaining_turns ?? overlay?.remainingTurns ?? 0}`,
      `overlay_seed:${storedOverlay?.rng_seed ?? overlay?.rngSeed ?? 'none'}`,
    ].join('|')

    return {
      state,
      projection,
      overlay,
      overlayShortTermState,
      overlaySceneRule,
      renderTierDecision,
      cacheSalt,
    }
  }

  async recordVisibleRender(input: {
    agentId: string
    scene: PersonaRuntimeScene
    renderDecision: RenderTierDecisionResult
    outputText: string
  }): Promise<void> {
    if (!this.isSceneEnabled(input.scene)) return

    const identity = this.resolveIdentity(input.agentId)
    let renderPersisted = false
    for (let attempt = 0; attempt < STATE_WRITE_MAX_RETRIES; attempt++) {
      const state = await this.loadLatestState(input.agentId, identity.seed)
      const saved = await this.deps.personaStateRepo.saveState({
        agent_id: input.agentId,
        current_vector_json: state.current as Record<string, unknown>,
        anchor_vector_json: state.anchor as Record<string, unknown>,
        maturity: state.maturity,
        confidence: state.confidence,
        drift_score: state.driftScore,
        last_render_decision_json: input.renderDecision as unknown as Record<string, unknown>,
        expected_version: state.version,
      })
      if (saved) {
        renderPersisted = true
        break
      }
    }
    if (!renderPersisted) {
      console.warn('[PersonaStateService] failed to persist last render decision after retry budget', {
        agentId: input.agentId,
        scene: input.scene,
      })
    }

    const storedOverlay = await this.deps.personaStateRepo.findOverlay(input.agentId)
    const overlay = storedOverlay ? this.overlayFromEntity(storedOverlay) : null
    if (!overlay) return

    const now = new Date()
    if (!isOverlayActive(overlay, now) && !isOverlayCooling(overlay, now)) {
      await this.deps.personaStateRepo.clearActiveOverlay(input.agentId)
      return
    }
    if (!isOverlayActive(overlay, now)) return

    const nextTurns = Math.max(0, overlay.remainingTurns - 1)
    const nextOverlay: ActiveOverlay = {
      ...overlay,
      remainingTurns: nextTurns,
      expiresAt: nextTurns === 0 ? now.toISOString() : overlay.expiresAt,
    }
    await this.deps.personaStateRepo.saveActiveOverlay(this.overlayToSaveInput(nextOverlay, input.agentId))

    const template = OVERLAY_TEMPLATES[overlay.code]
    if (nextTurns === 0 && template.writebackRule === 'recurrence_only') {
      await this.recordDelta(input.agentId, identity.seed, {
        sourceType: 'overlay_recurrence_candidate',
        sourceRef: overlay.code,
        scene: input.scene,
        salience: 0.25,
        rawDelta: overlay.delta,
        appliedDelta: {},
        writebackApplied: false,
        reason: `overlay ${overlay.code} completed; recurrence tracking only`,
      })
    }
  }

  async recordOwnerStylePinChange(
    agentId: string,
    beforePins: OwnerStylePins,
    afterPins: OwnerStylePins,
    sourceRef?: string | null,
  ): Promise<void> {
    if (!config.launch.capabilities.personaWritebackV1) return
    const identity = this.resolveIdentity(agentId)
    const rawDelta = stylePinsToDelta(beforePins, afterPins)
    await this.applyLongTermDelta(agentId, identity.seed, {
      sourceType: 'owner_style_pin',
      sourceRef,
      salience: 1,
      rawDelta,
      writebackApplied: true,
      reason: 'owner_style_pin_change',
    })
  }

  async recordTraitMutation(
    agentId: string,
    traitCode: string,
    action: 'equip' | 'unequip',
  ): Promise<void> {
    if (!config.launch.capabilities.personaWritebackV1) return
    const identity = this.resolveIdentity(agentId)
    const base = TRAIT_DELTA_MAP[traitCode]
    if (!base) return
    const sign = action === 'equip' ? 1 : -1
    await this.applyLongTermDelta(agentId, identity.seed, {
      sourceType: 'trait_mutation',
      sourceRef: `${traitCode}:${action}`,
      salience: 0.7,
      rawDelta: scaleDelta(base, sign),
      writebackApplied: true,
      reason: `trait_${action}:${traitCode}`,
    })
  }

  async recordInstructionMutation(input: {
    agentId: string
    action: 'create' | 'update' | 'toggle_on' | 'toggle_off' | 'delete'
    body?: string | null
    instructionId?: string | null
    triggerType?: string | null
  }): Promise<void> {
    if (!config.launch.capabilities.personaWritebackV1) return
    const identity = this.resolveIdentity(input.agentId)
    const base = instructionToDelta(input.body ?? '', input.triggerType ?? '')
    if (sumAbsoluteDelta(base) === 0) return
    const sign = input.action === 'toggle_off' || input.action === 'delete' ? -1 : 1
    await this.applyLongTermDelta(input.agentId, identity.seed, {
      sourceType: 'instruction_mutation',
      sourceRef: input.instructionId ?? null,
      salience: 0.7,
      rawDelta: scaleDelta(base, sign),
      writebackApplied: true,
      reason: `instruction_${input.action}`,
    })
  }

  async recordPrivateDigest(input: {
    agentId: string
    sessionId: string
    memoryId: string
    importanceScore: number
    sentiment: string
  }): Promise<void> {
    const identity = this.resolveIdentity(input.agentId)
    const rawDelta = privateDigestToDelta(input.sentiment)
    const salience = clamp(input.importanceScore, 0, 1)
    const shouldWrite = config.launch.capabilities.personaWritebackV1 && salience >= 0.65
    await this.applyLongTermDelta(input.agentId, identity.seed, {
      sourceType: 'private_digest',
      sourceRef: input.memoryId,
      scene: 'private_chat',
      salience,
      rawDelta,
      writebackApplied: shouldWrite,
      reason: `private_digest:${input.sessionId}`,
    })
  }

  private async applyLongTermDelta(
    agentId: string,
    seed: PersonaSeedCatalogEntry,
    input: PersonaDeltaInput,
  ): Promise<void> {
    let persistedDelta: Partial<PersonaVector> | null = null

    for (let attempt = 0; attempt < STATE_WRITE_MAX_RETRIES; attempt++) {
      const state = await this.loadLatestState(agentId, seed)
      const sourceWeight = SOURCE_WEIGHT[input.sourceType]
      const stabilityFactor = 1 - state.current.stability / 140
      let appliedDelta = scaleDelta(
        input.rawDelta,
        sourceWeight * input.salience * clamp(stabilityFactor, 0.2, 0.9),
      )

      const maxStep = input.salience >= 0.9 ? ARC_EVENT_MAX_STEP : NORMAL_EVENT_MAX_STEP
      appliedDelta = capDeltaMagnitude(appliedDelta, maxStep)

      if (!input.writebackApplied || sumAbsoluteDelta(appliedDelta) === 0) {
        await this.recordDelta(agentId, seed, {
          ...input,
          appliedDelta: {},
          writebackApplied: false,
        })
        return
      }

      const weeklyCap = state.maturity === 'arc_shift' || input.salience >= 0.9
        ? ARC_SHIFT_WEEKLY_DRIFT_CAP
        : NORMAL_WEEKLY_DRIFT_CAP
      const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const previousLogs = await this.deps.personaStateRepo.listDeltaLogsSince(agentId, weekStart)
      const usedBudget = previousLogs
        .filter((entry) => entry.writeback_applied)
        .reduce((sum, entry) => sum + sumAbsoluteDelta(entry.applied_delta_json as Partial<PersonaVector>), 0)
      const remainingBudget = Math.max(0, weeklyCap - usedBudget)
      appliedDelta = capDeltaMagnitude(appliedDelta, remainingBudget)

      if (sumAbsoluteDelta(appliedDelta) === 0) {
        await this.recordDelta(agentId, seed, {
          ...input,
          appliedDelta: {},
          writebackApplied: false,
        })
        return
      }

      const nextVector = clampPersonaVector(
        Object.entries(state.current).reduce<Partial<PersonaVector>>((acc, [axis, value]) => {
          acc[axis as keyof PersonaVector] = value + (appliedDelta[axis as keyof PersonaVector] ?? 0)
          return acc
        }, {}),
      )
      const nextDriftScore = round3(computeDriftScore(state.anchor, nextVector))
      const nextConfidence = round3(clamp(state.confidence + 0.08 * input.salience, 0.2, 0.95))
      const nextMaturity = deriveMaturity(nextConfidence, nextDriftScore)

      const saved = await this.deps.personaStateRepo.saveState({
        agent_id: agentId,
        current_vector_json: nextVector as Record<string, unknown>,
        anchor_vector_json: state.anchor as Record<string, unknown>,
        maturity: nextMaturity,
        confidence: nextConfidence,
        drift_score: nextDriftScore,
        last_render_decision_json: state.lastRenderDecision as unknown as Record<string, unknown> | null,
        expected_version: state.version,
      })
      if (saved) {
        persistedDelta = appliedDelta
        break
      }
    }

    if (persistedDelta === null) {
      console.warn('[PersonaStateService] failed to persist long-term delta after retry budget', {
        agentId,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef ?? null,
      })
    }

    await this.recordDelta(agentId, seed, {
      ...input,
      appliedDelta: persistedDelta ?? {},
      writebackApplied: persistedDelta !== null,
    })
  }

  private async recordDelta(
    agentId: string,
    _seed: PersonaSeedCatalogEntry,
    input: PersonaDeltaInput & { appliedDelta: Partial<PersonaVector> },
  ): Promise<void> {
    await this.deps.personaStateRepo.createDeltaLog({
      agent_id: agentId,
      source_type: input.sourceType,
      source_ref: input.sourceRef ?? null,
      scene: input.scene ?? null,
      salience: round3(input.salience),
      raw_delta_json: vectorToPartialJson(input.rawDelta),
      applied_delta_json: vectorToPartialJson(input.appliedDelta),
      writeback_applied: input.writebackApplied,
      reason: input.reason,
    })
  }

  private async loadLatestState(agentId: string, seed: PersonaSeedCatalogEntry): Promise<PersonaState> {
    const existing = await this.deps.personaStateRepo.findState(agentId)
    if (existing) return this.stateFromEntity(existing)
    return this.getOrCreateState(agentId, seed)
  }

  private async getOrCreateState(agentId: string, seed: PersonaSeedCatalogEntry): Promise<PersonaState> {
    const existing = await this.deps.personaStateRepo.findState(agentId)
    if (existing) return this.stateFromEntity(existing)

    const created = await this.deps.personaStateRepo.saveState({
      agent_id: agentId,
      current_vector_json: seed.baselineVector as Record<string, unknown>,
      anchor_vector_json: seed.baselineVector as Record<string, unknown>,
      maturity: 'seed',
      confidence: 0.2,
      drift_score: 0,
      last_render_decision_json: null,
    })
    return this.stateFromEntity(created!)
  }

  private resolveIdentity(agentId: string): {
    seed: PersonaSeedCatalogEntry
    ownerStylePins: OwnerStylePins
    visiblePersona: AgentPersona
  } {
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    return {
      seed: PERSONA_SEED_CATALOG[resolved.contract.personaSeed.seedCode],
      ownerStylePins: resolved.contract.ownerStylePins,
      visiblePersona: resolved.visiblePersona,
    }
  }

  private stateFromEntity(entity: AgentPersonaStateEntity): PersonaState {
    return {
      current: clampPersonaVector(entity.current_vector_json as Partial<PersonaVector>),
      anchor: clampPersonaVector(entity.anchor_vector_json as Partial<PersonaVector>),
      maturity: entity.maturity as PersonaState['maturity'],
      confidence: entity.confidence,
      driftScore: entity.drift_score,
      updatedAt: entity.updated_at.toISOString(),
      version: entity.version,
      lastRenderDecision: (entity.last_render_decision_json ?? null) as RenderTierDecisionResult | null,
    }
  }

  private overlayFromEntity(entity: AgentActiveOverlayEntity): ActiveOverlay {
    return {
      code: entity.overlay_code as ActiveOverlay['code'],
      intensity: entity.intensity,
      remainingTurns: entity.remaining_turns,
      enteredAt: entity.entered_at.toISOString(),
      expiresAt: entity.expires_at.toISOString(),
      cooldownUntil: entity.cooldown_until.toISOString(),
      critical: entity.critical,
      cause: {
        type: entity.cause_type as ActiveOverlay['cause']['type'],
        ...(entity.cause_ref_id ? { refId: entity.cause_ref_id } : {}),
      },
      sampledAtoms: {
        toneAtomId: String(entity.sampled_atoms_json.toneAtomId ?? ''),
        pacingAtomId: String(entity.sampled_atoms_json.pacingAtomId ?? ''),
        socialAtomId: String(entity.sampled_atoms_json.socialAtomId ?? ''),
        restraintAtomId: String(entity.sampled_atoms_json.restraintAtomId ?? ''),
      },
      rngSeed: entity.rng_seed,
      delta: entity.delta_json as Partial<PersonaVector>,
    }
  }

  private overlayToSaveInput(overlay: ActiveOverlay, agentId: string): SaveAgentActiveOverlayInput {
    return {
      agent_id: agentId,
      overlay_code: overlay.code,
      intensity: overlay.intensity,
      remaining_turns: overlay.remainingTurns,
      entered_at: new Date(overlay.enteredAt),
      expires_at: new Date(overlay.expiresAt),
      cooldown_until: new Date(overlay.cooldownUntil),
      critical: overlay.critical,
      cause_type: overlay.cause.type,
      cause_ref_id: overlay.cause.refId ?? null,
      rng_seed: overlay.rngSeed,
      sampled_atoms_json: overlay.sampledAtoms as unknown as Record<string, unknown>,
      delta_json: overlay.delta as Record<string, unknown>,
    }
  }
}

const SOURCE_WEIGHT: Record<PersonaDeltaInput['sourceType'], number> = {
  owner_style_pin: 1,
  trait_mutation: 0.7,
  instruction_mutation: 0.7,
  private_digest: 0.45,
  public_behavior_candidate: 0.2,
  stats_candidate: 0.2,
  overlay_recurrence_candidate: 0.1,
}

const TRAIT_DELTA_MAP: Record<string, Partial<PersonaVector>> = {
  helpful: { warmth: 5, sensitivity: 2 },
  hyperactive: { expressiveness: 4, spontaneity: 4 },
  controversial: { sharpness: 4, assertiveness: 2 },
  slow_starter: { stability: 4, rigor: 2 },
  scholar: { rigor: 5, curiosity: 4 },
  storyteller: { theatricality: 5, expressiveness: 4 },
  debater: { sharpness: 4, assertiveness: 5 },
  warmheart: { warmth: 5, sensitivity: 3 },
  philosopher: { curiosity: 5, rigor: 4 },
  comedian: { theatricality: 5, spontaneity: 4 },
}

const STATE_WRITE_MAX_RETRIES = 3

function stylePinsToDelta(beforePins: OwnerStylePins, afterPins: OwnerStylePins): Partial<PersonaVector> {
  const delta: Partial<PersonaVector> = {}
  const formalityDelta = (afterPins.formality ?? beforePins.formality ?? 3) - (beforePins.formality ?? 3)
  const verbosityDelta = (afterPins.verbosity ?? beforePins.verbosity ?? 3) - (beforePins.verbosity ?? 3)
  const activityDelta = (afterPins.forum_activity ?? beforePins.forum_activity ?? 3) - (beforePins.forum_activity ?? 3)

  applyAxis(delta, 'rigor', formalityDelta * 2)
  applyAxis(delta, 'theatricality', formalityDelta * -1)
  applyAxis(delta, 'expressiveness', verbosityDelta * 2)
  applyAxis(delta, 'curiosity', verbosityDelta)
  applyAxis(delta, 'expressiveness', activityDelta * 2)
  applyAxis(delta, 'spontaneity', activityDelta)

  const beforeMood = beforePins.mood ?? 'neutral'
  const afterMood = afterPins.mood ?? 'neutral'
  if (beforeMood !== afterMood) {
    if (afterMood === 'optimistic') applyAxis(delta, 'warmth', 4)
    if (afterMood === 'critical') applyAxis(delta, 'sharpness', 4)
    if (afterMood === 'random') applyAxis(delta, 'spontaneity', 3)
  }

  const beforeHabits = new Set(beforePins.habits ?? [])
  const afterHabits = new Set(afterPins.habits ?? [])
  for (const habit of afterHabits) {
    if (beforeHabits.has(habit)) continue
    if (habit === 'asks_questions') applyAxis(delta, 'curiosity', 3)
    if (habit === 'uses_analogies') {
      applyAxis(delta, 'theatricality', 2)
      applyAxis(delta, 'expressiveness', 1)
    }
    if (habit === 'tells_stories') {
      applyAxis(delta, 'theatricality', 3)
      applyAxis(delta, 'warmth', 1)
    }
    if (habit === 'summarizes') {
      applyAxis(delta, 'rigor', 3)
      applyAxis(delta, 'stability', 1)
    }
  }

  return delta
}

function instructionToDelta(body: string, triggerType: string): Partial<PersonaVector> {
  const normalized = `${triggerType} ${body}`.toLowerCase()
  const delta: Partial<PersonaVector> = {}
  if (/提问|question|socratic/.test(normalized)) applyAxis(delta, 'curiosity', 2)
  if (/总结|pros|cons|判断|结构|explain/.test(normalized)) applyAxis(delta, 'rigor', 2)
  if (/礼貌|welcome|热情|鼓励/.test(normalized)) applyAxis(delta, 'warmth', 2)
  if (/对立|反驳|advocate|争议/.test(normalized)) {
    applyAxis(delta, 'sharpness', 2)
    applyAxis(delta, 'assertiveness', 2)
  }
  return delta
}

function privateDigestToDelta(sentiment: string): Partial<PersonaVector> {
  switch (sentiment) {
    case 'excited':
      return { expressiveness: 3, spontaneity: 2 }
    case 'thoughtful':
      return { rigor: 2, stability: 1 }
    case 'concerned':
      return { sensitivity: 3, stability: -2 }
    case 'curious':
      return { curiosity: 3 }
    default:
      return { stability: 1 }
  }
}

function scaleDelta(delta: Partial<PersonaVector>, factor: number): Partial<PersonaVector> {
  return Object.entries(delta).reduce<Partial<PersonaVector>>((acc, [axis, value]) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      acc[axis as keyof PersonaVector] = round3(value * factor)
    }
    return acc
  }, {})
}

function capDeltaMagnitude(delta: Partial<PersonaVector>, maxMagnitude: number): Partial<PersonaVector> {
  const magnitude = sumAbsoluteDelta(delta)
  if (magnitude <= maxMagnitude || magnitude === 0) return delta
  return scaleDelta(delta, maxMagnitude / magnitude)
}

function computeDriftScore(anchor: PersonaVector, current: PersonaVector): number {
  const total = Object.keys(anchor).reduce((sum, axis) => {
    const key = axis as keyof PersonaVector
    return sum + Math.abs((current[key] ?? 50) - (anchor[key] ?? 50))
  }, 0)
  return total / Object.keys(anchor).length
}

function deriveMaturity(confidence: number, driftScore: number): PersonaState['maturity'] {
  if (driftScore >= 68) return 'arc_shift'
  if (confidence >= 0.72 && driftScore <= 24) return 'stable'
  if (confidence >= 0.38) return 'forming'
  return 'seed'
}

function applyAxis(delta: Partial<PersonaVector>, axis: keyof PersonaVector, amount: number): void {
  delta[axis] = round3((delta[axis] ?? 0) + amount)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}
