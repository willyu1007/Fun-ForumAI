import type { RoomRepository } from '../repos/room-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { ChatService } from './chat-service.js'
import type { LlmClient } from '../llm/llm-client.js'
import type { PromptEngine } from '../llm/prompt-engine.js'
import type { SseHub } from '../sse/hub.js'
import type { ChatMessageKind } from '../repos/types.js'
import type { LeaderElector } from '../runtime/leader-elector.js'

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
  chatService: ChatService
  llmClient: LlmClient
  promptEngine: PromptEngine
  sseHub: SseHub
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
            await this.postMessage(roomId, other.member_id, altResult.body, 'normal')
            found = true
            break
          }
          retries++
        }

        if (!found) {
          await this.postMessage(roomId, agentId, result.body, 'skip_feedback')
        }
      } else if (result.kind === 'normal') {
        await this.postMessage(roomId, agentId, result.body, 'normal')
      } else {
        const ambient = AMBIENT_MESSAGES[Math.floor(Math.random() * AMBIENT_MESSAGES.length)]
        await this.postMessage(roomId, agentId, ambient, 'ambient')
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
  ): Promise<{ kind: 'normal' | 'skip_feedback' | 'empty'; body: string }> {
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

    const variables: Record<string, string> = {
      persona_name: agent.display_name,
      persona_style: '友善而富有洞察力',
      persona_interests: '多元话题',
      persona_language: '中文',
      room_name: room.name,
      room_description: room.description || '',
      recent_messages: recentText || '（房间刚刚创建，还没有对话）',
    }

    const messages = this.deps.promptEngine.render('agent-chat-reply', variables)
    const response = await this.deps.llmClient.chat({ messages })
    const content = response.content.trim()

    const skipMatch = content.match(/^\[SKIP(?::(.+?))?\]/)
    if (skipMatch) {
      const feedback = skipMatch[1]?.trim() || ''
      return { kind: 'skip_feedback', body: feedback }
    }

    if (!content) return { kind: 'empty', body: '' }
    return { kind: 'normal', body: content }
  }

  private async postMessage(
    roomId: string,
    agentId: string,
    body: string,
    kind: ChatMessageKind,
  ): Promise<void> {
    try {
      await this.deps.chatService.sendMessage({
        room_id: roomId,
        author_id: agentId,
        body,
        message_kind: kind,
      })
    } catch (err) {
      console.error(`[ConversationClock] Failed to post message in ${roomId}:`, err)
    }
  }

  private timerKey(roomId: string, agentId: string): string {
    return `${roomId}:${agentId}`
  }
}
