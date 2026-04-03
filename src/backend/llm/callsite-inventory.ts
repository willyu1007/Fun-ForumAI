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
  raw_model_notes: string | null
  target_gateway_surface: string
  target_policy_id: string | null
  migration_status: 'migrated' | 'dual-track' | 'intentionally-retained'
  local_override_fields: Array<
    'temperature' |
    'maxTokens' |
    'stop' |
    'executionPolicyId' |
    'timeoutMs' |
    'maxRetries' |
    'regionHint'
  >
  local_override_notes: string | null
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
  'src/backend/media/media-semantic-service.ts': {
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
      'scene: promptScene',
    ],
    intent: 'forum_reply',
    visibility: 'visible',
    prompt_ref: { id: 'agent-reply-to-post', version: 4 },
    voice_line_authority: 'Forum post replies must resolve from the agent home voice line instead of bootstrap config.llm defaults.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-forum-reply-base',
      'glm-deep-v1': 'glm-deep-forum-reply-base',
    },
    raw_model_notes: 'Raw inline overrides remain removed; agent.model now only biases candidate selection inside the resolved profile.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    target_policy_id: 'visible-forum_reply-base',
    migration_status: 'migrated',
    local_override_fields: [],
    local_override_notes: null,
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'agent-executor-forum-thread',
    source_file: 'src/backend/runtime/agent-executor.ts',
    scene: 'forum_thread',
    dispatch_calls: ['llmGateway.generateVisibleText'],
    evidence_patterns: [
      "case 'ThreadOpened'",
      'PROMPT_TEMPLATE_REFS.agentReplyToThreadTurn',
      'this.deps.llmGateway.generateVisibleText({',
      'scene: promptScene',
    ],
    intent: 'forum_reply',
    visibility: 'visible',
    prompt_ref: { id: 'agent-reply-to-thread-turn', version: 4 },
    voice_line_authority: 'Thread turns still resolve through forum_reply intent, but now on top of homeVoiceLineId authority.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-forum-reply-base',
      'glm-deep-v1': 'glm-deep-forum-reply-base',
    },
    raw_model_notes: 'Raw inline overrides remain removed; agent.model now only biases candidate selection inside the resolved profile.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    target_policy_id: 'visible-forum_reply-base',
    migration_status: 'migrated',
    local_override_fields: [],
    local_override_notes: null,
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'conversation-clock-chat-reply',
    source_file: 'src/backend/services/conversation-clock/message-generator.ts',
    scene: 'chat_room',
    dispatch_calls: ['llmGateway.generateVisibleText'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.agentChatReply',
      'context.deps.llmGateway.generateVisibleText({',
      "intent: 'chat_reply'",
    ],
    intent: 'chat_reply',
    visibility: 'visible',
    prompt_ref: { id: 'agent-chat-reply', version: 6 },
    voice_line_authority: 'Chat room replies must resolve from homeVoiceLineId and chat_room policy, not bootstrap config.llm.',
    tier_floor: 'lite',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-chat-reply-lite',
      'glm-deep-v1': 'glm-deep-chat-reply-lite',
    },
    raw_model_notes: 'Removed; chat room replies now route through the gateway.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    target_policy_id: 'visible-chat_reply-lite',
    migration_status: 'migrated',
    local_override_fields: [],
    local_override_notes: null,
    migration_blocker: 'Migrated to gateway envelope; keep this inventory entry to prevent regressions.',
  },
  {
    source_id: 'post-scheduler-create-post',
    source_file: 'src/backend/runtime/post-scheduler.ts',
    scene: 'scheduled_post',
    dispatch_calls: ['llmGateway.generateVisibleText'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.agentCreatePostScene',
      'this.deps.llmGateway.generateVisibleText({',
      "intent: 'scheduled_post'",
    ],
    intent: 'scheduled_post',
    visibility: 'visible',
    prompt_ref: { id: 'agent-create-post', version: 4 },
    voice_line_authority: 'Scheduled posting now resolves from homeVoiceLineId plus scheduled_post tier policy.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-scheduled-post-base',
      'glm-deep-v1': 'glm-deep-scheduled-post-base',
    },
    raw_model_notes: 'Raw inline overrides remain removed; agent.model now only biases candidate selection inside the resolved profile.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    target_policy_id: 'visible-scheduled_post-base',
    migration_status: 'migrated',
    local_override_fields: [],
    local_override_notes: null,
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
    prompt_ref: { id: 'agent-private-chat-reply', version: 2 },
    voice_line_authority: 'Private replies still derive from homeVoiceLineId; agent.model can only bias same-profile candidate ordering after voice line resolution.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-private-reply-base',
      'glm-deep-v1': 'glm-deep-private-reply-base',
    },
    raw_model_notes: 'Temperature remains as a temporary local override while private reply policy defaults are being frozen for T-936 cutover.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    target_policy_id: 'visible-private_reply-base',
    migration_status: 'dual-track',
    local_override_fields: ['temperature'],
    local_override_notes: 'Retains private-chat temperature tuning until visible private reply policy defaults are finalized in T-936.',
    migration_blocker: 'Gateway routing is live, but private reply still carries a callsite temperature override that must migrate into execution policy ownership.',
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
    prompt_ref: { id: 'agent-proactive-dm-opening', version: 2 },
    voice_line_authority: 'Proactive openings resolve from homeVoiceLineId and proactive_dm policy with orchestrated private-boundary inputs.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-proactive-opening-base',
      'glm-deep-v1': 'glm-deep-proactive-opening-base',
    },
    raw_model_notes: 'Temperature remains as a temporary local override while proactive opening policy defaults are being frozen for T-936 cutover.',
    target_gateway_surface: 'LLMGateway.generateVisibleText',
    target_policy_id: 'visible-proactive_opening-base',
    migration_status: 'dual-track',
    local_override_fields: ['temperature'],
    local_override_notes: 'Retains proactive opening temperature tuning until visible proactive policy defaults are frozen in T-936.',
    migration_blocker: 'Gateway routing is live, but proactive opening still carries a callsite temperature override that must migrate into execution policy ownership.',
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
    raw_model_notes: 'Digest generation still carries a local temperature override while hidden public observation policy defaults remain in dual-track mode.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    target_policy_id: 'hidden-public_observation_digest-base',
    migration_status: 'dual-track',
    local_override_fields: ['temperature'],
    local_override_notes: 'Retains digest temperature tuning until hidden public-observation defaults move fully into registry-owned execution policy.',
    migration_blocker: 'Hidden digest routing is live, but this callsite still carries a local temperature override that T-936 must migrate.',
  },
  {
    source_id: 'agent-social-bio-render',
    source_file: 'src/backend/services/agent-bio-render-service.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateHiddenArtifact'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalAgentSocialBioRender',
      'this.deps.llmGateway.generateHiddenArtifact({',
      "intent: 'public_observation_digest'",
    ],
    intent: 'public_observation_digest',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-agent-social-bio-render', version: 1 },
    voice_line_authority: 'Social bio projection now renders on the agent home voice line hidden digest lane so rhetoric families stay aligned with the agent voice instead of a global director line.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-public-observation-base',
      'glm-deep-v1': 'glm-deep-public-observation-base',
      'minimax-her-v1': 'minimax-her-public-observation-base',
      'kimi-deep-v1': 'kimi-deep-public-observation-base',
    },
    raw_model_notes: 'Bio render no longer pins provider/model, but still carries local temperature/maxTokens tuning pending T-936 policy cutover.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    target_policy_id: 'hidden-public_observation_digest-base',
    migration_status: 'dual-track',
    local_override_fields: ['temperature', 'maxTokens'],
    local_override_notes: 'Retains social bio render temperature and maxTokens tuning until hidden digest policy defaults absorb them in T-936.',
    migration_blocker: 'This callsite now routes through the gateway, but still carries local generation controls that must migrate into execution policy ownership.',
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
    raw_model_notes: 'Public extract no longer pins model selection, but still retains a local temperature override pending policy cutover.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    target_policy_id: 'hidden-public_observation_digest-base',
    migration_status: 'dual-track',
    local_override_fields: ['temperature'],
    local_override_notes: 'Retains public extract temperature tuning until hidden public observation policy defaults absorb it in T-936.',
    migration_blocker: 'Keep public extract registered so forum/chat-room context ingestion stays auditable under the hidden lane while local overrides are still being migrated.',
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
    raw_model_notes: 'Public distill no longer pins model selection, but still retains a local temperature override pending policy cutover.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    target_policy_id: 'hidden-public_observation_digest-base',
    migration_status: 'dual-track',
    local_override_fields: ['temperature'],
    local_override_notes: 'Retains public distill temperature tuning until hidden public observation policy defaults absorb it in T-936.',
    migration_blocker: 'Keep public distill registered so typed forum/chat-room state generation remains policy-governed while local overrides are still being migrated.',
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
    voice_line_authority: 'Public observation finalize must resolve from the agent home voice line through the identity-write lane, but can request a lower identity tier than private digest.',
    tier_floor: 'base',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-identity-write-base',
      'glm-deep-v1': 'glm-deep-identity-write-premium',
    },
    raw_model_notes: 'Public identity finalize no longer pins raw model defaults, but still retains a local temperature override pending policy cutover.',
    target_gateway_surface: 'LLMGateway.generateIdentityWrite',
    target_policy_id: 'identity_write-identity_write-base',
    migration_status: 'dual-track',
    local_override_fields: ['temperature'],
    local_override_notes: 'Retains public identity finalize temperature tuning until identity-write defaults are fully absorbed into execution policy ownership.',
    migration_blocker: 'Keep public finalize on the identity-write surface so forum/chat-room adaptations remain auditable while local overrides are still being migrated.',
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
    tier_floor: 'base',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-private-digest-base',
    },
    raw_model_notes: 'Private extract no longer uses direct llmClient prompts, but still retains a local temperature override pending policy cutover.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    target_policy_id: 'hidden-private_digest-base',
    migration_status: 'dual-track',
    local_override_fields: ['temperature'],
    local_override_notes: 'Retains private extract temperature tuning until hidden private-digest defaults are fully absorbed into execution policy ownership.',
    migration_blocker: 'Keep extract on the registered hidden lane so later public/nightly phases cannot bypass routing policy while local overrides are still being migrated.',
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
    tier_floor: 'base',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-private-digest-base',
    },
    raw_model_notes: 'Private distill no longer uses direct llmClient prompts, but still retains a local temperature override pending policy cutover.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    target_policy_id: 'hidden-private_digest-base',
    migration_status: 'dual-track',
    local_override_fields: ['temperature'],
    local_override_notes: 'Retains private distill temperature tuning until hidden private-digest defaults are fully absorbed into execution policy ownership.',
    migration_blocker: 'Keep distill registered so typed state generation remains auditable under the same hidden routing family while local overrides are still being migrated.',
  },
  {
    source_id: 'private-context-identity-finalize',
    source_file: 'src/backend/context-memory/runtime.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateIdentityWrite'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalPrivateChatIdentityFinalize',
      'this.deps.llmGateway.generateIdentityWrite({',
      "traceId: `identity-finalize:${agentId}:",
    ],
    intent: 'identity_write',
    visibility: 'identity_write',
    prompt_ref: { id: 'internal-private-chat-identity-finalize', version: 1 },
    voice_line_authority: 'Private identity finalize must resolve from the agent home voice line through the identity-write lane and can request the higher private tier.',
    tier_floor: 'identityWriteTier',
    expected_profile_refs: {
      'qwen-social-v1': 'qwen-social-identity-write-premium',
      'glm-deep-v1': 'glm-deep-identity-write-premium',
    },
    raw_model_notes: 'Private identity finalize no longer pins raw model defaults, but still retains a local temperature override pending policy cutover.',
    target_gateway_surface: 'LLMGateway.generateIdentityWrite',
    target_policy_id: 'identity_write-identity_write-premium',
    migration_status: 'dual-track',
    local_override_fields: ['temperature'],
    local_override_notes: 'Retains private identity finalize temperature tuning until identity-write defaults are fully absorbed into execution policy ownership.',
    migration_blocker: 'Keep finalize on the identity-write surface so style patches remain tied to the voice contract while local overrides are still being migrated.',
  },
  {
    source_id: 'vision-summary',
    source_file: 'src/backend/media/media-semantic-service.ts',
    scene: 'background_hidden',
    dispatch_calls: ['llmGateway.generateHiddenArtifact'],
    evidence_patterns: [
      'PROMPT_TEMPLATE_REFS.internalVisionSummary',
      'type: \'image_url\'',
      'agentId: input.agentId ?? \'media-semantic\'',
      'this.deps.llmGateway.generateHiddenArtifact({',
    ],
    intent: 'vision_summary',
    visibility: 'hidden',
    prompt_ref: { id: 'internal-vision-summary', version: 1 },
    voice_line_authority: 'Multimodal hidden summaries stay on the hidden director line and remain detached from visible home voice authority.',
    tier_floor: 'base',
    expected_profile_refs: {
      'deepseek-director-v1': 'deepseek-director-vision-summary-base',
    },
    raw_model_notes: 'Vision summary no longer uses direct multimodal llmClient access, but still retains local temperature/maxTokens tuning pending policy cutover.',
    target_gateway_surface: 'LLMGateway.generateHiddenArtifact',
    target_policy_id: 'hidden-vision_summary-base',
    migration_status: 'dual-track',
    local_override_fields: ['temperature', 'maxTokens'],
    local_override_notes: 'Retains vision summary temperature and maxTokens tuning until the hidden multimodal execution policy fully absorbs them in T-936.',
    migration_blocker: 'Vision routing is live, but this callsite still carries local generation controls that must migrate into execution policy ownership.',
  },
  {
    source_id: 'dev-prompt-render',
    source_file: 'src/backend/app.ts',
    scene: 'dev_prompt_render',
    dispatch_calls: ['promptEngine.render'],
    evidence_patterns: [
      'resolveCurrentVisiblePromptRef(body.template_id)',
      'promptEngine.render(promptRef, variables)',
    ],
    intent: 'dev_prompt_render',
    visibility: 'dev_only',
    prompt_ref: { id: 'dev-selected-template', version: 1 },
    voice_line_authority: 'Dev-only render inspects prompt contracts and never chooses provider/model routing.',
    tier_floor: 'n/a',
    expected_profile_refs: null,
    raw_model_notes: null,
    target_gateway_surface: 'PromptEngine.renderPromptRef',
    target_policy_id: null,
    migration_status: 'intentionally-retained',
    local_override_fields: [],
    local_override_notes: 'Dev-only prompt rendering intentionally bypasses runtime routing and remains a prompt contract inspection surface.',
    migration_blocker: 'Dev route intentionally renders selected templates directly for contract inspection.',
  },
]

export function isRoutingIntent(intent: LLMGenerationIntent): intent is VoiceLineRoutingIntent {
  return intent !== 'dev_prompt_render'
}
