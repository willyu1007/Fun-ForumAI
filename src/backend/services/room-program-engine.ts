import type { RoomCastRole } from '../repos/types.js'
import type { SseHub } from '../sse/hub.js'
import { RoomCuePlanner, type PlannedRoomCue } from './room-cue-planner.js'
import { RoomProgramScorer } from './room-program-scorer.js'
import { RoomProgramStateLoader } from './room-program-state-loader.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'

export interface PlannedProgramTurn {
  episode_id: string
  selected_speaker_agent_id: string
  speaker_role: RoomCastRole | null
  cue_type: PlannedRoomCue['cue_type']
  beat_type: PlannedRoomCue['beat_type']
  director_goal: string
  beat_id: string
  program_event_id: string
}

export interface RoomProgramEngineDeps {
  stateLoader: RoomProgramStateLoader
  cuePlanner: RoomCuePlanner
  scorer: RoomProgramScorer
  watchabilityRepo: RoomWatchabilityRepository
  sseHub?: SseHub | null
}

export class RoomProgramEngine {
  constructor(private readonly deps: RoomProgramEngineDeps) {}

  async planNextTurn(input: {
    roomId: string
    triggerAgentId: string
    canSpeak?: (agentId: string) => Promise<boolean>
  }): Promise<PlannedProgramTurn | null> {
    const state = await this.deps.stateLoader.load(input.roomId)
    if (!state || !state.program.enabled || !state.episode) return null

    const pendingPlannedTurn = await this.reusePendingPlannedTurn(state, input.canSpeak)
    if (pendingPlannedTurn) {
      return pendingPlannedTurn
    }

    const cue = this.deps.cuePlanner.plan(state, input.triggerAgentId)
    if (!cue) return null

    const scoredCandidates = this.deps.scorer.score({
      cast: state.cast,
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

    const idempotencyKey = [
      'program-cue',
      state.room.id,
      state.episode.id,
      String(state.episode.turn_count),
      state.lastMessage?.id ?? 'no-message',
      cue.cue_type,
      selected.agent_id,
    ].join(':')
    const plannedCue = await this.deps.watchabilityRepo.planProgramCue({
      room_id: state.room.id,
      episode_id: state.episode.id,
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
        selected_agent_id: selected.agent_id,
      },
      event_status: 'PLANNED',
      idempotency_key: idempotencyKey,
      event_payload_json: {
        trigger_agent_id: input.triggerAgentId,
        beat_type: cue.beat_type,
        prompt_hint: cue.prompt_hint,
        target_role: cue.target_role,
        callback_message_id: cue.callback_message_id,
        top_candidates: scoredCandidates.slice(0, 4).map((candidate) => ({
          agent_id: candidate.agent_id,
          final_score: candidate.final_score,
        })),
      },
      selection_ledger: scoredCandidates.slice(0, 4).map((candidate) => ({
        candidate_agent_id: candidate.agent_id,
        selected: candidate.agent_id === selected.agent_id,
        final_score: candidate.final_score,
        reasons_json: candidate.reasons_json,
      })),
    })

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
      episode_id: state.episode.id,
      selected_speaker_agent_id: selected.agent_id,
      speaker_role: selected.role,
      cue_type: cue.cue_type,
      beat_type: cue.beat_type,
      director_goal: cue.director_goal,
      beat_id: plannedCue.beat.id,
      program_event_id: plannedCue.event.id,
    }
  }

  private async reusePendingPlannedTurn(
    state: Awaited<ReturnType<RoomProgramStateLoader['load']>>,
    canSpeak?: (agentId: string) => Promise<boolean>,
  ): Promise<PlannedProgramTurn | null> {
    if (!state?.episode) return null

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

    return {
      episode_id: state.episode.id,
      selected_speaker_agent_id: selectedAgentId,
      speaker_role: state.cast.find((candidate) => candidate.agent_id === selectedAgentId)?.role ?? null,
      cue_type: pendingTurn.event.cue_type ?? pendingTurn.beat.cue_type,
      beat_type: pendingTurn.beat.beat_type,
      director_goal: pendingTurn.event.director_goal ?? pendingTurn.beat.director_goal,
      beat_id: pendingTurn.beat.id,
      program_event_id: pendingTurn.event.id,
    }
  }

  async markProgramEvent(
    eventId: string,
    status: 'EXECUTED' | 'FAILED' | 'SKIPPED',
    errorText?: string | null,
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
}
