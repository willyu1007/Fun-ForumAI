import type { AgentRepository } from '../repos/agent-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type { ChatMessage, RoomCastMemberView, RoomHighlightKind } from '../repos/types.js'
import type { SseHub } from '../sse/hub.js'
import { config } from '../lib/config.js'
import type { RoomProjectionResult, RoomProjector } from './room-projector.js'
import type { ChatroomCanonizationService } from './chatroom-canonization-service.js'
import type { RuntimeSceneStateManager } from './runtime-scene-state-manager.js'
import { stripChatroomCompatFields } from './chatroom-local-intent-redaction.js'

function buildCastSignature(cast: RoomCastMemberView[]): string {
  return cast
    .map((entry) => `${entry.agent_id}:${entry.role}:${entry.last_spoke_at?.toISOString() ?? 'none'}`)
    .join('|')
}

function deriveHighlight(message: ChatMessage): { kind: RoomHighlightKind; score: number } | null {
  if (message.cue_type === 'CALLBACK') {
    return { kind: 'CALLBACK', score: 0.92 }
  }
  if (message.cue_type === 'SUMMARIZE') {
    return { kind: 'SUMMARY', score: 0.84 }
  }
  if (message.speaker_role === 'FOIL' && /[!！]/.test(message.body)) {
    return { kind: 'CLASH', score: 0.74 }
  }
  if (message.speaker_role === 'WILDCARD' || message.speaker_role === 'HOST') {
    return { kind: 'CHARACTER_MOMENT', score: 0.66 }
  }
  if (message.body.trim().length >= 42) {
    return { kind: 'PUNCHLINE', score: 0.62 }
  }
  return null
}

function readPayloadString(payload: Record<string, unknown> | null | undefined, key: string): string | null {
  return typeof payload?.[key] === 'string' ? payload[key] : null
}

export interface RoomProgramProjectorDeps {
  roomRepo: RoomRepository
  messageRepo: MessageRepository
  agentRepo: AgentRepository
  watchabilityRepo: RoomWatchabilityRepository
  roomProjector: RoomProjector
  canonizationService?: ChatroomCanonizationService | null
  runtimeSceneStateManager?: RuntimeSceneStateManager | null
  sseHub?: SseHub | null
}

export class RoomProgramProjector {
  constructor(private readonly deps: RoomProgramProjectorDeps) {}

  async onMessageCreated(message: ChatMessage): Promise<void> {
    const room = await this.deps.roomRepo.findById(message.room_id)
    if (!room) return

    const program =
      await this.deps.watchabilityRepo.getProgram(room.id)
      ?? await this.deps.watchabilityRepo.ensureProgram(room)
    const previousCast = await this.deps.watchabilityRepo.getCurrentCast(room.id)
    const previousHighlight = await this.deps.watchabilityRepo.getLatestHighlight(room.id)

    if (program.enabled) {
      await this.recordProgramMessage(message)
    }

    const projection = await this.deps.roomProjector.refreshRoom(room.id)
    if (!projection) return

    this.broadcastProgramProjection(room.id, previousCast, previousHighlight?.id ?? null, projection)
  }

