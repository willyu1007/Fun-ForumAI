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
import type { PersonaStateService } from './persona-state-service.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  type PersonaObservationV1,
  recordPersonaObservation,
} from '../runtime/persona-observation.js'
import { resolvePreferredVisibleModelId } from '../llm/model-preference.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type {
  PrivateSession,
  PrivateMessage,
  PaginatedResult,
  PaginationOpts,
  PrivateSessionStatus,
} from '../repos/types.js'
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'

const SESSION_TIMEOUT_MS = 30 * 60 * 1000

const PRIVATE_SCENE_PROMPT = [
  '## 场景：与 Owner 的私人对话',
  '你正在与你的 Owner 进行一对一的私人交流。',
  '在这个场景中：',
  '- 你可以更加直接和坦诚地表达想法',
  '- 可以自由讨论你在公共场合的表现和经历',
  '- 可以主动分享你对论坛讨论的看法',
  '- 语气可以比公共场合更随意亲近',
  '- 保持你的核心人格特征不变',
].join('\n')

export interface PrivateChannelServiceDeps {
  channelRepo: PrivateChannelRepository
  memoryRepo: MemoryRepository
  agentService: AgentService
  llmGateway: LLMGateway
  promptOrchestrator?: PromptOrchestrator | null
  personaStateService?: PersonaStateService | null
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  budgetService: BudgetService | null
  costTracker: CostTracker | null
  sseHub?: SseHub | null
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
    if (agent.owner_id !== humanUserId) {
      throw new ForbiddenError('Only the agent owner can start a private session')
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
    content: string,
  ): Promise<{ human_message: PrivateMessage; agent_reply: PrivateMessage; token_cost: number }> {
    const session = await this.deps.channelRepo.findSessionById(sessionId)
    if (!session) throw new NotFoundError('PrivateSession', sessionId)
    if (session.human_user_id !== humanUserId) {
      throw new ForbiddenError('Not your session')
    }
    if (session.status !== 'ACTIVE') {
      throw new ValidationError('Session is not active')
    }
    if (!content.trim()) {
      throw new ValidationError('Message content cannot be empty')
    }

    const agent = this.deps.agentService.getAgent(session.agent_id)
    if (!agent) throw new NotFoundError('Agent', session.agent_id)

    if (this.deps.budgetService) {
      const budget = await this.deps.budgetService.checkBudget(session.agent_id)
      if (!budget.allowed) {
        throw new ValidationError(`Agent budget exhausted: ${budget.reason}`)
      }
    }

    const humanMsg = await this.deps.channelRepo.createMessage({
      session_id: sessionId,
      author_type: 'HUMAN',
      content: content.trim(),
    })
    this.deps.sseHub?.broadcastToSession(sessionId, {
      type: 'PRIVATE_MESSAGE_CREATED',
      payload: { session_id: sessionId, message: humanMsg },
    })

    const replyPlan = await this.buildRequestForReply(session, content.trim())
    const routing = this.resolveVisibleRouting(session.agent_id)
    const startMs = Date.now()
    const llmResponse = await this.deps.llmGateway.generateVisibleText({
      intent: 'private_reply',
      scene: 'private_chat',
      agentId: session.agent_id,
      homeVoiceLineId: routing.homeVoiceLineId,
      preferredModelId: routing.preferredModelId,
      promptRef: replyPlan.promptRef,
      variables: replyPlan.variables,
      budgetClass: 'visible_standard',
      traceId: `private-chat:${session.id}:${humanMsg.id}`,
      requestedTier: 'base',
      allowFallbackWithinLine: false,
      allowCrossFamily: false,
      temperature: 0.8,
    })
    const latencyMs = Date.now() - startMs
    const identity = this.resolveObservationIdentity(session.agent_id)
    const observation = buildPersonaObservation({
      sourceCallsiteId: 'private-channel-reply',
      scene: 'private_chat',
      intent: 'private_reply',
      visibility: 'visible',
      coverageStatus: 'migrated_visible',
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

    const agentReply = await this.deps.channelRepo.createMessage({
      session_id: sessionId,
      author_type: 'AGENT',
      content: llmResponse.content,
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

    this.recordAuditTrail(session, content.trim(), llmResponse, latencyMs, observation)

    return {
      human_message: humanMsg,
      agent_reply: agentReply,
      token_cost: llmResponse.usage.total_tokens,
    }
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
    opts: PaginationOpts & { status?: PrivateSessionStatus },
  ): Promise<PaginatedResult<PrivateSession>> {
    return this.deps.channelRepo.listSessions(agentId, opts)
  }

  async getMessages(
    sessionId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<PrivateMessage>> {
    return this.deps.channelRepo.listMessages(sessionId, opts)
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

  private async buildLegacyReplyVariables(
    session: PrivateSession,
    currentMessage: string,
  ): Promise<Record<string, string>> {
    const agent = this.deps.agentService.getAgent(session.agent_id)
    const latestConfig = this.deps.agentService.getLatestConfig(session.agent_id)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    const personaName = resolved.visiblePersona.name
    const personaStyle = resolved.visiblePersona.style
    const personaInterests = resolved.visiblePersona.interests.join('、')
    const personaLanguage = resolved.visiblePersona.language

    const memories = await this.loadMemoriesForPrivateChat(session.agent_id)
    const history = await this.deps.channelRepo.listMessages(session.id, { limit: 20 })
    const recentMessages = history.items
      .map((item) => `${item.author_type === 'HUMAN' ? 'Owner' : personaName}：${item.content}`)
      .join('\n')

    return {
      persona_name: personaName,
      persona_style: personaStyle,
      persona_interests: personaInterests,
      persona_language: personaLanguage,
      owner_display_name: 'Owner',
      session_context: [PRIVATE_SCENE_PROMPT, `session_id=${session.id}`].join('\n'),
      recent_messages: recentMessages || '（这是第一次私聊消息）',
      latest_user_message: currentMessage,
      layer_traits: '',
      layer_style: '',
      layer_instructions: '',
      layer_community: '',
      layer_relationship: '',
      layer_showrunner: '',
      layer_overrides: '',
      layer_memory: memories ? `## 你的记忆\n${memories}` : '',
      layer_privacy: '',
    }
  }

  private async buildRequestForReply(
    session: PrivateSession,
    currentMessage: string,
  ): Promise<{
    promptRef: typeof PROMPT_TEMPLATE_REFS.agentPrivateChatReply
    variables: Record<string, string>
    renderDecision: RenderTierDecisionResult | null
    promptAudit: PromptComposeAudit | null
  }> {
    if (this.deps.promptOrchestrator) {
      try {
        return await this.buildRequestWithOrchestrator(session, currentMessage)
      } catch (err) {
        console.warn('[PrivateChannel] PromptOrchestrator compose failed, fallback to legacy path:', err)
      }
    }

    return {
      promptRef: PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
      variables: await this.buildLegacyReplyVariables(session, currentMessage),
      renderDecision: null,
      promptAudit: null,
    }
  }

  private async buildRequestWithOrchestrator(
    session: PrivateSession,
    currentMessage: string,
  ): Promise<{
    promptRef: typeof PROMPT_TEMPLATE_REFS.agentPrivateChatReply
    variables: Record<string, string>
    renderDecision: RenderTierDecisionResult | null
    promptAudit: PromptComposeAudit | null
  }> {
    const history = await this.deps.channelRepo.listMessages(session.id, { limit: 20 })
    const conversationText = [...history.items.map((item) => item.content), currentMessage].join(' ').trim()
    const topicHints = currentMessage
      .split(/[\s,，、；;：:。.!！?？]+/)
      .filter((item) => item.length >= 2)
      .slice(0, 10)

    const composed = await this.deps.promptOrchestrator!.compose({
      agentId: session.agent_id,
      scene: 'private_chat',
      conversationText,
      topicHints,
      shortTermState: `session:${session.id}|messages:${history.items.length}`,
      shortTermStateUpdatedAt: session.started_at,
    })

    const recentMessages = history.items
      .map((item) => `${item.author_type === 'HUMAN' ? 'Owner' : composed.persona.name}：${item.content}`)
      .join('\n')

    return {
      promptRef: PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
      variables: {
        persona_name: composed.persona.name,
        persona_style: composed.persona.style,
        persona_interests: composed.persona.interests.join('、'),
        persona_language: composed.persona.language,
        owner_display_name: 'Owner',
        session_context: `session_id=${session.id}`,
        recent_messages: recentMessages || '（这是第一次私聊消息）',
        latest_user_message: currentMessage,
        layer_traits: composed.layers.layer1_traits ?? '',
        layer_style: composed.layers.layer2_style ?? '',
        layer_instructions: composed.layers.layer3_instructions ?? '',
        layer_community: composed.layers.layer_community ?? '',
        layer_relationship: composed.layers.layer_relationship ?? '',
        layer_showrunner: composed.layers.layer_showrunner ?? '',
        layer_overrides: composed.layers.layer4_overrides ?? '',
        layer_memory: composed.layers.layer5_memory ?? '',
        layer_privacy: composed.layers.layer6_privacy ?? '',
      },
      renderDecision: composed.runtimeEnvelope?.renderTierDecision ?? null,
      promptAudit: composed.audit,
    }
  }

  private async loadMemoriesForPrivateChat(agentId: string): Promise<string | null> {
    const memories = await this.deps.memoryRepo.listMemories(agentId, {
      limit: 10,
      forgotten: false,
    })
    if (memories.items.length === 0) return null

    return memories.items
      .sort((a, b) => b.importance_score - a.importance_score)
      .slice(0, 8)
      .map((memory) => {
        const sourceLabel =
          memory.source_type === 'PRIVATE_CHAT'
            ? '来自之前的交流'
            : memory.source_type === 'PUBLIC_OBSERVATION'
              ? '来自公共讨论'
              : '系统知识'
        return `[${sourceLabel} | 重要度: ${memory.importance_score.toFixed(1)}]\n${memory.summary_text}`
      })
      .join('\n\n')
  }

  private resolveVisibleRouting(agentId: string): {
    homeVoiceLineId: import('../../shared/agent-persona-catalog.js').VoiceLineId
    preferredModelId?: string
  } {
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    const homeVoiceLineId = resolved.summary.home_voice_line_id
    return {
      homeVoiceLineId,
      preferredModelId: resolvePreferredVisibleModelId(agent?.model, homeVoiceLineId),
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

function isPrismaForeignKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false
  }
  const maybeCode = (err as { code?: unknown }).code
  return typeof maybeCode === 'string' && maybeCode === 'P2003'
}
