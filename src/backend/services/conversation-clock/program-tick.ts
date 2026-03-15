import type { CreateChatMessageInput } from '../../repos/types.js'
import { AMBIENT_MESSAGES } from './constants.js'
import type { ConversationClockContext } from './types.js'

export async function handleProgramTick(
  context: ConversationClockContext,
  roomId: string,
  triggerAgentId: string,
): Promise<void> {
  if (context.roomLocks.has(roomId)) return
  context.roomLocks.add(roomId)

  try {
    const plannedTurn =
      (await context.deps.roomProgramEngine?.planNextTurn({
        roomId,
        triggerAgentId,
        canSpeak: async (agentId) => checkRateLimits(context, roomId, agentId),
      })) ?? null
    if (!plannedTurn) return

    const selectedAgentId = plannedTurn.selected_speaker_agent_id

    context.deps.sseHub.broadcastToRoom(roomId, {
      type: 'AGENT_TYPING',
      payload: { room_id: roomId, agent_id: selectedAgentId },
    })

    try {
      const result = await context.generateMessage(roomId, selectedAgentId)
      const programMessageInput: Pick<
        CreateChatMessageInput,
        'episode_id' | 'beat_id' | 'program_event_id' | 'speaker_role' | 'cue_type'
      > = {
        episode_id: plannedTurn.episode_id,
        beat_id: plannedTurn.beat_id,
        program_event_id: plannedTurn.program_event_id,
        speaker_role: plannedTurn.speaker_role,
        cue_type: plannedTurn.cue_type,
      }

      if (result.kind === 'normal') {
        await context.postMessage(
          roomId,
          selectedAgentId,
          result.body,
          'normal',
          result.renderDecision,
          programMessageInput,
        )
        await context.deps.roomProgramEngine?.markProgramEvent(
          plannedTurn.program_event_id,
          'EXECUTED',
          null,
          {
            body: result.body,
            local_intent_id: plannedTurn.local_intent_id,
          },
        )
        await context.recordGeneratedMessageRun({
          roomId,
          agentId: selectedAgentId,
          body: result.body,
          kind: 'normal',
          usage: result.usage,
          latencyMs: result.latency_ms,
          observation: result.observation,
        })
        return
      }

      if (result.kind === 'skip_feedback' && result.body) {
        await context.postMessage(
          roomId,
          selectedAgentId,
          result.body,
          'skip_feedback',
          result.renderDecision,
          programMessageInput,
        )
        await context.deps.roomProgramEngine?.markProgramEvent(
          plannedTurn.program_event_id,
          'EXECUTED',
          null,
          {
            body: result.body,
            local_intent_id: plannedTurn.local_intent_id,
          },
        )
        await context.recordGeneratedMessageRun({
          roomId,
          agentId: selectedAgentId,
          body: result.body,
          kind: 'skip_feedback',
          usage: result.usage,
          latencyMs: result.latency_ms,
          observation: result.observation,
        })
        return
      }

      if (result.kind === 'empty') {
        await context.deps.roomProgramEngine?.markProgramEvent(
          plannedTurn.program_event_id,
          'SKIPPED',
          'empty_response',
        )
        return
      }

      const ambient = AMBIENT_MESSAGES[Math.floor(Math.random() * AMBIENT_MESSAGES.length)]
      await context.postMessage(
        roomId,
        selectedAgentId,
        ambient,
        'ambient',
        result.renderDecision,
        programMessageInput,
      )
      await context.deps.roomProgramEngine?.markProgramEvent(
        plannedTurn.program_event_id,
        'EXECUTED',
        null,
        {
          body: ambient,
          local_intent_id: plannedTurn.local_intent_id,
        },
      )
    } catch (error) {
      await context.deps.roomProgramEngine?.markProgramEvent(
        plannedTurn.program_event_id,
        'FAILED',
        error instanceof Error ? error.message : 'program_tick_failed',
      )
      throw error
    } finally {
      context.deps.sseHub.broadcastToRoom(roomId, {
        type: 'AGENT_STOP_TYPING',
        payload: { room_id: roomId, agent_id: selectedAgentId },
      })
    }
  } finally {
    context.roomLocks.delete(roomId)
  }
}

async function checkRateLimits(
  context: ConversationClockContext,
  roomId: string,
  agentId: string,
): Promise<boolean> {
  const agentRoom = await context.deps.messageRepo.countByAuthorInRoomThisHour(roomId, agentId)
  if (agentRoom >= 6) return false

  const agentGlobal = await context.deps.messageRepo.countByAuthorGlobalThisHour(agentId)
  if (agentGlobal >= 15) return false

  const roomTotal = await context.deps.messageRepo.countByRoomThisHour(roomId)
  if (roomTotal >= 40) return false

  return true
}
