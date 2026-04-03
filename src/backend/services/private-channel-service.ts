import type { LLMGateway } from '../llm/llm-gateway.js'
import type { LLMGatewayResponse } from '../llm/gateway-contract.js'
import type { PromptEngine } from '../llm/prompt-engine.js'
import type { AgentService } from './agent-service.js'
import type { BudgetService } from './budget-service.js'
import type { CostTracker } from './cost-tracker.js'
import type { PrivateChannelRepository } from '../repos/private-channel-repository.js'
import type { MemoryRepository } from '../repos/memory-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { SseHub } from '../sse/hub.js'
import type { PromptOrchestrator } from '../runtime/prompt-orchestrator.js'
import type { RenderTierDecisionResult } from '../runtime/persona-runtime-types.js'
import type { PromptComposeAudit } from '../runtime/types.js'
import type { CurrentContextSource } from '../runtime/types.js'
import type { PersonaStateService } from './persona-state-service.js'
import type { InferenceProfileService } from './inference-profile-service.js'
import type { MediaAssetService } from '../media/media-asset-service.js'
import type { MemoryService } from './memory-service.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  type PersonaObservationV1,
  recordPersonaObservation,
} from '../runtime/persona-observation.js'
import { resolvePreferredVisibleModelId } from '../llm/model-preference.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import { buildPromptBudgetSummary } from '../runtime/prompt-budget-summary.js'
import type {
  PrivateSession,
  PrivateMessage,
  PrivateMessageAttachment,
  PaginatedResult,
  PaginationOpts,
  PrivateSessionStatus,
  SendPrivateMessageInput,
} from '../repos/types.js'
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { buildAgentSystemDisplayFields } from '../launch/system-roster.js'
import type { PolicyGatewayService } from './policy-gateway-service.js'
import type { IdentityGateService } from './identity-gate-service.js'

const SESSION_TIMEOUT_MS = 30 * 60 * 1000

interface CurrentPrivateMediaCardInput {
  source_id: string
  text: string
  topic_hints: string[]
}

export interface PrivateChannelServiceDeps {
  channelRepo: PrivateChannelRepository
  memoryRepo: MemoryRepository
  agentService: AgentService
  llmGateway: LLMGateway
  promptOrchestrator?: PromptOrchestrator | null
  personaStateService?: PersonaStateService | null
  inferenceProfileService?: InferenceProfileService | null
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  budgetService: BudgetService | null
  costTracker: CostTracker | null
  mediaAssetService: MediaAssetService
  memoryService?: MemoryService | null
  sseHub?: SseHub | null
  policyGatewayService?: PolicyGatewayService | null
  identityGateService?: IdentityGateService | null
}

export class PrivateChannelService {
  constructor(private readonly deps: PrivateChannelServiceDeps) {}

  bindPromptOrchestrator(promptEngine: PromptEngine, promptOrchestrator: PromptOrchestrator): void {
    void promptEngine
    ;(this.deps as { promptOrchestrator?: PromptOrchestrator | null }).promptOrchestrator = promptOrchestrator
  }

