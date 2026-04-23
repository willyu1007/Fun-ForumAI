import type { AgentRepository } from '../repos/agent-repository.js'
import type { AgentService } from './agent-service.js'
import { XP_PER_GROWTH_POINT } from './xp-service.js'
import type {
  AgentState,
  AgentStatePoint,
  AgentStatEvent,
  DomainEvent,
  AgentStats,
  AgentStatsScene,
} from '../repos/types.js'
import type { StatsRepository } from '../repos/stats-repository.js'
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js'
import { deriveKnobs, type DerivedKnobs, type StatsDeriveContext, type StatsHardControls } from './stat-deriver.js'
import { readStyleSettings } from '../identity/agent-identity.js'

const AXIS_KEYS = [
  'sociability',
  'curiosity',
  'assertiveness',
  'empathy',
  'brashness',
  'cynicism',
  'stubbornness',
  'volatility',
] as const

type AxisKey = (typeof AXIS_KEYS)[number]

type AbilityKey = 'memory' | 'learning'

const ABILITY_KEYS: AbilityKey[] = ['memory', 'learning']

export interface StatsAllocationInput {
  sociability?: number
  curiosity?: number
  assertiveness?: number
  empathy?: number
  brashness?: number
  cynicism?: number
  stubbornness?: number
  volatility?: number
  memory?: number
  learning?: number
}

export interface AllocationPreviewRequest {
  allocation: StatsAllocationInput
  version?: number
}

export interface AllocationPreviewResponse {
  before: AgentStats
  after: AgentStats
  cost_points: number
  remaining_points: number
  derived: DerivedKnobs
}

export interface StatsAllocateRequest {
  allocation: StatsAllocationInput
  version?: number
  confirm_no_respec: boolean
  idempotency_key: string
}

export interface StatsAllocateResponse {
  stats: AgentStats
  state: AgentState
  derived: DerivedKnobs
  spent_points: number
  remaining_points: number
  deduped: boolean
}

export interface StatsSnapshot {
  stats: AgentStats
  state: AgentState
  derived: DerivedKnobs
}

export interface StatsServiceDeps {
  statsRepo: StatsRepository
  agentRepo: AgentRepository
  agentService: AgentService
  xpService?: {
    getXp(agentId: string): Promise<{ xp: number }>
  } | null
}

export class StatsService {
  constructor(private readonly deps: StatsServiceDeps) {}

  setXpService(engine: StatsServiceDeps['xpService']): void {
    ;(this.deps as { xpService: StatsServiceDeps['xpService'] }).xpService = engine ?? null
  }

  async onDomainEvent(event: DomainEvent): Promise<void> {
    const payload = event.payload_json
    const updates: Array<{
      agent_id: string
      source: string
      delta: Partial<Omit<AgentState, 'agent_id' | 'last_updated_at'>>
    }> = []

    if (
      event.event_type === 'POST_CREATED'
      || event.event_type === 'THREAD_OPENED'
      || event.event_type === 'THREAD_TURN_ADDED'
    ) {
      const authorAgentId = typeof payload.author_agent_id === 'string' ? payload.author_agent_id : ''
      if (authorAgentId) {
        updates.push({
          agent_id: authorAgentId,
          source: event.event_type.toLowerCase(),
          delta: { arousal: 0.02, fatigue: 0.08 },
        })
      }
    }

    if (event.event_type === 'VOTE_CAST' || event.event_type === 'AGENT_VOTE_CAST') {
      const voterAgentId = typeof payload.voter_agent_id === 'string' ? payload.voter_agent_id : ''
      if (voterAgentId) {
        updates.push({
          agent_id: voterAgentId,
          source: 'vote_cast_actor',
          delta: { fatigue: 0.01, arousal: 0.01 },
        })
      }

      const targetAgentId = typeof payload.target_author_agent_id === 'string' ? payload.target_author_agent_id : ''
      const direction = typeof payload.direction === 'string' ? payload.direction : ''
      if (targetAgentId && direction === 'UP') {
        updates.push({
          agent_id: targetAgentId,
          source: 'vote_cast_target',
          delta: { valence: 0.08, confidence: 0.1, irritability: -0.02 },
        })
      }
      if (targetAgentId && direction === 'DOWN') {
        updates.push({
          agent_id: targetAgentId,
          source: 'vote_cast_target',
          delta: { valence: -0.1, confidence: -0.12, irritability: 0.08, arousal: 0.05 },
        })
      }
    }

    for (const update of updates) {
      await this.applyStateDelta(update.agent_id, update.source, event, update.delta)
    }
  }

