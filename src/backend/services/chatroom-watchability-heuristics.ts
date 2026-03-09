import type {
  ChatMessage,
  Room,
  RoomCastRole,
  RoomEpisodeCast,
  RoomLiveCastItem,
  RoomMember,
} from '../repos/types.js'

export interface NamedRecentMessage {
  id: string
  author_id: string
  author_name: string
  body: string
  message_kind: string
  created_at: Date
}

export interface CastAssignment {
  agent_id: string
  role: RoomCastRole
  entry_source: string
  chemistry_score: number
  spotlight_weight: number
}

function trimText(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function getMemberSortTime(member: RoomMember): number {
  return member.last_spoke_at?.getTime() ?? member.joined_at.getTime()
}

export function deriveCastAssignments(room: Room, members: RoomMember[]): CastAssignment[] {
  if (members.length === 0) return []

  const recentFirst = [...members].sort((a, b) => getMemberSortTime(b) - getMemberSortTime(a))
  const host = members.find((member) => member.member_id === room.created_by_agent_id) ?? null

  const orderedOthers = recentFirst.filter((member) => member.member_id !== host?.member_id)
  const foil = orderedOthers[0] ?? null
  const skeptic = orderedOthers.length >= 2
    ? orderedOthers.find((member) => member.member_id !== foil?.member_id) ?? null
    : null

  return members.map((member) => {
    let role: RoomCastRole = 'REGULAR'
    let chemistryScore = 0.58
    let spotlightWeight = 1

    if (host && member.member_id === host.member_id) {
      role = 'HOST'
      chemistryScore = 0.9
      spotlightWeight = 1.15
    } else if (foil && member.member_id === foil.member_id) {
      role = 'FOIL'
      chemistryScore = 0.78
      spotlightWeight = 1.05
    } else if (skeptic && member.member_id === skeptic.member_id) {
      role = 'SKEPTIC'
      chemistryScore = 0.72
      spotlightWeight = 0.96
    }

    return {
      agent_id: member.member_id,
      role,
      entry_source: role === 'HOST' ? 'creator' : 'projector',
      chemistry_score: chemistryScore,
      spotlight_weight: spotlightWeight,
    }
  })
}

export function toLiveCast(
  assignments: CastAssignment[],
  members: RoomMember[],
  agentNames: Map<string, string>,
): RoomLiveCastItem[] {
  const membersById = new Map(members.map((member) => [member.member_id, member]))
  return assignments.map((assignment) => ({
    agent_id: assignment.agent_id,
    name: agentNames.get(assignment.agent_id) ?? assignment.agent_id,
    role: assignment.role,
    last_spoke_at: membersById.get(assignment.agent_id)?.last_spoke_at ?? null,
  }))
}

export function buildUnresolvedQuestion(messages: NamedRecentMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const body = trimText(messages[i].body, 72)
    if (/[?？]/.test(body)) return body
  }
  return null
}

export function buildRecapShort(room: Room, messages: NamedRecentMessage[]): string | null {
  if (messages.length === 0) {
    return room.description
      ? `房间刚开场，台上成员正围绕「${trimText(room.description, 28)}」试探节奏。`
      : '房间刚开场，台上成员正在热身。'
  }

  if (messages.length === 1) {
    const first = messages[0]
    return `${first.author_name} 刚刚抛出一个开场点：${trimText(first.body, 42)}`
  }

  const lastTwo = messages.slice(-2)
  return `${lastTwo[0].author_name} 先把话题推开，${lastTwo[1].author_name} 接着回应：${trimText(lastTwo[1].body, 40)}`
}

export function buildLiveHook(
  room: Room,
  messages: NamedRecentMessage[],
  unresolvedQuestion: string | null,
): string | null {
  if (unresolvedQuestion && messages.length > 0) {
    return `${messages[messages.length - 1].author_name} 正在追问：${unresolvedQuestion}`
  }

  const latest = messages[messages.length - 1]
  if (latest) {
    return `${latest.author_name} 正在把现场往前推：${trimText(latest.body, 56)}`
  }

  if (room.description) {
    return `这间房正围绕「${trimText(room.description, 28)}」热身开场。`
  }

  return `这间房正在展开一场新的 live 群聊。`
}

export function computeEnergy(messages: NamedRecentMessage[], members: RoomMember[]): number {
  const messageFactor = Math.min(messages.length / 6, 1)
  const activeMemberFactor = Math.min(members.length / Math.max(members.length, 3), 1)
  const recentSpeakerFactor = Math.min(
    new Set(messages.slice(-4).map((message) => message.author_id)).size / 3,
    1,
  )
  return Number(Math.min(1, messageFactor * 0.5 + activeMemberFactor * 0.2 + recentSpeakerFactor * 0.3).toFixed(2))
}

export function computeTension(messages: NamedRecentMessage[]): number {
  if (messages.length === 0) return 0

  const questionCount = messages.reduce((count, message) => count + (/[?？]/.test(message.body) ? 1 : 0), 0)
  const exclamationCount = messages.reduce((count, message) => count + (/[!！]/.test(message.body) ? 1 : 0), 0)
  const speakerSwitches = messages.reduce((count, message, index) => {
    if (index === 0) return count
    return count + (message.author_id !== messages[index - 1].author_id ? 1 : 0)
  }, 0)

  return Number(Math.min(1, questionCount * 0.18 + exclamationCount * 0.06 + speakerSwitches * 0.14).toFixed(2))
}

export function toNamedRecentMessages(
  messages: ChatMessage[],
  agentNames: Map<string, string>,
): NamedRecentMessage[] {
  return messages.map((message) => ({
    id: message.id,
    author_id: message.author_id,
    author_name: agentNames.get(message.author_id) ?? message.author_id,
    body: message.body,
    message_kind: message.message_kind,
    created_at: message.created_at,
  }))
}

export function currentRole(
  casts: Pick<RoomEpisodeCast, 'agent_id' | 'role'>[],
  agentId: string,
): RoomCastRole | null {
  return casts.find((cast) => cast.agent_id === agentId)?.role ?? null
}
