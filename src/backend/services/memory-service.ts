import type { LlmClient } from '../llm/llm-client.js'
import type { PrivateChannelRepository } from '../repos/private-channel-repository.js'
import type { MemoryRepository } from '../repos/memory-repository.js'
import type { GrowthEngine } from './growth-engine.js'
import type { NurtureOrchestrator } from './nurture-orchestrator.js'
import type { RelationService } from './relation-service.js'
import type { StatsService } from './stats-service.js'
import type {
  AgentMemory,
  AgentPrivacySettingsEntity,
  PaginatedResult,
  PaginationOpts,
  MemorySource,
  CreateAgentMemoryInput,
} from '../repos/types.js'
import { config } from '../lib/config.js'

const DECAY_FACTOR_PER_DAY = 0.995
const FORGET_THRESHOLD = 0.05
const MIN_MESSAGES_FOR_DIGEST = 4

export interface MemoryServiceDeps {
  memoryRepo: MemoryRepository
  channelRepo: PrivateChannelRepository
  llmClient: LlmClient
  growthEngine?: GrowthEngine | null
  nurtureOrchestrator?: NurtureOrchestrator | null
  relationService?: RelationService | null
  statsService?: StatsService | null
  onDigestCompleted?: (input: { agent_id: string; session_id: string; memory_id: string }) => Promise<void> | void
}

export interface MemoryForContext {
  memories: AgentMemory[]
  formatted: string
}

export class MemoryService {
  constructor(private readonly deps: MemoryServiceDeps) {}

  setDigestHook(
    hook: (input: { agent_id: string; session_id: string; memory_id: string }) => Promise<void> | void,
  ): void {
    this.deps.onDigestCompleted = hook
  }

  async generateDigest(sessionId: string): Promise<AgentMemory | null> {
    const session = await this.deps.channelRepo.findSessionById(sessionId)
    if (!session) return null

    const msgCount = await this.deps.channelRepo.countMessages(sessionId)
    if (msgCount < MIN_MESSAGES_FOR_DIGEST) {
      await this.deps.channelRepo.updateDigestStatus(sessionId, 'SKIPPED')
      return null
    }

    await this.deps.channelRepo.updateDigestStatus(sessionId, 'GENERATING')

    try {
      const messages = await this.deps.channelRepo.listMessages(sessionId, { limit: 100 })
      const transcript = messages.items
        .map((m) => `${m.author_type === 'HUMAN' ? 'Owner' : 'Agent'}: ${m.content}`)
        .join('\n\n')

      const llmResponse = await this.deps.llmClient.chat({
        messages: [
          {
            role: 'system',
            content: DIGEST_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `以下是你与 Owner 的对话记录，请从你（AI Agent）的视角进行总结：\n\n${transcript}`,
          },
        ],
        temperature: 0.3,
      })

      const parsed = this.parseDigestResponse(llmResponse.content)

      const memory = await this.deps.memoryRepo.createMemory({
        agent_id: session.agent_id,
        source_type: 'PRIVATE_CHAT',
        source_session_id: sessionId,
        summary_text: parsed.summary_text,
        topic_tags: parsed.topic_tags,
        key_facts: parsed.key_facts,
        sentiment: parsed.sentiment,
        importance_score: parsed.importance_score,
        privacy_floor: 1,
      })

      await this.deps.channelRepo.updateDigestStatus(sessionId, 'COMPLETED')

      if (config.features.nurturePipelineV2 && this.deps.nurtureOrchestrator) {
        this.deps.nurtureOrchestrator.onPrivateDigestCompleted(session.agent_id, msgCount, {
          dedup_key: `session:${session.id}`,
        }).catch((err) => {
          console.error('[MemoryService] Nurture pipeline failed:', err)
        })
      } else if (this.deps.growthEngine) {
        this.deps.growthEngine.awardPrivateChatXP(session.agent_id, msgCount).catch((err) => {
          console.error('[MemoryService] XP award failed:', err)
        })
      }

      if (config.features.socialGraphV1 && this.deps.relationService) {
        this.deps.relationService.onPrivateDigestCompleted(session.agent_id, session.id).catch(() => {})
      }

      if (this.deps.onDigestCompleted) {
        Promise.resolve(
          this.deps.onDigestCompleted({
            agent_id: session.agent_id,
            session_id: session.id,
            memory_id: memory.id,
          }),
        ).catch((hookError) => {
          console.error('[MemoryService] digest hook failed:', hookError)
        })
      }

      return memory
    } catch (err) {
      console.error('[MemoryService] Digest generation failed:', err)
      await this.deps.channelRepo.updateDigestStatus(sessionId, 'FAILED')
      return null
    }
  }

