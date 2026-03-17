import type { PromptOrchestrator } from '../runtime/prompt-orchestrator.js'
import type { ChatroomRuntimeContextBuilder } from './chatroom-runtime-context-builder.js'
import type { RoomEcologyService } from './room-ecology-service.js'
import { TIMER_SYNC_INTERVAL_MS } from './conversation-clock/constants.js'
import { createConversationClockContext } from './conversation-clock/runtime-adapter.js'
import {
  bootstrap as bootstrapImpl,
  handleRoomBroadcast as handleRoomBroadcastImpl,
  prioritizeAgent as prioritizeAgentImpl,
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
  private readonly context: ConversationClockContext

  constructor(private readonly deps: ConversationClockDeps) {
    this.context = createConversationClockContext({
      deps: this.deps,
      state: {
        getRunning: () => this.running,
        timers: this.timers,
        roomLocks: this.roomLocks,
        timerKey: (roomId, agentId) => this.timerKey(roomId, agentId),
        onAgentLeft: (roomId, agentId) => this.detachAgentTimer(roomId, agentId),
      },
    })
    this.deps.sseHub.onRoomEvent?.((roomId, event) => {
      handleRoomBroadcastImpl(this.context, roomId, event)
    })
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
      void syncActiveRoomTimersImpl(this.context).catch((err) => {
        console.error('[ConversationClock] Timer sync failed:', err)
      })
    }, TIMER_SYNC_INTERVAL_MS)
    void bootstrapImpl(this.context)
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

  get isRunning(): boolean {
    return this.running
  }

  onAgentJoined(roomId: string, agentId: string, tickInterval: number): void {
    if (!this.running) return
    scheduleAgentJoinImpl(this.context, roomId, agentId, tickInterval)
  }

  async prioritizeAgent(roomId: string, agentId: string, delayMs = 250): Promise<void> {
    return prioritizeAgentImpl(this.context, roomId, agentId, delayMs)
  }

  onAgentLeft(roomId: string, agentId: string): void {
    this.detachAgentTimer(roomId, agentId)
  }

  onRoomStatusChanged(roomId: string, status: string): void {
    void syncRoomStatusImpl(this.context, roomId, status)
  }

  private timerKey(roomId: string, agentId: string): string {
    return `${roomId}:${agentId}`
  }

  private detachAgentTimer(roomId: string, agentId: string): void {
    const key = this.timerKey(roomId, agentId)
    const existing = this.timers.get(key)
    if (existing) {
      clearTimeout(existing.timer)
      this.timers.delete(key)
    }
  }
}