  private async recordProgramMessage(message: ChatMessage): Promise<void> {
    const sourceEvent = message.program_event_id
      ? await this.deps.watchabilityRepo.getProgramEvent(message.program_event_id)
      : null
    const sourcePayload = sourceEvent?.payload_json ?? {}
    const inheritedLocalIntentId = readPayloadString(sourcePayload, 'local_intent_id')
    const rawEventPayload = stripChatroomCompatFields({
      message_id: message.id,
      message_kind: message.message_kind,
      speaker_role: message.speaker_role,
      source_program_event_id: sourceEvent?.id ?? null,
      manual: sourcePayload.manual === true,
      anchor_message_id: readPayloadString(sourcePayload, 'anchor_message_id'),
      callback_message_id: readPayloadString(sourcePayload, 'callback_message_id'),
      local_intent_id: inheritedLocalIntentId,
      local_intent: sourcePayload.local_intent ?? null,
      local_intent_block: sourcePayload.local_intent_block ?? null,
      episode_brief_min: sourcePayload.episode_brief_min ?? null,
      scene_source: sourcePayload.scene_source ?? null,
    })

    const rawEvent = await this.deps.watchabilityRepo.createProgramEvent({
      room_id: message.room_id,
      episode_id: message.episode_id ?? null,
      beat_id: message.beat_id ?? null,
      event_type: 'RAW_MESSAGE',
      status: 'EXECUTED',
      cue_type: message.cue_type ?? sourceEvent?.cue_type ?? null,
      director_goal: sourceEvent?.director_goal ?? null,
      selected_speaker_agent_id: message.author_id,
      idempotency_key: `raw-message:${message.id}`,
      payload_json: rawEventPayload,
      error_text: null,
    })

    const highlight = deriveHighlight(message)
    if (config.features.directorRuntimeStateV1 && message.episode_id) {
      await this.deps.runtimeSceneStateManager?.handleSignal({
        type: 'turn_executed',
        room_id: message.room_id,
        episode_id: message.episode_id,
        cue_type: message.cue_type,
        program_event_id: message.program_event_id ?? rawEvent.id,
        local_intent_id: inheritedLocalIntentId,
        speaker_agent_id: message.author_id,
        body: message.body,
      }).catch(() => null)

      if (/[?？]/.test(message.body)) {
        await this.deps.runtimeSceneStateManager?.handleSignal({
          type: 'loop_opened',
          room_id: message.room_id,
          episode_id: message.episode_id,
          loop_id: `message:${message.id}`,
          summary: message.body,
          source: 'message',
        }).catch(() => null)
      }
    }

    if (
      config.features.directorRuntimeStateV1
      && message.episode_id
      && (message.cue_type === 'CALLBACK' || message.cue_type === 'SUMMARIZE')
    ) {
      const currentState = await this.deps.runtimeSceneStateManager?.findByEpisodeId(message.episode_id) ?? null
      const referencedMessageId =
        readPayloadString(sourcePayload, 'callback_message_id')
        ?? readPayloadString(sourcePayload, 'anchor_message_id')
      const preferredLoopId = referencedMessageId ? `message:${referencedMessageId}` : null
      const resolvedLoopId = currentState?.state_json.continuity.open_loops
        .find((loop) => loop.loop_id === preferredLoopId)?.loop_id
        ?? preferredLoopId
        ?? currentState?.state_json.continuity.open_loops[0]?.loop_id
        ?? null
      if (resolvedLoopId) {
        await this.deps.runtimeSceneStateManager?.handleSignal({
          type: 'loop_resolved',
          room_id: message.room_id,
          episode_id: message.episode_id,
          loop_id: resolvedLoopId,
          summary: message.body,
          resolution_type: message.cue_type === 'CALLBACK' ? 'callback' : 'answered',
        }).catch(() => null)
      }
    }

    if (!highlight || highlight.score < 0.6) return

    const created = await this.deps.watchabilityRepo.createHighlight({
      room_id: message.room_id,
      episode_id: message.episode_id ?? null,
      beat_id: message.beat_id ?? null,
      source_message_id: message.id,
      kind: highlight.kind,
      text: message.body,
      actor_agent_ids: [message.author_id],
      score: highlight.score,
    })
    if (this.deps.canonizationService) {
      void this.deps.canonizationService.considerHighlight(message.room_id, created).catch((error) => {
        console.error('[RoomProgramProjector] canonization trigger failed:', error)
      })
    }
  }

  private broadcastProgramProjection(
    roomId: string,
    previousCast: Array<{ agent_id: string; role: string }>,
    previousHighlightId: string | null,
    projection: RoomProjectionResult,
  ): void {
    const { snapshot, cast } = projection

    this.deps.sseHub?.broadcastToRoom(roomId, {
      type: 'ROOM_LIVE_SNAPSHOT_UPDATED',
      payload: {
        room_id: roomId,
        episode_id: snapshot.episode_id,
        version: snapshot.version,
        snapshot: {
          current_beat: snapshot.current_beat,
          live_hook: snapshot.live_hook,
          unresolved_question: snapshot.unresolved_question,
          energy: snapshot.energy,
          tension: snapshot.tension,
          last_highlight_text: snapshot.last_highlight_text,
        },
      },
    })

    const previousCastSignature = buildCastSignature(previousCast.map((entry) => ({
      agent_id: entry.agent_id,
      name: entry.agent_id,
      role: entry.role as RoomCastMemberView['role'],
      chemistry_score: 0,
      spotlight_weight: 0,
      last_spoke_at: null,
      role_hint: null,
      wander_eligible: true,
      suppressed_until: null,
      member_spotlight_weight: 1,
      projection: null,
    })))
    const nextCastSignature = buildCastSignature(cast)

    if (previousCastSignature !== nextCastSignature) {
      this.deps.sseHub?.broadcastToRoom(roomId, {
        type: 'ROOM_CAST_UPDATED',
        payload: {
          room_id: roomId,
          episode_id: snapshot.episode_id,
          cast,
        },
      })
    }

    void this.deps.watchabilityRepo.getLatestHighlight(roomId).then((latestHighlight) => {
      if (!latestHighlight || latestHighlight.id === previousHighlightId) return
      this.deps.sseHub?.broadcastToRoom(roomId, {
        type: 'ROOM_HIGHLIGHT_CREATED',
        payload: {
          room_id: roomId,
          highlight: {
            id: latestHighlight.id,
            episode_id: latestHighlight.episode_id,
            beat_id: latestHighlight.beat_id,
            source_message_id: latestHighlight.source_message_id,
            kind: latestHighlight.kind,
            text: latestHighlight.text,
            actor_agent_ids: latestHighlight.actor_agent_ids,
            score: latestHighlight.score,
            created_at: latestHighlight.created_at.toISOString(),
          },
        },
      })
      this.deps.sseHub?.broadcastToRoom(roomId, {
        type: 'ROOM_CONTROL_STATE_UPDATED',
        payload: {
          room_id: roomId,
          reason: 'highlight_created',
          emitted_at: new Date().toISOString(),
        },
      })
    }).catch((err) => {
      console.warn(`[RoomProgramProjector] highlight broadcast failed for room=${roomId}:`, err)
    }).catch((error) => {
      console.error('[RoomProgramProjector] highlight broadcast failed:', error)
    })
  }
}
