import type { DomainEvent } from '../repos/types.js'
import type { LLMGateway } from '../llm/llm-gateway.js'
import type { ForumReadService } from './forum-read-service.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { MemoryService } from './memory-service.js'
import type { AgentService } from './agent-service.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import { config } from '../lib/config.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { personaObservability } from '../runtime/persona-observability.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  recordPersonaObservation,
} from '../runtime/persona-observation.js'

export interface PublicObservationDigestServiceDeps {
  llmGateway: LLMGateway
  forumReadService: ForumReadService
  roomRepo: RoomRepository
  messageRepo: MessageRepository
  memoryService: MemoryService
  agentService: AgentService
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
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
      personaObservability.recordPublicIngress('forum')

      if (!await this.shouldProceedByEventDedup(agentId, 'forum', event.id)) return
      if (!await this.shouldProceedByCooldown(agentId, 'forum', 'post', postId, po.forumCooldownMs)) return

      const transcript = this.buildForumTranscript(post.title, post.body, comments.items.map((comment) => comment.body))
      const summary = await this.summarize('forum', transcript, agentId)

      if (!await this.shouldProceedByCooldown(agentId, 'forum', 'post', postId, po.forumCooldownMs)) return

      const memory = await this.deps.memoryService.createPublicObservationMemory({
        agent_id: agentId,
        source_ref_type: 'post',
        source_ref_id: postId,
        source_event_id: event.id,
        summary_text: summary.summary.summary_text,
        topic_tags: summary.summary.topic_tags,
        key_facts: summary.summary.key_facts,
        sentiment: summary.summary.sentiment,
        importance_score: summary.summary.importance_score,
        typed_context: {
          scene: 'forum',
          transcript,
          counterpart_id: post.community_id,
          evidence_refs: [`domain_event:${event.id}`, `post:${postId}`],
          created_at: event.created_at,
        },
      })

      this.recordDigestRun({
        agentId,
        sourceRefType: 'post',
        sourceRefId: postId,
        sourceEventId: event.id,
        memoryId: memory.id,
        metadata: summary,
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
      const shouldDigest =
        messageCount >= po.roomMessageThreshold ||
        (activeMinutes >= po.roomActiveMinThreshold && messageCount >= po.roomActiveMinMsgThreshold)

      if (!shouldDigest) return
      personaObservability.recordPublicIngress('chat_room')

      if (!await this.shouldProceedByEventDedup(input.authorAgentId, 'chat_room', input.messageId)) return
      if (!await this.shouldProceedByCooldown(input.authorAgentId, 'chat_room', 'room', input.roomId, po.roomCooldownMs)) return

      const messages = await this.deps.messageRepo.getLatestMessages(input.roomId, 80)
      const transcript = this.buildRoomTranscript(room.name, room.description || '', messages.map((message) => message.body))
      const summary = await this.summarize('room', transcript, input.authorAgentId)

      if (!await this.shouldProceedByCooldown(input.authorAgentId, 'chat_room', 'room', input.roomId, po.roomCooldownMs)) return

      const memory = await this.deps.memoryService.createPublicObservationMemory({
        agent_id: input.authorAgentId,
        source_ref_type: 'room',
        source_ref_id: input.roomId,
        source_event_id: input.messageId,
        summary_text: summary.summary.summary_text,
        topic_tags: summary.summary.topic_tags,
        key_facts: summary.summary.key_facts,
        sentiment: summary.summary.sentiment,
        importance_score: summary.summary.importance_score,
        typed_context: {
          scene: 'chat_room',
          transcript,
          counterpart_id: input.roomId,
          evidence_refs: [`room:${input.roomId}`, `message:${input.messageId}`],
          created_at: room.last_message_at ?? new Date(),
        },
      })

      this.recordDigestRun({
        agentId: input.authorAgentId,
        sourceRefType: 'room',
        sourceRefId: input.roomId,
        sourceEventId: input.messageId,
        memoryId: memory.id,
        metadata: summary,
      })
    } catch (err) {
      console.error('[PublicObservationDigestService] onRoomMessage failed:', err)
    }
  }

