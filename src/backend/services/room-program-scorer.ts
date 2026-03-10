import type {
  ChatMessage,
  RoomCastMemberView,
  RoomCueType,
  RoomSelectionReason,
} from '../repos/types.js'
import type { PlannedRoomCue } from './room-cue-planner.js'

function roleFitScore(cueType: RoomCueType, role: RoomCastMemberView['role']): number {
  const weights: Record<RoomCueType, Partial<Record<RoomCastMemberView['role'], number>>> = {
    ADVANCE: { HOST: 0.45, REGULAR: 0.36, WILDCARD: 0.3, FOIL: 0.22 },
    ASK: { SKEPTIC: 0.5, HOST: 0.38, FOIL: 0.2, EXPLAINER: 0.18 },
    CALLBACK: { FOIL: 0.46, HOST: 0.28, WILDCARD: 0.24, REGULAR: 0.18 },
    SUMMARIZE: { CHRONICLER: 0.52, EXPLAINER: 0.34, HOST: 0.24 },
    COOL_DOWN: { EXPLAINER: 0.5, HOST: 0.3, CHRONICLER: 0.18 },
    CLOSE: { HOST: 0.44, CHRONICLER: 0.24, REGULAR: 0.18 },
  }
  return weights[cueType][role] ?? 0.08
}

function recentMessageCount(messages: ChatMessage[], agentId: string): number {
  return messages.reduce((count, message) => count + Number(message.author_id === agentId), 0)
}

function recentConsecutiveCount(messages: ChatMessage[], agentId: string): number {
  let count = 0
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].author_id !== agentId) break
    count += 1
  }
  return count
}

function pushReason(reasons: RoomSelectionReason[], code: string, value: number, message: string) {
  if (value === 0) return
  reasons.push({ code, value: Number(value.toFixed(2)), message })
}

export interface ProgramSpeakerScore {
  agent_id: string
  role: RoomCastMemberView['role'] | null
  final_score: number
  reasons_json: RoomSelectionReason[]
}

export class RoomProgramScorer {
  score(input: {
    cast: RoomCastMemberView[]
    recentMessages: ChatMessage[]
    cue: PlannedRoomCue
    maxConsecutiveTurns: number
  }): ProgramSpeakerScore[] {
    const castByAgentId = new Map(input.cast.map((entry) => [entry.agent_id, entry]))
    const candidates = input.cast.length > 0
      ? input.cast
      : []

    return candidates
      .map((candidate) => {
        const reasons: RoomSelectionReason[] = []
        const recentCount = recentMessageCount(input.recentMessages.slice(-6), candidate.agent_id)
        const consecutiveCount = recentConsecutiveCount(input.recentMessages, candidate.agent_id)
        const lastAuthorId = input.recentMessages[input.recentMessages.length - 1]?.author_id ?? null
        const roleFit = roleFitScore(input.cue.cue_type, candidate.role)
        const targetRoleBonus = input.cue.target_role && input.cue.target_role === candidate.role ? 0.25 : 0
        const callbackBonus =
          input.cue.callback_message_id
          && input.recentMessages.find((message) => message.id === input.cue.callback_message_id)?.author_id === candidate.agent_id
            ? 0.34
            : 0
        const chemistryBonus = Number((candidate.chemistry_score * 0.24).toFixed(2))
        const spotlightPenalty = Number((Math.max(candidate.spotlight_weight - 1, 0) * 0.2).toFixed(2))
        const repetitionPenalty = recentCount >= 2 ? Number((recentCount * 0.12).toFixed(2)) : 0
        const lastSpeakerPenalty = lastAuthorId === candidate.agent_id ? 0.28 : 0
        const chaosPenalty = consecutiveCount >= 2 ? Number((consecutiveCount * 0.14).toFixed(2)) : 0
        const maxConsecutivePenalty =
          consecutiveCount >= input.maxConsecutiveTurns
            ? Number(((consecutiveCount - input.maxConsecutiveTurns + 1) * 0.4).toFixed(2))
            : 0

        pushReason(reasons, 'role_fit_bonus', roleFit, `${candidate.role} 更适合这类 cue`)
        pushReason(reasons, 'target_role_bonus', targetRoleBonus, '命中导演想要的站位')
        pushReason(reasons, 'callback_bonus', callbackBonus, '和 callback 素材有直接关联')
        pushReason(reasons, 'chemistry_bonus', chemistryBonus, '当前 cast 化学反应较好')
        pushReason(reasons, 'spotlight_penalty', -spotlightPenalty, '近期 spotlight 已经偏高')
        pushReason(reasons, 'repetition_penalty', -repetitionPenalty, '最近几轮已经说得比较多')
        pushReason(reasons, 'last_speaker_penalty', -lastSpeakerPenalty, '刚说过上一句')
        pushReason(reasons, 'chaos_penalty', -chaosPenalty, '连续抢话会让现场变乱')
        pushReason(reasons, 'max_consecutive_penalty', -maxConsecutivePenalty, '超过连续出场上限')

        const finalScore = Number((
          1
          + roleFit
          + targetRoleBonus
          + callbackBonus
          + chemistryBonus
          - spotlightPenalty
          - repetitionPenalty
          - lastSpeakerPenalty
          - chaosPenalty
          - maxConsecutivePenalty
        ).toFixed(3))

        return {
          agent_id: candidate.agent_id,
          role: castByAgentId.get(candidate.agent_id)?.role ?? null,
          final_score: finalScore,
          reasons_json: reasons,
        } satisfies ProgramSpeakerScore
      })
      .sort((left, right) => right.final_score - left.final_score || left.agent_id.localeCompare(right.agent_id))
  }
}
