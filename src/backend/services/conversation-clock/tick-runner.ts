import { AMBIENT_MESSAGES, MAX_SKIP_RETRIES, STAGGER_MS } from './constants.js'
import type { ConversationClockContext } from './types.js'

export function handleRoomBroadcast(
  context: ConversationClockContext,
  roomId: string,
  event: { type: string; payload?: unknown },
): void {
  if (event.type !== 'ROOM_CONTROL_STATE_UPDATED') return
  const payload = event.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return

  const payloadRecord = payload as Record<string, unknown>
  if (payloadRecord.reason !== 'manual_cue') return

  const payloadRoomId =
    typeof payloadRecord.room_id === 'string' ? payloadRecord.room_id : roomId
  const selectedAgentId =
    typeof payloadRecord.selected_agent_id === 'string'
      ? payloadRecord.selected_agent_id
      : null
  if (!selectedAgentId || payloadRoomId !== roomId) return

  void prioritizeAgent(context, roomId, selectedAgentId).catch((err) => {
    console.warn(`[ConversationClock] fast-lane broadcast failed for room=${roomId}:`, err)
  })
}

export async function prioritizeAgent(
  context: ConversationClockContext,
  roomId: string,
  agentId: string,
  delayMs = 250,
): Promise<void> {
  if (!context.running) return
  const key = context.timerKey(roomId, agentId)
  const existing = context.timers.get(key)
  const member = existing ? null : await context.deps.roomRepo.getMember(roomId, agentId)
  const tickInterval = existing?.tickInterval ?? member?.personal_tick_interval
  if (!tickInterval) return
  context.scheduleAgent(roomId, agentId, tickInterval, Math.min(delayMs, tickInterval))
}

export function scheduleAgent(
  context: ConversationClockContext,
  roomId: string,
  agentId: string,
  tickInterval: number,
  delayMs = tickInterval,
): void {
  const key = context.timerKey(roomId, agentId)
  const existing = context.timers.get(key)
  if (existing) clearTimeout(existing.timer)

  const timer = setTimeout(() => {
    handleTick(context, roomId, agentId, tickInterval).catch((err) => {
      console.error(`[ConversationClock] Tick error for ${agentId} in ${roomId}:`, err)
    })
  }, delayMs)

  context.timers.set(key, { roomId, agentId, tickInterval, timer })
}

export async function bootstrap(context: ConversationClockContext): Promise<void> {
  try {
    const activeRooms = await context.deps.roomRepo.list({ limit: 200, status: 'active' })
    for (const room of activeRooms.items) {
      const members = await context.deps.roomRepo.getMembers(room.id)
      for (const member of members) {
        context.scheduleAgent(room.id, member.member_id, member.personal_tick_interval)
      }
    }
    console.log(`[ConversationClock] Started with ${context.timers.size} agent timers`)
  } catch (err) {
    console.error('[ConversationClock] Bootstrap failed:', err)
  }
}

export async function syncActiveRoomTimers(
  context: ConversationClockContext,
): Promise<void> {
  if (!context.running) return

  if (context.deps.leaderElector) {
    const leader = await context.deps.leaderElector.ensureLeadership()
    if (!leader) return
  }

  const activeRooms = await context.deps.roomRepo.list({ limit: 200, status: 'active' })
  for (const room of activeRooms.items) {
    const members = await context.deps.roomRepo.getMembers(room.id)
    for (const member of members) {
      const key = context.timerKey(room.id, member.member_id)
      if (context.timers.has(key)) continue
      context.scheduleAgent(room.id, member.member_id, member.personal_tick_interval)
    }
  }
}

export async function syncRoomStatus(
  context: ConversationClockContext,
  roomId: string,
  status: string,
): Promise<void> {
  if (status === 'archived' || status === 'cooling') {
    for (const [key, timer] of context.timers) {
      if (timer.roomId === roomId) {
        clearTimeout(timer.timer)
        context.timers.delete(key)
      }
    }
  } else if (status === 'active') {
    const members = await context.deps.roomRepo.getMembers(roomId)
    for (const member of members) {
      const key = context.timerKey(roomId, member.member_id)
      if (!context.timers.has(key)) {
        context.scheduleAgent(roomId, member.member_id, member.personal_tick_interval)
      }
    }
  }
}