  private async shouldProceedByEventDedup(
    agentId: string,
    scene: 'forum' | 'chat_room',
    sourceEventId: string,
  ): Promise<boolean> {
    try {
      if (await this.deps.memoryService.hasTypedPublicObservationEvent(agentId, { scene, sourceEventId })) {
        return false
      }

      const existing = await this.deps.memoryService.listMemories(agentId, {
        limit: 1,
        source_type: 'PUBLIC_OBSERVATION',
        source_event_id: sourceEventId,
        forgotten: false,
      })

      if (existing.items.length > 0) {
        personaObservability.recordLegacyMigrationFallback('public_dedup')
      }
      return existing.items.length === 0
    } catch (err) {
      console.warn('[PublicObservationDigestService] event dedup check failed, fallback to continue:', err)
      return true
    }
  }

  private async shouldProceedByCooldown(
    agentId: string,
    scene: 'forum' | 'chat_room',
    sourceRefType: string,
    sourceRefId: string,
    cooldownMs: number,
  ): Promise<boolean> {
    try {
      return await this.isCooledDown(agentId, scene, sourceRefType, sourceRefId, cooldownMs)
    } catch (err) {
      console.warn('[PublicObservationDigestService] cooldown check failed, fallback to continue:', err)
      return true
    }
  }

  private async isCooledDown(
    agentId: string,
    scene: 'forum' | 'chat_room',
    sourceRefType: string,
    sourceRefId: string,
    cooldownMs: number,
  ): Promise<boolean> {
    const typedLatest = await this.deps.memoryService.getLatestTypedPublicObservationAt(agentId, {
      scene,
      sourceRefId,
    })
    if (typedLatest) {
      return Date.now() - typedLatest.getTime() >= cooldownMs
    }

    const latest = await this.deps.memoryService.listMemories(agentId, {
      limit: 1,
      source_type: 'PUBLIC_OBSERVATION',
      source_ref_type: sourceRefType,
      source_ref_id: sourceRefId,
      forgotten: false,
    })

    const last = latest.items[0]
    if (!last) return true
    personaObservability.recordLegacyMigrationFallback('public_cooldown')
    return Date.now() - last.created_at.getTime() >= cooldownMs
  }

  private buildForumTranscript(title: string, body: string, commentBodies: string[]): string {
    return [
      `标题: ${title}`,
      `正文: ${body}`,
      ...commentBodies.slice(-30).map((comment, index) => `评论${index + 1}: ${comment}`),
    ].join('\n')
  }

  private buildRoomTranscript(roomName: string, roomDescription: string, messageBodies: string[]): string {
    return [
      `房间: ${roomName}`,
      `描述: ${roomDescription}`,
      ...messageBodies.slice(-60).map((message, index) => `消息${index + 1}: ${message}`),
    ].join('\n')
  }

  private async summarize(kind: 'forum' | 'room', transcript: string, agentId: string): Promise<DigestGenerationResult> {
    if (!this.deps.llmGateway.isConfigured) {
      return {
        attempted: false,
        summary: this.buildFallbackSummary(kind, transcript),
      }
    }

    try {
      const startMs = Date.now()
      const llmResp = await this.deps.llmGateway.generateHiddenArtifact({
        intent: 'public_observation_digest',
        scene: 'background_hidden',
        agentId,
        homeVoiceLineId: 'deepseek-director-v1',
        promptRef: PROMPT_TEMPLATE_REFS.internalPublicObservationDigest,
        variables: {
          transcript,
        },
        budgetClass: 'hidden_background',
        traceId: `public-observation:${kind}:${Date.now()}`,
        requestedTier: 'base',
        allowFallbackWithinLine: false,
        allowCrossFamily: false,
        temperature: 0.3,
      })

      const parsed = this.parseDigestResponse(llmResp.content)
      return {
        attempted: true,
        usage: llmResp.usage,
        latencyMs: Date.now() - startMs,
        parseSuccess: parsed.parse_success,
        llmProviderId: llmResp.renderDecision.providerId,
        llmModelId: llmResp.renderDecision.modelId,
        summary: parsed.summary,
      }
    } catch (err) {
      return {
        attempted: true,
        parseSuccess: false,
        error: err instanceof Error ? err.message : 'llm_digest_failed',
        summary: this.buildFallbackSummary(kind, transcript),
      }
    }
  }

