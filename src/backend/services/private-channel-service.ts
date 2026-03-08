import type { LlmClient } from '../llm/llm-client.js'
import type { LlmMessage } from '../llm/types.js'
import type { PromptEngine } from '../llm/prompt-engine.js'
import type { AgentService } from './agent-service.js'
import type { BudgetService } from './budget-service.js'
import type { CostTracker } from './cost-tracker.js'
import type { PrivateChannelRepository } from '../repos/private-channel-repository.js'
import type { MemoryRepository } from '../repos/memory-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { SseHub } from '../sse/hub.js'
import type { PromptOrchestrator } from '../runtime/prompt-orchestrator.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type {
  PrivateSession,
  PrivateMessage,
  PaginatedResult,
  PaginationOpts,
  PrivateSessionStatus,
} from '../repos/types.js'
import { AppError, NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

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
  llmClient: LlmClient
  promptEngine?: PromptEngine | null
  promptOrchestrator?: PromptOrchestrator | null
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  budgetService: BudgetService | null
  costTracker: CostTracker | null
  sseHub?: SseHub | null
}

export class PrivateChannelService {
  constructor(private readonly deps: PrivateChannelServiceDeps) {}

  bindPromptOrchestrator(promptEngine: PromptEngine, promptOrchestrator: PromptOrchestrator): void {
    ;(this.deps as { promptEngine?: PromptEngine | null }).promptEngine = promptEngine
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
        throw new AppError(
          409,
          'Session dependency not ready; retry shortly',
          'DEPENDENCY_NOT_READY',
        )
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

    const updated = await this.deps.channelRepo.updateSessionStatus(
      sessionId,
      'ENDED',
      new Date(),
    )
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

    const messages = await this.buildMessagesForReply(session, content.trim())
    const startMs = Date.now()
    const llmResponse = await this.deps.llmClient.chat({
      messages,
      model: agent.model,
      temperature: 0.8,
    })
    const latencyMs = Date.now() - startMs

    const agentReply = await this.deps.channelRepo.createMessage({
      session_id: sessionId,
      author_type: 'AGENT',
      content: llmResponse.content,
    })
    this.deps.sseHub?.broadcastToSession(sessionId, {
      type: 'PRIVATE_MESSAGE_CREATED',
      payload: { session_id: sessionId, message: agentReply },
    })

    this.recordAuditTrail(session, content.trim(), llmResponse, latencyMs)

    return {
      human_message: humanMsg,
      agent_reply: agentReply,
      token_cost: llmResponse.usage.total_tokens,
    }
  }

  private recordAuditTrail(
    session: PrivateSession,
    inputContent: string,
    llmResponse: { content: string; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } },
    latencyMs: number,
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
        output_json: { reply_len: llmResponse.content.length, session_id: session.id },
        token_cost: llmResponse.usage.total_tokens,
        latency_ms: latencyMs,
      })
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

  async checkTimeouts(): Promise<number> {
    const timedOut = await this.deps.channelRepo.findTimedOutSessions(SESSION_TIMEOUT_MS)
    let count = 0
    for (const session of timedOut) {
      await this.deps.channelRepo.updateSessionStatus(session.id, 'ENDED', new Date())
      count++
    }
    return count
  }

  async getMessageCount(sessionId: string): Promise<number> {
    return this.deps.channelRepo.countMessages(sessionId)
  }

  private async buildChatMessages(
    session: PrivateSession,
    currentMessage: string,
  ): Promise<LlmMessage[]> {
    const agent = this.deps.agentService.getAgent(session.agent_id)
    const latestConfig = this.deps.agentService.getLatestConfig(session.agent_id)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    const personaName = resolved.visiblePersona.name
    const personaStyle = resolved.visiblePersona.style
    const personaInterests = resolved.visiblePersona.interests.join('、')

    const memories = await this.loadMemoriesForPrivateChat(session.agent_id)

    const systemParts = [
      `你是 ${personaName}，一个 AI 智能体。`,
      `你的风格：${personaStyle}`,
      `你的兴趣领域：${personaInterests}`,
      '',
      PRIVATE_SCENE_PROMPT,
    ]

    if (memories) {
      systemParts.push('', '## 你的记忆', memories)
    }

    const history = await this.deps.channelRepo.listMessages(session.id, { limit: 20 })
    const chatMessages: LlmMessage[] = [
      { role: 'system', content: systemParts.join('\n') },
    ]

    for (const msg of history.items) {
      chatMessages.push({
        role: msg.author_type === 'HUMAN' ? 'user' : 'assistant',
        content: msg.content,
      })
    }

    chatMessages.push({ role: 'user', content: currentMessage })
    return chatMessages
  }

  private async buildMessagesForReply(
    session: PrivateSession,
    currentMessage: string,
  ): Promise<LlmMessage[]> {
    if (
      this.deps.promptEngine &&
      this.deps.promptOrchestrator?.isSceneEnabled('private_chat')
    ) {
      try {
        return await this.buildChatMessagesWithOrchestrator(session, currentMessage)
      } catch (err) {
        console.warn('[PrivateChannel] PromptOrchestrator compose failed, fallback to legacy path:', err)
      }
    }
    return this.buildChatMessages(session, currentMessage)
  }

  private async buildChatMessagesWithOrchestrator(
    session: PrivateSession,
    currentMessage: string,
  ): Promise<LlmMessage[]> {
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

    const variables: Record<string, string> = {
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
    }

    return this.deps.promptEngine!.render(PROMPT_TEMPLATE_REFS.agentPrivateChatReply, variables)
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
      .map((m) => {
        const sourceLabel =
          m.source_type === 'PRIVATE_CHAT' ? '来自之前的交流'
          : m.source_type === 'PUBLIC_OBSERVATION' ? '来自公共讨论'
          : '系统知识'
        return `[${sourceLabel} | 重要度: ${m.importance_score.toFixed(1)}]\n${m.summary_text}`
      })
      .join('\n\n')
  }
}

function isPrismaForeignKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false
  }
  const maybeCode = (err as { code?: unknown }).code
  return typeof maybeCode === 'string' && maybeCode === 'P2003'
}
