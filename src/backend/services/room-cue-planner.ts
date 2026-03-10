import type {
  RoomBeatType,
  RoomCallbackCandidate,
  RoomCastRole,
  RoomCueType,
} from '../repos/types.js'
import type { LoadedRoomProgramState } from './room-program-state-loader.js'

function trimText(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function findLatestUnansweredQuestion(messages: LoadedRoomProgramState['recentMessages']) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!/[?？]/.test(message.body)) continue

    const answered = messages.slice(index + 1).some((candidate) =>
      candidate.author_id !== message.author_id
      && !/[?？]/.test(candidate.body)
      && candidate.body.trim().length > 6)

    if (!answered) return message
  }
  return null
}

function selectCallbackCandidate(
  callbackBank: RoomCallbackCandidate[],
  recentMessages: LoadedRoomProgramState['recentMessages'],
): RoomCallbackCandidate | null {
  const recentMessageIds = new Set(recentMessages.slice(-2).map((message) => message.id))
  const ordered = [...callbackBank].sort((a, b) => b.weight - a.weight)
  return ordered.find((candidate) => !recentMessageIds.has(candidate.message_id)) ?? null
}

function buildBeatType(cueType: RoomCueType, turnCount: number): RoomBeatType {
  switch (cueType) {
    case 'ASK':
      return turnCount <= 1 ? 'HOOK' : 'EXPLAIN'
    case 'CALLBACK':
      return 'CALLBACK'
    case 'SUMMARIZE':
      return 'RECAP'
    case 'COOL_DOWN':
      return 'COOL_DOWN'
    case 'CLOSE':
      return 'LANDING'
    case 'ADVANCE':
    default:
      return turnCount === 0 ? 'OPENING' : 'HOOK'
  }
}

function defaultTargetRole(cueType: RoomCueType): RoomCastRole | null {
  switch (cueType) {
    case 'ASK':
      return 'SKEPTIC'
    case 'CALLBACK':
      return 'FOIL'
    case 'SUMMARIZE':
      return 'CHRONICLER'
    case 'COOL_DOWN':
      return 'EXPLAINER'
    case 'CLOSE':
      return 'HOST'
    case 'ADVANCE':
    default:
      return 'HOST'
  }
}

export interface PlannedRoomCue {
  cue_type: RoomCueType
  beat_type: RoomBeatType
  director_goal: string
  prompt_hint: string | null
  target_role: RoomCastRole | null
  anchor_message_id: string | null
  callback_message_id: string | null
  audit_json: Record<string, unknown>
}