  async createSession(agentId: string, humanUserId: string): Promise<PrivateSession> {
    const agent = this.deps.agentService.getAgent(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const displayFields = buildAgentSystemDisplayFields(latestConfig?.config_json)
    if (!displayFields.surface_access.private_chat_enabled) {
      throw new ForbiddenError('Private sessions are disabled for this agent')
    }
    if (agent.owner_id !== humanUserId) {
      throw new ForbiddenError('Only the agent owner can start a private session')
    }

    if (this.deps.identityGateService) {
      await this.deps.identityGateService.assertVerified(humanUserId, 'private_session_create')
    }

    const existing = await this.deps.channelRepo.listSessions(agentId, {
      limit: 1,
      status: 'ACTIVE',
    })
    if (existing.items.length > 0) {
      return existing.items[0]
    }

    try {
      return await this.deps.channelRepo.createSession({
        agent_id: agentId,
        human_user_id: humanUserId,
        initiator: 'HUMAN',
      })
    } catch (err) {
      if (isPrismaForeignKeyError(err)) {
        throw new AppError(409, 'Session dependency not ready; retry shortly', 'DEPENDENCY_NOT_READY')
      }
      throw err
    }
  }

  async endSession(sessionId: string, humanUserId: string): Promise<PrivateSession> {
    const session = await this.deps.channelRepo.findSessionById(sessionId)
    if (!session) throw new NotFoundError('PrivateSession', sessionId)
    if (session.human_user_id !== humanUserId) {
      throw new ForbiddenError('Not your session')
    }
    if (session.status !== 'ACTIVE') {
      throw new ValidationError('Session is not active')
    }

    const updated = await this.deps.channelRepo.updateSessionStatus(sessionId, 'ENDED', new Date())
    if (!updated) throw new NotFoundError('PrivateSession', sessionId)

    this.deps.sseHub?.broadcastToSession(sessionId, {
      type: 'PRIVATE_SESSION_ENDED',
      payload: { session_id: sessionId, session: updated },
    })

    return updated
  }

  async sendMessage(
    sessionId: string,
    humanUserId: string,
    input: SendPrivateMessageInput,
  ): Promise<{ human_message: PrivateMessage; agent_reply: PrivateMessage; token_cost: number }> {
    const session = await this.deps.channelRepo.findSessionById(sessionId)
    if (!session) throw new NotFoundError('PrivateSession', sessionId)
    if (session.human_user_id !== humanUserId) {
      throw new ForbiddenError('Not your session')
    }
    if (session.status !== 'ACTIVE') {
      throw new ValidationError('Session is not active')
    }
    const normalizedContent = input.content.trim()
    const attachmentAssetIds = normalizeAttachmentAssetIds(input.attachment_asset_ids)
    if (!normalizedContent && attachmentAssetIds.length === 0) {
      throw new ValidationError('Message content or attachment is required')
    }
    if (attachmentAssetIds.length > 0) {
      this.requirePrivateMediaMemoryService()
    }
    if (this.deps.identityGateService) {
      await this.deps.identityGateService.assertVerified(humanUserId, 'private_message_send')
    }

    const agent = this.deps.agentService.getAgent(session.agent_id)
    if (!agent) throw new NotFoundError('Agent', session.agent_id)

    if (this.deps.budgetService) {
      const budget = await this.deps.budgetService.checkBudget(session.agent_id)
      if (!budget.allowed) {
        throw new ValidationError(`Agent budget exhausted: ${budget.reason}`)
      }
    }

    const inboundPolicy = this.deps.policyGatewayService
      ? await this.deps.policyGatewayService.evaluate({
          channel: 'private_inbound',
          text: normalizedContent || '[owner shared image attachment]',
          author_agent_id: session.agent_id,
          user_id: humanUserId,
          target_type: 'private_session',
          target_id: session.id,
          session_id: session.id,
          scene: 'private_chat',
        })
      : null
    const effectiveHumanContent = inboundPolicy?.action === 'block'
      ? '[blocked by policy]'
      : inboundPolicy?.final_text ?? normalizedContent

    const humanMsg = await this.deps.channelRepo.createMessage({
      session_id: sessionId,
      author_type: 'HUMAN',
      content: effectiveHumanContent,
      delivery_status: inboundPolicy?.delivery_status ?? 'DELIVERED',
      moderation_metadata: inboundPolicy?.metadata ?? null,
    })

    if (inboundPolicy?.action === 'block') {
      const blockedHumanMessage: PrivateMessage = {
        ...humanMsg,
        attachments: [],
      }
      this.deps.sseHub?.broadcastToSession(sessionId, {
        type: 'PRIVATE_MESSAGE_CREATED',
        payload: { session_id: sessionId, message: blockedHumanMessage },
      })
      const refusal = await this.deps.channelRepo.createMessage({
        session_id: sessionId,
        author_type: 'AGENT',
        content: inboundPolicy.final_text,
        delivery_status: 'REFUSED',
        moderation_metadata: inboundPolicy.metadata,
      })
      this.deps.sseHub?.broadcastToSession(sessionId, {
        type: 'PRIVATE_MESSAGE_CREATED',
        payload: { session_id: sessionId, message: refusal },
      })
      return {
        human_message: blockedHumanMessage,
        agent_reply: { ...refusal, attachments: [] },
        token_cost: 0,
      }
    }

    try {
      const attachmentContext = await this.prepareMessageAttachments({
        session,
        humanUserId,
        messageId: humanMsg.id,
        attachmentAssetIds,
      })
      const enrichedHumanMessage: PrivateMessage = {
        ...humanMsg,
        attachments: attachmentContext.attachments,
      }

      const replyPlan = await this.buildRequestForReply(
        session,
        effectiveHumanContent,
        attachmentContext.current_media_cards,
      )
      const routing = await this.resolveVisibleRouting(
        session.agent_id,
        replyPlan.renderDecision?.requestedTier ?? 'base',
      )
      const startMs = Date.now()
      const llmResponse = await this.deps.llmGateway.generateVisibleText({
        intent: 'private_reply',
        scene: 'private_chat',
        modality: 'text',
        responseMode: 'text',
        agentId: session.agent_id,
        homeVoiceLineId: routing.homeVoiceLineId,
        preferredModelId: routing.preferredModelId,
        promptRef: replyPlan.promptRef,
        variables: replyPlan.variables,
        budgetClass: 'visible_standard',
        traceId: `private-chat:${session.id}:${humanMsg.id}`,
        promptBudgetSummary: buildPromptBudgetSummary('private_chat', replyPlan.promptRef, replyPlan.promptAudit),
        requestedTier: routing.requestedTier,
        allowFallbackWithinLine: false,
        allowCrossFamily: false,
        localOverrides: {
          temperature: 0.8,
        },
      })
      const latencyMs = Date.now() - startMs
      const identity = this.resolveObservationIdentity(session.agent_id)
      const observation = buildPersonaObservation({
        sourceCallsiteId: 'private-channel-reply',
        scene: 'private_chat',
        intent: 'private_reply',
        visibility: 'visible',
        coverageStatus: 'visible_complete',
        personaSeedCode: identity?.persona_seed_code,
        homeVoiceLineId: identity?.home_voice_line_id,
        promptRef: replyPlan.promptRef,
        requestedTier: llmResponse.renderDecision.tier,
        resolvedTier: llmResponse.renderDecision.tier,
        renderDecision: llmResponse.renderDecision,
        usage: llmResponse.usage,
        latencyMs,
        parseSuccess: true,
        promptAudit: replyPlan.promptAudit,
        llmProviderId: llmResponse.renderDecision.providerId,
        llmModelId: llmResponse.renderDecision.modelId,
      })

      const outboundPolicy = this.deps.policyGatewayService
        ? await this.deps.policyGatewayService.evaluate({
            channel: 'private_outbound',
            text: llmResponse.content,
            author_agent_id: session.agent_id,
            user_id: humanUserId,
            target_type: 'private_session',
            target_id: session.id,
            session_id: session.id,
            scene: 'private_chat',
          })
        : null

      const agentReply = await this.deps.channelRepo.createMessage({
        session_id: sessionId,
        author_type: 'AGENT',
        content: outboundPolicy?.final_text ?? llmResponse.content,
        delivery_status: outboundPolicy?.action === 'block'
          ? 'REFUSED'
          : outboundPolicy?.delivery_status ?? 'DELIVERED',
        moderation_metadata: outboundPolicy?.metadata ?? null,
      })
      this.deps.sseHub?.broadcastToSession(sessionId, {
        type: 'PRIVATE_MESSAGE_CREATED',
        payload: { session_id: sessionId, message: enrichedHumanMessage },
      })
      this.deps.sseHub?.broadcastToSession(sessionId, {
        type: 'PRIVATE_MESSAGE_CREATED',
        payload: { session_id: sessionId, message: agentReply },
      })

      if (replyPlan.renderDecision && this.deps.personaStateService) {
        await this.deps.personaStateService.recordVisibleRender({
          agentId: session.agent_id,
          scene: 'private_chat',
          renderDecision: replyPlan.renderDecision,
          outputText: agentReply.content,
        }).catch((err) => {
          console.error('[PrivateChannel] persona runtime render record failed:', err)
        })
      }

      this.recordAuditTrail(
        session,
        normalizedContent || attachmentContext.audit_input_text,
        llmResponse,
        latencyMs,
        observation,
      )

      return {
        human_message: enrichedHumanMessage,
        agent_reply: { ...agentReply, attachments: [] },
        token_cost: llmResponse.usage.total_tokens,
      }
    } catch (err) {
      if (attachmentAssetIds.length > 0) {
        await this.rollbackFailedAttachmentMessage({
          agentId: session.agent_id,
          messageId: humanMsg.id,
          attachmentAssetIds,
        })
      }
      throw err
    }
  }

  async uploadAttachment(input: {
    agentId: string
    sessionId: string
    humanUserId: string
    mimeType: string
    bytes: Buffer
  }): Promise<PrivateMessageAttachment> {
    const session = await this.deps.channelRepo.findSessionById(input.sessionId)
    if (!session) throw new NotFoundError('PrivateSession', input.sessionId)
    if (session.agent_id !== input.agentId) {
      throw new ValidationError('Session does not belong to the target agent')
    }
    if (session.human_user_id !== input.humanUserId) {
      throw new ForbiddenError('Not your session')
    }
    if (session.status !== 'ACTIVE') {
      throw new ValidationError('Session is not active')
    }
    this.requirePrivateMediaMemoryService()
    if (this.deps.identityGateService) {
      await this.deps.identityGateService.assertVerified(input.humanUserId, 'private_message_send')
    }

    const agent = this.deps.agentService.getAgent(session.agent_id)
    if (!agent) throw new NotFoundError('Agent', session.agent_id)

    const record = await this.deps.mediaAssetService.ingestPrivateMessageUpload({
      agent_id: session.agent_id,
      owner_user_id: input.humanUserId,
      session_id: session.id,
      mime_type: input.mimeType,
      bytes: input.bytes,
    })
    const attachment = await this.deps.mediaAssetService.getPrivateAttachmentView(record.asset.id)
    if (!attachment) {
      throw new AppError(500, 'Failed to build staged attachment view', 'PRIVATE_ATTACHMENT_STAGE_FAILED')
    }
    return attachment
  }

  private async prepareMessageAttachments(input: {
    session: PrivateSession
    humanUserId: string
    messageId: string
    attachmentAssetIds: string[]
  }): Promise<{
    attachments: PrivateMessageAttachment[]
    current_media_cards: CurrentPrivateMediaCardInput[]
    audit_input_text: string
  }> {
    if (input.attachmentAssetIds.length === 0) {
      return {
        attachments: [],
        current_media_cards: [],
        audit_input_text: '',
      }
    }

    const memoryService = this.requirePrivateMediaMemoryService()
    const attachments: PrivateMessageAttachment[] = []
    const currentMediaCards: CurrentPrivateMediaCardInput[] = []
    for (const assetId of input.attachmentAssetIds) {
      const attached = await this.deps.mediaAssetService.attachAssetToPrivateMessage({
        asset_id: assetId,
        agent_id: input.session.agent_id,
        owner_user_id: input.humanUserId,
        session_id: input.session.id,
        message_id: input.messageId,
        why_relevant_hint: 'Owner 刚在当前轮私聊中分享了这张图片，可直接作为当前回复的视觉上下文。',
      })
      attachments.push(attached.attachment)
      currentMediaCards.push({
        source_id: attached.runtime_projection.id,
        text: attached.runtime_serialized_text,
        topic_hints: buildPrivateCardTopicHints(attached.runtime_card),
      })

      try {
        await memoryService.createPrivateMediaMemory({
          agent_id: input.session.agent_id,
          owner_user_id: input.humanUserId,
          session_id: input.session.id,
          message_id: input.messageId,
          projection: attached.memory_payload,
          source_projection_id: attached.memory_projection.id,
        })
      } catch (err) {
        console.error('[PrivateChannel] private media memory write failed:', err)
        if (err instanceof AppError) {
          throw err
        }
        throw new AppError(500, 'Failed to persist private media memory', 'PRIVATE_MEDIA_MEMORY_WRITE_FAILED')
      }
    }

    return {
      attachments,
      current_media_cards: currentMediaCards,
      audit_input_text: currentMediaCards.map((item) => item.text).join('\n'),
    }
  }

  private async rollbackFailedAttachmentMessage(input: {
    agentId: string
    messageId: string
    attachmentAssetIds: string[]
  }): Promise<void> {
    const cleanupErrors: unknown[] = []
    const memoryCleanup = this.deps.memoryService?.cleanupPrivateMediaMemory?.({
      agent_id: input.agentId,
      message_id: input.messageId,
      asset_ids: input.attachmentAssetIds,
    })
    if (memoryCleanup) {
      await memoryCleanup.catch((err) => {
        cleanupErrors.push(err)
      })
    }
    await this.deps.mediaAssetService.rollbackPrivateMessageAttachmentArtifacts(input.messageId).catch((err) => {
      cleanupErrors.push(err)
    })
    await this.deps.channelRepo.deleteMessage(input.messageId).catch((err) => {
      cleanupErrors.push(err)
    })
    if (cleanupErrors.length > 0) {
      console.error('[PrivateChannel] attachment rollback cleanup failed:', cleanupErrors)
    }
  }

  private async hydrateMessageAttachments(messages: PrivateMessage[]): Promise<PrivateMessage[]> {
    if (messages.length === 0) return messages
    const attachmentMap = await this.deps.mediaAssetService.listPrivateMessageAttachmentViews(
      messages.map((message) => message.id),
    )
    return messages.map((message) => ({
      ...message,
      attachments: attachmentMap.get(message.id) ?? message.attachments ?? [],
    }))
  }

  private recordAuditTrail(
    session: PrivateSession,
    inputContent: string,
    llmResponse: Pick<LLMGatewayResponse, 'content' | 'usage'>,
    latencyMs: number,
    observation: PersonaObservationV1,
  ): void {
    const agentId = session.agent_id

    try {
      const event = this.deps.eventRepo.create({
        event_type: 'PrivateChatMessage',
        plane: 'DATA',
        schema_version: 'v1',
        actor_type: 'agent',
        actor_id: agentId,
        correlation_id: `private-session:${session.id}`,
        payload_json: { session_id: session.id, agent_id: agentId },
      })

      this.deps.agentRunRepo.create({
        agent_id: agentId,
        trigger_event_id: event.id,
        input_digest: `private_chat|session:${session.id}|len:${inputContent.length}`,
        output_json: attachPersonaObservation(
          {
            reply_len: llmResponse.content.length,
            session_id: session.id,
          },
          observation,
        ),
        token_cost: llmResponse.usage.total_tokens,
        latency_ms: latencyMs,
      })
      recordPersonaObservation(observation)
    } catch (err) {
      console.error('[PrivateChannel] AgentRun record failed:', err)
    }

    if (this.deps.budgetService) {
      this.deps.budgetService.recordAction(agentId).catch((err) =>
        console.error('[PrivateChannel] Budget record failed:', err),
      )
    }

    if (this.deps.costTracker) {
      this.deps.costTracker.record(agentId, 'private_chat', llmResponse.usage).catch((err) =>
        console.error('[PrivateChannel] Cost record failed:', err),
      )
    }
  }

  async getSession(sessionId: string): Promise<PrivateSession> {
    const session = await this.deps.channelRepo.findSessionById(sessionId)
    if (!session) throw new NotFoundError('PrivateSession', sessionId)
    return session
  }

  async listSessions(
    agentId: string,
    humanUserId: string,
    opts: PaginationOpts & { status?: PrivateSessionStatus },
  ): Promise<PaginatedResult<PrivateSession>> {
    const result = await this.deps.channelRepo.listSessions(agentId, opts)
    if (
      this.deps.identityGateService
      && result.items.some((session) => requiresProactiveReceiveGate(session))
    ) {
      await this.deps.identityGateService.assertVerified(humanUserId, 'proactive_receive')
    }
    return result
  }

  async getMessages(
    sessionId: string,
    humanUserId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<PrivateMessage>> {
    const session = await this.deps.channelRepo.findSessionById(sessionId)
    if (!session) throw new NotFoundError('PrivateSession', sessionId)
    if (session.human_user_id !== humanUserId) {
      throw new ForbiddenError('Not your session')
    }
    if (
      this.deps.identityGateService
      && requiresProactiveReceiveGate(session)
    ) {
      await this.deps.identityGateService.assertVerified(humanUserId, 'proactive_receive')
    }
    const result = await this.deps.channelRepo.listMessages(sessionId, opts)
    return {
      ...result,
      items: await this.hydrateMessageAttachments(result.items),
    }
  }

  async checkTimeouts(): Promise<PrivateSession[]> {
    const timedOut = await this.deps.channelRepo.findTimedOutSessions(SESSION_TIMEOUT_MS)
    const ended: PrivateSession[] = []
    for (const session of timedOut) {
      const updated = await this.deps.channelRepo.updateSessionStatus(session.id, 'ENDED', new Date())
      if (updated) {
        ended.push(updated)
      }
    }
    return ended
  }

  async getMessageCount(sessionId: string): Promise<number> {
    return this.deps.channelRepo.countMessages(sessionId)
  }

  private async buildRequestForReply(
    session: PrivateSession,
    currentMessage: string,
    currentMediaCards: CurrentPrivateMediaCardInput[],
  ): Promise<{
    promptRef: typeof PROMPT_TEMPLATE_REFS.agentPrivateChatReply
    variables: Record<string, string>
    renderDecision: RenderTierDecisionResult | null
    promptAudit: PromptComposeAudit | null
  }> {
    if (!this.deps.promptOrchestrator) {
      throw new AppError(
        503,
        'PromptOrchestrator is not configured for private chat',
        'PROMPT_ORCHESTRATOR_UNAVAILABLE',
      )
    }

    return this.buildRequestWithOrchestrator(session, currentMessage, currentMediaCards)
  }

  private async buildRequestWithOrchestrator(
    session: PrivateSession,
    currentMessage: string,
    currentMediaCards: CurrentPrivateMediaCardInput[],
  ): Promise<{
    promptRef: typeof PROMPT_TEMPLATE_REFS.agentPrivateChatReply
    variables: Record<string, string>
    renderDecision: RenderTierDecisionResult | null
    promptAudit: PromptComposeAudit | null
  }> {
    const history = await this.deps.channelRepo.listMessages(session.id, { limit: 20 })
    const historyText = history.items
      .map((item) => item.content)
      .filter((item) => item.trim().length > 0)
      .join(' ')
      .trim()
    const conversationText = historyText || currentMessage.trim()
    const topicHints = dedupeStrings([
      ...extractTopicHints(currentMessage),
      ...currentMediaCards.flatMap((item) => item.topic_hints),
    ]).slice(0, 10)
    const currentInputText = currentMessage.trim()

    const currentMediaContextSources: CurrentContextSource[] = currentMediaCards.map((item, index) => ({
      kind: 'private_media_card',
      text: item.text,
      priority: 'high' as const,
      source_id: item.source_id || `session:${session.id}:private_media_card:${index + 1}`,
    }))

    const currentContextSources: CurrentContextSource[] = [
      {
        kind: 'owner_latest_input',
        text: currentMessage,
        priority: 'critical' as const,
        source_id: `session:${session.id}:latest_owner_input`,
      },
      ...currentMediaContextSources,
      {
        kind: 'session_recent_turns',
        text: history.items
          .slice(-8)
          .map((item) => `${item.author_type === 'HUMAN' ? 'Owner' : 'Agent'}：${item.content}`)
          .join('\n'),
        priority: 'high' as const,
        source_id: `session:${session.id}:recent_turns`,
      },
      {
        kind: 'session_meta',
        text: `session_id=${session.id}\nmessage_count=${history.items.length}`,
        priority: 'medium' as const,
        source_id: session.id,
      },
    ].filter((source) => source.text.trim().length > 0)

    const composed = await this.deps.promptOrchestrator!.compose({
      agentId: session.agent_id,
      scene: 'private_chat',
      conversationText,
      topicHints,
      currentContextSources,
      requestEnvelope: {
        static_system_tokens: 180,
        route_wrapper_tokens: 90,
        tool_tokens: 0,
        current_user_input_tokens: Math.max(1, Math.ceil(Math.max(1, currentInputText.trim().length) / 4)),
        output_reserve: 0,
        model_capability_ref: null,
      },
      shortTermState: `session:${session.id}|messages:${history.items.length}`,
      shortTermStateUpdatedAt: session.started_at,
    })

    return {
      promptRef: PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
      variables: {
        persona_name: composed.persona.name,
        persona_style: composed.persona.style,
        persona_interests: composed.persona.interests.join('、'),
        persona_language: composed.persona.language,
        owner_display_name: 'Owner',
        hard_control_block: composed.blocks.hard_control_block ?? '',
        compact_control_block: composed.blocks.compact_control_block ?? '',
        current_context_block: composed.blocks.current_context_block ?? '',
        memory_block: composed.blocks.memory_block ?? '',
        soft_expression_block: composed.blocks.soft_expression_block ?? '',
      },
      renderDecision: composed.runtimeEnvelope?.renderTierDecision ?? null,
      promptAudit: composed.audit,
    }
  }

  private requirePrivateMediaMemoryService(): NonNullable<PrivateChannelServiceDeps['memoryService']> {
    if (!this.deps.memoryService) {
      throw new AppError(503, 'Private media memory pipeline is unavailable', 'PRIVATE_MEDIA_MEMORY_UNAVAILABLE')
    }
    return this.deps.memoryService
  }

  private async resolveVisibleRouting(agentId: string, requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier): Promise<{
    homeVoiceLineId: import('../../shared/agent-persona-catalog.js').VoiceLineId
    preferredModelId?: string
    requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier
  }> {
    if (this.deps.inferenceProfileService) {
      return this.deps.inferenceProfileService.resolveVisibleRoute({ agentId, requestedTier })
    }
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    const homeVoiceLineId = resolved.summary.home_voice_line_id
    return {
      homeVoiceLineId,
      preferredModelId: resolvePreferredVisibleModelId(agent?.model, homeVoiceLineId),
      requestedTier,
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

function requiresProactiveReceiveGate(session: PrivateSession): boolean {
  return session.initiator === 'AGENT'
}

function isPrismaForeignKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false
  }
  const maybeCode = (err as { code?: unknown }).code
  return typeof maybeCode === 'string' && maybeCode === 'P2003'
}

function normalizeAttachmentAssetIds(value: string[] | undefined): string[] {
  if (!value) return []
  const normalized = dedupeStrings(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )
  if (normalized.length > 1) {
    throw new ValidationError('Only one attachment is supported per private message')
  }
  return normalized
}

function extractTopicHints(text: string): string[] {
  return text
    .split(/[\s,，、；;：:。.!！?？]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
}

function buildPrivateCardTopicHints(card: {
  private_summary: {
    theme: string
    scene: string
    mood: string
    salient_entities: string[]
    discussion_points: string[]
  }
}): string[] {
  return dedupeStrings([
    card.private_summary.theme,
    card.private_summary.scene,
    card.private_summary.mood,
    ...card.private_summary.salient_entities,
    ...card.private_summary.discussion_points,
  ]).slice(0, 8)
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}
