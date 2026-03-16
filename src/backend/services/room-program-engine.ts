import { config } from '../lib/config.js'
import type { RoomCastRole } from '../repos/types.js'
import type { SseHub } from '../sse/hub.js'
import { RoomCuePlanner, type PlannedRoomCue } from './room-cue-planner.js'
import { RoomProgramScorer } from './room-program-scorer.js'
import { RoomProgramStateLoader, type LoadedRoomProgramState } from './room-program-state-loader.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type { RuntimeSceneStateManager } from './runtime-scene-state-manager.js'
import type { ChatroomSceneContractResolver } from './chatroom-scene-contract-resolver.js'
import type { ChatroomLocalIntentService } from './chatroom-local-intent-service.js'
import { stripChatroomCompatFields } from './chatroom-local-intent-redaction.js'

export interface PlannedProgramTurn {
  episode_id: string
  selected_speaker_agent_id: string
  speaker_role: RoomCastRole | null
  cue_type: PlannedRoomCue['cue_type']
  beat_type: PlannedRoomCue['beat_type']
  director_goal: string
  beat_id: string
  program_event_id: string
  local_intent_id: string | null
}

export interface RoomProgramEngineDeps {
  stateLoader: RoomProgramStateLoader
  cuePlanner: RoomCuePlanner
  scorer: RoomProgramScorer
  watchabilityRepo: RoomWatchabilityRepository
  runtimeSceneStateManager?: RuntimeSceneStateManager | null
  sceneResolver?: ChatroomSceneContractResolver | null
  localIntentService?: ChatroomLocalIntentService | null
  sseHub?: SseHub | null
}

export class RoomProgramEngine {
  constructor(private readonly deps: RoomProgramEngineDeps) {}

