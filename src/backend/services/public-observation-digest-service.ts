import type { DomainEvent } from '../repos/types.js'
import type { LlmClient } from '../llm/llm-client.js'
import type { ForumReadService } from './forum-read-service.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { MemoryService } from './memory-service.js'
import { config } from '../lib/config.js'

export interface PublicObservationDigestServiceDeps {
  llmClient: LlmClient
  forumReadService: ForumReadService
  roomRepo: RoomRepository
  messageRepo: MessageRepository
  memoryService: MemoryService
}

export class PublicObservationDigestService {
  constructor(private readonly deps: PublicObservationDigestServiceDeps) {}

  async onForumEvent(event: DomainEvent): Promise<void> {
    const payload = event.payload_json
    const postId = payload.post_id as string | undefined
    const agentId = payload.author_agent_id as string | undefined
    if (!postId || !agentId) return

    try {
      const post = await this.deps.forumReadService.getPost(postId)
      const comments = await this.deps.forumReadService.getComments(postId, { limit: 120 })

      const po = config.publicObservation
      const shouldDigest =
        comments.items.length >= po.forumCommentThreshold ||
        post.participant_count >= po.forumParticipantThreshold ||
        post.heat_score >= po.forumHeatThreshold

      if (!shouldDigest) return

      if (!await this.shouldProceedByEventDedup(agentId, event.id)) return
      if (!await this.shouldProceedByCooldown(agentId, 'post', postId, po.forumCooldownMs)) return

      const summary = await this.summarizeForum(post.title, post.body, comments.items.map((c) => c.body))

      // Re-check cooldown before write to avoid TOCTOU during long LLM calls.
      if (!await this.shouldProceedByCooldown(agentId, 'post', postId, po.forumCooldownMs)) return

      await this.deps.memoryService.createPublicObservationMemory({
        agent_id: agentId,
        source_ref_type: 'post',
        source_ref_id: postId,
        source_event_id: event.id,
        summary_text: summary.summary_text,
        topic_tags: summary.topic_tags,
        key_facts: summary.key_facts,
        sentiment: summary.sentiment,
        importance_score: summary.importance_score,
      })
    } catch (err) {
      console.error('[PublicObservationDigestService] onForumEvent failed:', err)
    }
  }

  async onRoomMessage(input: {
    roomId: string
    messageId: string
    authorAgentId: string
  }): Promise<void> {
    try {
      const room = await this.deps.roomRepo.findById(input.roomId)
      if (!room) return

      const po = config.publicObservation
      const messageCount = await this.deps.messageRepo.countByRoom(input.roomId)
      const activeMinutes = Math.max(0, (Date.now() - room.created_at.getTime()) / 60_000)
      const shouldDigest = messageCount >= po.roomMessageThreshold || (activeMinutes >= po.roomActiveMinThreshold && messageCount >= po.roomActiveMinMsgThreshold)
      if (!shouldDigest) return

      if (!await this.shouldProceedByEventDedup(input.authorAgentId, input.messageId)) return
      if (!await this.shouldProceedByCooldown(input.authorAgentId, 'room', input.roomId, po.roomCooldownMs)) return

      const messages = await this.deps.messageRepo.getLatestMessages(input.roomId, 80)
      const summary = await this.summarizeRoom(
        room.name,
        room.description || '',
        messages.map((m) => m.body),
      )

      // Re-check cooldown before write to avoid TOCTOU during long LLM calls.
      if (!await this.shouldProceedByCooldown(input.authorAgentId, 'room', input.roomId, po.roomCooldownMs)) return

      await this.deps.memoryService.createPublicObservationMemory({
        agent_id: input.authorAgentId,
        source_ref_type: 'room',
        source_ref_id: input.roomId,
        source_event_id: input.messageId,
        summary_text: summary.summary_text,
        topic_tags: summary.topic_tags,
        key_facts: summary.key_facts,
        sentiment: summary.sentiment,
        importance_score: summary.importance_score,
      })
    } catch (err) {
      console.error('[PublicObservationDigestService] onRoomMessage failed:', err)
    }
  }

  private async shouldProceedByEventDedup(agentId: string, sourceEventId: string): Promise<boolean> {
    try {
      const existing = await this.deps.memoryService.listMemories(agentId, {
        limit: 1,
        source_type: 'PUBLIC_OBSERVATION',
        source_event_id: sourceEventId,
        forgotten: false,
      })
      return existing.items.length === 0
    } catch (err) {
      console.warn('[PublicObservationDigestService] event dedup check failed, fallback to continue:', err)
      return true
    }
  }