export class RoomCuePlanner {
  plan(state: LoadedRoomProgramState, triggerAgentId: string): PlannedRoomCue | null {
    if (!state.program.enabled || !state.episode) return null

    const now = Date.now()
    const idleMs = state.lastMessage
      ? now - state.lastMessage.created_at.getTime()
      : state.program.idle_cue_after_ms + 1
    const unanswered = findLatestUnansweredQuestion(state.recentMessages)
    const callbackCandidate = selectCallbackCandidate(
      state.episode.callback_bank_json,
      state.recentMessages,
    )
    const turnCount = state.episode.turn_count
    const energy = state.snapshot?.energy ?? state.episode.energy
    const tension = state.snapshot?.tension ?? state.episode.tension

    if (idleMs > state.program.idle_cue_after_ms) {
      const cueType: RoomCueType = unanswered ? 'ASK' : 'ADVANCE'
      return this.buildPlan({
        cueType,
        turnCount,
        targetRole: unanswered ? 'SKEPTIC' : 'HOST',
        directorGoal: unanswered
          ? `把这句悬念接住并继续追问：${trimText(unanswered.body, 48)}`
          : `现场有点安静了，给「${state.room.name}」抛出下一拍。`,
        promptHint: unanswered
          ? `接住 ${unanswered.author_id} 刚才的问题，不要重复原句。`
          : '用一句能把节奏重新推起来的话继续往前。',
        anchorMessageId: unanswered?.id ?? state.lastMessage?.id ?? null,
        callbackMessageId: null,
        auditJson: {
          trigger: 'idle_gate',
          idle_ms: idleMs,
          trigger_agent_id: triggerAgentId,
        },
      })
    }

    if (unanswered) {
      return this.buildPlan({
        cueType: 'ASK',
        turnCount,
        targetRole: 'SKEPTIC',
        directorGoal: `有人抛出问题还没被接住：${trimText(unanswered.body, 48)}`,
        promptHint: '不要复述问题，直接补一个更有推进感的追问或回应。',
        anchorMessageId: unanswered.id,
        callbackMessageId: null,
        auditJson: {
          trigger: 'unresolved_question',
          unresolved_message_id: unanswered.id,
          trigger_agent_id: triggerAgentId,
        },
      })
    }

    if (callbackCandidate) {
      return this.buildPlan({
        cueType: 'CALLBACK',
        turnCount,
        targetRole: 'FOIL',
        directorGoal: `把前面的包袱重新抛回来：${trimText(callbackCandidate.summary_text, 48)}`,
        promptHint: '这是 callback，不要生硬解释，要像自然回收之前的梗。',
        anchorMessageId: state.lastMessage?.id ?? null,
        callbackMessageId: callbackCandidate.message_id,
        auditJson: {
          trigger: 'callback_bank',
          callback_message_id: callbackCandidate.message_id,
          callback_weight: callbackCandidate.weight,
          trigger_agent_id: triggerAgentId,
        },
      })
    }

    if (tension >= 0.78) {
      return this.buildPlan({
        cueType: 'COOL_DOWN',
        turnCount,
        targetRole: 'EXPLAINER',
        directorGoal: '张力有点过高，用一句轻一点的话把现场缓下来。',
        promptHint: '可以转成解释、调侃或承接，但不要继续拱火。',
        anchorMessageId: state.lastMessage?.id ?? null,
        callbackMessageId: null,
        auditJson: {
          trigger: 'tension_high',
          tension,
          trigger_agent_id: triggerAgentId,
        },
      })
    }

    if (turnCount > 0 && turnCount % state.program.recap_every_turns === 0) {
      return this.buildPlan({
        cueType: 'SUMMARIZE',
        turnCount,
        targetRole: 'CHRONICLER',
        directorGoal: '用一句短 recap 把观众刚才错过的东西补上。',
        promptHint: '总结，不要扩写；像主持人口播一样简洁。',
        anchorMessageId: state.lastMessage?.id ?? null,
        callbackMessageId: null,
        auditJson: {
          trigger: 'recap_turn',
          turn_count: turnCount,
          trigger_agent_id: triggerAgentId,
        },
      })
    }

    if (
      !state.episode.unresolved_question
      && energy <= 0.28
      && turnCount >= 4
      && idleMs > Math.floor(state.program.idle_cue_after_ms * 0.6)
    ) {
      return this.buildPlan({
        cueType: 'CLOSE',
        turnCount,
        targetRole: 'HOST',
        directorGoal: '这一段可以先收束一下，给观众一个落点。',
        promptHint: '像把这一小段聊完，不要宣布房间结束。',
        anchorMessageId: state.lastMessage?.id ?? null,
        callbackMessageId: null,
        auditJson: {
          trigger: 'close_signal',
          energy,
          idle_ms: idleMs,
          trigger_agent_id: triggerAgentId,
        },
      })
    }

    if (turnCount === 0 || turnCount % 3 === 0) {
      return this.buildPlan({
        cueType: 'ADVANCE',
        turnCount,
        targetRole: state.latestBeat ? 'REGULAR' : 'HOST',
        directorGoal: state.latestBeat
          ? '给现场补一个新的推进点，不要只附和上一句。'
          : `把「${state.room.name}」这场房间先开起来。`,
        promptHint: '保持轻推进，给别人留接话口。',
        anchorMessageId: state.lastMessage?.id ?? null,
        callbackMessageId: null,
        auditJson: {
          trigger: turnCount === 0 ? 'opening' : 'steady_advance',
          turn_count: turnCount,
          trigger_agent_id: triggerAgentId,
        },
      })
    }

    return null
  }

  private buildPlan(input: {
    cueType: RoomCueType
    turnCount: number
    directorGoal: string
    promptHint: string | null
    targetRole: RoomCastRole | null
    anchorMessageId: string | null
    callbackMessageId: string | null
    auditJson: Record<string, unknown>
  }): PlannedRoomCue {
    return {
      cue_type: input.cueType,
      beat_type: buildBeatType(input.cueType, input.turnCount),
      director_goal: input.directorGoal,
      prompt_hint: input.promptHint,
      target_role: input.targetRole ?? defaultTargetRole(input.cueType),
      anchor_message_id: input.anchorMessageId,
      callback_message_id: input.callbackMessageId,
      audit_json: input.auditJson,
    }
  }
}
