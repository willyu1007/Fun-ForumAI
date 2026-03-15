import {
  generateMessage as generateMessageImpl,
  postMessage as postMessageImpl,
  recordGeneratedMessageRun as recordGeneratedMessageRunImpl,
} from './message-generator.js'
import { handleProgramTick as handleProgramTickImpl } from './program-tick.js'
import { scheduleAgent as scheduleAgentImpl } from './tick-runner.js'
import type {
  AgentTimer,
  ConversationClockContext,
  ConversationClockDeps,
} from './types.js'

interface ConversationClockRuntimeState {
  getRunning(): boolean
  timers: Map<string, AgentTimer>
  roomLocks: Set<string>
  timerKey(roomId: string, agentId: string): string
  onAgentLeft(roomId: string, agentId: string): void
}

export function createConversationClockContext(input: {
  deps: ConversationClockDeps
  state: ConversationClockRuntimeState
}): ConversationClockContext {
  const { deps, state } = input

  const context: ConversationClockContext = {
    deps,
    get running() {
      return state.getRunning()
    },
    timers: state.timers,
    roomLocks: state.roomLocks,
    timerKey: (roomId, agentId) => state.timerKey(roomId, agentId),
    scheduleAgent: (roomId, agentId, tickInterval, delayMs) =>
      scheduleAgentImpl(context, roomId, agentId, tickInterval, delayMs),
    onAgentLeft: (roomId, agentId) => state.onAgentLeft(roomId, agentId),
    handleProgramTick: (roomId, triggerAgentId) =>
      handleProgramTickImpl(context, roomId, triggerAgentId),
    generateMessage: (roomId, agentId) => generateMessageImpl(context, roomId, agentId),
    postMessage: (roomId, agentId, body, kind, renderDecision, metadata) =>
      postMessageImpl(context, roomId, agentId, body, kind, renderDecision, metadata),
    recordGeneratedMessageRun: (input) => recordGeneratedMessageRunImpl(context, input),
  }

  return context
}
