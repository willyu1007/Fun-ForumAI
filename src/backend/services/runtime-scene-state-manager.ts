import { randomUUID } from 'node:crypto'
import { config } from '../lib/config.js'
import type { EventRepository } from '../repos/event-repository.js'
import type { RuntimeSceneStateRepository } from '../repos/runtime-scene-state-repository.js'
import type {
  ChatMessage,
  Room,
  RoomCastMemberView,
  RoomCueType,
  RoomMember,
  RoomProgram,
} from '../repos/types.js'
import { runtimeSceneStateV1Schema, type RuntimeSceneStateV1 } from '../stage/index.js'
import { ChatroomSceneAwareCastingService } from './chatroom-scene-aware-casting-service.js'
import { ChatroomSceneContractResolver } from './chatroom-scene-contract-resolver.js'

const DEFAULT_CHATROOM_COOLDOWN_MS = 60 * 60 * 1000

type RuntimeSignal =
  | {
      type: 'turn_planned'
      room_id: string
      episode_id: string
      cue_type: RoomCueType | null
      program_event_id: string | null
      local_intent_id: string | null
    }
  | {
      type: 'turn_executed'
      room_id: string
      episode_id: string
      cue_type: RoomCueType | null
      program_event_id: string | null
      local_intent_id: string | null
      speaker_agent_id: string
      body: string | null
    }
  | {
      type: 'loop_opened'
      room_id: string
      episode_id: string
      loop_id: string
      summary: string
      source: RuntimeSceneStateV1['continuity']['open_loops'][number]['source']
    }
  | {
      type: 'loop_resolved'
      room_id: string
      episode_id: string
      loop_id: string
      summary: string
      resolution_type: RuntimeSceneStateV1['continuity']['resolved_loops'][number]['resolution_type']
    }
  | {
      type: 'close_requested'
      room_id: string
      episode_id: string
      reason: NonNullable<RuntimeSceneStateV1['close_condition']['reason']>
    }

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function trimLoopSummary(text: string | null | undefined, max = 96): string {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function assignExperimentBucket(episodeId: string): RuntimeSceneStateV1['experiment']['bucket'] {
  const sum = Array.from(episodeId).reduce((total, char) => total + char.charCodeAt(0), 0)
  return (['A', 'B', 'C'] as const)[sum % 3]
}

function computeHeatScore(recentMessages: ChatMessage[]): number {
  if (recentMessages.length === 0) return 0
  const questionScore = recentMessages.reduce((count, message) => count + Number(/[?？]/.test(message.body)) * 0.12, 0)
  const exclamationScore = recentMessages.reduce((count, message) => count + Number(/[!！]/.test(message.body)) * 0.05, 0)
  const speakerVariety = Math.min(new Set(recentMessages.slice(-6).map((message) => message.author_id)).size / 4, 1)
  return Number(Math.min(1, speakerVariety * 0.4 + questionScore + exclamationScore).toFixed(2))
}

function computeFatigueScore(turnCount: number, threshold: number): number {
  if (threshold <= 0) return 0
  return Number(Math.min(1, turnCount / Math.max(threshold, 6)).toFixed(2))
}

function computeRepetitionScore(recentlySpokeAgentIds: string[]): number {
  if (recentlySpokeAgentIds.length <= 1) return 0
  const duplicates = recentlySpokeAgentIds.length - new Set(recentlySpokeAgentIds).size
  return Number(Math.min(1, duplicates / Math.max(1, recentlySpokeAgentIds.length - 1)).toFixed(2))
}

function derivePhase(input: {
  turnCount: number
  messageThreshold: number
  status: RuntimeSceneStateV1['status']
}): RuntimeSceneStateV1['phase'] {
  if (input.status === 'closing' || input.status === 'closed' || input.status === 'cooldown') {
    return 'closure'
  }
  const threshold = Math.max(input.messageThreshold, 6)
  if (input.turnCount >= Math.ceil(threshold * 0.66)) return 'pivot'
  if (input.turnCount >= Math.ceil(threshold * 0.33)) return 'escalation'
  return 'opening'
}

function nowIso(): string {
  return new Date().toISOString()
}

function buildInitialAftershowState(
  mode: RuntimeSceneStateV1['aftershow']['mode'],
): RuntimeSceneStateV1['aftershow'] {
  return {
    mode,
    status: mode === 'off' ? 'not_applicable' : 'pending',
    artifact_ref: null,
  }
}

function syncAftershowState(
  current: RuntimeSceneStateV1['aftershow'],
  mode: RuntimeSceneStateV1['aftershow']['mode'],
): RuntimeSceneStateV1['aftershow'] {
  if (current.mode === mode) return current
  if (mode === 'off') {
    return {
      mode,
      status: 'not_applicable',
      artifact_ref: current.artifact_ref,
    }
  }
  return {
    mode,
    status: current.status === 'published' || current.status === 'skipped'
      ? current.status
      : 'pending',
    artifact_ref: current.artifact_ref,
  }
}

export class RuntimeSceneStateManager {
  constructor(
    private readonly deps: {
      runtimeSceneStateRepo: RuntimeSceneStateRepository
      eventRepo: EventRepository
      sceneResolver: ChatroomSceneContractResolver
      sceneAwareCastingService: ChatroomSceneAwareCastingService
    },
  ) {}

  async ensureChatroomState(input: {
    room: Room
    program: RoomProgram
    episode: {
      id: string
      turn_count: number
      message_count: number
      started_at: Date
      ended_at: Date | null
    }
    cast: RoomCastMemberView[]
    members: RoomMember[]
    recentMessages: ChatMessage[]
  }) {
    let existing = await this.deps.runtimeSceneStateRepo.findByEpisodeId(input.episode.id)
    const resolved = this.deps.sceneResolver.resolve({
      roomId: input.room.id,
      sceneType: input.program.scene_type,
    })
    const sceneCasting = this.deps.sceneAwareCastingService.shape({
      cast: input.cast,
      members: input.members,
      recentMessages: input.recentMessages,
      template: resolved.template,
      target_cast_min: input.program.target_cast_min,
      target_cast_max: input.program.target_cast_max,
    })
    const previous = await this.deps.runtimeSceneStateRepo.findActiveByRoom(input.room.id)
    if (!existing) {
      const startedAtIso = input.episode.started_at.toISOString()
      const expiresAt = new Date(
        input.episode.started_at.getTime()
          + resolved.template.director.closing_policy.ttl_hours * 3600_000,
      ).toISOString()
      const initialState = runtimeSceneStateV1Schema.parse({
        runtime_scene_id: `runtime_scene_${randomUUID()}`,
        director_surface: 'chat_room',
        actor_surface: 'chat_room',
        community_id: input.room.community_id ?? null,
        room_id: input.room.id,
        scene_template_id: resolved.template.template_id,
        scene_template_version: resolved.template.template_version,
        scene_binding_id: resolved.binding?.binding_id ?? null,
        overlay_id: null,
        episode_id: input.episode.id,
        phase: 'opening',
        status: 'active',
        cast: {
          active_agent_ids: sceneCasting.active_agent_ids,
          standby_agent_ids: sceneCasting.standby_agent_ids,
          suppressed_agent_ids: sceneCasting.suppressed_agent_ids,
          recently_spoke_agent_ids: unique(
            input.recentMessages
              .slice(-4)
              .map((message) => message.author_id)
              .reverse(),
          ),
          slot_audit: sceneCasting.slot_audit,
          cast_version: 1,
        },
        continuity: {
          previous_episode_ids: previous && previous.episode_id !== input.episode.id
            ? unique([previous.episode_id, ...previous.state_json.continuity.previous_episode_ids]).slice(0, 6)
            : [],
          open_loops: [],
          resolved_loops: [],
        },
        dynamics: {
          turn_count: input.episode.turn_count,
          message_count: input.episode.message_count,
          heat_score: computeHeatScore(input.recentMessages),
          fatigue_score: computeFatigueScore(
            input.episode.turn_count,
            resolved.template.director.closing_policy.message_threshold,
          ),
          repetition_score: computeRepetitionScore(
            unique(
              input.recentMessages
                .slice(-4)
                .map((message) => message.author_id)
                .reverse(),
            ),
          ),
          phase_entered_at: startedAtIso,
        },
        close_condition: {
          reason: null,
          satisfied: false,
          objective_refs: [resolved.template.director.scene_goal.viewer_goal],
          ttl_at: expiresAt,
          message_threshold: resolved.template.director.closing_policy.message_threshold,
          evaluated_at: startedAtIso,
        },
        aftershow: buildInitialAftershowState(resolved.template.director.closing_policy.aftershow_mode),
        cooldown_until: null,
        experiment: {
          bucket: assignExperimentBucket(input.episode.id),
          assignment_source: 'feature_flag',
        },
        audit: {
          selection_id: null,
          episode_plan_id: null,
          source: resolved.source,
          latest_local_intent_id: null,
          latest_program_event_id: null,
          state_version: 1,
        },
        started_at: startedAtIso,
        updated_at: startedAtIso,
        expires_at: expiresAt,
        closed_at: null,
      })

      existing = await this.deps.runtimeSceneStateRepo.create({
        runtime_scene_id: initialState.runtime_scene_id,
        director_surface: 'chat_room',
        actor_surface: 'chat_room',
        community_id: input.room.community_id ?? null,
        room_id: input.room.id,
        episode_id: input.episode.id,
        scene_template_id: initialState.scene_template_id,
        scene_template_version: initialState.scene_template_version,
        scene_binding_id: initialState.scene_binding_id,
        overlay_id: null,
        experiment_bucket: initialState.experiment.bucket,
        initial_state: initialState,
      })

      this.emitRuntimeEvent('DIRECTOR_EPISODE_STARTED', input.room, input.episode.id, {
        runtime_scene_id: initialState.runtime_scene_id,
        scene_template_id: initialState.scene_template_id,
        scene_binding_id: initialState.scene_binding_id,
        source: resolved.source,
      })
      return { state: existing, resolved }
    }

    const nextState = this.applyChatroomSync(existing.state_json, input, resolved, sceneCasting)
    if (JSON.stringify(nextState) === JSON.stringify(existing.state_json)) {
      return { state: existing, resolved }
    }

    const updated = await this.deps.runtimeSceneStateRepo.update(existing.runtime_scene_id, {
      expected_state_version: existing.state_version,
      phase: nextState.phase,
      status: nextState.status,
      fatigue_score: nextState.dynamics.fatigue_score,
      repetition_score: nextState.dynamics.repetition_score,
      cooldown_until: nextState.cooldown_until ? new Date(nextState.cooldown_until) : null,
      state_json: nextState,
    })
    return { state: updated ?? existing, resolved }
  }

  async findActiveByRoom(roomId: string) {
    return this.deps.runtimeSceneStateRepo.findActiveByRoom(roomId)
  }

  async findByEpisodeId(episodeId: string) {
    return this.deps.runtimeSceneStateRepo.findByEpisodeId(episodeId)
  }

  async handleSignal(signal: RuntimeSignal): Promise<void> {
    if (!config.launch.capabilities.directorRuntimeStateV1) return
    const current = await this.deps.runtimeSceneStateRepo.findByEpisodeId(signal.episode_id)
    if (!current) return

    const now = new Date()
    const next = structuredClone(current.state_json)
    let phaseAdvancePayload: Record<string, unknown> | null = null
    next.updated_at = now.toISOString()
    next.audit.state_version = current.state_version + 1
    next.close_condition.evaluated_at = next.updated_at

    switch (signal.type) {
      case 'turn_planned': {
        next.audit.latest_program_event_id = signal.program_event_id
        next.audit.latest_local_intent_id = signal.local_intent_id
        break
      }
      case 'turn_executed': {
        next.audit.latest_program_event_id = signal.program_event_id
        next.audit.latest_local_intent_id = signal.local_intent_id
        next.dynamics.turn_count += 1
        next.dynamics.message_count += 1
        next.cast.recently_spoke_agent_ids = unique([
          signal.speaker_agent_id,
          ...next.cast.recently_spoke_agent_ids,
        ]).slice(0, 4)
        next.dynamics.repetition_score = computeRepetitionScore(next.cast.recently_spoke_agent_ids)
        next.dynamics.fatigue_score = computeFatigueScore(
          next.dynamics.turn_count,
          next.close_condition.message_threshold ?? 10,
        )
        next.dynamics.heat_score = Number(Math.min(
          1,
          next.dynamics.heat_score
            + (signal.cue_type === 'ASK' ? 0.12 : 0.04)
            + (signal.body && /[?？]/.test(signal.body) ? 0.08 : 0)
            + (signal.body && /[!！]/.test(signal.body) ? 0.04 : 0),
        ).toFixed(2))
        if (signal.cue_type === 'CLOSE') {
          this.closeState(next, 'manual', now)
        } else {
          this.evaluateAutomaticClose(next, now)
        }
        break
      }
      case 'loop_opened': {
        if (!next.continuity.open_loops.some((item) => item.loop_id === signal.loop_id)) {
          next.continuity.open_loops.push({
            loop_id: signal.loop_id,
            summary: trimLoopSummary(signal.summary),
            source: signal.source,
            opened_at: next.updated_at,
          })
        }
        break
      }
      case 'loop_resolved': {
        const loop = next.continuity.open_loops.find((item) => item.loop_id === signal.loop_id)
        next.continuity.open_loops = next.continuity.open_loops.filter((item) => item.loop_id !== signal.loop_id)
        next.continuity.resolved_loops.push({
          loop_id: signal.loop_id,
          summary: trimLoopSummary(signal.summary || loop?.summary),
          resolution_type: signal.resolution_type,
          resolved_at: next.updated_at,
        })
        break
      }
      case 'close_requested': {
        this.closeState(next, signal.reason, now)
        break
      }
    }

    if (next.status === 'active') {
      const derivedPhase = derivePhase({
        turnCount: next.dynamics.turn_count,
        messageThreshold: next.close_condition.message_threshold ?? 10,
        status: next.status,
      })
      if (derivedPhase !== next.phase) {
        next.phase = derivedPhase
        next.dynamics.phase_entered_at = next.updated_at
        phaseAdvancePayload = {
          phase: next.phase,
        }
      }
    }

    const updated = await this.deps.runtimeSceneStateRepo.update(current.runtime_scene_id, {
      expected_state_version: current.state_version,
      phase: next.phase,
      status: next.status,
      fatigue_score: next.dynamics.fatigue_score,
      repetition_score: next.dynamics.repetition_score,
      cooldown_until: next.cooldown_until ? new Date(next.cooldown_until) : null,
      state_json: runtimeSceneStateV1Schema.parse(next),
    })
    if (!updated) return

    if (phaseAdvancePayload) {
      this.emitSignalEvent('DIRECTOR_PHASE_ADVANCED', current, updated.state_json, phaseAdvancePayload)
    }

    if (signal.type === 'close_requested' || (signal.type === 'turn_executed' && updated.status !== 'active')) {
      this.emitRuntimeEvent('DIRECTOR_EPISODE_CLOSED', {
        id: signal.room_id,
        community_id: current.community_id,
      } as Room, updated.episode_id, {
        runtime_scene_id: updated.runtime_scene_id,
        close_reason: updated.state_json.close_condition.reason,
        cooldown_until: updated.state_json.cooldown_until,
      })
    }
    if (signal.type === 'loop_resolved') {
      this.emitRuntimeEvent('DIRECTOR_OPEN_LOOP_REVISITED', {
        id: signal.room_id,
        community_id: current.community_id,
      } as Room, updated.episode_id, {
        loop_id: signal.loop_id,
        resolution_type: signal.resolution_type,
      })
    }
  }

  private applyChatroomSync(
    current: RuntimeSceneStateV1,
    input: {
      room: Room
      program: RoomProgram
      episode: {
        id: string
        turn_count: number
        message_count: number
      }
      recentMessages: ChatMessage[]
    },
    resolved: ReturnType<ChatroomSceneContractResolver['resolve']>,
    sceneCasting: ReturnType<ChatroomSceneAwareCastingService['shape']>,
  ): RuntimeSceneStateV1 {
    const next = structuredClone(current)
    const nextExpiresAt = new Date(
      new Date(current.started_at).getTime()
        + resolved.template.director.closing_policy.ttl_hours * 3600_000,
    ).toISOString()
    next.scene_template_id = resolved.template.template_id
    next.scene_template_version = resolved.template.template_version
    next.scene_binding_id = resolved.binding?.binding_id ?? null
    next.audit.source = resolved.source
    next.cast.active_agent_ids = sceneCasting.active_agent_ids
    next.cast.standby_agent_ids = sceneCasting.standby_agent_ids
    next.cast.suppressed_agent_ids = sceneCasting.suppressed_agent_ids
    next.cast.slot_audit = sceneCasting.slot_audit
    next.cast.cast_version = JSON.stringify({
      active: next.cast.active_agent_ids,
      standby: next.cast.standby_agent_ids,
      suppressed: next.cast.suppressed_agent_ids,
      slot_audit: next.cast.slot_audit,
    }) === JSON.stringify({
      active: current.cast.active_agent_ids,
      standby: current.cast.standby_agent_ids,
      suppressed: current.cast.suppressed_agent_ids,
      slot_audit: current.cast.slot_audit,
    })
      ? current.cast.cast_version
      : current.cast.cast_version + 1
    next.dynamics.turn_count = input.episode.turn_count
    next.dynamics.message_count = input.episode.message_count
    next.dynamics.heat_score = computeHeatScore(input.recentMessages)
    next.dynamics.fatigue_score = computeFatigueScore(
      input.episode.turn_count,
      resolved.template.director.closing_policy.message_threshold,
    )
    next.dynamics.repetition_score = computeRepetitionScore(next.cast.recently_spoke_agent_ids)
    next.close_condition.message_threshold = resolved.template.director.closing_policy.message_threshold
    next.close_condition.objective_refs = [resolved.template.director.scene_goal.viewer_goal]
    next.close_condition.ttl_at = nextExpiresAt
    next.aftershow = syncAftershowState(
      next.aftershow,
      resolved.template.director.closing_policy.aftershow_mode,
    )
    next.expires_at = nextExpiresAt

    const currentComparable = JSON.stringify({
      scene_template_id: current.scene_template_id,
      scene_template_version: current.scene_template_version,
      scene_binding_id: current.scene_binding_id,
      source: current.audit.source ?? null,
      cast: current.cast,
      dynamics: current.dynamics,
      close_condition: current.close_condition,
      expires_at: current.expires_at,
    })
    const nextComparable = JSON.stringify({
      scene_template_id: next.scene_template_id,
      scene_template_version: next.scene_template_version,
      scene_binding_id: next.scene_binding_id,
      source: next.audit.source,
      cast: next.cast,
      dynamics: next.dynamics,
      close_condition: next.close_condition,
      expires_at: next.expires_at,
    })

    if (currentComparable === nextComparable) {
      return current
    }

    next.updated_at = nowIso()
    next.audit.state_version = current.audit.state_version + 1
    return runtimeSceneStateV1Schema.parse(next)
  }

  private evaluateAutomaticClose(state: RuntimeSceneStateV1, now: Date): void {
    const ttlAt = state.close_condition.ttl_at ? new Date(state.close_condition.ttl_at) : null
    if (ttlAt && ttlAt.getTime() <= now.getTime()) {
      this.closeState(state, 'ttl', now)
      return
    }
    if (
      state.close_condition.message_threshold
      && state.dynamics.message_count >= state.close_condition.message_threshold
    ) {
      this.closeState(state, 'threshold', now)
      return
    }
    if (state.dynamics.fatigue_score >= 1 || state.dynamics.repetition_score >= 0.92) {
      this.closeState(state, 'fatigue_stop', now)
    }
  }

  private closeState(
    state: RuntimeSceneStateV1,
    reason: NonNullable<RuntimeSceneStateV1['close_condition']['reason']>,
    now: Date,
  ): void {
    const nowIsoValue = now.toISOString()
    const aftershowMode = state.aftershow.mode
    state.phase = 'closure'
    state.status = aftershowMode === 'off' ? 'cooldown' : 'closed'
    state.close_condition.reason = reason
    state.close_condition.satisfied = true
    state.close_condition.evaluated_at = nowIsoValue
    state.aftershow.status = aftershowMode === 'off'
      ? 'not_applicable'
      : aftershowMode === 'manual'
        ? 'pending'
        : 'due'
    state.closed_at = nowIsoValue
    state.cooldown_until = aftershowMode === 'off'
      ? new Date(now.getTime() + DEFAULT_CHATROOM_COOLDOWN_MS).toISOString()
      : null
    state.dynamics.phase_entered_at = nowIsoValue
  }

  private emitSignalEvent(
    eventType: string,
    current: {
      room_id: string | null
      community_id: string | null
      episode_id: string
      runtime_scene_id: string
    },
    next: RuntimeSceneStateV1,
    payload: Record<string, unknown>,
  ): void {
    this.deps.eventRepo.create({
      event_type: eventType,
      plane: 'RUNTIME',
      room_id: current.room_id,
      community_id: current.community_id,
      actor_type: 'system',
      correlation_id: `runtime-scene:${current.runtime_scene_id}`,
      idempotency_key: `${eventType}:${current.runtime_scene_id}:${next.audit.state_version}`,
      payload_json: {
        episode_id: current.episode_id,
        runtime_scene_id: current.runtime_scene_id,
        state_version: next.audit.state_version,
        ...payload,
      },
    })
  }

  private emitRuntimeEvent(
    eventType: string,
    room: Pick<Room, 'id' | 'community_id'>,
    episodeId: string,
    payload: Record<string, unknown>,
  ): void {
    this.deps.eventRepo.create({
      event_type: eventType,
      plane: 'RUNTIME',
      room_id: room.id,
      community_id: room.community_id ?? null,
      actor_type: 'system',
      correlation_id: `room:${room.id}:episode:${episodeId}`,
      idempotency_key: `${eventType}:${room.id}:${episodeId}:${payload.runtime_scene_id ?? ''}`,
      payload_json: {
        room_id: room.id,
        episode_id: episodeId,
        ...payload,
      },
    })
  }
}
