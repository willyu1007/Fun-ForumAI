import type { RoomRepository } from '../repos/room-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { AgentService } from './agent-service.js'
import type { ChatService } from './chat-service.js'
import type { LLMGateway } from '../llm/llm-gateway.js'
import type { PromptLayerService } from '../runtime/prompt-layer-service.js'
import type { PromptOrchestrator } from '../runtime/prompt-orchestrator.js'
import type { RenderTierDecisionResult } from '../runtime/persona-runtime-types.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type { SseHub } from '../sse/hub.js'
import type { Agent, AgentConfig, ChatMessageKind, CreateChatMessageInput } from '../repos/types.js'
import type { LeaderElector } from '../runtime/leader-elector.js'
import type { PersonaStateService } from './persona-state-service.js'
import type {
  ChatroomRuntimeContextBuilder,
  ChatroomRuntimeContextResult,
} from './chatroom-runtime-context-builder.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { LlmTokenUsage } from '../llm/types.js'
import type { PromptComposeAudit } from '../runtime/types.js'
import { sanitizeChatOutput } from '../runtime/chat-output-sanitizer.js'
import { config } from '../lib/config.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import type { PersonaObservationV1 } from '../runtime/persona-observation.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  recordPersonaObservation,
} from '../runtime/persona-observation.js'
import type { RoomProgramEngine } from './room-program-engine.js'
import type { RoomEcologyService } from './room-ecology-service.js'

const MAX_MSG_PER_AGENT_PER_ROOM_HOUR = 6
const MAX_MSG_PER_AGENT_GLOBAL_HOUR = 15
const MAX_MSG_PER_ROOM_HOUR = 40
const STAGGER_MS = 3_000
const MAX_SKIP_RETRIES = 2
const TIMER_SYNC_INTERVAL_MS = 5_000
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
  llmGateway: LLMGateway
  sseHub: SseHub
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  promptLayerService?: PromptLayerService | null
  promptOrchestrator?: PromptOrchestrator | null
  personaStateService?: PersonaStateService | null
  chatroomRuntimeContextBuilder?: ChatroomRuntimeContextBuilder | null
  roomWatchabilityRepo?: RoomWatchabilityRepository | null
  roomProgramEngine?: RoomProgramEngine | null
  roomEcologyService?: RoomEcologyService | null
  leaderElector?: LeaderElector
}

interface AgentTimer {
  roomId: string
  agentId: string
  tickInterval: number
  timer: ReturnType<typeof setTimeout>
}

export class ConversationClock {
  private timers = new Map<string, AgentTimer>()
  private roomLocks = new Set<string>()
  private running = false
  private timerSync: ReturnType<typeof setInterval> | null = null

  constructor(private readonly deps: ConversationClockDeps) {
    this.deps.sseHub.onRoomEvent?.((roomId, event) => {
      this.handleRoomBroadcast(roomId, event)
    })
  }

  setPromptLayerService(service: PromptLayerService | null): void {
    ;(this.deps as { promptLayerService?: PromptLayerService | null }).promptLayerService = service
  }

  setPromptOrchestrator(orchestrator: PromptOrchestrator | null): void {
    ;(this.deps as { promptOrchestrator?: PromptOrchestrator | null }).promptOrchestrator = orchestrator
  }

  setChatroomRuntimeContextBuilder(builder: ChatroomRuntimeContextBuilder | null): void {
    ;(this.deps as { chatroomRuntimeContextBuilder?: ChatroomRuntimeContextBuilder | null }).chatroomRuntimeContextBuilder = builder
  }

  setRoomEcologyService(service: RoomEcologyService | null): void {
    ;(this.deps as { roomEcologyService?: RoomEcologyService | null }).roomEcologyService = service
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.timerSync = setInterval(() => {
      void this.syncActiveRoomTimers().catch((err) => {
        console.error('[ConversationClock] Timer sync failed:', err)
      })
    }, TIMER_SYNC_INTERVAL_MS)
    void this.bootstrap()
  }

  stop(): void {
    this.running = false
    for (const [, t] of this.timers) {
      clearTimeout(t.timer)
    }
    this.timers.clear()
    if (this.timerSync) {
      clearInterval(this.timerSync)
      this.timerSync = null
    }
    if (this.deps.leaderElector) {
      void this.deps.leaderElector.releaseLeadership()
    }
  }