  async getSnapshot(agentId: string): Promise<StatsSnapshot> {
    this.ensureAgentExists(agentId)

    const stats = await this.ensureStats(agentId)
    const state = await this.deps.statsRepo.getOrCreateState(agentId)

    return {
      stats,
      state,
      derived: deriveKnobs(stats, state, {
        hard: this.getHardControls(agentId),
      }),
    }
  }

  async getEvents(agentId: string, opts: { cursor?: string; limit?: number }): Promise<{ items: AgentStatEvent[]; next_cursor: string | null }> {
    this.ensureAgentExists(agentId)
    const limit = clampInt(opts.limit ?? 20, 1, 100)
    return this.deps.statsRepo.listEvents(agentId, { cursor: opts.cursor, limit })
  }

  async getStateTimeline(agentId: string, hours: number): Promise<AgentStatePoint[]> {
    this.ensureAgentExists(agentId)
    const safeHours = clampInt(hours, 1, 24 * 14)
    const since = new Date(Date.now() - safeHours * 60 * 60 * 1000)
    return this.deps.statsRepo.listStateTimeline(agentId, since, 200)
  }

  async derive(agentId: string, scene: AgentStatsScene, context?: { privacy_top_k?: number; privacy_budget?: number }): Promise<DerivedKnobs> {
    const snapshot = await this.getSnapshot(agentId)
    const deriveContext = this.buildDeriveContext(agentId, {
      privacy_top_k: context?.privacy_top_k,
      privacy_budget: context?.privacy_budget,
    })

    // scene is currently used for API contract parity; all scenes share one deterministic set.
    void scene
    return deriveKnobs(snapshot.stats, snapshot.state, deriveContext)
  }

  getDerivedSync(agentId: string, context?: { hard?: StatsHardControls; privacy_top_k?: number; privacy_budget?: number }): DerivedKnobs {
    const fallbackStats = defaultStats(agentId)
    const fallbackState = defaultState(agentId)

    const cachedStats = this.deps.statsRepo.getCachedStats(agentId) ?? fallbackStats
    const cachedState = this.deps.statsRepo.getCachedState(agentId) ?? fallbackState

    const hard = {
      ...this.getHardControls(agentId),
      ...(context?.hard ?? {}),
    }

    const deriveContext: StatsDeriveContext = {
      hard,
      privacy:
        context?.privacy_top_k !== undefined && context?.privacy_budget !== undefined
          ? {
              top_k: context.privacy_top_k,
              budget: context.privacy_budget,
            }
          : undefined,
    }

    return deriveKnobs(cachedStats, cachedState, deriveContext)
  }

  async previewAllocation(agentId: string, req: AllocationPreviewRequest): Promise<AllocationPreviewResponse> {
    this.ensureAgentExists(agentId)

    const before = await this.ensureStats(agentId)
    this.assertVersion(req.version, before.version)

    const projected = projectAllocation(before, req.allocation)
    if (projected.cost_points > before.unspent_points) {
      throw new ValidationError(`Insufficient points: requires ${projected.cost_points}, has ${before.unspent_points}`)
    }

    const after: AgentStats = {
      ...before,
      ...projected.next,
      unspent_points: before.unspent_points - projected.cost_points,
    }

    const state = await this.deps.statsRepo.getOrCreateState(agentId)

    return {
      before,
      after,
      cost_points: projected.cost_points,
      remaining_points: after.unspent_points,
      derived: deriveKnobs(after, state, this.buildDeriveContext(agentId)),
    }
  }

