import type { PromptScene } from '../runtime/types.js'
import type {
  LLMGenerationIntent,
  LLMVisibility,
  PromptTemplateRef,
} from './gateway-contract.js'
import type {
  RenderTier,
  VoiceLineId,
  VoiceLineRoutingIntent,
} from '../../shared/agent-persona-catalog.js'

export interface LlmCallsiteInventoryEntry {
  source_id: string
  source_file: string
  scene: PromptScene | 'background_hidden' | 'dev_prompt_render'
  dispatch_calls: Array<
    'llmGateway.generateVisibleText' |
    'llmGateway.generateHiddenArtifact' |
    'llmGateway.generateIdentityWrite' |
    'promptEngine.render'
  >
  evidence_patterns: string[]
  intent: LLMGenerationIntent
  visibility: LLMVisibility
  prompt_ref: PromptTemplateRef
  voice_line_authority: string
  tier_floor: RenderTier | 'identityWriteTier' | 'n/a'
  expected_profile_refs: Partial<Record<VoiceLineId, string>> | null
  legacy_raw_model_use: string | null
  target_gateway_surface: string
  migration_blocker: string
}

export const LLM_DIRECT_CALL_GUARD_COUNTS: Record<
  string,
  Partial<Record<'llmClient.chat' | 'promptEngine.render', number>>
> = {
  'src/backend/llm/llm-gateway.ts': {
    'llmClient.chat': 1,
    'promptEngine.render': 1,
  },
  'src/backend/app.ts': {
    'promptEngine.render': 1,
  },
}

