import type { PromptEngine } from '../llm/prompt-engine.js'
import type { LLMGateway } from '../llm/llm-gateway.js'
import type { RenderDecision } from '../llm/gateway-contract.js'
import type { AgentService } from './agent-service.js'
import type { NotificationService } from './notification-service.js'
import type { PrivateChannelRepository } from '../repos/private-channel-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { PromptOrchestrator } from '../runtime/prompt-orchestrator.js'
import type { RenderTierDecisionResult } from '../runtime/persona-runtime-types.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import { buildPromptBudgetSummary } from '../runtime/prompt-budget-summary.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import type { PersonaStateService } from './persona-state-service.js'
import type { InferenceProfileService } from './inference-profile-service.js'
import type { PromptComposeAudit } from '../runtime/types.js'
import type { LlmTokenUsage } from '../llm/types.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  type PersonaObservationV1,
  recordPersonaObservation,
} from '../runtime/persona-observation.js'
import {
  formatChatReplyForReadability,
  sanitizeChatOutput,
} from '../runtime/chat-output-sanitizer.js'
import type { PolicyGatewayService } from './policy-gateway-service.js'
import type { IdentityGateService } from './identity-gate-service.js'
import type { MediaAssetService } from '../media/media-asset-service.js'
import type { PrivateMessage, PrivateSession } from '../repos/types/private-channel.js'
import { config } from '../lib/config.js'
import { AppError } from '../lib/errors.js'
import {
  compactErrorMessage,
  recordRuntimeOperation,
} from '../runtime/runtime-observability.js'

const MAX_PROACTIVE_PER_DAY = 2
const PROACTIVE_COOLDOWN_MS = 4 * 60 * 60 * 1000

export interface ProactiveInteractionDeps {
  channelRepo: PrivateChannelRepository
  agentService: AgentService
  llmGateway: LLMGateway
  promptOrchestrator?: PromptOrchestrator | null
  personaStateService?: PersonaStateService | null
  inferenceProfileService?: InferenceProfileService | null
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  notificationService: NotificationService
  policyGatewayService?: PolicyGatewayService | null
  identityGateService?: IdentityGateService | null
  mediaAssetService?: MediaAssetService | null
}

function normalizeVisibleOpeningText(text: string, errorCode: string): string {
  const sanitized = sanitizeChatOutput(text)
  const formatted = formatChatReplyForReadability(sanitized.text)
  if (!formatted || sanitized.looks_meta) {
    throw new AppError(502, 'Visible proactive opening normalization failed', errorCode)
  }
  return formatted
}

export class ProactiveInteractionService {
  constructor(private readonly deps: ProactiveInteractionDeps) {}

  bindPromptOrchestrator(promptEngine: PromptEngine, promptOrchestrator: PromptOrchestrator): void {
    void promptEngine
    ;(this.deps as { promptOrchestrator?: PromptOrchestrator | null }).promptOrchestrator = promptOrchestrator
  }

  async onVoteReceived(agentId: string, vote: {
    direction: string
    target_type: string
    target_id: string
    voter_agent_id: string
  }): Promise<boolean> {
    if (vote.direction !== 'UP') return false

    const agent = this.deps.agentService.getAgent(agentId)
    if (!agent) return false

    const canTrigger = await this.canTriggerProactive(agentId)
    if (!canTrigger) return false

    const voterAgent = this.deps.agentService.getAgent(vote.voter_agent_id)
    const voterName = voterAgent?.display_name ?? '一位智能体'
    const targetLabel = vote.target_type === 'POST'
      ? '帖子'
      : vote.target_type === 'THREAD'
        ? '线程'
        : vote.target_type === 'TURN'
          ? '回合'
          : '消息'

    const openingMessage = await this.generateOpeningMessage(agentId, {
      trigger: 'vote_received',
      context: `${voterName}给你的${targetLabel}点了赞。`,
    })
    const delivery = await this.deliverOpeningMessage({
      agentId,
      humanUserId: agent.owner_id,
      sessionTriggerType: 'VOTE_RECEIVED',
      observationTriggerType: 'vote_received',
      triggerRef: vote.target_id,
      openingMessage,
      notificationTitle: `${agent.display_name} 想和你聊聊`,
      policyTargetId: vote.target_id,
      whyRelevantHint: '作为这次主动私聊开场的视觉锚点，帮助 owner 在进入会话时快速识别当前触发语境。',
    })

    return delivery !== null
  }