  private handleRoomBroadcast(
    roomId: string,
    event: { type: string; payload?: unknown },
  ): void {
    if (event.type !== 'ROOM_CONTROL_STATE_UPDATED') return
    const payload = event.payload
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return

    const payloadRecord = payload as Record<string, unknown>
    if (payloadRecord.reason !== 'manual_cue') return

    const payloadRoomId = typeof payloadRecord.room_id === 'string'
      ? payloadRecord.room_id
      : roomId
    const selectedAgentId = typeof payloadRecord.selected_agent_id === 'string'
      ? payloadRecord.selected_agent_id
      : null
    if (!selectedAgentId || payloadRoomId !== roomId) return

    void this.prioritizeAgent(roomId, selectedAgentId).catch((err) => {
      console.warn(`[ConversationClock] fast-lane broadcast failed for room=${roomId}:`, err)
    })
  }

  onAgentJoined(roomId: string, agentId: string, tickInterval: number): void {
    if (!this.running) return
    const stagger = Math.random() * STAGGER_MS
    setTimeout(() => {
      this.scheduleAgent(roomId, agentId, tickInterval)
    }, stagger)
  }

  async prioritizeAgent(roomId: string, agentId: string, delayMs = 250): Promise<void> {
    if (!this.running) return
    const key = this.timerKey(roomId, agentId)
    const existing = this.timers.get(key)
    const member = existing
      ? null
      : await this.deps.roomRepo.getMember(roomId, agentId)
    const tickInterval = existing?.tickInterval ?? member?.personal_tick_interval
    if (!tickInterval) return
    this.scheduleAgent(roomId, agentId, tickInterval, Math.min(delayMs, tickInterval))
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

  private async syncActiveRoomTimers(): Promise<void> {
    if (!this.running) return

    if (this.deps.leaderElector) {
      const leader = await this.deps.leaderElector.ensureLeadership()
      if (!leader) return
    }

    const activeRooms = await this.deps.roomRepo.list({ limit: 200, status: 'active' })
    for (const room of activeRooms.items) {
      const members = await this.deps.roomRepo.getMembers(room.id)
      for (const member of members) {
        const key = this.timerKey(room.id, member.member_id)
        if (this.timers.has(key)) continue
        this.scheduleAgent(room.id, member.member_id, member.personal_tick_interval)
      }
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

  private scheduleAgent(roomId: string, agentId: string, tickInterval: number, delayMs = tickInterval): void {
    const key = this.timerKey(roomId, agentId)
    const existing = this.timers.get(key)
    if (existing) clearTimeout(existing.timer)

    const timer = setTimeout(() => {
      this.handleTick(roomId, agentId, tickInterval).catch((err) => {
        console.error(`[ConversationClock] Tick error for ${agentId} in ${roomId}:`, err)
      })
    }, delayMs)

    this.timers.set(key, { roomId, agentId, tickInterval, timer })
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

    if (this.deps.roomEcologyService) {
      const wandered = await this.deps.roomEcologyService.maybeWander(roomId, agentId)
      if (wandered) {
        return
      }
    }

    const program = await this.deps.roomWatchabilityRepo?.getProgram(roomId) ?? null
    if (program?.enabled && this.deps.roomProgramEngine) {
      await this.handleProgramTick(roomId, agentId)
      this.scheduleAgent(roomId, agentId, tickInterval)
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
            await this.postMessage(roomId, other.member_id, altResult.body, 'normal', altResult.renderDecision)
            await this.recordGeneratedMessageRun({
              roomId,
              agentId: other.member_id,
              body: altResult.body,
              kind: 'normal',
              usage: altResult.usage,
              latencyMs: altResult.latency_ms,
              observation: altResult.observation,
            })
            found = true
            break
          }
          retries++
        }

        if (!found) {
          await this.postMessage(roomId, agentId, result.body, 'skip_feedback', result.renderDecision)
          await this.recordGeneratedMessageRun({
            roomId,
            agentId,
            body: result.body,
            kind: 'skip_feedback',
            usage: result.usage,
            latencyMs: result.latency_ms,
            observation: result.observation,
          })
        }
      } else if (result.kind === 'normal') {
        await this.postMessage(roomId, agentId, result.body, 'normal', result.renderDecision)
        await this.recordGeneratedMessageRun({
          roomId,
          agentId,
          body: result.body,
          kind: 'normal',
          usage: result.usage,
          latencyMs: result.latency_ms,
          observation: result.observation,
        })
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

  private async handleProgramTick(roomId: string, triggerAgentId: string): Promise<void> {
    if (this.roomLocks.has(roomId)) return
    this.roomLocks.add(roomId)

    try {
      const plannedTurn = await this.deps.roomProgramEngine?.planNextTurn({
        roomId,
        triggerAgentId,
        canSpeak: async (agentId) => this.checkRateLimits(roomId, agentId),
      }) ?? null
      if (!plannedTurn) return

      const selectedAgentId = plannedTurn.selected_speaker_agent_id

      this.deps.sseHub.broadcastToRoom(roomId, {
        type: 'AGENT_TYPING',
        payload: { room_id: roomId, agent_id: selectedAgentId },
      })

      try {
        const result = await this.generateMessage(roomId, selectedAgentId)
        const programMessageInput: Pick<
          CreateChatMessageInput,
          'episode_id' | 'beat_id' | 'program_event_id' | 'speaker_role' | 'cue_type'
        > = {
          episode_id: plannedTurn.episode_id,
          beat_id: plannedTurn.beat_id,
          program_event_id: plannedTurn.program_event_id,
          speaker_role: plannedTurn.speaker_role,
          cue_type: plannedTurn.cue_type,
        }

        if (result.kind === 'normal') {
          await this.postMessage(
            roomId,
            selectedAgentId,
            result.body,
            'normal',
            result.renderDecision,
            programMessageInput,
          )
          await this.deps.roomProgramEngine?.markProgramEvent(plannedTurn.program_event_id, 'EXECUTED')
          await this.recordGeneratedMessageRun({
            roomId,
            agentId: selectedAgentId,
            body: result.body,
            kind: 'normal',
            usage: result.usage,
            latencyMs: result.latency_ms,
            observation: result.observation,
          })
          return
        }

        if (result.kind === 'skip_feedback' && result.body) {
          await this.postMessage(
            roomId,
            selectedAgentId,
            result.body,
            'skip_feedback',
            result.renderDecision,
            programMessageInput,
          )
          await this.deps.roomProgramEngine?.markProgramEvent(plannedTurn.program_event_id, 'EXECUTED')
          await this.recordGeneratedMessageRun({
            roomId,
            agentId: selectedAgentId,
            body: result.body,
            kind: 'skip_feedback',
            usage: result.usage,
            latencyMs: result.latency_ms,
            observation: result.observation,
          })
          return
        }

        if (result.kind === 'empty') {
          await this.deps.roomProgramEngine?.markProgramEvent(
            plannedTurn.program_event_id,
            'SKIPPED',
            'empty_response',
          )
          return
        }

        const ambient = AMBIENT_MESSAGES[Math.floor(Math.random() * AMBIENT_MESSAGES.length)]
        await this.postMessage(
          roomId,
          selectedAgentId,
          ambient,
          'ambient',
          result.renderDecision,
          programMessageInput,
        )
        await this.deps.roomProgramEngine?.markProgramEvent(plannedTurn.program_event_id, 'EXECUTED')
      } catch (error) {
        await this.deps.roomProgramEngine?.markProgramEvent(
          plannedTurn.program_event_id,
          'FAILED',
          error instanceof Error ? error.message : 'program_tick_failed',
        )
        throw error
      } finally {
        this.deps.sseHub.broadcastToRoom(roomId, {
          type: 'AGENT_STOP_TYPING',
          payload: { room_id: roomId, agent_id: selectedAgentId },
        })
      }
    } finally {
      this.roomLocks.delete(roomId)
    }
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
    usage?: LlmTokenUsage
    latency_ms?: number
    observation?: PersonaObservationV1
    renderDecision?: RenderTierDecisionResult | null
  }> {
    const room = await this.deps.roomRepo.findById(roomId)
    const agent = this.deps.agentRepo.findById(agentId)
      ?? await this.deps.agentService.getAgentPersisted(agentId).catch(() => null)
    if (!room || !agent) return { kind: 'empty', body: '' }
    const latestConfig = this.deps.agentService.getLatestConfigPersisted
      ? await this.deps.agentService.getLatestConfigPersisted(agentId).catch(() =>
          this.deps.agentService.getLatestConfig(agentId)
        )
      : this.deps.agentService.getLatestConfig(agentId)
    const resolvedIdentity = this.resolveIdentity(agent, latestConfig)

    const recentMsgs = await this.deps.messageRepo.getLatestMessages(roomId, 10)
    const runtimeChatContext = this.deps.chatroomRuntimeContextBuilder
      ? await this.deps.chatroomRuntimeContextBuilder.build({
          room,
          agentId,
          recentMessages: recentMsgs,
        }).catch(() => null)
      : null
    const chatConversationText = this.buildChatConversationText(recentMsgs, runtimeChatContext)
    const chatTopicHints = this.extractTopicHints(room.name, this.buildTopicHintBodies(recentMsgs, runtimeChatContext))
    const chatSceneRule = this.buildChatSceneRule(room.name, runtimeChatContext)
    const chatShortTermState = this.buildChatShortTermState(roomId, recentMsgs.length, runtimeChatContext)

    const recentText = recentMsgs
      .flatMap((m) => {
        const body = this.sanitizePromptText(m.body)
        if (!body) return []
        const a = this.deps.agentRepo.findById(m.author_id)
        const name = a?.display_name ?? m.author_id
        return [`发言人=${name}；内容=${body}`]
      })
      .join('\n')

    if (!this.deps.llmGateway.isConfigured) {
      return { kind: 'normal', body: `[${agent.display_name}] 聊天测试消息` }
    }

    let persona = resolvedIdentity.visiblePersona
    const observationIdentity = resolvedIdentity.observationIdentity
    let promptAudit: PromptComposeAudit | null = null
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
        const composed = await this.deps.promptOrchestrator.compose({
          agentId,
          scene: 'chat_room',
          conversationText: chatConversationText,
          communityId: room.community_id,
          topicHints: chatTopicHints,
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
        }
        promptAudit = composed.audit
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
        const composed = await this.deps.promptLayerService.composeLayersWithAudit(
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
        }
        promptAudit = composed.audit
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
      persona_seed_code: observationIdentity?.persona_seed_code ?? 'scholar',
      room_name: room.name,
      room_description: room.description || '',
      recent_messages: recentText || '（房间刚刚创建，还没有对话）',
      program_scene: runtimeChatContext?.promptVariables.program_scene ?? '',
      episode_id: runtimeChatContext?.promptVariables.episode_id ?? '',
      current_beat: runtimeChatContext?.promptVariables.current_beat ?? '',
      cue_type: runtimeChatContext?.promptVariables.cue_type ?? '',
      director_goal: runtimeChatContext?.promptVariables.director_goal ?? '',
      self_role: runtimeChatContext?.promptVariables.self_role ?? '',
      cast_snapshot: runtimeChatContext?.promptVariables.cast_snapshot ?? '',
      live_hook: runtimeChatContext?.promptVariables.live_hook ?? '',
      unresolved_question: runtimeChatContext?.promptVariables.unresolved_question ?? '',
      last_highlight: runtimeChatContext?.promptVariables.last_highlight ?? '',
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
    }

    const response = await this.deps.llmGateway.generateVisibleText({
      intent: 'chat_reply',
      scene: 'chat_room',
      agentId,
      homeVoiceLineId: resolvedIdentity.homeVoiceLineId,
      promptRef: PROMPT_TEMPLATE_REFS.agentChatReply,
      variables,
      budgetClass: 'visible_standard',
      traceId: `chat-room:${roomId}:${agentId}:${Date.now()}`,
      requestedTier: 'lite',
      allowFallbackWithinLine: false,
      allowCrossFamily: false,
    })
    const latencyMs = response.latencyMs ?? 0
    const sanitized = sanitizeChatOutput(response.content)
    const content = sanitized.text
    const observation = buildPersonaObservation({
      sourceCallsiteId: 'conversation-clock-chat-reply',
      scene: 'chat_room',
      intent: 'chat_reply',
      visibility: 'visible',
      coverageStatus: 'migrated_visible',
      personaSeedCode: observationIdentity?.persona_seed_code,
      homeVoiceLineId: observationIdentity?.home_voice_line_id,
      promptRef: PROMPT_TEMPLATE_REFS.agentChatReply,
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

  private async postMessage(
    roomId: string,
    agentId: string,
    body: string,
    kind: ChatMessageKind,
    renderDecision?: RenderTierDecisionResult | null,
    metadata?: Pick<
      CreateChatMessageInput,
      'episode_id' | 'beat_id' | 'program_event_id' | 'speaker_role' | 'cue_type'
    >,
  ): Promise<void> {
    try {
      await this.deps.chatService.sendMessage({
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

  private resolveIdentity(agent: Agent, latestConfig: AgentConfig | null): {
    visiblePersona: {
      name: string
      style: string
      interests: string[]
      language: string
    }
    homeVoiceLineId: import('../../shared/agent-persona-catalog.js').VoiceLineId
    observationIdentity: {
      persona_seed_code: import('../../shared/agent-persona-catalog.js').PersonaSeedCode
      home_voice_line_id: import('../../shared/agent-persona-catalog.js').VoiceLineId
    } | null
  } {
    try {
      const resolved = resolveAgentIdentity(agent, latestConfig)
      return {
        visiblePersona: resolved.visiblePersona,
        homeVoiceLineId: resolved.summary.home_voice_line_id,
        observationIdentity: {
          persona_seed_code: resolved.summary.persona_seed_code,
          home_voice_line_id: resolved.summary.home_voice_line_id,
        },
      }
    } catch {
      return {
        visiblePersona: {
          name: agent.display_name,
          style: '友善而富有洞察力',
          interests: ['多元话题'],
          language: '中文',
        },
        homeVoiceLineId: 'qwen-social-v1',
        observationIdentity: null,
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

  private buildTopicHintBodies(
    recentMessages: Array<{ body: string }>,
    runtimeChatContext: ChatroomRuntimeContextResult | null,
  ): string[] {
    const bodies = recentMessages
      .map((message) => this.sanitizePromptText(message.body))
      .filter((body): body is string => Boolean(body))
    const liveHook = this.sanitizePromptText(runtimeChatContext?.chatContext.program?.live_hook)
    const unresolvedQuestion = this.sanitizePromptText(runtimeChatContext?.chatContext.program?.unresolved_question)
    if (liveHook) bodies.push(liveHook)
    if (unresolvedQuestion) bodies.push(unresolvedQuestion)
    return bodies
  }

  private buildChatConversationText(
    recentMessages: Array<{ body: string }>,
    runtimeChatContext: ChatroomRuntimeContextResult | null,
  ): string {
    const bodies = recentMessages
      .map((message) => this.sanitizePromptText(message.body))
      .filter((body): body is string => Boolean(body))
    const liveHook = this.sanitizePromptText(runtimeChatContext?.chatContext.program?.live_hook)
    const unresolvedQuestion = this.sanitizePromptText(runtimeChatContext?.chatContext.program?.unresolved_question)
    if (liveHook) {
      bodies.push(`当前看点：${liveHook}`)
    }
    if (unresolvedQuestion) {
      bodies.push(`当前悬念：${unresolvedQuestion}`)
    }
    return bodies.join(' ')
  }

  private buildChatSceneRule(roomName: string, runtimeChatContext: ChatroomRuntimeContextResult | null): string {
    const program = runtimeChatContext?.chatContext.program
    if (!program) {
      return `聊天室：${roomName}`
    }
    return `聊天室：${roomName}｜节目=${program.scene_type}｜角色=${program.self_role ?? 'UNASSIGNED'}｜episode=${program.episode_id}`
  }

  private buildChatShortTermState(
    roomId: string,
    recentMessageCount: number,
    runtimeChatContext: ChatroomRuntimeContextResult | null,
  ): string {
    const program = runtimeChatContext?.chatContext.program
    if (!program) {
      return `room:${roomId}|messages:${recentMessageCount}`
    }
    return [
      `room:${roomId}`,
      `messages:${recentMessageCount}`,
      `scene:${program.scene_type}`,
      `role:${program.self_role ?? 'UNASSIGNED'}`,
      `episode:${program.episode_id}`,
      `hook:${this.sanitizePromptText(program.live_hook) ?? ''}`,
      `question:${this.sanitizePromptText(program.unresolved_question) ?? ''}`,
    ].join('|')
  }

  private sanitizePromptText(text: string | null | undefined): string | null {
    if (!text) return null
    const sanitized = sanitizeChatOutput(text)
    if (!sanitized.text || sanitized.looks_meta) return null
    return sanitized.text
  }

  private async recordGeneratedMessageRun(input: {
    roomId: string
    agentId: string
    body: string
    kind: ChatMessageKind
    usage?: LlmTokenUsage
    latencyMs?: number
    observation?: PersonaObservationV1
  }): Promise<void> {
    if (!input.observation || !input.usage || typeof input.latencyMs !== 'number') {
      return
    }

    try {
      const event = this.deps.eventRepo.create({
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

      this.deps.agentRunRepo.create({
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

}
