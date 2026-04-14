import type { LLMGateway } from '../llm/llm-gateway.js'
import type { LLMGatewayResponse } from '../llm/gateway-contract.js'
import type { PromptEngine } from '../llm/prompt-engine.js'
import type { AgentService } from './agent-service.js'
import type { BudgetService } from './budget-service.js'
import type { CostTracker } from './cost-tracker.js'
import type {
  PrivateChannelRepository,
  UpdatePrivateMessagePatch,
} from '../repos/private-channel-repository.js'
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
import {
  formatChatReplyForReadability,
  sanitizeChatOutput,
} from '../runtime/chat-output-sanitizer.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import { buildPromptBudgetSummary } from '../runtime/prompt-budget-summary.js'
import type {
  PrivateSession,
  PrivateMessage,
  PrivateMessageAttachment,
  PaginatedResult,
  PaginationOpts,
  PrivateMessageModerationMetadata,
  PrivateSessionStatus,
  SendPrivateMessageInput,
} from '../repos/types.js'
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { buildAgentSystemDisplayFields } from '../launch/system-roster.js'
import type { PolicyGatewayService } from './policy-gateway-service.js'
import type { IdentityGateService } from './identity-gate-service.js'
import { isDeletedAgent } from '../lib/agent-lifecycle.js'

export const PRIVATE_SESSION_TIMEOUT_MS = 30 * 60 * 1000
export const PRIVATE_REPLY_RECOVERY_STALE_MS = 2 * 60 * 1000
export const PRIVATE_REPLY_RECOVERY_BATCH_LIMIT = 25
const PRIVATE_PREVIEW_MESSAGE_LOOKBACK = 5

interface CurrentPrivateMediaCardInput {
  source_id: string
  text: string
  topic_hints: string[]
}

interface PreparedPrivateReplyContext {
  enrichedHumanMessage: PrivateMessage
  auditInputText: string
  replyPlan: {
    promptRef: typeof PROMPT_TEMPLATE_REFS.agentPrivateChatReply
    variables: Record<string, string>
    renderDecision: RenderTierDecisionResult | null
    promptAudit: PromptComposeAudit | null
  }
  routing: {
    homeVoiceLineId: import('../../shared/agent-persona-catalog.js').VoiceLineId
    requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier
  }
}

interface GeneratedPrivateReplyResult {
  llmResponse: LLMGatewayResponse
  latencyMs: number
  observation: PersonaObservationV1
  finalContent: string
  deliveryStatus: PrivateMessage['delivery_status']
  moderationMetadata: PrivateMessageModerationMetadata | null
}

interface CompletedPrivateReplyResult {
  agentReply: PrivateMessage
  tokenCost: number
}

interface PendingPrivateReplyTaskInput {
  session: PrivateSession
  humanUserId: string
  humanMessage: PrivateMessage
  effectiveHumanContent: string
  attachmentAssetIds: string[]
  humanInput: string
  pendingReplyId: string
  traceId: string
  preparedContext?: PreparedPrivateReplyContext
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
  onProactiveSessionSuccess?: (input: {
    agent_id: string
    session_id: string
    human_message_id?: string | null
    opening_message_id?: string | null
  }) => Promise<void> | void
}

export interface AgentLastPrivatePreview {
  session_id: string
  message_id: string | null
  kind: 'text' | 'image' | 'empty'
  text: string
  created_at: Date
}

function normalizeVisibleReplyText(text: string, errorCode: string): string {
  const sanitized = sanitizeChatOutput(text)
  const formatted = formatChatReplyForReadability(sanitized.text)
  if (!formatted || sanitized.looks_meta) {
    throw new AppError(502, 'Visible reply normalization failed', errorCode)
  }
  return formatted
}

export class PrivateChannelService {
  private readonly pendingReplyTasks = new Map<string, Promise<CompletedPrivateReplyResult>>()

  constructor(private readonly deps: PrivateChannelServiceDeps) {}

  setProactiveSessionSuccessHook(
    hook: (input: {
      agent_id: string
      session_id: string
      human_message_id?: string | null
      opening_message_id?: string | null
    }) => Promise<void> | void,
  ): void {
    this.deps.onProactiveSessionSuccess = hook
  }

  bindPromptOrchestrator(promptEngine: PromptEngine, promptOrchestrator: PromptOrchestrator): void {
    void promptEngine
    ;(this.deps as { promptOrchestrator?: PromptOrchestrator | null }).promptOrchestrator = promptOrchestrator
  }

