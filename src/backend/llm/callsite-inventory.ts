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
  direct_calls: Array<'llmClient.chat' | 'promptEngine.render'>
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
  'src/backend/runtime/agent-executor.ts': {
    'llmClient.chat': 1,
    'promptEngine.render': 1,
  },
  'src/backend/services/conversation-clock.ts': {
    'llmClient.chat': 1,
    'promptEngine.render': 1,
  },
  'src/backend/runtime/post-scheduler.ts': {
    'llmClient.chat': 1,
    'promptEngine.render': 1,
  },
  'src/backend/services/private-channel-service.ts': {
    'llmClient.chat': 1,
    'promptEngine.render': 1,
  },
  'src/backend/services/proactive-interaction-service.ts': {
    'llmClient.chat': 2,
    'promptEngine.render': 1,
  },
  'src/backend/services/public-observation-digest-service.ts': {
    'llmClient.chat': 1,
  },
  'src/backend/services/memory-service.ts': {
    'llmClient.chat': 1,
  },
  'src/backend/services/vision-summary-service.ts': {
    'llmClient.chat': 1,
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
    direct_calls: ['promptEngine.render', 'llmClient.chat'],
    evidence_patterns: [
      "case 'NewPostCreated'",
      'PROMPT_TEMPLATE_REFS.agentReplyToPost',
      'this.deps.promptEngine.render(templateId, variables)',
      'this.deps.llmClient.chat({ messages })',
    ],
    intent: 'forum_reply',
    visibility: 'visible',
    prompt_ref: { id: 'agent-reply-to-post', version: 1 },
    voice_line_authority: 'T-063 homeVoiceLineId is the future visible authority; this path must resolve forum_reply within the selected visible line.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-forum-reply-base',
      'glm-deep-v1': 'glm-deep-forum-reply-base',
    },
    legacy_raw_model_use: 'Implicit config.llm bootstrap via llmClient defaults.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'AgentExecutor still couples prompt selection and direct llmClient dispatch.',
  },
  {
    source_id: 'agent-executor-forum-comment',
    source_file: 'src/backend/runtime/agent-executor.ts',
    scene: 'forum_comment',
    direct_calls: ['promptEngine.render', 'llmClient.chat'],
    evidence_patterns: [
      "case 'NewCommentCreated'",
      'PROMPT_TEMPLATE_REFS.agentReplyToComment',
      'this.deps.promptEngine.render(templateId, variables)',
      'this.deps.llmClient.chat({ messages })',
    ],
    intent: 'forum_reply',
    visibility: 'visible',
    prompt_ref: { id: 'agent-reply-to-comment', version: 1 },
    voice_line_authority: 'T-063 homeVoiceLineId is the future visible authority; comment replies still resolve through the forum_reply routing intent.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-forum-reply-base',
      'glm-deep-v1': 'glm-deep-forum-reply-base',
    },
    legacy_raw_model_use: 'Implicit config.llm bootstrap via llmClient defaults.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Comment replies share the same raw llmClient call and need explicit gateway request envelopes.',
  },
  {
    source_id: 'conversation-clock-chat-reply',
    source_file: 'src/backend/services/conversation-clock.ts',
    scene: 'chat_room',
    direct_calls: ['promptEngine.render', 'llmClient.chat'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.agentChatReply',
      'this.deps.promptEngine.render(PROMPT_TEMPLATE_REFS.agentChatReply, variables)',
      'this.deps.llmClient.chat({ messages })',
    ],
    intent: 'chat_reply',
    visibility: 'visible',
    prompt_ref: { id: 'agent-chat-reply', version: 1 },
    voice_line_authority: 'Visible authority must resolve from homeVoiceLineId and chat_room scene policy.',
    tier_floor: 'lite',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-chat-reply-lite',
      'glm-deep-v1': 'glm-deep-chat-reply-lite',
    },
    legacy_raw_model_use: 'Implicit config.llm bootstrap via llmClient defaults.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'ConversationClock still combines prompt assembly, skip handling, and llmClient dispatch in one service.',
  },
  {
    source_id: 'post-scheduler-create-post',
    source_file: 'src/backend/runtime/post-scheduler.ts',
    scene: 'scheduled_post',
    direct_calls: ['promptEngine.render', 'llmClient.chat'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.agentCreatePost',
      'this.deps.promptEngine.render(PROMPT_TEMPLATE_REFS.agentCreatePost, variables)',
      'this.deps.llmClient.chat({ messages })',
    ],
    intent: 'scheduled_post',
    visibility: 'visible',
    prompt_ref: { id: 'agent-create-post', version: 1 },
    voice_line_authority: 'Visible authority must resolve from homeVoiceLineId plus scheduled_post tier policy.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-scheduled-post-base',
      'glm-deep-v1': 'glm-deep-scheduled-post-base',
    },
    legacy_raw_model_use: 'Implicit config.llm bootstrap via llmClient defaults.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Scheduled posting has no gateway-level profile resolution or budget enforcement yet.',
  },
  {
    source_id: 'private-channel-reply',
    source_file: 'src/backend/services/private-channel-service.ts',
    scene: 'private_chat',
    direct_calls: ['promptEngine.render', 'llmClient.chat'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.agentPrivateChatReply',
      'return this.deps.promptEngine!.render(PROMPT_TEMPLATE_REFS.agentPrivateChatReply, variables)',
      'this.deps.llmClient.chat({',
      'model: agent.model',
    ],
    intent: 'private_reply',
    visibility: 'visible',
    prompt_ref: { id: 'agent-private-chat-reply', version: 1 },
    voice_line_authority: 'Private reply routing must still derive from homeVoiceLineId; legacy agent.model is migration-only bootstrap input.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-private-reply-base',
      'glm-deep-v1': 'glm-deep-private-reply-base',
    },
    legacy_raw_model_use: 'Explicit agent.model override.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Private chat still preserves a raw model override and inline fallback prompt path.',
  },
  {
    source_id: 'proactive-orchestrated-opening',
    source_file: 'src/backend/services/proactive-interaction-service.ts',
    scene: 'proactive_dm',
    direct_calls: ['promptEngine.render', 'llmClient.chat'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.agentProactiveDmOpening',
      'this.deps.promptEngine.render(',
      'scene: \'proactive_dm\'',
      'model: agent?.model',
    ],
    intent: 'proactive_opening',
    visibility: 'visible',
    prompt_ref: { id: 'agent-proactive-dm-opening', version: 1 },
    voice_line_authority: 'Proactive openings must resolve from homeVoiceLineId and proactive_dm scene policy before any fallback.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-proactive-opening-base',
      'glm-deep-v1': 'glm-deep-proactive-opening-base',
    },
    legacy_raw_model_use: 'Explicit agent.model override in orchestrated path.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Proactive opening keeps a direct llmClient path even after prompt orchestration succeeds.',
  },
  {
    source_id: 'proactive-legacy-opening',
    source_file: 'src/backend/services/proactive-interaction-service.ts',
    scene: 'proactive_dm',
    direct_calls: ['llmClient.chat'],
    evidence_patterns: [
      'PromptOrchestrator compose failed, fallback to legacy path',
      '你正在主动和你的 Owner（人类持有者）发起一次简短对话。',
      'model: agent?.model',
    ],
    intent: 'proactive_opening',
    visibility: 'visible',
    prompt_ref: { id: 'internal-proactive-dm-opening-legacy', version: 1 },
    voice_line_authority: 'Legacy fallback still owes the same homeVoiceLineId authority, even though the prompt is inline today.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-proactive-opening-base',
      'glm-deep-v1': 'glm-deep-proactive-opening-base',
    },
    legacy_raw_model_use: 'Explicit agent.model override.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    migration_blocker: 'Legacy inline proactive prompt is not yet migrated to a registered prompt contract.',
  },
  {
    source_id: 'public-observation-digest',
    source_file: 'src/backend/services/public-observation-digest-service.ts',
    scene: 'background_hidden',
    direct_calls: ['llmClient.chat'],
    evidence_patterns: [
      'PUBLIC_OBSERVATION_DIGEST_SYSTEM_PROMPT',
      'this.deps.llmClient.chat({',
      'content: transcript',
    ],
    intent: 'public_observation_digest',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-public-observation-digest', version: 1 },
    voice_line_authority: 'Hidden observation digest must route on the director line and never overwrite visible homeVoiceLine authority.',
    tier_floor: 'base',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-public-observation-base',
    },
    legacy_raw_model_use: 'Global config.llm.model default.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    migration_blocker: 'Observation digest prompt is still inline and bypasses profile-aware routing.',
  },
  {
    source_id: 'memory-private-digest',
    source_file: 'src/backend/services/memory-service.ts',
    scene: 'background_hidden',
    direct_calls: ['llmClient.chat'],
    evidence_patterns: [
      'DIGEST_SYSTEM_PROMPT',
      '以下是你与 Owner 的对话记录，请从你（AI Agent）的视角进行总结',
      'this.deps.llmClient.chat({',
    ],
    intent: 'private_digest',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-private-chat-digest', version: 1 },
    voice_line_authority: 'Private digest is reserved for hidden director work today; identity-affecting write rules remain a later package concern.',
    tier_floor: 'identityWriteTier',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-private-digest-premium',
    },
    legacy_raw_model_use: 'Global config.llm.model default.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    migration_blocker: 'Digest summarization stays inline and has no gateway request envelope yet.',
  },
  {
    source_id: 'vision-summary',
    source_file: 'src/backend/services/vision-summary-service.ts',
    scene: 'background_hidden',
    direct_calls: ['llmClient.chat'],
    evidence_patterns: [
      '你是一个图像内容摘要助手。只输出 JSON。',
      'type: \'image_url\'',
      'this.llmClient.chat({',
    ],
    intent: 'vision_summary',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-vision-summary', version: 1 },
    voice_line_authority: 'Multimodal hidden summaries must stay on the hidden director line and remain detached from visible home voice authority.',
    tier_floor: 'base',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-vision-summary-base',
    },
    legacy_raw_model_use: 'Global config.llm.model default.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    migration_blocker: 'Vision summary still relies on inline prompts and direct multimodal llmClient access.',
  },
  {
    source_id: 'dev-prompt-render',
    source_file: 'src/backend/app.ts',
    scene: 'dev_prompt_render',
    direct_calls: ['promptEngine.render'],
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
    migration_blocker: 'Dev route still renders selected templates directly and bypasses any future gateway wrapper.',
  },
]

export function isRoutingIntent(intent: LLMGenerationIntent): intent is VoiceLineRoutingIntent {
  return intent !== 'dev_prompt_render'
}