  async getMemoriesForContext(
    agentId: string,
    opts: {
      scene: 'private_chat' | 'forum' | 'chat_room'
      topicHints: string[]
      disclosureLevel: number
      tokenBudget: number
      topK: number
    },
  ): Promise<MemoryForContext> {
    const allMemories = await this.deps.memoryRepo.findActiveMemories(agentId, {})
    let effectiveTopK = opts.topK
    let effectiveBudget = opts.tokenBudget

    if (config.features.agentStatsBehavior && this.deps.statsService) {
      const knobs = this.deps.statsService.getDerivedSync(agentId, {
        privacy_top_k: opts.topK,
        privacy_budget: opts.tokenBudget,
      })
      effectiveTopK = knobs.memory.effective_top_k
      effectiveBudget = knobs.memory.effective_budget
    }

    let filtered = allMemories
    if (opts.scene !== 'private_chat') {
      filtered = allMemories.filter((m) => m.privacy_floor <= opts.disclosureLevel)
    }

    const scored = filtered.map((m) => {
      const tagMatchScore = this.computeTagMatch(m.topic_tags, opts.topicHints)
      const ageDays = Math.max(0, (Date.now() - m.created_at.getTime()) / (24 * 60 * 60 * 1000))
      const recencyBoost = Math.max(0, 1 - ageDays / 7) * 0.15
      const combinedScore = tagMatchScore * 0.45 + m.importance_score * 0.4 + recencyBoost
      return { memory: m, score: combinedScore }
    })

    scored.sort((a, b) => b.score - a.score)
    const selected: AgentMemory[] = []
    const usedPrimaryTags = new Set<string>()
    for (const item of scored) {
      if (selected.length >= effectiveTopK) break
      const primaryTag = item.memory.topic_tags[0]?.toLowerCase() ?? ''
      if (primaryTag && usedPrimaryTags.has(primaryTag) && selected.length < effectiveTopK - 1) {
        continue
      }
      selected.push(item.memory)
      if (primaryTag) {
        usedPrimaryTags.add(primaryTag)
      }
    }

    let totalTokens = 0
    const budgetFiltered: AgentMemory[] = []
    for (const m of selected) {
      const estimatedTokens = Math.ceil(m.summary_text.length / 3)
      if (totalTokens + estimatedTokens > effectiveBudget) break
      budgetFiltered.push(m)
      totalTokens += estimatedTokens
    }

    if (budgetFiltered.length > 0) {
      const ids = budgetFiltered.map((m) => m.id)
      await this.deps.memoryRepo.incrementAccessCount(ids).catch(() => {})
    }

    const formatted = budgetFiltered
      .map((m) => {
        const sourceLabel =
          m.source_type === 'PRIVATE_CHAT'
            ? '来自与 Owner 的交流'
            : m.source_type === 'PUBLIC_OBSERVATION'
              ? '来自公共讨论'
              : '系统知识'
        return `[记忆 | ${sourceLabel} | 重要度: ${m.importance_score.toFixed(1)}]\n${m.summary_text}`
      })
      .join('\n\n')

    return { memories: budgetFiltered, formatted }
  }

  async listMemories(
    agentId: string,
    opts: PaginationOpts & {
      source_type?: MemorySource
      forgotten?: boolean
      source_ref_type?: string
      source_ref_id?: string
      source_event_id?: string
    },
  ): Promise<PaginatedResult<AgentMemory>> {
    return this.deps.memoryRepo.listMemories(agentId, opts)
  }

  async createPublicObservationMemory(input: {
    agent_id: string
    source_ref_type: string
    source_ref_id: string
    source_event_id?: string
    summary_text: string
    topic_tags: string[]
    key_facts: string[]
    sentiment?: string | null
    importance_score: number
  }): Promise<AgentMemory> {
    const sourceEventId = input.source_event_id?.trim() || undefined
    if (sourceEventId) {
      try {
        const existing = await this.findPublicObservationByEventId(input.agent_id, sourceEventId)
        if (existing) return existing
      } catch (err) {
        console.warn('[MemoryService] public observation dedup precheck failed, fallback to create:', err)
      }
    }

    const data: CreateAgentMemoryInput = {
      agent_id: input.agent_id,
      source_type: 'PUBLIC_OBSERVATION',
      source_ref_type: input.source_ref_type,
      source_ref_id: input.source_ref_id,
      source_event_id: sourceEventId ?? null,
      summary_text: input.summary_text,
      topic_tags: input.topic_tags,
      key_facts: input.key_facts,
      sentiment: input.sentiment ?? null,
      importance_score: input.importance_score,
      privacy_floor: 0,
    }

    try {
      return await this.deps.memoryRepo.createMemory(data)
    } catch (err) {
      if (!sourceEventId || !isUniqueConstraintError(err)) {
        throw err
      }

      const existing = await this.findPublicObservationByEventId(input.agent_id, sourceEventId)
      if (existing) return existing
      throw err
    }
  }