export const LLM_CALLSITE_INVENTORY: LlmCallsiteInventoryEntry[] = [
  {
    source_id: 'agent-executor-forum-post',
    source_file: 'src/backend/runtime/agent-executor.ts',
    scene: 'forum_post',
    dispatch_calls: ['llmGateway.generateVisibleText'],
    evidence_patterns: [
      "case 'NewPostCreated'",
      'PROMPT_TEMPLATE_REFS.agentReplyToPost',
      'this.deps.llmGateway.generateVisibleText({',
      'scene: this.pickScene(event)',
    ],
    intent: 'forum_reply',
    visibility: 'visible',
    prompt_ref: { id: 'agent-reply-to-post', version: 1 },
    voice_line_authority: 'Forum post replies must resolve from the agent home voice line instead of bootstrap config.llm defaults.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-forum-reply-base',
      'glm-deep-v1': 'glm-deep-forum-reply-base',
    },
    legacy_raw_model_use: 'Removed; homeVoiceLineId compatibility now resolves through the identity contract.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'agent-executor-forum-comment',
    source_file: 'src/backend/runtime/agent-executor.ts',
    scene: 'forum_comment',
    dispatch_calls: ['llmGateway.generateVisibleText'],
    evidence_patterns: [
      "case 'NewCommentCreated'",
      'PROMPT_TEMPLATE_REFS.agentReplyToComment',
      'this.deps.llmGateway.generateVisibleText({',
      'scene: this.pickScene(event)',
    ],
    intent: 'forum_reply',
    visibility: 'visible',
    prompt_ref: { id: 'agent-reply-to-comment', version: 1 },
    voice_line_authority: 'Comment replies still resolve through forum_reply intent, but now on top of homeVoiceLineId authority.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-forum-reply-base',
      'glm-deep-v1': 'glm-deep-forum-reply-base',
    },
    legacy_raw_model_use: 'Removed; comment replies no longer use raw llmClient defaults.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'conversation-clock-chat-reply',
    source_file: 'src/backend/services/conversation-clock.ts',
    scene: 'chat_room',
    dispatch_calls: ['llmGateway.generateVisibleText'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.agentChatReply',
      'this.deps.llmGateway.generateVisibleText({',
      "intent: 'chat_reply'",
    ],
    intent: 'chat_reply',
    visibility: 'visible',
    prompt_ref: { id: 'agent-chat-reply', version: 1 },
    voice_line_authority: 'Chat room replies must resolve from homeVoiceLineId and chat_room policy, not bootstrap config.llm.',
    tier_floor: 'lite',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-chat-reply-lite',
      'glm-deep-v1': 'glm-deep-chat-reply-lite',
    },
    legacy_raw_model_use: 'Removed; chat room replies now route through the gateway.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'post-scheduler-create-post',
    source_file: 'src/backend/runtime/post-scheduler.ts',
    scene: 'scheduled_post',
    dispatch_calls: ['llmGateway.generateVisibleText'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.agentCreatePost',
      'this.deps.llmGateway.generateVisibleText({',
      "intent: 'scheduled_post'",
    ],
    intent: 'scheduled_post',
    visibility: 'visible',
    prompt_ref: { id: 'agent-create-post', version: 1 },
    voice_line_authority: 'Scheduled posting now resolves from homeVoiceLineId plus scheduled_post tier policy.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-scheduled-post-base',
      'glm-deep-v1': 'glm-deep-scheduled-post-base',
    },
    legacy_raw_model_use: 'Removed; scheduled posting no longer uses raw llmClient defaults.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'private-channel-reply',
    source_file: 'src/backend/services/private-channel-service.ts',
    scene: 'private_chat',
    dispatch_calls: ['llmGateway.generateVisibleText'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.agentPrivateChatReply',
      'this.deps.llmGateway.generateVisibleText({',
      "intent: 'private_reply'",
    ],
    intent: 'private_reply',
    visibility: 'visible',
    prompt_ref: { id: 'agent-private-chat-reply', version: 1 },
    voice_line_authority: 'Private replies still derive from homeVoiceLineId; raw agent.model compatibility is removed from dispatch.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-private-reply-base',
      'glm-deep-v1': 'glm-deep-private-reply-base',
    },
    legacy_raw_model_use: 'Removed; private chat no longer carries inline model overrides.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'proactive-orchestrated-opening',
    source_file: 'src/backend/services/proactive-interaction-service.ts',
    scene: 'proactive_dm',
    dispatch_calls: ['llmGateway.generateVisibleText'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.agentProactiveDmOpening',
      'this.deps.llmGateway.generateVisibleText({',
      "intent: 'proactive_opening'",
    ],
    intent: 'proactive_opening',
    visibility: 'visible',
    prompt_ref: { id: 'agent-proactive-dm-opening', version: 1 },
    voice_line_authority: 'Proactive openings resolve from homeVoiceLineId and proactive_dm policy before any fallback.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-proactive-opening-base',
      'glm-deep-v1': 'glm-deep-proactive-opening-base',
    },
    legacy_raw_model_use: 'Removed; orchestrated path no longer passes raw agent.model.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'proactive-legacy-opening',
    source_file: 'src/backend/services/proactive-interaction-service.ts',
    scene: 'proactive_dm',
    dispatch_calls: ['llmGateway.generateVisibleText'],
    evidence_patterns: [
      'PromptOrchestrator compose failed, fallback to legacy path',
      'PROMPT_TEMPLATE_REFS.internalProactiveDmOpeningLegacy',
      'this.deps.llmGateway.generateVisibleText({',
    ],
    intent: 'proactive_opening',
    visibility: 'visible',
    prompt_ref: { id: 'internal-proactive-dm-opening-legacy', version: 1 },
    voice_line_authority: 'Legacy proactive fallback still owes the same homeVoiceLineId authority and now uses a registered prompt contract.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-proactive-opening-base',
      'glm-deep-v1': 'glm-deep-proactive-opening-base',
    },
    legacy_raw_model_use: 'Removed; legacy fallback no longer uses inline model overrides.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'public-observation-digest',
    source_file: 'src/backend/services/public-observation-digest-service.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateHiddenArtifact'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalPublicObservationDigest',
      'this.deps.llmGateway.generateHiddenArtifact({',
      "intent: 'public_observation_digest'",
    ],
    intent: 'public_observation_digest',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-public-observation-digest', version: 1 },
    voice_line_authority: 'Public observation digest must stay on the hidden director line and remain detached from visible home voice authority.',
    tier_floor: 'base',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-public-observation-base',
    },
    legacy_raw_model_use: 'Removed; observation digest no longer uses global config.llm bootstrap.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'memory-private-digest',
    source_file: 'src/backend/services/memory-service.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateHiddenArtifact'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalPrivateChatDigest',
      'this.deps.llmGateway.generateHiddenArtifact({',
      "intent: 'private_digest'",
    ],
    intent: 'private_digest',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-private-chat-digest', version: 1 },
    voice_line_authority: 'Private digest stays on the hidden director line; identity-write semantics remain a separate lane.',
    tier_floor: 'identityWriteTier',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-private-digest-premium',
    },
    legacy_raw_model_use: 'Removed; digest summarization no longer uses inline llmClient prompts.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'public-context-summary-extract',
    source_file: 'src/backend/context-memory/runtime.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateHiddenArtifact'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalPublicObservationSummaryExtract',
      'this.deps.llmGateway.generateHiddenArtifact({',
      "traceId: `context-extract:${event.id}`",
    ],
    intent: 'public_observation_digest',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-public-observation-summary-extract', version: 1 },
    voice_line_authority: 'Public context extraction stays on the hidden director line and reuses the public_observation_digest routing family.',
    tier_floor: 'base',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-public-observation-base',
    },
    legacy_raw_model_use: 'Removed; typed public extract no longer relies on raw model defaults.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    migration_blocker: 'Keep public extract registered so forum/chat-room context ingestion stays auditable under the hidden lane.',
  },
  {
    source_id: 'public-context-summary-distill',
    source_file: 'src/backend/context-memory/runtime.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateHiddenArtifact'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalPublicObservationSummaryDistill',
      'this.deps.llmGateway.generateHiddenArtifact({',
      "traceId: `context-distill:${event.id}`",
    ],
    intent: 'public_observation_digest',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-public-observation-summary-distill', version: 1 },
    voice_line_authority: 'Public context distill also stays on the hidden director line and must not route through visible home voice.',
    tier_floor: 'base',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-public-observation-base',
    },
    legacy_raw_model_use: 'Removed; typed public distill replaces prose-only observation shaping.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    migration_blocker: 'Keep public distill registered so typed forum/chat-room state generation remains policy-governed.',
  },
  {
    source_id: 'public-context-identity-finalize',
    source_file: 'src/backend/context-memory/runtime.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateIdentityWrite'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalPublicObservationIdentityFinalize',
      'this.deps.llmGateway.generateIdentityWrite({',
      "traceId: `identity-finalize:${agentId}:",
    ],
    intent: 'identity_write',
    visibility: 'identity_write',
    prompt_ref: { id: 'internal-public-observation-identity-finalize', version: 1 },
    voice_line_authority: 'Public observation finalize must resolve from the agent home voice line through the identity-write lane.',
    tier_floor: 'identityWriteTier',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-identity-write-premium',
      'glm-deep-v1': 'glm-deep-identity-write-premium',
    },
    legacy_raw_model_use: 'Removed; config-affecting public finalize no longer uses hidden director or raw model defaults.',
    target_gateway_surface: 'LLMGateway.generateIdentityWrite',
    migration_blocker: 'Keep public finalize on the identity-write surface so forum/chat-room adaptations remain auditable.',
  },
  {
    source_id: 'private-context-summary-extract',
    source_file: 'src/backend/context-memory/runtime.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateHiddenArtifact'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalPrivateChatSummaryExtract',
      'this.deps.llmGateway.generateHiddenArtifact({',
      "traceId: `context-extract:${event.id}`",
    ],
    intent: 'private_digest',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-private-chat-summary-extract', version: 1 },
    voice_line_authority: 'Private context extraction stays on the hidden director line and reuses the private_digest routing family.',
    tier_floor: 'identityWriteTier',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-private-digest-premium',
    },
    legacy_raw_model_use: 'Removed; typed extract no longer relies on direct llmClient prompts.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    migration_blocker: 'Keep extract on the registered hidden lane so later public/nightly phases cannot bypass routing policy.',
  },
  {
    source_id: 'private-context-summary-distill',
    source_file: 'src/backend/context-memory/runtime.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateHiddenArtifact'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalPrivateChatSummaryDistill',
      'this.deps.llmGateway.generateHiddenArtifact({',
      "traceId: `context-distill:${event.id}`",
    ],
    intent: 'private_digest',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-private-chat-summary-distill', version: 1 },
    voice_line_authority: 'Private context distill also stays on the hidden director line and must not route through visible home voice.',
    tier_floor: 'identityWriteTier',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-private-digest-premium',
    },
    legacy_raw_model_use: 'Removed; typed distill replaces prose-only digest shaping.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    migration_blocker: 'Keep distill registered so typed state generation remains auditable under the same hidden routing family.',
  },
  {
    source_id: 'private-context-identity-finalize',
    source_file: 'src/backend/context-memory/runtime.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateHiddenArtifact'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalPrivateChatIdentityFinalize',
      'this.deps.llmGateway.generateIdentityWrite({',
      "traceId: `identity-finalize:${agentId}:",
    ],
    intent: 'identity_write',
    visibility: 'identity_write',
    prompt_ref: { id: 'internal-private-chat-identity-finalize', version: 1 },
    voice_line_authority: 'Identity finalize must resolve from the agent home voice line through the identity-write lane.',
    tier_floor: 'identityWriteTier',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-identity-write-premium',
      'glm-deep-v1': 'glm-deep-identity-write-premium',
    },
    legacy_raw_model_use: 'Removed; config-affecting finalize no longer uses hidden director or raw model defaults.',
    target_gateway_surface: 'LLMGateway.generateIdentityWrite',
    migration_blocker: 'Keep finalize on the identity-write surface so style patches remain tied to the voice contract.',
  },
  {
    source_id: 'vision-summary',
    source_file: 'src/backend/services/vision-summary-service.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateHiddenArtifact'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalVisionSummary',
      'type: \'image_url\'',
      'this.llmGateway.generateHiddenArtifact({',
    ],
    intent: 'vision_summary',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-vision-summary', version: 1 },
    voice_line_authority: 'Multimodal hidden summaries stay on the hidden director line and remain detached from visible home voice authority.',
    tier_floor: 'base',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-vision-summary-base',
    },
    legacy_raw_model_use: 'Removed; vision summary no longer uses direct multimodal llmClient access.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'dev-prompt-render',
    source_file: 'src/backend/app.ts',
    scene: 'dev_prompt_render',
    dispatch_calls: ['promptEngine.render'],
    evidence_patterns: [
      'template_version',
      'buildPromptTemplateRef(body.template_id, body.template_version)',
      'promptEngine.render(promptRef, variables)',
    ],
    intent: 'dev_prompt_render',
    visibility: 'dev_only',
    prompt_ref: { id: 'dev-selected-template', version: 1 },
    voice_line_authority: 'Dev-only render inspects prompt contracts and never chooses provider/model routing.',
    tier_floor: 'n/a',
    expected_profile_refs: null,
    legacy_raw_model_use: null,
    target_gateway_surface: 'PromptEngine.renderPromptRef',
    migration_blocker: 'Dev route intentionally renders selected templates directly for contract inspection.',
  },
]

export function isRoutingIntent(intent: LLMGenerationIntent): intent is VoiceLineRoutingIntent {
  return intent !== 'dev_prompt_render'
}