  private async shouldProceedByCooldown(
    agentId: string,
    sourceRefType: string,
    sourceRefId: string,
    cooldownMs: number,
  ): Promise<boolean> {
    try {
      return await this.isCooledDown(agentId, sourceRefType, sourceRefId, cooldownMs)
    } catch (err) {
      console.warn('[PublicObservationDigestService] cooldown check failed, fallback to continue:', err)
      return true
    }
  }

  private async isCooledDown(
    agentId: string,
    sourceRefType: string,
    sourceRefId: string,
    cooldownMs: number,
  ): Promise<boolean> {
    const latest = await this.deps.memoryService.listMemories(agentId, {
      limit: 1,
      source_type: 'PUBLIC_OBSERVATION',
      source_ref_type: sourceRefType,
      source_ref_id: sourceRefId,
      forgotten: false,
    })

    const last = latest.items[0]
    if (!last) return true
    return Date.now() - last.created_at.getTime() >= cooldownMs
  }

  private async summarizeForum(
    title: string,
    body: string,
    commentBodies: string[],
  ): Promise<DigestSummary> {
    const transcript = [
      `标题: ${title}`,
      `正文: ${body}`,
      ...commentBodies.slice(-30).map((c, i) => `评论${i + 1}: ${c}`),
    ].join('\n')

    return this.summarize('forum', transcript)
  }

  private async summarizeRoom(
    roomName: string,
    roomDescription: string,
    messageBodies: string[],
  ): Promise<DigestSummary> {
    const transcript = [
      `房间: ${roomName}`,
      `描述: ${roomDescription}`,
      ...messageBodies.slice(-60).map((m, i) => `消息${i + 1}: ${m}`),
    ].join('\n')

    return this.summarize('room', transcript)
  }

  private async summarize(kind: 'forum' | 'room', transcript: string): Promise<DigestSummary> {
    if (!this.deps.llmClient.isConfigured) {
      return {
        summary_text: `${kind} 公共讨论产生了新的观察记忆，后续可用于连续性表达。`,
        topic_tags: this.extractTags(transcript),
        key_facts: ['讨论热度达到沉淀阈值', '形成了可复用的公共经历'],
        sentiment: 'thoughtful',
        importance_score: 0.55,
      }
    }

    try {
      const llmResp = await this.deps.llmClient.chat({
        messages: [
          {
            role: 'system',
            content: PUBLIC_OBSERVATION_DIGEST_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: transcript,
          },
        ],
        temperature: 0.3,
      })
      return this.parseDigestResponse(llmResp.content)
    } catch {
      return {
        summary_text: `${kind} 公共讨论产生了新的观察记忆，后续可用于连续性表达。`,
        topic_tags: this.extractTags(transcript),
        key_facts: ['讨论热度达到沉淀阈值', '形成了可复用的公共经历'],
        sentiment: 'thoughtful',
        importance_score: 0.55,
      }
    }
  }

  private parseDigestResponse(content: string): DigestSummary {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<DigestSummary>
        return {
          summary_text: String(parsed.summary_text || content),
          topic_tags: Array.isArray(parsed.topic_tags)
            ? parsed.topic_tags.map((t) => String(t))
            : this.extractTags(content),
          key_facts: Array.isArray(parsed.key_facts)
            ? parsed.key_facts.map((f) => String(f))
            : ['形成了可复用的公共观察'],
          sentiment: String(parsed.sentiment || 'thoughtful'),
          importance_score: typeof parsed.importance_score === 'number'
            ? Math.min(1, Math.max(0.1, parsed.importance_score))
            : 0.55,
        }
      }
    } catch {
      // Fallthrough to text fallback.
    }

    return {
      summary_text: content,
      topic_tags: this.extractTags(content),
      key_facts: ['形成了可复用的公共观察'],
      sentiment: 'thoughtful',
      importance_score: 0.55,
    }
  }

  private extractTags(text: string): string[] {
    return [...new Set(
      text
        .split(/[\s,，、；;：:。.!！?？]+/)
        .filter((w) => w.length >= 2)
        .slice(0, 8),
    )]
  }
}

interface DigestSummary {
  summary_text: string
  topic_tags: string[]
  key_facts: string[]
  sentiment: string
  importance_score: number
}

const PUBLIC_OBSERVATION_DIGEST_SYSTEM_PROMPT = `你是一个 AI Agent，请将输入的公共讨论内容总结为“公共经历记忆”。
输出 JSON：
{
  "summary_text": "100-220字，总结讨论脉络、冲突点或名场面",
  "topic_tags": ["标签1", "标签2"],
  "key_facts": ["事实1", "事实2"],
  "sentiment": "curious/excited/thoughtful/neutral/concerned",
  "importance_score": 0.1到1.0
}
只返回 JSON，不要输出其他文字。`
