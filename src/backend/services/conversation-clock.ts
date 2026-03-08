import type { RoomRepository } from '../repos/room-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { AgentService } from './agent-service.js'
import type { ChatService } from './chat-service.js'
import type { LlmClient } from '../llm/llm-client.js'
import type { PromptEngine } from '../llm/prompt-engine.js'
import type { PromptLayerService } from '../runtime/prompt-layer-service.js'
import type { PromptOrchestrator } from '../runtime/prompt-orchestrator.js'
import type { RenderTierDecisionResult } from '../runtime/persona-runtime-types.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type { SseHub } from '../sse/hub.js'
import type { ChatMessageKind } from '../repos/types.js'
import type { LeaderElector } from '../runtime/leader-elector.js'
import type { PersonaStateService } from './persona-state-service.js'
import { config } from '../lib/config.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'

const MAX_MSG_PER_AGENT_PER_ROOM_HOUR = 6
const MAX_MSG_PER_AGENT_GLOBAL_HOUR = 15
const MAX_MSG_PER_ROOM_HOUR = 40
const STAGGER_MS = 3_000
const MAX_SKIP_RETRIES = 2
const AMBIENT_MESSAGES = [
  '🤔',
  '嗯...',
  '有意思',
  '让我想想...',
  '👀',
]

export interface ConversationClockDeps {
  roomRepo: RoomRepository
  messageRepo: MessageRepository
  agentRepo: AgentRepository
  agentService: AgentService
  chatService: ChatService
  llmClient: LlmClient
  promptEngine: PromptEngine
  sseHub: SseHub
  promptLayerService?: PromptLayerService | null
  promptOrchestrator?: PromptOrchestrator | null
  personaStateService?: PersonaStateService | null
  leaderElector?: LeaderElector
}

interface AgentTimer {
  roomId: string
  agentId: string
  timer: ReturnType<typeof setTimeout>
}

export class ConversationClock {
  private timers = new Map<string, AgentTimer>()
  private running = false

  constructor(private readonly deps: ConversationClockDeps) {}

  setPromptLayerService(service: PromptLayerService | null): void {
    ;(this.deps as { promptLayerService?: PromptLayerService | null }).promptLayerService = service
  }

  setPromptOrchestrator(orchestrator: PromptOrchestrator | null): void {
    ;(this.deps as { promptOrchestrator?: PromptOrchestrator | null }).promptOrchestrator = orchestrator
  }

  start(): void {
    if (this.running) return
    this.running = true
    void this.bootstrap()
  }

  stop(): void {
    this.running = false
    for (const [, t] of this.timers) {
      clearTimeout(t.timer)
    }
    this.timers.clear()
    if (this.deps.leaderElector) {
      void this.deps.leaderElector.releaseLeadership()
    }
  }

  onAgentJoined(roomId: string, agentId: string, tickInterval: number): void {
    if (!this.running) return
    const stagger = Math.random() * STAGGER_MS
    setTimeout(() => {
      this.scheduleAgent(roomId, agentId, tickInterval)
    }, stagger)
  }

  onAgentLeft(roomId: string, agentId: string): void {
    const key = this.timerKey(roomId, agentId)
    const existing = this.timers.get(key)
    if (existing) {
      clearTimeout(existing.timer)
      this.timers.delete(key)
    }
  }

  onRoomStatusChanged(roomId: string, status: string): void {
    void this.syncRoomStatus(roomId, status)
  }

  private async bootstrap(): Promise<void> {
    try {
      const activeRooms = await this.deps.roomRepo.list({ limit: 200, status: 'active' })
      for (const room of activeRooms.items) {
        const members = await this.deps.roomRepo.getMembers(room.id)
        for (const member of members) {
          this.scheduleAgent(room.id, member.member_id, member.personal_tick_interval)
        }
      }
      console.log(`[ConversationClock] Started with ${this.timers.size} agent timers`)
    } catch (err) {
      console.error('[ConversationClock] Bootstrap failed:', err)
    }
  }

  private async syncRoomStatus(roomId: string, status: string): Promise<void> {
    if (status === 'archived' || status === 'cooling') {
      for (const [key, t] of this.timers) {
        if (t.roomId === roomId) {
          clearTimeout(t.timer)
          this.timers.delete(key)
        }
      }
    } else if (status === 'active') {
      const members = await this.deps.roomRepo.getMembers(roomId)
      for (const member of members) {
        const key = this.timerKey(roomId, member.member_id)
        if (!this.timers.has(key)) {
          this.scheduleAgent(roomId, member.member_id, member.personal_tick_interval)
        }
      }
    }
  }

  private scheduleAgent(roomId: string, agentId: string, tickInterval: number): void {
    const key = this.timerKey(roomId, agentId)
    const existing = this.timers.get(key)
    if (existing) clearTimeout(existing.timer)

    const timer = setTimeout(() => {
      this.handleTick(roomId, agentId, tickInterval).catch((err) => {
        console.error(`[ConversationClock] Tick error for ${agentId} in ${roomId}:`, err)
      })
    }, tickInterval)

    this.timers.set(key, { roomId, agentId, timer })
  }

