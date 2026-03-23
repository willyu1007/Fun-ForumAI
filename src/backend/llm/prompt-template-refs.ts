import type { PromptTemplateRef } from './gateway-contract.js'

export const PROMPT_TEMPLATE_REFS = {
  agentReplyToPost: { id: 'agent-reply-to-post', version: 4 },
  agentReplyToPostScene: { id: 'agent-reply-to-post', version: 4 },
  agentCreatePostScene: { id: 'agent-create-post', version: 4 },
  agentReplyToThreadTurn: { id: 'agent-reply-to-thread-turn', version: 4 },
  agentReplyToThreadTurnScene: { id: 'agent-reply-to-thread-turn', version: 4 },
  agentChatReply: { id: 'agent-chat-reply', version: 6 },
  agentChatReplyScene: { id: 'agent-chat-reply', version: 6 },
  agentPrivateChatReply: { id: 'agent-private-chat-reply', version: 2 },
  agentProactiveDmOpening: { id: 'agent-proactive-dm-opening', version: 2 },
  agentCreateRoom: { id: 'agent-create-room', version: 1 },
  internalPublicObservationDigest: { id: 'internal-public-observation-digest', version: 1 },
  internalPrivateChatSummaryExtract: { id: 'internal-private-chat-summary-extract', version: 1 },
  internalPrivateChatSummaryDistill: { id: 'internal-private-chat-summary-distill', version: 1 },
  internalPrivateChatIdentityFinalize: { id: 'internal-private-chat-identity-finalize', version: 1 },
  internalPublicObservationSummaryExtract: { id: 'internal-public-observation-summary-extract', version: 1 },
  internalPublicObservationSummaryDistill: { id: 'internal-public-observation-summary-distill', version: 1 },
  internalPublicObservationIdentityFinalize: { id: 'internal-public-observation-identity-finalize', version: 1 },
  internalVisionSummary: { id: 'internal-vision-summary', version: 3 },
} as const satisfies Record<string, PromptTemplateRef>

const CURRENT_VISIBLE_PROMPT_REFS_BY_TEMPLATE_ID: Readonly<Record<string, PromptTemplateRef>> = {
  'agent-reply-to-post': PROMPT_TEMPLATE_REFS.agentReplyToPostScene,
  'agent-create-post': PROMPT_TEMPLATE_REFS.agentCreatePostScene,
  'agent-reply-to-thread-turn': PROMPT_TEMPLATE_REFS.agentReplyToThreadTurnScene,
  'agent-chat-reply': PROMPT_TEMPLATE_REFS.agentChatReplyScene,
  'agent-private-chat-reply': PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
  'agent-proactive-dm-opening': PROMPT_TEMPLATE_REFS.agentProactiveDmOpening,
}

export function buildPromptTemplateRef(id: string, version: number): PromptTemplateRef {
  return { id, version }
}

export function resolveCurrentVisiblePromptRef(templateId: string): PromptTemplateRef | null {
  const promptRef = CURRENT_VISIBLE_PROMPT_REFS_BY_TEMPLATE_ID[templateId]
  if (!promptRef) return null
  return { ...promptRef }
}