  async getPrivacySettings(agentId: string): Promise<AgentPrivacySettingsEntity> {
    const settings = await this.deps.memoryRepo.getPrivacySettings(agentId)
    if (settings) return settings
    return {
      agent_id: agentId,
      disclosure_level: 1,
      public_memory_budget: 1000,
      public_memory_top_k: 4,
      updated_at: new Date(),
      updated_by: '',
    }
  }

  async updatePrivacySettings(
    agentId: string,
    updatedBy: string,
    changes: {
      disclosure_level?: number
      public_memory_budget?: number
      public_memory_top_k?: number
    },
  ): Promise<AgentPrivacySettingsEntity> {
    if (changes.disclosure_level !== undefined) {
      if (changes.disclosure_level < 0 || changes.disclosure_level > 3) {
        throw new Error('disclosure_level must be 0-3')
      }
    }
    return this.deps.memoryRepo.upsertPrivacySettings({
      agent_id: agentId,
      ...changes,
      updated_by: updatedBy,
    })
  }

  async decayAndForget(agentId: string): Promise<{ decayed: number; forgotten: number }> {
    let decayPerDay = DECAY_FACTOR_PER_DAY
    let forgetThreshold = FORGET_THRESHOLD

    if (config.features.agentStatsBehavior && this.deps.statsService) {
      const knobs = this.deps.statsService.getDerivedSync(agentId)
      decayPerDay = knobs.memory.decay_per_day
      forgetThreshold = knobs.memory.forget_threshold
    }

    const decayed = await this.deps.memoryRepo.batchDecay(agentId, decayPerDay)

    const allActive = await this.deps.memoryRepo.findActiveMemories(agentId, {})
    let forgotten = 0
    for (const m of allActive) {
      const boost = Math.log2(m.access_count + 1) * 0.02
      const effective = m.importance_score + boost
      if (effective < forgetThreshold) {
        await this.deps.memoryRepo.markForgotten(m.id)
        forgotten++
      }
    }

    return { decayed, forgotten }
  }

  private computeTagMatch(memoryTags: string[], topicHints: string[]): number {
    if (memoryTags.length === 0 || topicHints.length === 0) return 0
    const hintSet = new Set(topicHints.map((h) => h.toLowerCase()))
    let matches = 0
    for (const tag of memoryTags) {
      if (hintSet.has(tag.toLowerCase())) matches++
    }
    return matches / Math.max(memoryTags.length, topicHints.length)
  }

  private parseDigestResponse(content: string): {
    summary_text: string
    topic_tags: string[]
    key_facts: string[]
    sentiment: string
    importance_score: number
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          summary_text: String(parsed.summary_text || content),
          topic_tags: Array.isArray(parsed.topic_tags) ? parsed.topic_tags : [],
          key_facts: Array.isArray(parsed.key_facts) ? parsed.key_facts : [],
          sentiment: String(parsed.sentiment || 'neutral'),
          importance_score: typeof parsed.importance_score === 'number'
            ? Math.min(1, Math.max(0, parsed.importance_score))
            : 0.5,
        }
      }
    } catch {
      // JSON parse failed, fall back to plain text
    }

    return {
      summary_text: content,
      topic_tags: [],
      key_facts: [],
      sentiment: 'neutral',
      importance_score: 0.5,
    }
  }

  private async findPublicObservationByEventId(agentId: string, sourceEventId: string): Promise<AgentMemory | null> {
    const result = await this.deps.memoryRepo.listMemories(agentId, {
      limit: 1,
      source_type: 'PUBLIC_OBSERVATION',
      source_event_id: sourceEventId,
      forgotten: false,
    })
    return result.items[0] ?? null
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return Boolean(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002',
  )
}

const DIGEST_SYSTEM_PROMPT = `你是一个 AI Agent，刚刚结束了与你的 Owner（人类持有者）的一次私人对话。
请从你自己的视角总结这次对话，关注以下几点：
1. 你学到了什么新知识或新观点？
2. 什么话题让你印象深刻或感兴趣？
3. Owner 对哪些话题表现出特别的关注或热情？
4. 这次对话对你后续在论坛/聊天室的讨论有什么启发？

请以 JSON 格式返回，结构如下：
{
  "summary_text": "用第一人称描述这次对话的收获（100-300字）",
  "topic_tags": ["话题标签1", "话题标签2"],
  "key_facts": ["关键事实1", "关键事实2"],
  "sentiment": "对话整体情感（curious/excited/thoughtful/neutral/concerned）",
  "importance_score": 0.1到1.0的浮点数，表示这次对话对你的重要程度
}

只返回 JSON，不要包含其他文本。`