  async planNextTurn(input: {
    roomId: string
    triggerAgentId: string
    canSpeak?: (agentId: string) => Promise<boolean>
  }): Promise<PlannedProgramTurn | null> {
    let state = await this.deps.stateLoader.load(input.roomId)
    if (!state || !state.program.enabled || !state.episode) return null
    const initialEpisode = state.episode

    const runtimeState = config.features.directorRuntimeStateV1
      ? await this.deps.runtimeSceneStateManager?.ensureChatroomState({
          room: state.room,
          program: state.program,
          episode: initialEpisode,
          cast: state.cast,
          members: state.members,
          recentMessages: state.recentMessages,
        })
      : null

    if (runtimeState?.state.status === 'cooldown' || runtimeState?.state.status === 'closed') {
      if (runtimeState.state.status === 'cooldown') {
        const cooldownUntil = runtimeState.state.state_json.cooldown_until
          ? new Date(runtimeState.state.state_json.cooldown_until)
          : null
        if (cooldownUntil && cooldownUntil.getTime() > Date.now()) {
          return null
        }
      }

      const rotated = await this.rotateEpisodeAfterFinalization(state)
      if (!rotated) return null
      state = rotated
    }

    const pendingPlannedTurn = await this.reusePendingPlannedTurn(state, input.canSpeak)
    if (pendingPlannedTurn) {
      return pendingPlannedTurn
    }

    const episode = state.episode
    if (!episode) return null

    const cue = this.deps.cuePlanner.plan(state, input.triggerAgentId)
    if (!cue) return null

    const ensuredRuntime = config.features.directorRuntimeStateV1
      ? await this.deps.runtimeSceneStateManager?.ensureChatroomState({
          room: state.room,
          program: state.program,
          episode,
          cast: state.cast,
          members: state.members,
          recentMessages: state.recentMessages,
        })
      : null
    const activeCastAgentIds = ensuredRuntime?.state.state_json.cast.active_agent_ids ?? []
    const eligibleCast = activeCastAgentIds.length > 0
      ? state.cast.filter((candidate) => activeCastAgentIds.includes(candidate.agent_id))
      : state.cast
    const scoredCandidates = this.deps.scorer.score({
      cast: eligibleCast.length > 0 ? eligibleCast : state.cast,
      recentMessages: state.recentMessages,
      cue,
      scene_type: state.program.scene_type,
      maxConsecutiveTurns: state.program.max_consecutive_turns,
    })
    if (scoredCandidates.length === 0) return null

    let selected = scoredCandidates[0] ?? null
    if (input.canSpeak) {
      for (const candidate of scoredCandidates) {
        if (await input.canSpeak(candidate.agent_id)) {
          selected = candidate
          break
        }
      }
    }
    if (!selected) return null

    const sceneContract = ensuredRuntime?.resolved
      ?? this.deps.sceneResolver?.resolve({
        roomId: state.room.id,
        sceneType: state.program.scene_type,
      })
      ?? null
    const localIntentBundle =
      config.features.directorRuntimeStateV1
      && sceneContract
      && ensuredRuntime
      && this.deps.localIntentService
        ? this.deps.localIntentService.build({
            cue_type: cue.cue_type,
            director_goal: cue.director_goal,
            anchor_message_id: cue.anchor_message_id,
            callback_message_id: cue.callback_message_id,
            runtime_state: ensuredRuntime.state.state_json,
            resolved_scene: sceneContract,
            manual: false,
          })
        : null

    const idempotencyKey = [
      'program-cue',
      state.room.id,
      episode.id,
      String(episode.turn_count),
      state.lastMessage?.id ?? 'no-message',
      cue.cue_type,
      selected.agent_id,
    ].join(':')
    const eventPayload = stripChatroomCompatFields({
      trigger_agent_id: input.triggerAgentId,
      beat_type: cue.beat_type,
      prompt_hint: cue.prompt_hint,
      target_role: cue.target_role,
      active_cast_agent_ids: activeCastAgentIds,
      suppressed_agent_ids: ensuredRuntime?.state.state_json.cast.suppressed_agent_ids ?? [],
      scene_casting_slot_audit: ensuredRuntime?.state.state_json.cast.slot_audit ?? null,
      anchor_message_id: cue.anchor_message_id,
      callback_message_id: cue.callback_message_id,
      local_intent_id: localIntentBundle?.local_intent_id ?? null,
      local_intent: localIntentBundle?.local_intent ?? null,
      local_intent_block: localIntentBundle?.local_intent_block ?? null,
      episode_brief_min: localIntentBundle?.episode_brief_min ?? null,
      scene_source: localIntentBundle?.scene_source ?? null,
      top_candidates: scoredCandidates.slice(0, 4).map((candidate) => ({
        agent_id: candidate.agent_id,
        final_score: candidate.final_score,
      })),
    })

    const plannedCue = await this.deps.watchabilityRepo.planProgramCue({
      room_id: state.room.id,
      episode_id: episode.id,
      ordinal: (state.latestBeat?.ordinal ?? 0) + 1,
      beat_type: cue.beat_type,
      cue_type: cue.cue_type,
      director_goal: cue.director_goal,
      prompt_hint: cue.prompt_hint,
      anchor_message_id: cue.anchor_message_id,
      callback_message_id: cue.callback_message_id,
      target_role: cue.target_role,
      selected_speaker_agent_id: selected.agent_id,
      beat_status: 'selected',
      beat_audit_json: {
        ...cue.audit_json,
        active_cast_agent_ids: activeCastAgentIds,
        suppressed_agent_ids: ensuredRuntime?.state.state_json.cast.suppressed_agent_ids ?? [],
        scene_casting_slot_audit: ensuredRuntime?.state.state_json.cast.slot_audit ?? null,
        selected_agent_id: selected.agent_id,
      },
      event_status: 'PLANNED',
      idempotency_key: idempotencyKey,
      event_payload_json: eventPayload,
      selection_ledger: scoredCandidates.slice(0, 4).map((candidate) => ({
        candidate_agent_id: candidate.agent_id,
        selected: candidate.agent_id === selected.agent_id,
        final_score: candidate.final_score,
        reasons_json: candidate.reasons_json,
      })),
    })

    if (config.features.directorRuntimeStateV1) {
      await this.deps.runtimeSceneStateManager?.handleSignal({
        type: 'turn_planned',
        room_id: state.room.id,
        episode_id: episode.id,
        cue_type: cue.cue_type,
        program_event_id: plannedCue.event.id,
        local_intent_id: localIntentBundle?.local_intent_id ?? null,
      })
    }

    if (plannedCue.created_now) {
      this.deps.sseHub?.broadcastToRoom(state.room.id, {
        type: 'ROOM_BEAT_CHANGED',
        payload: {
          room_id: state.room.id,
          beat: {
            id: plannedCue.beat.id,
            episode_id: plannedCue.beat.episode_id,
            ordinal: plannedCue.beat.ordinal,
            beat_type: plannedCue.beat.beat_type,
            cue_type: plannedCue.beat.cue_type,
            director_goal: plannedCue.beat.director_goal,
            selected_speaker_agent_id: plannedCue.beat.selected_speaker_agent_id,
            target_role: plannedCue.beat.target_role,
            created_at: plannedCue.beat.created_at.toISOString(),
          },
        },
      })
      this.deps.sseHub?.broadcastToRoom(state.room.id, {
        type: 'ROOM_CONTROL_STATE_UPDATED',
        payload: {
          room_id: state.room.id,
          reason: 'program_cue_planned',
          emitted_at: new Date().toISOString(),
        },
      })
    }

    return {
      episode_id: episode.id,
      selected_speaker_agent_id: selected.agent_id,
      speaker_role: selected.role,
      cue_type: cue.cue_type,
      beat_type: cue.beat_type,
      director_goal: cue.director_goal,
      beat_id: plannedCue.beat.id,
      program_event_id: plannedCue.event.id,
      local_intent_id: localIntentBundle?.local_intent_id ?? null,
    }
  }

