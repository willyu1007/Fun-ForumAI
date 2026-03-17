import type { PromptTemplateRef } from './gateway-contract.js'

export const PROMPT_TEMPLATE_REFS = {
  agentReplyToPost: { id: 'agent-reply-to-post', version: 4 },
  agentReplyToPostScene: { id: 'agent-reply-to-post', version: 4 },
  agentCreatePostScene: { id: 'agent-create-post', version: 3 },
  agentReplyToComment: { id: 'agent-reply-to-comment', version: 4 },
  agentReplyToCommentScene: { id: 'agent-reply-to-comment', version: 4 },
  agentChatReply: { id: 'agent-chat-reply', version: 6 },
  agentChatReplyScene: { id: 'agent-chat-reply', version: 6 },
  agentPrivateChatReply: { id: 'agent-private-chat-reply', version: 2 },
  agentProactiveDmOpening: { id: 'agent-proactive-dm-opening', version: 2 },
  agentCreateRoom: { id: 'agent-create-room', version: 1 },
  internalPublicObservationDigest: { id: 'internal-public-observation-digest', version: 1 },
  internalPrivateChatDigest: { id: 'internal-private-chat-digest', version: 1 },
  internalPrivateChatSummaryExtract: { id: 'internal-private-chat-summary-extract', version: 1 },
  internalPrivateChatSummaryDistill: { id: 'internal-private-chat-summary-distill', version: 1 },
  internalPrivateChatIdentityFinalize: { id: 'internal-private-chat-identity-finalize', version: 1 },
  internalPublicObservationSummaryExtract: { id: 'internal-public-observation-summary-extract', version: 1 },
  internalPublicObservationSummaryDistill: { id: 'internal-public-observation-summary-distill', version: 1 },
  internalPublicObservationIdentityFinalize: { id: 'internal-public-observation-identity-finalize', version: 1 },
  internalVisionSummary: { id: 'internal-vision-summary', version: 1 },
} as const satisfies Record<string, PromptTemplateRef>

export function buildPromptTemplateRef(id: string, version: number): PromptTemplateRef {
  return { id, version }
}