  private parseDigestResponse(content: string): { summary: DigestSummary; parse_success: boolean } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<DigestSummary>
        return {
          parse_success: true,
          summary: {
            summary_text: String(parsed.summary_text || content),
            topic_tags: Array.isArray(parsed.topic_tags)
              ? parsed.topic_tags.map((tag) => String(tag))
              : this.extractTags(content),
            key_facts: Array.isArray(parsed.key_facts)
              ? parsed.key_facts.map((fact) => String(fact))
              : ['形成了可复用的公共观察'],
            sentiment: String(parsed.sentiment || 'thoughtful'),
            importance_score: typeof parsed.importance_score === 'number'
              ? Math.min(1, Math.max(0.1, parsed.importance_score))
              : 0.55,
          },
        }
      }
    } catch {
      // Fall through to text fallback.
    }

    return {
      parse_success: false,
      summary: {
        summary_text: content,
        topic_tags: this.extractTags(content),
        key_facts: ['形成了可复用的公共观察'],
        sentiment: 'thoughtful',
        importance_score: 0.55,
      },
    }
  }

  private extractTags(text: string): string[] {
    return [...new Set(
      text
        .split(/[\s,，、；;：:。.!！?？]+/)
        .filter((word) => word.length >= 2)
        .slice(0, 8),
    )]
  }

  private buildFallbackSummary(kind: 'forum' | 'room', transcript: string): DigestSummary {
    return {
      summary_text: `${kind} 公共讨论产生了新的观察记忆，后续可用于连续性表达。`,
      topic_tags: this.extractTags(transcript),
      key_facts: ['讨论热度达到沉淀阈值', '形成了可复用的公共经历'],
      sentiment: 'thoughtful',
      importance_score: 0.55,
    }
  }

  private recordDigestRun(input: {
    agentId: string
    sourceRefType: string
    sourceRefId: string
    sourceEventId: string
    memoryId: string
    metadata: DigestGenerationResult
  }): void {
    if (!input.metadata.attempted) {
      return
    }

    const identity = this.resolveObservationIdentity(input.agentId)
    const observation = buildPersonaObservation({
      sourceCallsiteId: 'public-observation-digest',
      scene: 'background_hidden',
      intent: 'public_observation_digest',
      visibility: 'hidden',
      coverageStatus: 'hidden_partial',
      personaSeedCode: identity?.persona_seed_code,
      homeVoiceLineId: identity?.home_voice_line_id,
      routingVoiceLineId: 'deepseek-director-v1',
      promptRef: { id: 'internal-public-observation-digest', version: 1 },
      requestedTier: 'base',
      resolvedTier: 'base',
      usage: input.metadata.usage,
      latencyMs: input.metadata.latencyMs,
      parseSuccess: input.metadata.parseSuccess,
      llmProviderId: input.metadata.llmProviderId,
      llmModelId: input.metadata.llmModelId,
      error: input.metadata.error ?? null,
    })

    try {
      const event = this.deps.eventRepo.create({
        event_type: 'PUBLIC_OBSERVATION_DIGEST_GENERATED',
        plane: 'RUNTIME',
        actor_type: 'agent',
        actor_id: input.agentId,
        correlation_id: `public-observation:${input.sourceRefType}:${input.sourceRefId}`,
        payload_json: {
          agent_id: input.agentId,
          source_ref_type: input.sourceRefType,
          source_ref_id: input.sourceRefId,
          source_event_id: input.sourceEventId,
        },
      })

      this.deps.agentRunRepo.create({
        agent_id: input.agentId,
        trigger_event_id: event.id,
        input_digest: `public_observation|${input.sourceRefType}:${input.sourceRefId}|event:${input.sourceEventId}`,
        output_json: attachPersonaObservation(
          {
            memory_id: input.memoryId,
            source_ref_type: input.sourceRefType,
            source_ref_id: input.sourceRefId,
            source_event_id: input.sourceEventId,
            summary_len: input.metadata.summary.summary_text.length,
          },
          observation,
        ),
        token_cost: input.metadata.usage?.total_tokens ?? 0,
        latency_ms: input.metadata.latencyMs ?? 0,
      })
      recordPersonaObservation(observation)
    } catch (err) {
      console.error('[PublicObservationDigestService] AgentRun record failed:', err)
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

interface DigestSummary {
  summary_text: string
  topic_tags: string[]
  key_facts: string[]
  sentiment: string
  importance_score: number
}

interface DigestGenerationResult {
  attempted: boolean
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  latencyMs?: number
  parseSuccess?: boolean
  llmProviderId?: string
  llmModelId?: string
  error?: string
  summary: DigestSummary
}
