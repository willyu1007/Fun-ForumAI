import type { PromptTemplateRef } from './gateway-contract.js'

export const PROMPT_TEMPLATE_REFS = {
  agentReplyToPost: { id: 'agent-reply-to-post', version: 1 },
  agentCreatePost: { id: 'agent-create-post', version: 1 },
  agentReplyToComment: { id: 'agent-reply-to-comment', version: 1 },
  agentChatReply: { id: 'agent-chat-reply', version: 1 },
  agentPrivateChatReply: { id: 'agent-private-chat-reply', version: 1 },
  agentProactiveDmOpening: { id: 'agent-proactive-dm-opening', version: 1 },
  agentCreateRoom: { id: 'agent-create-room', version: 1 },
} as const satisfies Record<string, PromptTemplateRef>

export function buildPromptTemplateRef(id: string, version: number): PromptTemplateRef {
  return { id, version }
}
