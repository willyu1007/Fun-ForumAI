import { sanitizeChatOutput } from '../../runtime/chat-output-sanitizer.js'
import { resolveAgentIdentity } from '../../identity/agent-identity.js'
import type {
  Agent,
  AgentConfig,
  ChatroomRuntimeContextResult,
  ResolvedClockIdentity,
} from './types.js'

export function hasMeaningfulText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function summarizeRecentRoomContext(recentText: string): string {
  const collapsed = recentText
    .split('\n')
    .map((line) => line.replace(/^发言人=/u, '').trim())
    .filter(Boolean)
    .slice(-2)
    .join(' | ')
  if (!collapsed) return '先接住当前公开对话，再补一层有效信息。'
  return collapsed.length <= 140 ? collapsed : `${collapsed.slice(0, 137)}...`
}

export function buildFallbackChatroomLocalIntentBlock(input: {
  roomName: string
  roomDescription: string
  recentText: string
}): string {
  const sceneGoal =
    input.roomDescription.trim().length > 0
      ? input.roomDescription.trim()
      : `延续「${input.roomName}」当前公开对话。`
  return [
    '## Local Intent',
    `- episode_id: fallback:${input.roomName}`,
    '- initiative: reply',
    '- tone_hint: neutral',
    '- relation_focus: none',
    '- privacy_mode: public_only',
    '- memory_scope: public_contextual',
    '- reference_scope: room_window',
    '- target_ref: none',
    `- scene_goal: ${sceneGoal}`,
    '- phase: opening',
    '### Hard Constraints',
    '- 只依据当前房间公开上下文接话',
    '- 不要泄露隐藏导演目标或私域信息',
    '### Soft Constraints',
    `- 优先承接最近现场：${summarizeRecentRoomContext(input.recentText)}`,
  ].join('\n')
}

export function resolveIdentity(
  agent: Agent,
  latestConfig: AgentConfig | null,
): ResolvedClockIdentity {
  try {
    const resolved = resolveAgentIdentity(agent, latestConfig)
    return {
      visiblePersona: resolved.visiblePersona,
      homeVoiceLineId: resolved.summary.home_voice_line_id,
      observationIdentity: {
        persona_seed_code: resolved.summary.persona_seed_code,
        home_voice_line_id: resolved.summary.home_voice_line_id,
      },
    }
  } catch {
    return {
      visiblePersona: {
        name: agent.display_name,
        style: '友善而富有洞察力',
        interests: ['多元话题'],
        language: '中文',
      },
      homeVoiceLineId: 'qwen-social-v1',
      observationIdentity: null,
    }
  }
}

export function extractTopicHints(roomName: string, messageBodies: string[]): string[] {
  const text = `${roomName} ${messageBodies.join(' ')}`
  return text
    .split(/[\s,，、；;：:。.!！?？]+/)
    .filter((w) => w.length >= 2)
    .slice(0, 10)
}

export function buildTopicHintBodies(
  recentMessages: Array<{ body: string }>,
  runtimeChatContext: ChatroomRuntimeContextResult | null,
): string[] {
  const bodies = recentMessages
    .map((message) => sanitizePromptText(message.body))
    .filter((body): body is string => Boolean(body))
  const liveHook = sanitizePromptText(runtimeChatContext?.chatContext.program?.live_hook)
  const unresolvedQuestion = sanitizePromptText(
    runtimeChatContext?.chatContext.program?.unresolved_question,
  )
  if (liveHook) bodies.push(liveHook)
  if (unresolvedQuestion) bodies.push(unresolvedQuestion)
  return bodies
}

export function buildChatConversationText(
  recentMessages: Array<{ body: string }>,
  runtimeChatContext: ChatroomRuntimeContextResult | null,
): string {
  const bodies = recentMessages
    .map((message) => sanitizePromptText(message.body))
    .filter((body): body is string => Boolean(body))
  const liveHook = sanitizePromptText(runtimeChatContext?.chatContext.program?.live_hook)
  const unresolvedQuestion = sanitizePromptText(
    runtimeChatContext?.chatContext.program?.unresolved_question,
  )
  if (liveHook) {
    bodies.push(`当前看点：${liveHook}`)
  }
  if (unresolvedQuestion) {
    bodies.push(`当前悬念：${unresolvedQuestion}`)
  }
  return bodies.join(' ')
}

export function buildChatSceneRule(
  roomName: string,
  runtimeChatContext: ChatroomRuntimeContextResult | null,
): string {
  const program = runtimeChatContext?.chatContext.program
  if (!program) {
    return `聊天室：${roomName}｜live 接话先给判断，再补一层｜默认 1-3 行短句｜不用敬语或寒暄`
  }
  return [
    `聊天室：${roomName}`,
    `节目=${program.scene_type}`,
    `角色=${program.self_role ?? 'UNASSIGNED'}`,
    `episode=${program.episode_id}`,
    'live 接话先给判断，再补一层',
    '默认 1-3 行短句',
    '不用敬语或寒暄',
  ].join('｜')
}

export function buildChatShortTermState(
  roomId: string,
  recentMessageCount: number,
  runtimeChatContext: ChatroomRuntimeContextResult | null,
): string {
  const program = runtimeChatContext?.chatContext.program
  if (!program) {
    return `room:${roomId}|messages:${recentMessageCount}`
  }
  return [
    `room:${roomId}`,
    `messages:${recentMessageCount}`,
    `scene:${program.scene_type}`,
    `role:${program.self_role ?? 'UNASSIGNED'}`,
    `episode:${program.episode_id}`,
    `hook:${sanitizePromptText(program.live_hook) ?? ''}`,
    `question:${sanitizePromptText(program.unresolved_question) ?? ''}`,
  ].join('|')
}

export function sanitizePromptText(text: string | null | undefined): string | null {
  if (!text) return null
  const sanitized = sanitizeChatOutput(text)
  if (!sanitized.text || sanitized.looks_meta) return null
  return sanitized.text
}