  private async handleTick(roomId: string, agentId: string, tickInterval: number): Promise<void> {
    if (!this.running) return

    if (this.deps.leaderElector) {
      const leader = await this.deps.leaderElector.ensureLeadership()
      if (!leader) {
        this.scheduleAgent(roomId, agentId, tickInterval)
        return
      }
    }

    const room = await this.deps.roomRepo.findById(roomId)
    if (!room || room.status !== 'active') {
      this.onAgentLeft(roomId, agentId)
      return
    }

    if (!await this.deps.roomRepo.isMember(roomId, agentId)) {
      this.onAgentLeft(roomId, agentId)
      return
    }

    if (!await this.checkRateLimits(roomId, agentId)) {
      this.scheduleAgent(roomId, agentId, tickInterval)
      return
    }

    this.deps.sseHub.broadcastToRoom(roomId, {
      type: 'AGENT_TYPING',
      payload: { room_id: roomId, agent_id: agentId },
    })

    try {
      const result = await this.generateMessage(roomId, agentId)

      if (result.kind === 'skip_feedback' && result.body) {
        let retries = 0
        let found = false
        const otherMembers = (await this.deps.roomRepo.getMembers(roomId))
          .filter((m) => m.member_id !== agentId)
          .sort(() => Math.random() - 0.5)

        for (const other of otherMembers) {
          if (retries >= MAX_SKIP_RETRIES) break
          if (!await this.checkRateLimits(roomId, other.member_id)) continue

          this.deps.sseHub.broadcastToRoom(roomId, {
            type: 'AGENT_TYPING',
            payload: { room_id: roomId, agent_id: other.member_id },
          })

          const altResult = await this.generateMessage(roomId, other.member_id)
          if (altResult.kind === 'normal') {
            await this.postMessage(
              roomId,
              other.member_id,
              altResult.body,
              'normal',
              altResult.renderDecision,
            )
            found = true
            break
          }
          retries++
        }

        if (!found) {
          await this.postMessage(roomId, agentId, result.body, 'skip_feedback', result.renderDecision)
        }
      } else if (result.kind === 'normal') {
        await this.postMessage(roomId, agentId, result.body, 'normal', result.renderDecision)
      } else {
        const ambient = AMBIENT_MESSAGES[Math.floor(Math.random() * AMBIENT_MESSAGES.length)]
        await this.postMessage(roomId, agentId, ambient, 'ambient', result.renderDecision)
      }
    } catch (err) {
      console.error(`[ConversationClock] Generate error for ${agentId}:`, err)
    } finally {
      this.deps.sseHub.broadcastToRoom(roomId, {
        type: 'AGENT_STOP_TYPING',
        payload: { room_id: roomId, agent_id: agentId },
      })
    }

    this.scheduleAgent(roomId, agentId, tickInterval)
  }

  private async checkRateLimits(roomId: string, agentId: string): Promise<boolean> {
    const agentRoom = await this.deps.messageRepo.countByAuthorInRoomThisHour(roomId, agentId)
    if (agentRoom >= MAX_MSG_PER_AGENT_PER_ROOM_HOUR) return false

    const agentGlobal = await this.deps.messageRepo.countByAuthorGlobalThisHour(agentId)
    if (agentGlobal >= MAX_MSG_PER_AGENT_GLOBAL_HOUR) return false

    const roomTotal = await this.deps.messageRepo.countByRoomThisHour(roomId)
    if (roomTotal >= MAX_MSG_PER_ROOM_HOUR) return false

    return true
  }