  async allocate(agentId: string, req: StatsAllocateRequest): Promise<StatsAllocateResponse> {
    this.ensureAgentExists(agentId)

    if (!req.confirm_no_respec) {
      throw new ValidationError('confirm_no_respec must be true')
    }
    if (!req.idempotency_key || !req.idempotency_key.trim()) {
      throw new ValidationError('idempotency_key is required')
    }

    const existingEvent = await this.deps.statsRepo.findEventByIdempotencyKey(agentId, req.idempotency_key)
    if (existingEvent) {
      const snapshot = await this.getSnapshot(agentId)
      const spent = toNumber(existingEvent.delta_json.spent_points)
      return {
        stats: snapshot.stats,
        state: snapshot.state,
        derived: snapshot.derived,
        spent_points: spent,
        remaining_points: snapshot.stats.unspent_points,
        deduped: true,
      }
    }

    const preview = await this.previewAllocation(agentId, {
      allocation: req.allocation,
      version: req.version,
    })

    if (preview.cost_points <= 0) {
      throw new ValidationError('At least 1 point must be allocated')
    }

    const persisted = await this.deps.statsRepo.saveStats({
      agent_id: agentId,
      unspent_points: preview.after.unspent_points,
      granted_points_total: preview.after.granted_points_total,
      sociability: preview.after.sociability,
      curiosity: preview.after.curiosity,
      assertiveness: preview.after.assertiveness,
      empathy: preview.after.empathy,
      brashness: preview.after.brashness,
      cynicism: preview.after.cynicism,
      stubbornness: preview.after.stubbornness,
      volatility: preview.after.volatility,
      memory: preview.after.memory,
      learning: preview.after.learning,
      expected_version: preview.before.version,
    })

    if (!persisted) {
      const dedupedEvent = await this.deps.statsRepo.findEventByIdempotencyKey(agentId, req.idempotency_key)
      if (dedupedEvent) {
        const snapshot = await this.getSnapshot(agentId)
        return {
          stats: snapshot.stats,
          state: snapshot.state,
          derived: snapshot.derived,
          spent_points: toNumber(dedupedEvent.delta_json.spent_points),
          remaining_points: snapshot.stats.unspent_points,
          deduped: true,
        }
      }

      throw new AppError(409, 'Stats version conflict', 'CONFLICT')
    }

    const state = await this.deps.statsRepo.getOrCreateState(agentId)
    const derived = deriveKnobs(persisted, state, this.buildDeriveContext(agentId))

    await this.deps.statsRepo.createEvent({
      agent_id: agentId,
      event_type: 'POINTS_SPENT',
      source: 'manual_allocate',
      idempotency_key: req.idempotency_key,
      delta_json: {
        allocation: req.allocation,
        spent_points: preview.cost_points,
        before: serializeStats(preview.before),
        after: serializeStats(persisted),
      },
    })

    return {
      stats: persisted,
      state,
      derived,
      spent_points: preview.cost_points,
      remaining_points: persisted.unspent_points,
      deduped: false,
    }
  }

  private async applyStateDelta(
    agentId: string,
    source: string,
    event: DomainEvent,
    delta: Partial<Omit<AgentState, 'agent_id' | 'last_updated_at'>>,
  ): Promise<void> {
    const baseState = await this.deps.statsRepo.getOrCreateState(agentId)
    const decayed = decayState(baseState, new Date())

    const next: AgentState = {
      ...decayed,
      agent_id: agentId,
      valence: clampFloat(decayed.valence + (delta.valence ?? 0), -1, 1),
      arousal: clampFloat(decayed.arousal + (delta.arousal ?? 0), 0, 1),
      confidence: clampFloat(decayed.confidence + (delta.confidence ?? 0), -1, 1),
      irritability: clampFloat(decayed.irritability + (delta.irritability ?? 0), 0, 1),
      fatigue: clampFloat(decayed.fatigue + (delta.fatigue ?? 0), 0, 1),
      last_updated_at: new Date(),
    }

    if (
      next.valence === baseState.valence &&
      next.arousal === baseState.arousal &&
      next.confidence === baseState.confidence &&
      next.irritability === baseState.irritability &&
      next.fatigue === baseState.fatigue
    ) {
      return
    }

    const saved = await this.deps.statsRepo.saveState({
      agent_id: agentId,
      valence: next.valence,
      arousal: next.arousal,
      confidence: next.confidence,
      irritability: next.irritability,
      fatigue: next.fatigue,
    })

    await this.deps.statsRepo.createEvent({
      agent_id: agentId,
      event_type: 'STATE_UPDATED',
      source,
      idempotency_key: `state:${event.id}:${agentId}:${source}`,
      delta_json: {
        event_id: event.id,
        event_type: event.event_type,
        state_before: serializeState(baseState),
        state_after: serializeState(saved),
        state_delta: delta,
      },
    })
  }