  async createSession(agentId: string, humanUserId: string): Promise<PrivateSession> {
    const agent = this.deps.agentService.getAgent(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    if (isDeletedAgent(agent)) {
      throw new ForbiddenError('This agent has left and can no longer accept private sessions')
    }
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
    const pendingReply = await this.findPendingAgentReply(sessionId)
    if (pendingReply) {
      throw new AppError(409, 'Previous private reply is still generating', 'PRIVATE_REPLY_IN_PROGRESS')
    }
    if (attachmentAssetIds.length > 0) {
      this.requirePrivateMediaMemoryService()
    }
    if (this.deps.identityGateService) {
      await this.deps.identityGateService.assertVerified(humanUserId, 'private_message_send')
    }

    const proactiveReplyContext = session.initiator === 'AGENT'
      ? await this.inspectProactiveReplyContext(session.id)
      : null

    const agent = this.deps.agentService.getAgent(session.agent_id)
    if (!agent) throw new NotFoundError('Agent', session.agent_id)
    if (isDeletedAgent(agent)) {
      throw new ForbiddenError('This agent has left and can no longer accept private messages')
    }

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
        agent_reply: { ...refusal, attachments: [], reply_to_message_id: humanMsg.id, runtime_status: 'READY', runtime_error_code: null },
        token_cost: 0,
      }
    }