  private async generateMessage(
    roomId: string,
    agentId: string,
  ): Promise<{
    kind: 'normal' | 'skip_feedback' | 'empty'
    body: string
    renderDecision?: RenderTierDecisionResult | null
  }> {
    const room = await this.deps.roomRepo.findById(roomId)
    const agent = this.deps.agentRepo.findById(agentId)
    if (!room || !agent) return { kind: 'empty', body: '' }

    const recentMsgs = await this.deps.messageRepo.getLatestMessages(roomId, 10)
    const recentText = recentMsgs
      .map((m) => {
        const a = this.deps.agentRepo.findById(m.author_id)
        const name = a?.display_name ?? m.author_id
        return `**${name}**：${m.body}`
      })
      .join('\n')

    if (!this.deps.llmClient.isConfigured) {
      return { kind: 'normal', body: `[${agent.display_name}] 聊天测试消息` }
    }

    let persona = this.resolvePersona(agentId, agent.display_name)
    let renderDecision: RenderTierDecisionResult | null = null
    let layers: {
      layer_traits: string
      layer_style: string
      layer_instructions: string
      layer_community: string
      layer_relationship: string
      layer_showrunner: string
      layer_overrides: string
      layer_memory: string
      layer_privacy: string
    } = {
      layer_traits: '',
      layer_style: '',
      layer_instructions: '',
      layer_community: '',
      layer_relationship: '',
      layer_showrunner: '',
      layer_overrides: '',
      layer_memory: '',
      layer_privacy: '',
    }
    let orchestratorApplied = false

    if (this.deps.promptOrchestrator?.isSceneEnabled('chat_room')) {
      try {
        const member = await this.deps.roomRepo.getMember(roomId, agentId)
        const topicHints = this.extractTopicHints(room.name, recentMsgs.map((m) => m.body))
        const composed = await this.deps.promptOrchestrator.compose({
          agentId,
          scene: 'chat_room',
          conversationText: recentMsgs.map((m) => m.body).join(' '),
          topicHints,
          communitySoftCulture: room.description || '',
          sceneRule: `聊天室：${room.name}`,
          shortTermState: `room:${roomId}|messages:${recentMsgs.length}`,
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
        }
        persona = composed.persona
        renderDecision = composed.runtimeEnvelope?.renderTierDecision ?? null
        orchestratorApplied = true
      } catch {
        // Fall back to prompt layer service or base values.
      }
    }

    if (
      config.features.layerStackV2 &&
      !orchestratorApplied &&
      this.deps.promptLayerService
    ) {
      try {
        const member = await this.deps.roomRepo.getMember(roomId, agentId)
        const topicHints = this.extractTopicHints(room.name, recentMsgs.map((m) => m.body))
        const composed = await this.deps.promptLayerService.composeLayersWithAudit(
          {
            agentId,
            scene: 'chat_room',
            conversationText: recentMsgs.map((m) => m.body).join(' '),
            topicHints,
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
        }
        if (composed.persona) {
          persona = composed.persona
        }
        renderDecision = composed.runtimeEnvelope?.renderTierDecision ?? null
      } catch {
        // Fall back to base values if layer composition fails.
      }
    }

    const variables: Record<string, string> = {
      persona_name: persona.name,
      persona_style:
        orchestratorApplied || config.features.layerStackV2
          ? persona.style
          : '友善而富有洞察力',
      persona_interests:
        orchestratorApplied || config.features.layerStackV2
          ? persona.interests.join('、')
          : '多元话题',
      persona_language: persona.language,
      room_name: room.name,
      room_description: room.description || '',
      recent_messages: recentText || '（房间刚刚创建，还没有对话）',
      layer_traits: layers.layer_traits,
      layer_style: layers.layer_style,
      layer_instructions: layers.layer_instructions,
      layer_community: layers.layer_community,
      layer_relationship: layers.layer_relationship,
      layer_showrunner: layers.layer_showrunner,
      layer_overrides: layers.layer_overrides,
      layer_memory: layers.layer_memory,
      layer_privacy: layers.layer_privacy,
    }

    const messages = this.deps.promptEngine.render(PROMPT_TEMPLATE_REFS.agentChatReply, variables)
    const response = await this.deps.llmClient.chat({ messages })
    const content = response.content.trim()

    const skipMatch = content.match(/^\[SKIP(?::(.+?))?\]/)
    if (skipMatch) {
      const feedback = skipMatch[1]?.trim() || ''
      return { kind: 'skip_feedback', body: feedback, renderDecision }
    }

    if (!content) return { kind: 'empty', body: '', renderDecision }
    return { kind: 'normal', body: content, renderDecision }
  }

  private async postMessage(
    roomId: string,
    agentId: string,
    body: string,
    kind: ChatMessageKind,
    renderDecision?: RenderTierDecisionResult | null,
  ): Promise<void> {
    try {
      await this.deps.chatService.sendMessage({
        room_id: roomId,
        author_id: agentId,
        body,
        message_kind: kind,
      })
      if (renderDecision && this.deps.personaStateService) {
        await this.deps.personaStateService.recordVisibleRender({
          agentId,
          scene: 'chat_room',
          renderDecision,
          outputText: body,
        }).catch((err) => {
          console.error('[ConversationClock] persona runtime render record failed:', err)
        })
      }
    } catch (err) {
      console.error(`[ConversationClock] Failed to post message in ${roomId}:`, err)
    }
  }

  private timerKey(roomId: string, agentId: string): string {
    return `${roomId}:${agentId}`
  }

  private resolvePersona(agentId: string, fallbackName: string): {
    name: string
    style: string
    interests: string[]
    language: string
  } {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      return resolveAgentIdentity(agent, latestConfig).visiblePersona
    } catch {
      return {
        name: fallbackName,
        style: '友善而富有洞察力',
        interests: ['多元话题'],
        language: '中文',
      }
    }
  }

  private extractTopicHints(roomName: string, messageBodies: string[]): string[] {
    const text = `${roomName} ${messageBodies.join(' ')}`
    return text
      .split(/[\s,，、；;：:。.!！?？]+/)
      .filter((w) => w.length >= 2)
      .slice(0, 10)
  }
}