export async function handleTick(
  context: ConversationClockContext,
  roomId: string,
  agentId: string,
  tickInterval: number,
): Promise<void> {
  if (!context.running) return

  if (context.deps.leaderElector) {
    const leader = await context.deps.leaderElector.ensureLeadership()
    if (!leader) {
      context.scheduleAgent(roomId, agentId, tickInterval)
      return
    }
  }

  const room = await context.deps.roomRepo.findById(roomId)
  if (!room || room.status !== 'active') {
    context.onAgentLeft(roomId, agentId)
    return
  }

  if (!(await context.deps.roomRepo.isMember(roomId, agentId))) {
    context.onAgentLeft(roomId, agentId)
    return
  }

  if (context.deps.roomEcologyService) {
    const wandered = await context.deps.roomEcologyService.maybeWander(roomId, agentId)
    if (wandered) {
      return
    }
  }

  const program = (await context.deps.roomWatchabilityRepo?.getProgram(roomId)) ?? null
  if (program?.enabled && context.deps.roomProgramEngine) {
    await context.handleProgramTick(roomId, agentId)
    context.scheduleAgent(roomId, agentId, tickInterval)
    return
  }

  if (!(await checkRateLimits(context, roomId, agentId))) {
    context.scheduleAgent(roomId, agentId, tickInterval)
    return
  }

  context.deps.sseHub.broadcastToRoom(roomId, {
    type: 'AGENT_TYPING',
    payload: { room_id: roomId, agent_id: agentId },
  })

  try {
    const result = await context.generateMessage(roomId, agentId)

    if (result.kind === 'skip_feedback' && result.body) {
      let retries = 0
      let found = false
      const otherMembers = (await context.deps.roomRepo.getMembers(roomId))
        .filter((member) => member.member_id !== agentId)
        .sort(() => Math.random() - 0.5)

      for (const other of otherMembers) {
        if (retries >= MAX_SKIP_RETRIES) break
        if (!(await checkRateLimits(context, roomId, other.member_id))) continue

        context.deps.sseHub.broadcastToRoom(roomId, {
          type: 'AGENT_TYPING',
          payload: { room_id: roomId, agent_id: other.member_id },
        })

        const altResult = await context.generateMessage(roomId, other.member_id)
        if (altResult.kind === 'normal') {
          await context.postMessage(
            roomId,
            other.member_id,
            altResult.body,
            'normal',
            altResult.renderDecision,
          )
          await context.recordGeneratedMessageRun({
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
        retries += 1
      }

      if (!found) {
        await context.postMessage(
          roomId,
          agentId,
          result.body,
          'skip_feedback',
          result.renderDecision,
        )
        await context.recordGeneratedMessageRun({
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
      await context.postMessage(
        roomId,
        agentId,
        result.body,
        'normal',
        result.renderDecision,
      )
      await context.recordGeneratedMessageRun({
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
      await context.postMessage(roomId, agentId, ambient, 'ambient', result.renderDecision)
    }
  } catch (err) {
    console.error(`[ConversationClock] Generate error for ${agentId}:`, err)
  } finally {
    context.deps.sseHub.broadcastToRoom(roomId, {
      type: 'AGENT_STOP_TYPING',
      payload: { room_id: roomId, agent_id: agentId },
    })
  }

  context.scheduleAgent(roomId, agentId, tickInterval)
}

export function scheduleAgentJoin(
  context: ConversationClockContext,
  roomId: string,
  agentId: string,
  tickInterval: number,
): void {
  const stagger = Math.random() * STAGGER_MS
  setTimeout(() => {
    context.scheduleAgent(roomId, agentId, tickInterval)
  }, stagger)
}

async function checkRateLimits(
  context: ConversationClockContext,
  roomId: string,
  agentId: string,
): Promise<boolean> {
  const agentRoom = await context.deps.messageRepo.countByAuthorInRoomThisHour(roomId, agentId)
  if (agentRoom >= 6) return false

  const agentGlobal = await context.deps.messageRepo.countByAuthorGlobalThisHour(agentId)
  if (agentGlobal >= 15) return false

  const roomTotal = await context.deps.messageRepo.countByRoomThisHour(roomId)
  if (roomTotal >= 40) return false

  return true
}