  private ensureAgentExists(agentId: string): void {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) {
      throw new NotFoundError('Agent', agentId)
    }
  }

  private assertVersion(expected: number | undefined, actual: number): void {
    if (expected === undefined) return
    if (expected !== actual) {
      throw new AppError(409, `Stats version mismatch, expected ${expected}, got ${actual}`, 'CONFLICT')
    }
  }

  private buildDeriveContext(
    agentId: string,
    context?: { privacy_top_k?: number; privacy_budget?: number },
  ): StatsDeriveContext {
    const hard = this.getHardControls(agentId)

    if (context?.privacy_top_k !== undefined && context?.privacy_budget !== undefined) {
      return {
        hard,
        privacy: {
          top_k: context.privacy_top_k,
          budget: context.privacy_budget,
        },
      }
    }

    return { hard }
  }

  private getHardControls(agentId: string): StatsHardControls {
    const agent = this.deps.agentRepo.findById(agentId)

    let talkativeness = 3
    let allowWandering = false
    let forumActivity = 3

    try {
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      const configJson = latestConfig?.config_json ?? {}
      const chat = (configJson.chat as Record<string, unknown>) ?? {}
      const style = readStyleSettings(configJson)

      if (typeof chat.talkativeness === 'number') {
        talkativeness = clampInt(Math.round(chat.talkativeness), 1, 5)
      }
      allowWandering = chat.allow_wandering === true

      forumActivity = clampInt(Math.round(style.forum_activity), 1, 5)
    } catch {
      // Keep defaults when agent config is not found.
    }

    return {
      agent_status: agent?.status,
      talkativeness,
      allow_wandering: allowWandering,
      forum_activity: forumActivity,
    }
  }

  private async ensureStats(agentId: string): Promise<AgentStats> {
    const stats = await this.deps.statsRepo.getOrCreateStats(agentId)

    if (!this.deps.xpService) {
      return stats
    }

    try {
      const { xp } = await this.deps.xpService.getXp(agentId)
      const grantedPointsTotal = Math.max(0, Math.floor(xp / XP_PER_GROWTH_POINT))
      if (grantedPointsTotal <= stats.granted_points_total) {
        return stats
      }

      const grantedPointsDelta = grantedPointsTotal - stats.granted_points_total
      const synced = await this.deps.statsRepo.saveStats({
        agent_id: agentId,
        unspent_points: stats.unspent_points + grantedPointsDelta,
        granted_points_total: grantedPointsTotal,
        sociability: stats.sociability,
        curiosity: stats.curiosity,
        assertiveness: stats.assertiveness,
        empathy: stats.empathy,
        brashness: stats.brashness,
        cynicism: stats.cynicism,
        stubbornness: stats.stubbornness,
        volatility: stats.volatility,
        memory: stats.memory,
        learning: stats.learning,
        expected_version: stats.version,
      })

      if (!synced) {
        return stats
      }

      await this.deps.statsRepo.createEvent({
        agent_id: agentId,
        event_type: 'POINTS_GRANTED',
        source: 'xp_formula_sync',
        idempotency_key: `xp-formula-sync:${agentId}:${grantedPointsTotal}`,
        delta_json: {
          granted_points: grantedPointsDelta,
          granted_points_total: grantedPointsTotal,
          xp,
          xp_per_growth_point: XP_PER_GROWTH_POINT,
        },
      })

      return synced
    } catch {
      return stats
    }
  }
}

function projectAllocation(
  current: AgentStats,
  allocation: StatsAllocationInput,
): {
  next: Pick<AgentStats, AxisKey | AbilityKey>
  cost_points: number
} {
  const next: Pick<AgentStats, AxisKey | AbilityKey> = {
    sociability: current.sociability,
    curiosity: current.curiosity,
    assertiveness: current.assertiveness,
    empathy: current.empathy,
    brashness: current.brashness,
    cynicism: current.cynicism,
    stubbornness: current.stubbornness,
    volatility: current.volatility,
    memory: current.memory,
    learning: current.learning,
  }

  let costPoints = 0

  for (const axis of AXIS_KEYS) {
    const raw = allocation[axis] ?? 0
    const points = assertInteger(raw, axis)
    if (points === 0) continue

    const moved = applyAxisPoints(next[axis], points)
    next[axis] = moved
    costPoints += Math.abs(points)
  }

  for (const ability of ABILITY_KEYS) {
    const raw = allocation[ability] ?? 0
    const points = assertInteger(raw, ability)
    if (points < 0) {
      throw new ValidationError(`${ability} points cannot be negative`)
    }
    if (points === 0) continue

    const delta = points * 2
    const nextValue = next[ability] + delta
    if (nextValue > 100) {
      throw new ValidationError(`${ability} exceeds max value 100`)
    }

    next[ability] = nextValue
    costPoints += points
  }

  return { next, cost_points: costPoints }
}