  async onOpinionChallenged(agentId: string, challenge: {
    challenger_agent_id: string
    original_content: string
    challenge_content: string
    post_id: string
    thread_id?: string
    turn_id?: string
  }): Promise<boolean> {
    const agent = this.deps.agentService.getAgent(agentId)
    if (!agent) return false

    const canTrigger = await this.canTriggerProactive(agentId)
    if (!canTrigger) return false

    const challengerAgent = this.deps.agentService.getAgent(challenge.challenger_agent_id)
    const challengerName = challengerAgent?.display_name ?? '一位智能体'

    const openingMessage = await this.generateOpeningMessage(agentId, {
      trigger: 'opinion_challenged',
      context: [
        `${challengerName}对你的观点提出了质疑。`,
        `你的原文："${challenge.original_content.slice(0, 200)}"`,
        `质疑内容："${challenge.challenge_content.slice(0, 200)}"`,
      ].join('\n'),
    })
    const delivery = await this.deliverOpeningMessage({
      agentId,
      humanUserId: agent.owner_id,
      sessionTriggerType: 'OPINION_CHALLENGED',
      observationTriggerType: 'opinion_challenged',
      triggerRef: challenge.turn_id ?? challenge.thread_id ?? challenge.post_id,
      openingMessage,
      notificationTitle: `${agent.display_name} 的观点被质疑了`,
      policyTargetId: challenge.turn_id ?? challenge.thread_id ?? challenge.post_id,
      topicContextText: [
        challenge.original_content,
        challenge.challenge_content,
      ].join('\n\n'),
      whyRelevantHint: '作为这次主动私聊开场的视觉锚点，帮助 owner 在进入会话时快速识别当前争议或回访的上下文。',
    })

    return delivery !== null
  }

  async onAgentFirstPost(agentId: string, postId: string): Promise<void> {
    const agent = this.deps.agentService.getAgent(agentId)
    if (!agent) return

    await this.deps.notificationService.create({
      userId: agent.owner_id,
      type: 'AGENT_FIRST_POST',
      title: `${agent.display_name} 发布了第一个帖子！`,
      body: `你的 Agent 迈出了在论坛中的第一步。去看看吧，也可以和 TA 私聊讨论。`,
      targetType: 'post',
      targetId: postId,
    })
  }

  async runCloseoutProactiveOpening(input: {
    agentId: string
    humanUserId?: string
    context?: string
    triggerRef?: string | null
  }): Promise<{
    session: PrivateSession
    opening_message: PrivateMessage
    token_cost: number
    trace_id: string
  }> {
    const agent = this.deps.agentService.getAgent(input.agentId)
    const selectedHumanUserId = input.humanUserId?.trim() || agent.owner_id
    const triggerRef = input.triggerRef ?? `runtime-closeout:${Date.now()}`
    const openingMessage = await this.generateOpeningMessage(input.agentId, {
      trigger: 'runtime_closeout',
      context:
        input.context?.trim() || '请主动打个招呼，确认你已准备好继续这段交流，并保持一句话内完成。',
    })
    const delivery = await this.deliverOpeningMessage({
      agentId: input.agentId,
      humanUserId: selectedHumanUserId,
      sessionTriggerType: 'RUNTIME_CLOSEOUT_PROACTIVE',
      observationTriggerType: 'runtime_closeout',
      triggerRef,
      openingMessage,
      notificationTitle: `${agent.display_name} 想和你聊聊`,
      policyTargetId: triggerRef,
      whyRelevantHint: '作为 runtime closeout 主动开场的视觉锚点，帮助 operator 验证 proactive opening lane 已回到统一 execution-plan contract。',
    })
    if (!delivery) {
      throw new Error('Proactive closeout opening was blocked by policy.')
    }
    return {
      session: delivery.session,
      opening_message: delivery.openingMessage,
      token_cost: openingMessage.usage.total_tokens,
      trace_id: openingMessage.traceId,
    }
  }

