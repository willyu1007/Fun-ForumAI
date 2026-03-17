import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'
import type { CurrentContextSource, PromptComposeAudit } from '../../runtime/types.js'
import { buildPromptBudgetSummary } from '../../runtime/prompt-budget-summary.js'
import { formatChatReplyForReadability, sanitizeChatOutput } from '../../runtime/chat-output-sanitizer.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  recordPersonaObservation,
} from '../../runtime/persona-observation.js'
import type { RenderTierDecisionResult } from '../../runtime/persona-runtime-types.js'
import type {
  ConversationClockContext,
  GeneratedMessageResult,
  ProgramMessageMetadata,
  RecordGeneratedMessageRunInput,
} from './types.js'
import {
  buildChatConversationText,
  buildChatSceneRule,
  buildChatShortTermState,
  buildFallbackChatroomLocalIntentBlock,
  buildTopicHintBodies,
  extractTopicHints,
  hasMeaningfulText,
  resolveIdentity,
  sanitizePromptText,
} from './prompt-context.js'

export async function generateMessage(
  context: ConversationClockContext,
  roomId: string,
  agentId: string,
): Promise<GeneratedMessageResult> {
  const room = await context.deps.roomRepo.findById(roomId)
  const agent =
    context.deps.agentRepo.findById(agentId) ??
    (await context.deps.agentService.getAgentPersisted(agentId).catch(() => null))
  if (!room || !agent) return { kind: 'empty', body: '' }

  const latestConfig = context.deps.agentService.getLatestConfigPersisted
    ? await context.deps.agentService
        .getLatestConfigPersisted(agentId)
        .catch(() => context.deps.agentService.getLatestConfig(agentId))
    : context.deps.agentService.getLatestConfig(agentId)
  const resolvedIdentity = resolveIdentity(agent, latestConfig)

  const recentMsgs = await context.deps.messageRepo.getLatestMessages(roomId, 10)
  const runtimeChatContext = context.deps.chatroomRuntimeContextBuilder
    ? await context.deps.chatroomRuntimeContextBuilder
        .build({
          room,
          agentId,
          recentMessages: recentMsgs,
        })
        .catch((error) => {
          console.warn(
            `[ConversationClock] chatroom runtime context build failed for room=${roomId} agent=${agentId}:`,
            error,
          )
          return null
        })
    : null
  const chatConversationText = buildChatConversationText(recentMsgs, runtimeChatContext)
  const chatTopicHints = extractTopicHints(
    room.name,
    buildTopicHintBodies(recentMsgs, runtimeChatContext),
  )
  const chatSceneRule = buildChatSceneRule(room.name, runtimeChatContext)
  const chatShortTermState = buildChatShortTermState(
    roomId,
    recentMsgs.length,
    runtimeChatContext,
  )

  const recentText = recentMsgs
    .flatMap((message) => {
      const body = sanitizePromptText(message.body)
      if (!body) return []
      const author = context.deps.agentRepo.findById(message.author_id)
      const name = author?.display_name ?? message.author_id
      return [`发言人=${name}；内容=${body}`]
    })
    .join('\n')
  const localIntentBlock = hasMeaningfulText(runtimeChatContext?.promptVariables.local_intent_block)
    ? runtimeChatContext.promptVariables.local_intent_block
    : buildFallbackChatroomLocalIntentBlock({
        roomName: room.name,
        roomDescription: room.description || '',
        recentText,
      })

  if (!context.deps.llmGateway.isConfigured) {
    return { kind: 'normal', body: `[${agent.display_name}] 聊天测试消息` }
  }

  let persona = resolvedIdentity.visiblePersona
  const observationIdentity = resolvedIdentity.observationIdentity
  let promptAudit: PromptComposeAudit | null = null
  let renderDecision: RenderTierDecisionResult | null = null
  let layers = {
    layer_traits: '',
    layer_style: '',
    layer_instructions: '',
    layer_community: '',
    layer_relationship: '',
    layer_showrunner: '',
    layer_overrides: '',
    layer_memory: '',
    layer_privacy: '',
    hard_control_block: '',
    compact_control_block: '',
    current_context_block: '',
    memory_block: '',
    soft_expression_block: '',
  }
  if (context.deps.promptOrchestrator?.isSceneEnabled('chat_room')) {
    const member = await context.deps.roomRepo.getMember(roomId, agentId)
    const composed = await context.deps.promptOrchestrator.compose({
      agentId,
      scene: 'chat_room',
      conversationText: chatConversationText,
      communityId: room.community_id,
      topicHints: chatTopicHints,
      currentContextSources: ([
        {
          kind: 'room_recent_turns',
          text: recentText || '（房间刚创建，还没有对话）',
          priority: 'critical',
          source_id: `${roomId}:recent_turns`,
        },
        {
          kind: 'local_role_or_cue',
          text: thisOrEmpty(runtimeChatContext?.promptVariables.role_hint),
          priority: 'high',
          source_id: `${roomId}:role_hint`,
        },
        {
          kind: 'room_program_context',
          text: [
            runtimeChatContext?.promptVariables.program_scene,
            runtimeChatContext?.promptVariables.current_beat,
            runtimeChatContext?.promptVariables.live_hook,
            runtimeChatContext?.promptVariables.unresolved_question,
          ].filter(Boolean).join('\n'),
          priority: 'high',
          source_id: `${roomId}:program_context`,
        },
        {
          kind: 'thread_or_scene_continuity',
          text: thisOrEmpty(runtimeChatContext?.promptVariables.room_public_context_summary),
          priority: 'medium',
          source_id: `${roomId}:continuity`,
        },
      ] satisfies CurrentContextSource[]).filter((source) => source.text.trim().length > 0),
      requestEnvelope: {
        static_system_tokens: 180,
        route_wrapper_tokens: 90,
        tool_tokens: 0,
        current_user_input_tokens: 0,
        output_reserve: 0,
        model_capability_ref: null,
      },
      communitySoftCulture: room.description || '',
      sceneRule: chatSceneRule,
      shortTermState: chatShortTermState,
      shortTermStateUpdatedAt: recentMsgs[recentMsgs.length - 1]?.created_at ?? null,
      roomMemberState: member
        ? { joined_at: member.joined_at, last_spoke_at: member.last_spoke_at }
        : undefined,
    })
    layers = {
      layer_traits: composed.layers.layer1_traits ?? '',
      layer_style: composed.layers.layer2_style ?? '',
      layer_instructions: composed.layers.layer3_instructions ?? '',
      layer_community: composed.layers.layer_community ?? '',
      layer_relationship: composed.layers.layer_relationship ?? '',
      layer_showrunner: composed.layers.layer_showrunner ?? '',
      layer_overrides: composed.layers.layer4_overrides ?? '',
      layer_memory: composed.layers.layer5_memory ?? '',
      layer_privacy: composed.layers.layer6_privacy ?? '',
      hard_control_block: composed.layers.hard_control_block ?? '',
      compact_control_block: composed.layers.compact_control_block ?? '',
      current_context_block: composed.layers.current_context_block ?? '',
      memory_block: composed.layers.memory_block ?? '',
      soft_expression_block: composed.layers.soft_expression_block ?? '',
    }
    promptAudit = composed.audit
    persona = composed.persona
    renderDecision = composed.runtimeEnvelope?.renderTierDecision ?? null
  } else if (context.deps.promptLayerService) {
    const member = await context.deps.roomRepo.getMember(roomId, agentId)
    const composed = await context.deps.promptLayerService.composeLayersWithAudit(
      {
        agentId,
        scene: 'chat_room',
        conversationText: chatConversationText,
        communityId: room.community_id,
        topicHints: chatTopicHints,
        roomMemberState: member
          ? { joined_at: member.joined_at, last_spoke_at: member.last_spoke_at }
          : undefined,
      },
      { suppressAuditLog: true },
    )
    layers = {
      layer_traits: composed.layers.layer1_traits ?? '',
      layer_style: composed.layers.layer2_style ?? '',
      layer_instructions: composed.layers.layer3_instructions ?? '',
      layer_community: composed.layers.layer_community ?? '',
      layer_relationship: composed.layers.layer_relationship ?? '',
      layer_showrunner: composed.layers.layer_showrunner ?? '',
      layer_overrides: composed.layers.layer4_overrides ?? '',
      layer_memory: composed.layers.layer5_memory ?? '',
      layer_privacy: composed.layers.layer6_privacy ?? '',
      hard_control_block: composed.layers.hard_control_block ?? '',
      compact_control_block: composed.layers.compact_control_block ?? '',
      current_context_block: composed.layers.current_context_block ?? '',
      memory_block: composed.layers.memory_block ?? '',
      soft_expression_block: composed.layers.soft_expression_block ?? '',
    }
    promptAudit = composed.audit
    if (composed.persona) {
      persona = composed.persona
    }
    renderDecision = composed.runtimeEnvelope?.renderTierDecision ?? null
  }

  const variables: Record<string, string> = {
    persona_name: persona.name,
    persona_style: persona.style,
    persona_interests: persona.interests.join('、'),
    persona_language: persona.language,
    persona_seed_code: observationIdentity?.persona_seed_code ?? 'scholar',
    room_name: room.name,
    room_description: room.description || '',
    recent_messages: recentText || '（房间刚刚创建，还没有对话）',
    program_scene: runtimeChatContext?.promptVariables.program_scene ?? '',
    episode_id: runtimeChatContext?.promptVariables.episode_id ?? '',
    current_beat: runtimeChatContext?.promptVariables.current_beat ?? '',
    cue_type: runtimeChatContext?.promptVariables.cue_type ?? '',
    director_goal: '',
    self_role: runtimeChatContext?.promptVariables.self_role ?? '',
    cast_snapshot: runtimeChatContext?.promptVariables.cast_snapshot ?? '',
    live_hook: runtimeChatContext?.promptVariables.live_hook ?? '',
    unresolved_question: runtimeChatContext?.promptVariables.unresolved_question ?? '',
    last_highlight: runtimeChatContext?.promptVariables.last_highlight ?? '',
    local_intent_block: localIntentBlock,
    room_public_context_summary:
      runtimeChatContext?.promptVariables.room_public_context_summary ?? '',
    public_projection_hint: runtimeChatContext?.promptVariables.public_projection_hint ?? '',
    signature_moves: runtimeChatContext?.promptVariables.signature_moves ?? '',
    shared_memory_summary: runtimeChatContext?.promptVariables.shared_memory_summary ?? '',
    role_hint: runtimeChatContext?.promptVariables.role_hint ?? '',
    projection_updated_at: runtimeChatContext?.promptVariables.projection_updated_at ?? '',
    layer_traits: layers.layer_traits,
    layer_style: layers.layer_style,
    layer_instructions: layers.layer_instructions,
    layer_community: layers.layer_community,
    layer_relationship: layers.layer_relationship,
    layer_showrunner: layers.layer_showrunner,
    layer_overrides: layers.layer_overrides,
    layer_memory: layers.layer_memory,
    layer_privacy: layers.layer_privacy,
    hard_control_block: layers.hard_control_block,
    compact_control_block: layers.compact_control_block,
    current_context_block: layers.current_context_block,
    memory_block: layers.memory_block,
    soft_expression_block: layers.soft_expression_block,
  }

  const promptRef = PROMPT_TEMPLATE_REFS.agentChatReplyScene
  const routing = context.deps.inferenceProfileService
    ? await context.deps.inferenceProfileService.resolveVisibleRoute({
        agentId,
        requestedTier: renderDecision?.requestedTier ?? 'lite',
      })
    : {
        homeVoiceLineId: resolvedIdentity.homeVoiceLineId,
        preferredModelId: undefined,
        requestedTier: renderDecision?.requestedTier ?? 'lite',
      }
  const response = await context.deps.llmGateway.generateVisibleText({
    intent: 'chat_reply',
    scene: 'chat_room',
    agentId,
    homeVoiceLineId: routing.homeVoiceLineId,
    preferredModelId: routing.preferredModelId,
    promptRef,
    variables,
    budgetClass: 'visible_standard',
    traceId: `chat-room:${roomId}:${agentId}:${Date.now()}`,
    promptBudgetSummary: buildPromptBudgetSummary('chat_room', promptRef, promptAudit),
    requestedTier: routing.requestedTier,
    allowFallbackWithinLine: false,
    allowCrossFamily: false,
  })
  const latencyMs = response.latencyMs ?? 0
  const sanitized = sanitizeChatOutput(response.content)
  const content = formatChatReplyForReadability(sanitized.text)
  const observation = buildPersonaObservation({
    sourceCallsiteId: 'conversation-clock-chat-reply',
    scene: 'chat_room',
    intent: 'chat_reply',
    visibility: 'visible',
    coverageStatus: 'visible_complete',
    personaSeedCode: observationIdentity?.persona_seed_code,
    homeVoiceLineId: observationIdentity?.home_voice_line_id,
    promptRef,
    requestedTier: response.renderDecision.tier,
    resolvedTier: response.renderDecision.tier,
    renderDecision: response.renderDecision,
    usage: response.usage,
    latencyMs,
    parseSuccess: Boolean(content) && !sanitized.looks_meta,
    promptAudit,
    llmProviderId: response.renderDecision.providerId,
    llmModelId: response.renderDecision.modelId,
  })

  const skipMatch = content.match(/^\[SKIP(?::(.+?))?\]/)
  if (skipMatch) {
    const feedback = skipMatch[1]?.trim() || ''
    return {
      kind: 'skip_feedback',
      body: feedback,
      usage: response.usage,
      latency_ms: latencyMs,
      observation,
      renderDecision,
    }
  }

  if (!content || sanitized.looks_meta) return { kind: 'empty', body: '', renderDecision }
  return {
    kind: 'normal',
    body: content,
    usage: response.usage,
    latency_ms: latencyMs,
    observation,
    renderDecision,
  }
}