function applyAxisPoints(current: number, signedPoints: number): number {
  const direction = Math.sign(signedPoints)
  const points = Math.abs(signedPoints)
  let value = current

  for (let i = 0; i < points; i++) {
    if (direction > 0 && value >= 100) {
      throw new ValidationError('Axis value already at +100 boundary')
    }
    if (direction < 0 && value <= -100) {
      throw new ValidationError('Axis value already at -100 boundary')
    }

    const step = axisStep(Math.abs(value))
    value = clampInt(value + direction * step, -100, 100)
  }

  return value
}

function axisStep(absValue: number): number {
  if (absValue <= 40) return 4
  if (absValue <= 70) return 3
  return 1
}

function assertInteger(input: number, field: string): number {
  if (!Number.isInteger(input)) {
    throw new ValidationError(`${field} allocation must be integer points`)
  }
  return input
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return Math.trunc(value)
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function serializeStats(stats: AgentStats): Record<string, number> {
  return {
    unspent_points: stats.unspent_points,
    granted_points_total: stats.granted_points_total,
    sociability: stats.sociability,
    curiosity: stats.curiosity,
    assertiveness: stats.assertiveness,
    empathy: stats.empathy,
    brashness: stats.brashness,
    cynicism: stats.cynicism,
    stubbornness: stats.stubbornness,
    volatility: stats.volatility,
    memory: stats.memory,
    learning: stats.learning,
    version: stats.version,
  }
}

function serializeState(state: AgentState): Record<string, number> {
  return {
    valence: state.valence,
    arousal: state.arousal,
    confidence: state.confidence,
    irritability: state.irritability,
    fatigue: state.fatigue,
  }
}

function decayState(state: AgentState, now: Date): AgentState {
  const elapsedHours = Math.max(0, (now.getTime() - state.last_updated_at.getTime()) / (60 * 60 * 1000))
  if (elapsedHours <= 0) return state

  const decayed = {
    valence: decayByHalfLife(state.valence, elapsedHours, 6),
    arousal: decayByHalfLife(state.arousal, elapsedHours, 2),
    confidence: decayByHalfLife(state.confidence, elapsedHours, 12),
    irritability: decayByHalfLife(state.irritability, elapsedHours, 4),
    fatigue: decayByHalfLife(state.fatigue, elapsedHours, 12),
  }

  return {
    ...state,
    valence: clampFloat(decayed.valence, -1, 1),
    arousal: clampFloat(decayed.arousal, 0, 1),
    confidence: clampFloat(decayed.confidence, -1, 1),
    irritability: clampFloat(decayed.irritability, 0, 1),
    fatigue: clampFloat(decayed.fatigue, 0, 1),
    last_updated_at: now,
  }
}

function decayByHalfLife(value: number, elapsedHours: number, halfLifeHours: number): number {
  const factor = Math.pow(0.5, elapsedHours / Math.max(halfLifeHours, 0.1))
  return value * factor
}

function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return Math.round(value * 1000) / 1000
}

function defaultStats(agentId: string): AgentStats {
  const now = new Date()
  return {
    agent_id: agentId,
    unspent_points: 25,
    granted_points_total: 25,
    sociability: 0,
    curiosity: 0,
    assertiveness: 0,
    empathy: 0,
    brashness: 0,
    cynicism: 0,
    stubbornness: 0,
    volatility: 0,
    memory: 30,
    learning: 30,
    version: 1,
    created_at: now,
    updated_at: now,
  }
}

function defaultState(agentId: string): AgentState {
  const now = new Date()
  return {
    agent_id: agentId,
    valence: 0,
    arousal: 0,
    confidence: 0,
    irritability: 0,
    fatigue: 0,
    last_updated_at: now,
  }
}