  private async canTriggerProactive(agentId: string): Promise<boolean> {
    const agent = this.deps.agentService.getAgent(agentId)
    if (!agent) return false
    if (agent.status === 'LIMITED' || agent.status === 'QUARANTINED' || agent.status === 'BANNED') {
      return false
    }
    if (this.deps.identityGateService) {
      try {
        await this.deps.identityGateService.assertVerified(agent.owner_id, 'proactive_receive')
      } catch {
        return false
      }
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todaySessions = await this.deps.channelRepo.listSessions(agentId, {
      limit: MAX_PROACTIVE_PER_DAY + 1,
      initiator: 'AGENT',
    })

    const todayCount = todaySessions.items.filter((session) => session.started_at >= todayStart).length
    if (todayCount >= MAX_PROACTIVE_PER_DAY) return false

    const lastProactive = todaySessions.items[0]
    if (lastProactive && lastProactive.started_at >= todayStart) {
      const messages = await this.deps.channelRepo.listMessages(lastProactive.id, { limit: 10 })
      const hasOwnerReply = messages.items.some((message) => message.author_type === 'HUMAN')
      if (!hasOwnerReply) return false

      const elapsed = Date.now() - lastProactive.started_at.getTime()
      if (elapsed < PROACTIVE_COOLDOWN_MS) return false
    }

    return true
  }

  private async maybeAttachOpeningMedia(input: {
    agentId: string
    ownerUserId: string
    sessionId: string
    messageId: string
    why_relevant_hint: string
  }): Promise<void> {
    if (!config.launch.capabilities.mediaProactivePrivateSurfaceV1 || !this.deps.mediaAssetService) {
      return
    }
    const candidate = await this.deps.mediaAssetService.findLatestAgentAuthoredPrivateAttachmentCandidate(
      input.agentId,
    )
    if (!candidate) return

    try {
      await this.deps.mediaAssetService.attachAgentAuthoredAssetToPrivateMessage({
        asset_id: candidate.id,
        agent_id: input.agentId,
        owner_user_id: input.ownerUserId,
        session_id: input.sessionId,
        message_id: input.messageId,
        why_relevant_hint: input.why_relevant_hint,
      })
    } catch (error) {
      await this.deps.mediaAssetService.rollbackPrivateMessageAttachmentArtifacts(input.messageId).catch((rollbackErr) => {
        console.error('[ProactiveInteraction] proactive media rollback failed:', rollbackErr)
      })
      console.error('[ProactiveInteraction] proactive opening media attach failed:', error)
      recordRuntimeOperation({
        severity: 'warn',
        source: 'proactive_interaction',
        operation: 'attach_opening_media',
        status: 'failed',
        agent_id: input.agentId,
        session_id: input.sessionId,
        message_id: input.messageId,
        error_message_redacted: compactErrorMessage(error),
      })
    }
  }

  private async deliverOpeningMessage(input: {
    agentId: string
    humanUserId: string
    sessionTriggerType: string
    observationTriggerType: string
    triggerRef: string
    openingMessage: Awaited<ReturnType<ProactiveInteractionService['generateOpeningMessage']>>
    notificationTitle: string
    policyTargetId: string
    topicContextText?: string
    whyRelevantHint: string
  }): Promise<{
    session: PrivateSession
    openingMessage: PrivateMessage
    effectiveOpeningContent: string
  } | null> {
    const agent = this.deps.agentService.getAgent(input.agentId)
    const policyDecision = this.deps.policyGatewayService
      ? await this.deps.policyGatewayService.evaluate({
          channel: 'proactive_dm',
          text: input.openingMessage.content,
          ...(input.topicContextText ? { topic_context_text: input.topicContextText } : {}),
          author_agent_id: input.agentId,
          user_id: input.humanUserId,
          target_type: 'notification',
          target_id: input.policyTargetId,
          scene: 'proactive_dm',
        })
      : null
    if (policyDecision?.action === 'block') return null

    const effectiveOpeningContent = policyDecision?.final_text
      ? normalizeVisibleOpeningText(policyDecision.final_text, 'PROACTIVE_DM_INVALID_OUTPUT')
      : input.openingMessage.content
    const session = await this.deps.channelRepo.createSession({
      agent_id: input.agentId,
      human_user_id: input.humanUserId,
      initiator: 'AGENT',
      trigger_type: input.sessionTriggerType,
      trigger_ref: input.triggerRef,
    })
    const openingRecord = await this.deps.channelRepo.createMessage({
      session_id: session.id,
      author_type: 'AGENT',
      content: effectiveOpeningContent,
      delivery_status: policyDecision?.delivery_status ?? 'DELIVERED',
      moderation_metadata: policyDecision?.metadata ?? null,
    })

    await this.maybeAttachOpeningMedia({
      agentId: input.agentId,
      ownerUserId: input.humanUserId,
      sessionId: session.id,
      messageId: openingRecord.id,
      why_relevant_hint: input.whyRelevantHint,
    })

    this.recordOpeningRun({
      agentId: input.agentId,
      sessionId: session.id,
      triggerType: input.observationTriggerType,
      triggerRef: input.triggerRef,
      openingMessage: { ...input.openingMessage, content: effectiveOpeningContent },
    })

    if (input.openingMessage.renderDecision && this.deps.personaStateService) {
      await this.deps.personaStateService.recordVisibleRender({
        agentId: input.agentId,
        scene: 'proactive_dm',
        renderDecision: input.openingMessage.renderDecision,
        outputText: effectiveOpeningContent,
      }).catch((err) => {
        console.error('[ProactiveInteraction] persona runtime render record failed:', err)
      })
    }

    await this.deps.notificationService.create({
      userId: input.humanUserId,
      type: 'AGENT_PROACTIVE',
      title: input.notificationTitle,
      body: effectiveOpeningContent,
      targetType: 'agent',
      targetId: agent.id,
    })

    return {
      session,
      openingMessage: openingRecord,
      effectiveOpeningContent,
    }
  }

  private async generateOpeningMessage(
    agentId: string,
    trigger: { trigger: string; context: string },
  ): Promise<{
    content: string
    traceId: string
    renderDecision: RenderTierDecisionResult | null
    usage: LlmTokenUsage
    latencyMs: number
    promptAudit: PromptComposeAudit | null
    sourceCallsiteId: 'proactive-orchestrated-opening'
    gatewayRenderDecision: RenderDecision
    llmProviderId?: string
    llmModelId?: string
  }> {
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const identity = resolveAgentIdentity(agent, latestConfig)
    const defaultHomeVoiceLineId = identity.summary.home_voice_line_id

    if (!this.deps.promptOrchestrator) {
      throw new Error('PromptOrchestrator is not configured for proactive DM')
    }

    const composed = await this.deps.promptOrchestrator.compose({
      agentId,
      scene: 'proactive_dm',
      conversationText: `${trigger.trigger}\n${trigger.context}`,
      topicHints: [trigger.trigger],
      currentContextSources: [
        {
          kind: 'boundary_control',
          text: `trigger_type=${trigger.trigger}`,
          priority: 'critical',
          source_id: `${agentId}:proactive:boundary`,
        },
        {
          kind: 'trigger_context',
          text: trigger.context,
          priority: 'critical',
          source_id: `${agentId}:proactive:trigger`,
        },
      ],
      requestEnvelope: {
        static_system_tokens: 180,
        route_wrapper_tokens: 80,
        tool_tokens: 0,
        current_user_input_tokens: 0,
        output_reserve: 0,
        model_capability_ref: null,
      },
      shortTermState: trigger.context.slice(0, 200),
      shortTermStateUpdatedAt: new Date(),
    })

    const variables: Record<string, string> = {
      persona_name: composed.persona.name,
      persona_style: composed.persona.style,
      persona_interests: composed.persona.interests.join('、'),
      persona_language: composed.persona.language,
      trigger_type: trigger.trigger,
      hard_control_block: composed.blocks.hard_control_block ?? '',
      compact_control_block: composed.blocks.compact_control_block ?? '',
      current_context_block: composed.blocks.current_context_block ?? '',
      memory_block: composed.blocks.memory_block ?? '',
      soft_expression_block: composed.blocks.soft_expression_block ?? '',
    }

    const routing = this.deps.inferenceProfileService
      ? await this.deps.inferenceProfileService.resolveVisibleRoute({
          agentId,
          requestedTier: composed.runtimeEnvelope?.renderTierDecision.requestedTier ?? 'base',
        })
      : {
          homeVoiceLineId: defaultHomeVoiceLineId,
          requestedTier: composed.runtimeEnvelope?.renderTierDecision.requestedTier ?? 'base',
        }
    const startMs = Date.now()
    const traceId = `proactive-dm:${agentId}:${Date.now()}`
    const response = await this.deps.llmGateway.generateVisibleText({
      intent: 'proactive_opening',
      scene: 'proactive_dm',
      modality: 'text',
      responseMode: 'text',
      agentId,
      homeVoiceLineId: routing.homeVoiceLineId,
      promptRef: PROMPT_TEMPLATE_REFS.agentProactiveDmOpening,
      variables,
      budgetClass: 'visible_standard',
      traceId,
      promptBudgetSummary: buildPromptBudgetSummary('proactive_dm', PROMPT_TEMPLATE_REFS.agentProactiveDmOpening, composed.audit),
      requestedTier: routing.requestedTier,
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    })
    const normalizedContent = normalizeVisibleOpeningText(
      response.content,
      'PROACTIVE_DM_INVALID_OUTPUT',
    )

    return {
      content: normalizedContent,
      traceId,
      renderDecision: composed.runtimeEnvelope?.renderTierDecision ?? null,
      usage: response.usage,
      latencyMs: Date.now() - startMs,
      promptAudit: composed.audit,
      sourceCallsiteId: 'proactive-orchestrated-opening',
      gatewayRenderDecision: response.renderDecision,
      llmProviderId: response.renderDecision.providerId,
      llmModelId: response.renderDecision.modelId,
    }
  }

  private recordOpeningRun(input: {
    agentId: string
    sessionId: string
    triggerType: string
    triggerRef: string
    openingMessage: {
      content: string
      renderDecision: RenderTierDecisionResult | null
      usage: LlmTokenUsage
      latencyMs: number
      promptAudit: PromptComposeAudit | null
      sourceCallsiteId: 'proactive-orchestrated-opening'
      gatewayRenderDecision: RenderDecision
      llmProviderId?: string
      llmModelId?: string
    }
  }): void {
    const identity = this.resolveObservationIdentity(input.agentId)
    const observation: PersonaObservationV1 = buildPersonaObservation({
      sourceCallsiteId: input.openingMessage.sourceCallsiteId,
      scene: 'proactive_dm',
      intent: 'proactive_opening',
      visibility: 'visible',
      coverageStatus: 'visible_complete',
      personaSeedCode: identity?.persona_seed_code,
      homeVoiceLineId: identity?.home_voice_line_id,
      promptRef: PROMPT_TEMPLATE_REFS.agentProactiveDmOpening,
      requestedTier: input.openingMessage.gatewayRenderDecision.tier,
      resolvedTier: input.openingMessage.gatewayRenderDecision.tier,
      renderDecision: input.openingMessage.gatewayRenderDecision,
      usage: input.openingMessage.usage,
      latencyMs: input.openingMessage.latencyMs,
      parseSuccess: true,
      promptAudit: input.openingMessage.promptAudit,
      llmProviderId: input.openingMessage.llmProviderId,
      llmModelId: input.openingMessage.llmModelId,
    })

    try {
      const event = this.deps.eventRepo.create({
        event_type: 'PROACTIVE_DM_OPENING_GENERATED',
        plane: 'RUNTIME',
        actor_type: 'agent',
        actor_id: input.agentId,
        correlation_id: `private-session:${input.sessionId}`,
        payload_json: {
          agent_id: input.agentId,
          session_id: input.sessionId,
          trigger_type: input.triggerType,
          trigger_ref: input.triggerRef,
        },
      })

      this.deps.agentRunRepo.create({
        agent_id: input.agentId,
        trigger_event_id: event.id,
        input_digest: `proactive_dm|session:${input.sessionId}|trigger:${input.triggerType}`,
        output_json: attachPersonaObservation(
          {
            session_id: input.sessionId,
            trigger_type: input.triggerType,
            trigger_ref: input.triggerRef,
            reply_len: input.openingMessage.content.length,
          },
          observation,
        ),
        token_cost: input.openingMessage.usage.total_tokens,
        latency_ms: input.openingMessage.latencyMs,
      })
      recordPersonaObservation(observation)
    } catch (err) {
      console.error('[ProactiveInteraction] AgentRun record failed:', err)
      recordRuntimeOperation({
        severity: 'warn',
        source: 'proactive_interaction',
        operation: 'persist_agent_run',
        status: 'failed',
        agent_id: input.agentId,
        session_id: input.sessionId,
        error_message_redacted: compactErrorMessage(err),
        payload_json: {
          trigger_type: input.triggerType,
        },
      })
    }
  }

  private resolveObservationIdentity(agentId: string): {
    persona_seed_code: import('../../shared/agent-persona-catalog.js').PersonaSeedCode
    home_voice_line_id: import('../../shared/agent-persona-catalog.js').VoiceLineId
  } | null {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      const resolved = resolveAgentIdentity(agent, latestConfig)
      return {
        persona_seed_code: resolved.summary.persona_seed_code,
        home_voice_line_id: resolved.summary.home_voice_line_id,
      }
    } catch {
      return null
    }
  }
}
