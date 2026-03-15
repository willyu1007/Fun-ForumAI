import type { PromptLayerService } from '../runtime/prompt-layer-service.js'
import type { PromptOrchestrator } from '../runtime/prompt-orchestrator.js'
import type { ChatroomRuntimeContextBuilder } from './chatroom-runtime-context-builder.js'
import type { RoomEcologyService } from './room-ecology-service.js'
import { TIMER_SYNC_INTERVAL_MS } from './conversation-clock/constants.js'
import {
  generateMessage as generateMessageImpl,
  postMessage as postMessageImpl,
  recordGeneratedMessageRun as recordGeneratedMessageRunImpl,
} from './conversation-clock/message-generator.js'
import { handleProgramTick as handleProgramTickImpl } from './conversation-clock/program-tick.js'
import {
  bootstrap as bootstrapImpl,
  handleRoomBroadcast as handleRoomBroadcastImpl,
  handleTick as handleTickImpl,
  prioritizeAgent as prioritizeAgentImpl,
  scheduleAgent as scheduleAgentImpl,
  scheduleAgentJoin as scheduleAgentJoinImpl,
  syncActiveRoomTimers as syncActiveRoomTimersImpl,
  syncRoomStatus as syncRoomStatusImpl,
} from './conversation-clock/tick-runner.js'
import type {
  AgentTimer,
  ConversationClockContext,
  ConversationClockDeps,
} from './conversation-clock/types.js'

export type { ConversationClockDeps } from './conversation-clock/types.js'

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
    ;(this.deps as { promptLayerService?: PromptLayerService | null }).promptLayerService =
      service
  }

  setPromptOrchestrator(orchestrator: PromptOrchestrator | null): void {
    ;(this.deps as {
      promptOrchestrator?: PromptOrchestrator | null
    }).promptOrchestrator = orchestrator
  }

  setChatroomRuntimeContextBuilder(builder: ChatroomRuntimeContextBuilder | null): void {
    ;(this.deps as {
      chatroomRuntimeContextBuilder?: ChatroomRuntimeContextBuilder | null
    }).chatroomRuntimeContextBuilder = builder
  }

  setRoomEcologyService(service: RoomEcologyService | null): void {
    ;(this.deps as { roomEcologyService?: RoomEcologyService | null }).roomEcologyService =
      service
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
    for (const [, timer] of this.timers) {
      clearTimeout(timer.timer)
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

  onAgentJoined(roomId: string, agentId: string, tickInterval: number): void {
    if (!this.running) return
    this.scheduleAgentJoin(roomId, agentId, tickInterval)
  }

  async prioritizeAgent(roomId: string, agentId: string, delayMs = 250): Promise<void> {
    return prioritizeAgentImpl(this.getContext(), roomId, agentId, delayMs)
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

  private getContext(): ConversationClockContext {
    return {
      deps: this.deps,
      running: this.running,
      timers: this.timers,
      roomLocks: this.roomLocks,
      timerKey: (roomId, agentId) => this.timerKey(roomId, agentId),
      scheduleAgent: (roomId, agentId, tickInterval, delayMs) => {
        if (delayMs === undefined) {
          this.scheduleAgent(roomId, agentId, tickInterval)
          return
        }
        this.scheduleAgent(roomId, agentId, tickInterval, delayMs)
      },
      onAgentLeft: (roomId, agentId) => this.onAgentLeft(roomId, agentId),
      handleProgramTick: (roomId, triggerAgentId) =>
        this.handleProgramTick(roomId, triggerAgentId),
      generateMessage: (roomId, agentId) => this.generateMessage(roomId, agentId),
      postMessage: (roomId, agentId, body, kind, renderDecision, metadata) =>
        this.postMessage(roomId, agentId, body, kind, renderDecision, metadata),
      recordGeneratedMessageRun: (input) => this.recordGeneratedMessageRun(input),
    }
  }

  private bootstrap(): Promise<void> {
    return bootstrapImpl(this.getContext())
  }

  private handleRoomBroadcast(
    roomId: string,
    event: { type: string; payload?: unknown },
  ): void {
    handleRoomBroadcastImpl(this.getContext(), roomId, event)
  }

  async handleTick(
    roomId: string,
    agentId: string,
    tickInterval: number,
  ): Promise<void> {
    return handleTickImpl(this.getContext(), roomId, agentId, tickInterval)
  }

  private scheduleAgent(
    roomId: string,
    agentId: string,
    tickInterval: number,
    delayMs?: number,
  ): void {
    scheduleAgentImpl(this.getContext(), roomId, agentId, tickInterval, delayMs)
  }

  private scheduleAgentJoin(roomId: string, agentId: string, tickInterval: number): void {
    scheduleAgentJoinImpl(this.getContext(), roomId, agentId, tickInterval)
  }

  private syncActiveRoomTimers(): Promise<void> {
    return syncActiveRoomTimersImpl(this.getContext())
  }

  private syncRoomStatus(roomId: string, status: string): Promise<void> {
    return syncRoomStatusImpl(this.getContext(), roomId, status)
  }

  private handleProgramTick(roomId: string, triggerAgentId: string): Promise<void> {
    return handleProgramTickImpl(this.getContext(), roomId, triggerAgentId)
  }

  private generateMessage(roomId: string, agentId: string) {
    return generateMessageImpl(this.getContext(), roomId, agentId)
  }

  private postMessage(
    roomId: string,
    agentId: string,
    body: string,
    kind: 'normal' | 'skip_feedback' | 'ambient' | 'greeting',
    renderDecision?: Parameters<typeof postMessageImpl>[5],
    metadata?: Parameters<typeof postMessageImpl>[6],
  ) {
    return postMessageImpl(this.getContext(), roomId, agentId, body, kind, renderDecision, metadata)
  }

  private recordGeneratedMessageRun(
    input: Parameters<typeof recordGeneratedMessageRunImpl>[1],
  ) {
    return recordGeneratedMessageRunImpl(this.getContext(), input)
  }

  private timerKey(roomId: string, agentId: string): string {
    return `${roomId}:${agentId}`
  }

}