    try {
      if (
        proactiveReplyContext
        && !proactiveReplyContext.hadHumanReplyBefore
      ) {
        await this.notifyProactiveSessionSuccess({
          agent_id: session.agent_id,
          session_id: session.id,
          human_message_id: humanMsg.id,
          opening_message_id: proactiveReplyContext.openingMessageId,
        })
      }

      const prepared = attachmentAssetIds.length > 0
        ? await this.preparePrivateReplyContext({
            session,
            humanUserId,
            humanMessage: humanMsg,
            effectiveHumanContent,
            attachmentAssetIds,
          })
        : null
      const agentReply = await this.deps.channelRepo.createMessage({
        session_id: sessionId,
        author_type: 'AGENT',
        reply_to_message_id: humanMsg.id,
        runtime_status: 'THINKING',
        content: '',
      })
      const outboundHumanMessage = prepared?.enrichedHumanMessage ?? { ...humanMsg, attachments: [] }
      this.deps.sseHub?.broadcastToSession(sessionId, {
        type: 'PRIVATE_MESSAGE_CREATED',
        payload: { session_id: sessionId, message: outboundHumanMessage },
      })
      this.deps.sseHub?.broadcastToSession(sessionId, {
        type: 'PRIVATE_MESSAGE_CREATED',
        payload: { session_id: sessionId, message: agentReply },
      })

      const pendingReplyTask = this.trackPendingReplyTask(
        agentReply.id,
        this.finishPendingReply({
          session,
          humanUserId,
          humanMessage: humanMsg,
          effectiveHumanContent,
          attachmentAssetIds,
          humanInput: normalizedContent || prepared?.auditInputText || effectiveHumanContent,
          pendingReplyId: agentReply.id,
          traceId: `private-chat:${session.id}:${humanMsg.id}`,
          preparedContext: prepared ?? undefined,
        }),
      )
      void pendingReplyTask.catch(() => undefined)

      return {
        human_message: outboundHumanMessage,
        agent_reply: { ...agentReply, attachments: [] },
        token_cost: 0,
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

  async endAllActiveSessionsForAgent(agentId: string): Promise<number> {
    let ended = 0
    let cursor: string | undefined

    do {
      const sessions = await this.deps.channelRepo.listSessions(agentId, {
        cursor,
        limit: 200,
        status: 'ACTIVE',
      })

      for (const session of sessions.items) {
        const updated = await this.deps.channelRepo.updateSessionStatus(session.id, 'ENDED', new Date())
        if (!updated) continue
        ended += 1
        this.deps.sseHub?.broadcastToSession(session.id, {
          type: 'PRIVATE_SESSION_ENDED',
          payload: { session_id: session.id, session: updated },
        })
      }

      cursor = sessions.next_cursor ?? undefined
    }
    while (cursor)

    return ended
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

  private trackPendingReplyTask(
    pendingReplyId: string,
    task: Promise<CompletedPrivateReplyResult>,
  ): Promise<CompletedPrivateReplyResult> {
    const trackedTask = task.finally(() => {
      this.pendingReplyTasks.delete(pendingReplyId)
    })
    this.pendingReplyTasks.set(pendingReplyId, trackedTask)
    return trackedTask
  }

  private async waitForPendingReply(
    pendingReplyId: string,
  ): Promise<CompletedPrivateReplyResult | null> {
    const task = this.pendingReplyTasks.get(pendingReplyId)
    if (!task) {
      return null
    }
    return task
  }

  async runCloseoutVisibleReply(input: {
    agentId: string
    humanUserId: string
    content: string
  }): Promise<{
    session: PrivateSession
    human_message: PrivateMessage
    agent_reply: PrivateMessage
    token_cost: number
  }> {
    const session = await this.createSession(input.agentId, input.humanUserId)
    const result = await this.sendMessage(session.id, input.humanUserId, {
      content: input.content,
    })
    if (result.agent_reply.runtime_status !== 'THINKING') {
      return {
        session,
        ...result,
      }
    }
    const completed = await this.waitForPendingReply(result.agent_reply.id)
    if (!completed) {
      throw new AppError(
        500,
        'Private closeout reply tracking was not registered',
        'PRIVATE_CLOSEOUT_REPLY_TRACKING_MISSING',
      )
    }
    return {
      session,
      human_message: result.human_message,
      agent_reply: completed.agentReply,
      token_cost: completed.tokenCost,
    }
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

  private async preparePrivateReplyContext(input: {
    session: PrivateSession
    humanUserId: string
    humanMessage: PrivateMessage
    effectiveHumanContent: string
    attachmentAssetIds: string[]
  }): Promise<PreparedPrivateReplyContext> {
    const attachmentContext = await this.prepareMessageAttachments({
      session: input.session,
      humanUserId: input.humanUserId,
      messageId: input.humanMessage.id,
      attachmentAssetIds: input.attachmentAssetIds,
    })
    const enrichedHumanMessage: PrivateMessage = {
      ...input.humanMessage,
      attachments: attachmentContext.attachments,
    }
    const replyPlan = await this.buildRequestForReply(
      input.session,
      input.effectiveHumanContent,
      attachmentContext.current_media_cards,
    )
    const routing = await this.resolveVisibleRouting(
      input.session.agent_id,
      replyPlan.renderDecision?.requestedTier ?? 'base',
    )
    return {
      enrichedHumanMessage,
      auditInputText: attachmentContext.audit_input_text,
      replyPlan,
      routing,
    }
  }

  private async finishPendingReply(input: PendingPrivateReplyTaskInput): Promise<CompletedPrivateReplyResult> {
    try {
      const prepared = input.preparedContext ?? await this.preparePrivateReplyContext({
        session: input.session,
        humanUserId: input.humanUserId,
        humanMessage: input.humanMessage,
        effectiveHumanContent: input.effectiveHumanContent,
        attachmentAssetIds: input.attachmentAssetIds,
      })
      const generated = await this.generatePrivateReply({
        session: input.session,
        humanUserId: input.humanUserId,
        traceId: input.traceId,
        replyPlan: prepared.replyPlan,
        routing: prepared.routing,
      })
      const agentReply = await this.updatePrivateMessage(input.pendingReplyId, {
        content: generated.finalContent,
        delivery_status: generated.deliveryStatus,
        moderation_metadata: generated.moderationMetadata,
        runtime_status: 'READY',
        runtime_error_code: null,
      })
      if (!agentReply) {
        console.error('[PrivateChannel] pending reply update failed:', { messageId: input.pendingReplyId })
        throw new AppError(500, 'Pending private reply update failed', 'PRIVATE_REPLY_UPDATE_FAILED')
      }
      this.deps.sseHub?.broadcastToSession(input.session.id, {
        type: 'PRIVATE_MESSAGE_UPDATED',
        payload: { session_id: input.session.id, message: agentReply },
      })

      if (prepared.replyPlan.renderDecision && this.deps.personaStateService) {
        await this.deps.personaStateService.recordVisibleRender({
          agentId: input.session.agent_id,
          scene: 'private_chat',
          renderDecision: prepared.replyPlan.renderDecision,
          outputText: agentReply.content,
        }).catch((err) => {
          console.error('[PrivateChannel] persona runtime render record failed:', err)
        })
      }

      this.recordAuditTrail(
        input.session,
        input.humanInput,
        generated.llmResponse,
        generated.latencyMs,
        generated.observation,
      )
      return {
        agentReply,
        tokenCost: generated.llmResponse.usage.total_tokens,
      }
    } catch (err) {
      const failedReply = await this.updatePrivateMessage(input.pendingReplyId, {
        runtime_status: 'FAILED',
        runtime_error_code: resolvePrivateReplyErrorCode(err),
        moderation_metadata: {
          failure_message: err instanceof Error ? err.message : 'Private reply generation failed',
        },
      })
      if (failedReply) {
        this.deps.sseHub?.broadcastToSession(input.session.id, {
          type: 'PRIVATE_MESSAGE_UPDATED',
          payload: { session_id: input.session.id, message: failedReply },
        })
      }
      console.error('[PrivateChannel] pending reply failed:', err)
      throw err
    }
  }

  private async generatePrivateReply(input: {
    session: PrivateSession
    humanUserId: string
    traceId: string
    replyPlan: PreparedPrivateReplyContext['replyPlan']
    routing: PreparedPrivateReplyContext['routing']
  }): Promise<GeneratedPrivateReplyResult> {
    const startMs = Date.now()
    const llmResponse = await this.deps.llmGateway.generateVisibleText({
      intent: 'private_reply',
      scene: 'private_chat',
      modality: 'text',
      responseMode: 'text',
      agentId: input.session.agent_id,
      homeVoiceLineId: input.routing.homeVoiceLineId,
      promptRef: input.replyPlan.promptRef,
      variables: input.replyPlan.variables,
      budgetClass: 'visible_standard',
      traceId: input.traceId,
      promptBudgetSummary: buildPromptBudgetSummary('private_chat', input.replyPlan.promptRef, input.replyPlan.promptAudit),
      requestedTier: input.routing.requestedTier,
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    })
    const latencyMs = Date.now() - startMs
    const normalizedContent = normalizeVisibleReplyText(
      llmResponse.content,
      'PRIVATE_REPLY_INVALID_OUTPUT',
    )
    const identity = this.resolveObservationIdentity(input.session.agent_id)
    const observation = buildPersonaObservation({
      sourceCallsiteId: 'private-channel-reply',
      scene: 'private_chat',
      intent: 'private_reply',
      visibility: 'visible',
      coverageStatus: 'visible_complete',
      personaSeedCode: identity?.persona_seed_code,
      homeVoiceLineId: identity?.home_voice_line_id,
      promptRef: input.replyPlan.promptRef,
      requestedTier: llmResponse.renderDecision.tier,
      resolvedTier: llmResponse.renderDecision.tier,
      renderDecision: llmResponse.renderDecision,
      usage: llmResponse.usage,
      latencyMs,
      parseSuccess: true,
      promptAudit: input.replyPlan.promptAudit,
      llmProviderId: llmResponse.renderDecision.providerId,
      llmModelId: llmResponse.renderDecision.modelId,
    })

    const outboundPolicy = this.deps.policyGatewayService
      ? await this.deps.policyGatewayService.evaluate({
          channel: 'private_outbound',
          text: normalizedContent,
          author_agent_id: input.session.agent_id,
          user_id: input.humanUserId,
          target_type: 'private_session',
          target_id: input.session.id,
          session_id: input.session.id,
          scene: 'private_chat',
        })
      : null

    return {
      llmResponse,
      latencyMs,
      observation,
      finalContent: outboundPolicy?.final_text
        ? normalizeVisibleReplyText(
            outboundPolicy.final_text,
            'PRIVATE_REPLY_INVALID_OUTPUT',
          )
        : normalizedContent,
      deliveryStatus: outboundPolicy?.action === 'block'
        ? 'REFUSED'
        : outboundPolicy?.delivery_status ?? 'DELIVERED',
      moderationMetadata: outboundPolicy?.metadata ?? null,
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

  private async inspectProactiveReplyContext(sessionId: string): Promise<{
    hadHumanReplyBefore: boolean
    openingMessageId: string | null
  }> {
    const history = await this.deps.channelRepo.listMessages(sessionId, { limit: 500 })
    return {
      hadHumanReplyBefore: history.items.some((item) => item.author_type === 'HUMAN'),
      openingMessageId: history.items.find((item) => item.author_type === 'AGENT')?.id ?? null,
    }
  }

  private async notifyProactiveSessionSuccess(input: {
    agent_id: string
    session_id: string
    human_message_id?: string | null
    opening_message_id?: string | null
  }): Promise<void> {
    try {
      await this.deps.onProactiveSessionSuccess?.(input)
    } catch (err) {
      console.error('[PrivateChannel] proactive session success hook failed:', err)
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

  private async buildPreviewsForSessions(
    sessions: PrivateSession[],
  ): Promise<Map<string, AgentLastPrivatePreview>> {
    const previewsBySessionId = new Map<string, AgentLastPrivatePreview>()
    if (sessions.length === 0) return previewsBySessionId

    const messagesBySessionId = await this.deps.channelRepo.findLatestMessagesBySessionIds(
      sessions.map((session) => session.id),
      PRIVATE_PREVIEW_MESSAGE_LOOKBACK,
    )
    const hydratedMessages = await this.hydrateMessageAttachments(
      [...messagesBySessionId.values()].flat(),
    )
    const hydratedByMessageId = new Map(hydratedMessages.map((message) => [message.id, message]))

    for (const session of sessions) {
      const recentMessages = (messagesBySessionId.get(session.id) ?? []).map((message) =>
        hydratedByMessageId.get(message.id) ?? message)
      previewsBySessionId.set(session.id, buildLatestPrivatePreview(session, recentMessages))
    }

    return previewsBySessionId
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

  async getLatestPreviews(
    agentIds: string[],
    humanUserId: string,
  ): Promise<Map<string, AgentLastPrivatePreview | null>> {
    const uniqueAgentIds = [...new Set(agentIds)]
    const previewsByAgentId = new Map<string, AgentLastPrivatePreview | null>()
    for (const agentId of uniqueAgentIds) previewsByAgentId.set(agentId, null)
    if (uniqueAgentIds.length === 0) return previewsByAgentId

    const latestSessionsByAgentId = await this.deps.channelRepo.findLatestSessionsByAgentIds(
      uniqueAgentIds,
      humanUserId,
    )
    if (latestSessionsByAgentId.size === 0) return previewsByAgentId

    let visibleSessions = [...latestSessionsByAgentId.values()]
    if (
      this.deps.identityGateService
      && visibleSessions.some((session) => requiresProactiveReceiveGate(session))
    ) {
      try {
        await this.deps.identityGateService.assertVerified(humanUserId, 'proactive_receive')
      } catch {
        visibleSessions = visibleSessions.filter((session) => !requiresProactiveReceiveGate(session))
      }
    }

    const previewsBySessionId = await this.buildPreviewsForSessions(visibleSessions)
    for (const session of visibleSessions) {
      previewsByAgentId.set(session.agent_id, previewsBySessionId.get(session.id) ?? null)
    }

    return previewsByAgentId
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
    const timedOut = await this.deps.channelRepo.findTimedOutSessions(PRIVATE_SESSION_TIMEOUT_MS)
    const ended: PrivateSession[] = []
    for (const session of timedOut) {
      const updated = await this.deps.channelRepo.updateSessionStatus(session.id, 'ENDED', new Date())
      if (updated) {
        ended.push(updated)
      }
    }
    return ended
  }

  async recoverStalePendingReplies(input?: {
    staleMs?: number
    limit?: number
  }): Promise<PrivateMessage[]> {
    const staleMs = input?.staleMs ?? PRIVATE_REPLY_RECOVERY_STALE_MS
    const limit = input?.limit ?? PRIVATE_REPLY_RECOVERY_BATCH_LIMIT
    const cutoff = new Date(Date.now() - staleMs)
    const staleReplies = await this.deps.channelRepo.listPendingAgentRepliesOlderThan(cutoff, limit)
    const recovered: PrivateMessage[] = []

    for (const staleReply of staleReplies) {
      if (this.pendingReplyTasks.has(staleReply.id)) {
        continue
      }
      const recoveredReply = await this.updatePrivateMessage(staleReply.id, {
        runtime_status: 'FAILED',
        runtime_error_code: 'PRIVATE_REPLY_RECOVERY_TIMEOUT',
        moderation_metadata: {
          failure_message: 'Private reply did not complete before the recovery timeout expired.',
        },
      })
      if (!recoveredReply) {
        continue
      }
      this.deps.sseHub?.broadcastToSession(recoveredReply.session_id, {
        type: 'PRIVATE_MESSAGE_UPDATED',
        payload: { session_id: recoveredReply.session_id, message: recoveredReply },
      })
      recovered.push(recoveredReply)
    }

    return recovered
  }

  async getMessageCount(sessionId: string): Promise<number> {
    return this.deps.channelRepo.countMessages(sessionId)
  }

  async createCloseoutFixtureSession(input: {
    agentId: string
    humanUserId: string
    startedAt: Date
    messages: Array<{
      authorType: 'HUMAN' | 'AGENT'
      content: string
      createdAt: Date
    }>
    triggerType?: string | null
    triggerRef?: string | null
  }): Promise<{ session: PrivateSession; messages: PrivateMessage[] }> {
    const session = await this.deps.channelRepo.createSession({
      agent_id: input.agentId,
      human_user_id: input.humanUserId,
      initiator: 'HUMAN',
      trigger_type: input.triggerType ?? 'RUNTIME_CLOSEOUT_FIXTURE',
      trigger_ref: input.triggerRef ?? null,
      started_at: input.startedAt,
    })
    const messages: PrivateMessage[] = []
    for (const message of input.messages) {
      messages.push(await this.deps.channelRepo.createMessage({
        session_id: session.id,
        author_type: message.authorType,
        content: message.content,
        created_at: message.createdAt,
      }))
    }
    return { session, messages }
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

  private async resolveVisibleRouting(agentId: string, _requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier): Promise<{
    homeVoiceLineId: import('../../shared/agent-persona-catalog.js').VoiceLineId
    requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier
  }> {
    if (this.deps.inferenceProfileService) {
      return this.deps.inferenceProfileService.resolveVisibleRoute({ agentId, requestedTier: 'base' })
    }
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    const homeVoiceLineId = resolved.summary.home_voice_line_id
    return {
      homeVoiceLineId,
      requestedTier: 'base',
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

  private async updatePrivateMessage(
    messageId: string,
    patch: UpdatePrivateMessagePatch,
  ): Promise<PrivateMessage | null> {
    const channelRepo = this.deps.channelRepo as PrivateChannelRepository & {
      updateMessage?: PrivateChannelRepository['updateMessage']
    }
    if (typeof channelRepo.updateMessage !== 'function') {
      return null
    }
    return channelRepo.updateMessage(messageId, patch)
  }

  private async findPendingAgentReply(sessionId: string): Promise<PrivateMessage | null> {
    const channelRepo = this.deps.channelRepo as PrivateChannelRepository & {
      findPendingAgentReply?: PrivateChannelRepository['findPendingAgentReply']
    }
    if (typeof channelRepo.findPendingAgentReply !== 'function') {
      return null
    }
    return channelRepo.findPendingAgentReply(sessionId)
  }
}

function buildLatestPrivatePreview(
  session: PrivateSession,
  recentMessages: PrivateMessage[],
): AgentLastPrivatePreview {
  const latestDisplayableMessage = recentMessages.find((message) => isDisplayablePrivatePreviewMessage(message))
  if (latestDisplayableMessage) {
    return buildPrivatePreviewFromMessage(session.id, latestDisplayableMessage)
  }

  const latestMessage = recentMessages[0] ?? null
  return {
    session_id: session.id,
    message_id: latestMessage?.id ?? null,
    kind: 'empty',
    text: '暂无对话',
    created_at: latestMessage?.created_at ?? session.started_at,
  }
}

function buildPrivatePreviewFromMessage(
  sessionId: string,
  message: PrivateMessage,
): AgentLastPrivatePreview {
  const text = message.content.trim()
  if (text.length > 0) {
    return {
      session_id: sessionId,
      message_id: message.id,
      kind: 'text',
      text,
      created_at: message.created_at,
    }
  }
  return {
    session_id: sessionId,
    message_id: message.id,
    kind: 'image',
    text: '[图片]',
    created_at: message.created_at,
  }
}

function isDisplayablePrivatePreviewMessage(message: PrivateMessage): boolean {
  return message.content.trim().length > 0 || (message.attachments ?? []).length > 0
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

function resolvePrivateReplyErrorCode(error: unknown): string {
  if (
    error
    && typeof error === 'object'
    && 'code' in error
    && typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code
  }
  return 'PRIVATE_REPLY_FAILED'
}