  private async reusePendingPlannedTurn(
    state: LoadedRoomProgramState,
    canSpeak?: (agentId: string) => Promise<boolean>,
  ): Promise<PlannedProgramTurn | null> {
    if (!state.episode) return null

    const pendingTurn = await this.deps.watchabilityRepo.getNextPlannedProgramTurn(state.room.id)
    if (!pendingTurn) return null
    if (pendingTurn.event.episode_id !== state.episode.id) return null

    const selectedAgentId =
      pendingTurn.event.selected_speaker_agent_id
      ?? pendingTurn.beat.selected_speaker_agent_id
      ?? null
    if (!selectedAgentId) return null

    const isManualCue = pendingTurn.event.payload_json?.manual === true
    if (canSpeak && !isManualCue && !await canSpeak(selectedAgentId)) {
      return null
    }

    const payload = pendingTurn.event.payload_json ?? {}
    const localIntentId = typeof payload.local_intent_id === 'string'
      ? payload.local_intent_id
      : null
    const directorGoal = pendingTurn.event.director_goal
      ?? pendingTurn.beat.director_goal
      ?? ''

    return {
      episode_id: state.episode.id,
      selected_speaker_agent_id: selectedAgentId,
      speaker_role: state.cast.find((candidate) => candidate.agent_id === selectedAgentId)?.role ?? null,
      cue_type: pendingTurn.event.cue_type ?? pendingTurn.beat.cue_type,
      beat_type: pendingTurn.beat.beat_type,
      director_goal: directorGoal,
      beat_id: pendingTurn.beat.id,
      program_event_id: pendingTurn.event.id,
      local_intent_id: localIntentId,
    }
  }

  async markProgramEvent(
    eventId: string,
    status: 'EXECUTED' | 'FAILED' | 'SKIPPED',
    errorText?: string | null,
    _metadata?: {
      body?: string | null
      local_intent_id?: string | null
    },
  ): Promise<void> {
    const updated = await this.deps.watchabilityRepo.updateProgramEvent(eventId, {
      status,
      error_text: errorText ?? null,
    })
    if (!updated) return

    this.deps.sseHub?.broadcastToRoom(updated.room_id, {
      type: 'ROOM_CONTROL_STATE_UPDATED',
      payload: {
        room_id: updated.room_id,
        reason: `program_event_${status.toLowerCase()}`,
        emitted_at: new Date().toISOString(),
      },
    })
  }

  private async rotateEpisodeAfterFinalization(state: LoadedRoomProgramState): Promise<LoadedRoomProgramState | null> {
    await this.deps.watchabilityRepo.endActiveEpisode(state.room.id)
    const nextEpisode = await this.deps.watchabilityRepo.ensureActiveEpisode(state.room.id, state.program.id)
    if (state.cast.length > 0) {
      await this.deps.watchabilityRepo.replaceEpisodeCast(
        state.room.id,
        nextEpisode.id,
        state.cast.map((entry) => ({
          room_id: state.room.id,
          episode_id: nextEpisode.id,
          agent_id: entry.agent_id,
          role: entry.role,
          entry_source: 'runtime_rollover',
          chemistry_score: entry.chemistry_score,
          spotlight_weight: entry.spotlight_weight,
        })),
      )
    }
    return this.deps.stateLoader.load(state.room.id)
  }
}