function thisOrEmpty(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export async function postMessage(
  context: ConversationClockContext,
  roomId: string,
  agentId: string,
  body: string,
  kind: import('../../repos/types.js').ChatMessageKind,
  renderDecision?: RenderTierDecisionResult | null,
  metadata?: ProgramMessageMetadata,
): Promise<void> {
  try {
    await context.deps.chatService.sendMessage({
      room_id: roomId,
      author_id: agentId,
      episode_id: metadata?.episode_id ?? null,
      beat_id: metadata?.beat_id ?? null,
      program_event_id: metadata?.program_event_id ?? null,
      speaker_role: metadata?.speaker_role ?? null,
      cue_type: metadata?.cue_type ?? null,
      body,
      message_kind: kind,
    })
    if (renderDecision && context.deps.personaStateService) {
      await context.deps.personaStateService
        .recordVisibleRender({
          agentId,
          scene: 'chat_room',
          renderDecision,
          outputText: body,
        })
        .catch((err) => {
          console.error('[ConversationClock] persona runtime render record failed:', err)
        })
    }
  } catch (err) {
    console.error(`[ConversationClock] Failed to post message in ${roomId}:`, err)
  }
}

export async function recordGeneratedMessageRun(
  context: ConversationClockContext,
  input: RecordGeneratedMessageRunInput,
): Promise<void> {
  if (!input.observation || !input.usage || typeof input.latencyMs !== 'number') {
    return
  }

  try {
    const event = context.deps.eventRepo.create({
      event_type: 'CHAT_ROOM_MESSAGE_GENERATED',
      plane: 'RUNTIME',
      room_id: input.roomId,
      actor_type: 'agent',
      actor_id: input.agentId,
      correlation_id: `room:${input.roomId}:agent:${input.agentId}`,
      payload_json: {
        room_id: input.roomId,
        author_agent_id: input.agentId,
        message_kind: input.kind,
      },
    })

    context.deps.agentRunRepo.create({
      agent_id: input.agentId,
      trigger_event_id: event.id,
      input_digest: `chat_room|room:${input.roomId}|kind:${input.kind}|len:${input.body.length}`,
      output_json: attachPersonaObservation(
        {
          room_id: input.roomId,
          body_length: input.body.length,
          message_kind: input.kind,
        },
        input.observation,
      ),
      token_cost: input.usage.total_tokens,
      latency_ms: input.latencyMs,
    })
    recordPersonaObservation(input.observation)
  } catch (err) {
    console.error('[ConversationClock] AgentRun record failed:', err)
  }
}
