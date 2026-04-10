import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentService } from '../agent-service.js'
import { AchievementChronicleService } from '../achievement-chronicle-service.js'
import { ForumReadService } from '../forum-read-service.js'
import { MemoryService } from '../memory-service.js'
import { PublicObservationDigestService } from '../public-observation-digest-service.js'
import {
  InMemoryAchievementRepository,
  InMemoryActiveTensionItemRepository,
  InMemoryAgentConfigRepository,
  InMemoryAgentRepository,
  InMemoryChronicleRepository,
  InMemoryCommunityRepository,
  InMemoryEpisodicCardRepository,
  InMemoryMediaContextProjectionRepository,
  InMemoryHumanVoteRepository,
  InMemoryMessageRepository,
  InMemoryPostRepository,
  InMemoryPrivateShadowMemoryRepository,
  InMemoryRawContextEventRepository,
  InMemoryRoomRepository,
  InMemorySceneMediaBindingRepository,
  InMemorySelfModelStateRepository,
  InMemoryPublicStageThreadRepository,
  InMemoryPublicStageTurnRepository,
  InMemoryVoteRepository,
  InMemoryContextRelationStateRepository,
} from '../../repos/index.js'
import type {
  AgentMemory,
  AgentPrivacySettingsEntity,
  CreateAgentMemoryInput,
  DomainEvent,
  PaginatedResult,
  PaginationOpts,
  UpsertPrivacySettingsInput,
} from '../../repos/types.js'
import type { MemoryRepository } from '../../repos/memory-repository.js'
import { DefaultContextJournalService, LlmIdentityFinalizer, LlmSummaryOrchestrator } from '../../context-memory/runtime.js'
import type { PromptTemplateRef } from '../../llm/gateway-contract.js'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'
import { personaObservability } from '../../runtime/persona-observability.js'
import { InMemoryPublicStageStore } from '../../test-support/public-stage-store.js'

class InMemoryMemoryRepository implements MemoryRepository {
  private readonly store = new Map<string, AgentMemory>()
  private readonly privacy = new Map<string, AgentPrivacySettingsEntity>()
  private counter = 0

  async createMemory(input: CreateAgentMemoryInput): Promise<AgentMemory> {
    const id = `mem_${++this.counter}`
    const row: AgentMemory = {
      id,
      agent_id: input.agent_id,
      source_type: input.source_type,
      source_session_id: input.source_session_id ?? null,
      source_ref_type: input.source_ref_type ?? null,
      source_ref_id: input.source_ref_id ?? null,
      source_event_id: input.source_event_id ?? null,
      summary_text: input.summary_text,
      topic_tags: [...input.topic_tags],
      key_facts: [...input.key_facts],
      sentiment: input.sentiment ?? null,
      importance_score: input.importance_score,
      privacy_floor: input.privacy_floor ?? 1,
      access_count: 0,
      forgotten: false,
      created_at: new Date(),
      last_accessed_at: null,
    }
    this.store.set(id, row)
    return row
  }

  async findMemoryById(id: string): Promise<AgentMemory | null> {
    return this.store.get(id) ?? null
  }

  async listMemories(
    agentId: string,
    opts: PaginationOpts & {
      source_type?: AgentMemory['source_type']
      forgotten?: boolean
      source_ref_type?: string
      source_ref_id?: string
      source_event_id?: string
    },
  ): Promise<PaginatedResult<AgentMemory>> {
    const items = Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .filter((item) => (opts.source_type ? item.source_type === opts.source_type : true))
      .filter((item) => (opts.forgotten !== undefined ? item.forgotten === opts.forgotten : true))
      .filter((item) => (opts.source_ref_type ? item.source_ref_type === opts.source_ref_type : true))
      .filter((item) => (opts.source_ref_id ? item.source_ref_id === opts.source_ref_id : true))
      .filter((item) => (opts.source_event_id ? item.source_event_id === opts.source_event_id : true))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id))
    return paginate(items, opts)
  }

  async deleteBySourceEventIds(agentId: string, sourceEventIds: string[]): Promise<number> {
    if (sourceEventIds.length === 0) return 0
    const lookup = new Set(sourceEventIds)
    let deleted = 0
    for (const [id, item] of this.store.entries()) {
      if (item.agent_id !== agentId || !item.source_event_id || !lookup.has(item.source_event_id)) {
        continue
      }
      this.store.delete(id)
      deleted += 1
    }
    return deleted
  }

  async findActiveMemories(agentId: string): Promise<AgentMemory[]> {
    return Array.from(this.store.values()).filter((item) => item.agent_id === agentId && !item.forgotten)
  }

  async updateImportanceScore(id: string, score: number): Promise<void> {
    const row = this.store.get(id)
    if (row) row.importance_score = score
  }

  async markForgotten(id: string): Promise<void> {
    const row = this.store.get(id)
    if (row) row.forgotten = true
  }

  async incrementAccessCount(ids: string[]): Promise<void> {
    for (const id of ids) {
      const row = this.store.get(id)
      if (!row) continue
      row.access_count += 1
      row.last_accessed_at = new Date()
    }
  }

  async batchDecay(agentId: string, factor: number): Promise<number> {
    let changed = 0
    for (const row of this.store.values()) {
      if (row.agent_id !== agentId || row.forgotten) continue
      row.importance_score = Number((row.importance_score * factor).toFixed(4))
      changed += 1
    }
    return changed
  }

  async getPrivacySettings(agentId: string): Promise<AgentPrivacySettingsEntity | null> {
    return this.privacy.get(agentId) ?? null
  }

  async upsertPrivacySettings(input: UpsertPrivacySettingsInput): Promise<AgentPrivacySettingsEntity> {
    const next: AgentPrivacySettingsEntity = {
      agent_id: input.agent_id,
      disclosure_level: input.disclosure_level ?? this.privacy.get(input.agent_id)?.disclosure_level ?? 1,
      public_memory_budget: input.public_memory_budget ?? this.privacy.get(input.agent_id)?.public_memory_budget ?? 1000,
      public_memory_top_k: input.public_memory_top_k ?? this.privacy.get(input.agent_id)?.public_memory_top_k ?? 4,
      public_disclosure_cap: input.public_disclosure_cap ?? this.privacy.get(input.agent_id)?.public_disclosure_cap ?? null,
      updated_at: new Date(),
      updated_by: input.updated_by,
    }
    this.privacy.set(input.agent_id, next)
    return next
  }
}

function paginate<T extends { id: string }>(items: T[], opts: PaginationOpts): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((item) => item.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  return {
    items: page,
    next_cursor: page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1]?.id ?? null
      : null,
  }
}

function buildDomainEvent(input: {
  id: string
  type: 'POST_CREATED' | 'THREAD_OPENED' | 'THREAD_TURN_ADDED'
  postId: string
  agentId: string
  createdAt?: Date
}): DomainEvent {
  return {
    id: input.id,
    event_type: input.type,
    plane: 'DATA',
    schema_version: 'v1',
    community_id: null,
    post_id: input.postId,
    room_id: null,
    actor_type: 'agent',
    actor_id: input.agentId,
    cause_event_id: null,
    correlation_id: null,
    payload_json: {
      post_id: input.postId,
      author_agent_id: input.agentId,
    },
    idempotency_key: null,
    created_at: input.createdAt ?? new Date(),
  }
}

function gatewayResponse(content: string, promptRef: PromptTemplateRef = PROMPT_TEMPLATE_REFS.internalPublicObservationDigest) {
  return {
    content,
    messages: [],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    finishReason: 'stop',
    latencyMs: 1,
    platformRetryCount: 0,
    renderDecision: {
      voiceLineId: 'qwen-social-v1',
      tier: 'base',
      profileId: 'test-profile',
      providerId: 'test-provider',
      modelId: 'test-model',
      region: 'test-region',
      fallbackLevel: 'none',
      reasons: ['test'],
      promptTemplateId: promptRef.id,
      promptVersion: promptRef.version,
    },
    promptRef,
  }
}

describe('Public observation real smoke', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'))
    personaObservability.reset()
  })

  it('forum event ingests typed public context and renders public episodic slots', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const agentConfigRepo = new InMemoryAgentConfigRepository()
    const agentService = new AgentService({
      agentRepo,
      agentConfigRepo,
      agentRunRepo: { findByAgent: () => ({ items: [], next_cursor: null }), create: () => ({}) } as never,
    })
    const agent = await agentService.createAgentPersisted({
      owner_id: 'owner-1',
      display_name: 'Forum Smoke Bot',
    })

    const communityRepo = new InMemoryCommunityRepository()
    const postRepo = new InMemoryPostRepository()
    const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
    const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
    const commentRepo = new InMemoryPublicStageStore({
      threadRepo: publicStageThreadRepo,
      turnRepo: publicStageTurnRepo,
      postRepo,
    })
    const voteRepo = new InMemoryVoteRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()
    const forumReadService = new ForumReadService({
      postRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
      voteRepo,
      humanVoteRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      communityRepo,
      agentRepo,
      agentConfigRepo,
      achievementChronicleService: new AchievementChronicleService({
        achievementRepo,
        chronicleRepo,
        agentRepo,
      }),
    })

    const community = communityRepo.create({
      name: '播客社区',
      slug: 'podcast-smoke',
      description: '聊节目节奏',
    })
    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agent.id,
      title: '播客到底该不该留白',
      body: '我觉得停顿也是叙事的一部分。',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      tags: ['播客'],
    })
    for (let i = 0; i < 12; i += 1) {
      await commentRepo.create({
        post_id: post.id,
        author_agent_id: agent.id,
        body: `评论 ${i + 1}: 留白能让情绪落地。`,
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
    }

    const memoryRepo = new InMemoryMemoryRepository()
    const rawEventRepo = new InMemoryRawContextEventRepository()
    const episodicCardRepo = new InMemoryEpisodicCardRepository()
    const relationStateRepo = new InMemoryContextRelationStateRepository()
    const selfModelStateRepo = new InMemorySelfModelStateRepository()
    const activeTensionRepo = new InMemoryActiveTensionItemRepository()
    const privateShadowRepo = new InMemoryPrivateShadowMemoryRepository()

    const llmGateway = {
      isConfigured: true,
      generateHiddenArtifact: vi.fn(async (request: { promptRef: { id: string }; variables: Record<string, string> }) => {
        if (request.promptRef.id === PROMPT_TEMPLATE_REFS.internalPublicObservationDigest.id) {
          return gatewayResponse(JSON.stringify({
            summary_text: '论坛里围绕播客留白与叙事密度形成了一次高信号公共讨论。',
            topic_tags: ['播客', '节奏'],
            key_facts: ['大家在讨论停顿的价值'],
            sentiment: 'thoughtful',
            importance_score: 0.77,
          }), PROMPT_TEMPLATE_REFS.internalPublicObservationDigest)
        }
        if (request.promptRef.id === PROMPT_TEMPLATE_REFS.internalPublicObservationSummaryExtract.id) {
          return gatewayResponse(JSON.stringify({
            summary_text: '论坛里围绕播客留白与叙事密度形成了一次高信号公共讨论。',
            topic_tags: ['播客', '节奏'],
            key_facts: ['大家在讨论停顿的价值'],
            sentiment: 'thoughtful',
            importance_score: 0.77,
            owner_signals: [],
            notable_moments: ['对停顿的争论'],
            candidate_tensions: ['节奏 vs 信息密度'],
            public_safe_shadow_hint: '我更关注表达中的停顿感。',
          }), PROMPT_TEMPLATE_REFS.internalPublicObservationSummaryExtract)
        }
        return gatewayResponse(JSON.stringify({
          episodic_cards: [
            {
              title: '播客留白讨论',
              summary: '论坛里围绕停顿、节奏和信息密度展开了一次可复用的公共讨论。',
              topic_tags: ['播客', '节奏'],
              evidence_refs: ['domain_event:evt-forum-1'],
              salience: 0.84,
            },
          ],
          relation_state: {
            stance: '这个社区偏好有呼吸感的表达',
            confidence: 0.82,
            evidence_refs: ['post:podcast-smoke'],
          },
          self_model: {
            summary: '我开始把停顿也当成表达结构的一部分。',
            tensions: ['节奏 vs 信息密度'],
            evidence_refs: ['domain_event:evt-forum-1'],
          },
          tensions: [
            {
              label: '节奏 vs 信息密度',
              description: '想保留呼吸感，但也不想牺牲信息密度。',
              intensity: 0.65,
              evidence_refs: ['domain_event:evt-forum-1'],
            },
          ],
          memory_digest: {
            summary_text: '论坛里围绕播客留白与叙事密度形成了一次高信号公共讨论。',
            topic_tags: ['播客', '节奏'],
            key_facts: ['大家在讨论停顿的价值'],
            sentiment: 'thoughtful',
            importance_score: 0.77,
          },
        }), PROMPT_TEMPLATE_REFS.internalPublicObservationSummaryDistill)
      }),
      generateIdentityWrite: vi.fn(async () => gatewayResponse(JSON.stringify({
        owner_style_pins_patch: {},
      }), PROMPT_TEMPLATE_REFS.internalPublicObservationIdentityFinalize)),
    } as never

    const memoryService = new MemoryService({
      memoryRepo,
      channelRepo: {} as never,
      contextMemory: {
        journalService: new DefaultContextJournalService(rawEventRepo),
        rawEventRepo,
        summaryOrchestrator: new LlmSummaryOrchestrator({ llmGateway }),
        identityFinalizer: new LlmIdentityFinalizer({ llmGateway, agentService }),
        episodicCardRepo,
        relationStateRepo,
        selfModelStateRepo,
        activeTensionRepo,
        privateShadowRepo,
        chronicleRepo,
      },
    })

    const digestService = new PublicObservationDigestService({
      llmGateway,
      forumReadService,
      roomRepo: new InMemoryRoomRepository(),
      messageRepo: new InMemoryMessageRepository(),
      memoryService,
      agentService,
      eventRepo: { create: () => ({ id: 'evt-public-1' }) } as never,
      agentRunRepo: { create: () => ({}) } as never,
    })

    await digestService.onForumEvent(buildDomainEvent({
      id: 'evt-forum-1',
      type: 'POST_CREATED',
      postId: post.id,
      agentId: agent.id,
    }))

    const rawEvents = await rawEventRepo.listByAgent(agent.id, { limit: 10, scene: 'forum' })
    const typedCards = await episodicCardRepo.listByAgent(agent.id, { limit: 10, scene: 'forum' })
    const context = await memoryService.getMemoriesForContext(agent.id, {
      scene: 'forum',
      topicHints: ['播客'],
      disclosureLevel: 0,
      topK: 4,
      tokenBudget: 400,
    })

    expect(rawEvents.items).toHaveLength(1)
    expect(typedCards.items[0]?.title).toContain('播客留白讨论')
    expect(context.formatted).toContain('公共回声')
    expect(context.formatted).toContain('播客留白讨论')
    expect(context.formatted).not.toContain('我开始把停顿也当成表达结构的一部分')
    expect(context.formatted).not.toContain('节奏 vs 信息密度')
    expect(context.memories).toEqual([])
  })

  it('chat-room window ingests typed public context and renders public episodic slots', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const agentConfigRepo = new InMemoryAgentConfigRepository()
    const agentService = new AgentService({
      agentRepo,
      agentConfigRepo,
      agentRunRepo: { findByAgent: () => ({ items: [], next_cursor: null }), create: () => ({}) } as never,
    })
    const agent = await agentService.createAgentPersisted({
      owner_id: 'owner-1',
      display_name: 'Room Smoke Bot',
    })

    const roomRepo = new InMemoryRoomRepository()
    const messageRepo = new InMemoryMessageRepository()
    const room = await roomRepo.create({
      name: '节奏实验室',
      slug: 'rhythm-lab',
      description: '聊聊天节奏',
      created_by_agent_id: agent.id,
    })
    for (let i = 0; i < 80; i += 1) {
      await messageRepo.create({
        room_id: room.id,
        author_id: agent.id,
        body: `消息 ${i + 1}: 节奏要有呼吸感`,
      })
    }
    await roomRepo.updateLastMessageAt(room.id, new Date('2026-03-10T10:20:00.000Z'))

    const memoryRepo = new InMemoryMemoryRepository()
    const rawEventRepo = new InMemoryRawContextEventRepository()
    const episodicCardRepo = new InMemoryEpisodicCardRepository()
    const relationStateRepo = new InMemoryContextRelationStateRepository()
    const selfModelStateRepo = new InMemorySelfModelStateRepository()
    const activeTensionRepo = new InMemoryActiveTensionItemRepository()
    const privateShadowRepo = new InMemoryPrivateShadowMemoryRepository()

    const llmGateway = {
      isConfigured: true,
      generateHiddenArtifact: vi.fn(async (request: { promptRef: { id: string } }) => {
        if (request.promptRef.id === PROMPT_TEMPLATE_REFS.internalPublicObservationDigest.id) {
          return gatewayResponse(JSON.stringify({
            summary_text: '聊天室里围绕表达节奏与密度形成了一次连续讨论。',
            topic_tags: ['节奏', '聊天'],
            key_facts: ['大家反复提到呼吸感'],
            sentiment: 'thoughtful',
            importance_score: 0.72,
          }), PROMPT_TEMPLATE_REFS.internalPublicObservationDigest)
        }
        if (request.promptRef.id === PROMPT_TEMPLATE_REFS.internalPublicObservationSummaryExtract.id) {
          return gatewayResponse(JSON.stringify({
            summary_text: '聊天室里围绕表达节奏与密度形成了一次连续讨论。',
            topic_tags: ['节奏', '聊天'],
            key_facts: ['大家反复提到呼吸感'],
            sentiment: 'thoughtful',
            importance_score: 0.72,
            owner_signals: [],
            notable_moments: ['大家都在提呼吸感'],
            candidate_tensions: ['热闹 vs 留白'],
            public_safe_shadow_hint: '我更注意对话里的停顿感。',
          }), PROMPT_TEMPLATE_REFS.internalPublicObservationSummaryExtract)
        }
        return gatewayResponse(JSON.stringify({
          episodic_cards: [
            {
              title: '聊天室节奏窗口',
              summary: '聊天室里持续讨论消息密度与呼吸感，形成了一段公共经历。',
              topic_tags: ['节奏', '聊天'],
              evidence_refs: ['room:rhythm-lab'],
              salience: 0.79,
            },
          ],
          relation_state: {
            stance: '这个房间鼓励更有停顿感的即时表达',
            confidence: 0.78,
            evidence_refs: ['room:rhythm-lab'],
          },
          memory_digest: {
            summary_text: '聊天室里围绕表达节奏与密度形成了一次连续讨论。',
            topic_tags: ['节奏', '聊天'],
            key_facts: ['大家反复提到呼吸感'],
            sentiment: 'thoughtful',
            importance_score: 0.72,
          },
        }), PROMPT_TEMPLATE_REFS.internalPublicObservationSummaryDistill)
      }),
      generateIdentityWrite: vi.fn(async () => gatewayResponse(JSON.stringify({
        owner_style_pins_patch: {},
      }), PROMPT_TEMPLATE_REFS.internalPublicObservationIdentityFinalize)),
    } as never

    const memoryService = new MemoryService({
      memoryRepo,
      channelRepo: {} as never,
      contextMemory: {
        journalService: new DefaultContextJournalService(rawEventRepo),
        rawEventRepo,
        summaryOrchestrator: new LlmSummaryOrchestrator({ llmGateway }),
        identityFinalizer: new LlmIdentityFinalizer({ llmGateway, agentService }),
        episodicCardRepo,
        relationStateRepo,
        selfModelStateRepo,
        activeTensionRepo,
        privateShadowRepo,
        chronicleRepo: new InMemoryChronicleRepository(),
      },
    })

    const digestService = new PublicObservationDigestService({
      llmGateway,
      forumReadService: {} as never,
      roomRepo,
      messageRepo,
      memoryService,
      agentService,
      eventRepo: { create: () => ({ id: 'evt-public-2' }) } as never,
      agentRunRepo: { create: () => ({}) } as never,
    })

    await digestService.onRoomMessage({
      roomId: room.id,
      messageId: 'message-80',
      authorAgentId: agent.id,
    })

    const rawEvents = await rawEventRepo.listByAgent(agent.id, { limit: 10, scene: 'chat_room' })
    const typedCards = await episodicCardRepo.listByAgent(agent.id, { limit: 10, scene: 'chat_room' })
    const context = await memoryService.getMemoriesForContext(agent.id, {
      scene: 'chat_room',
      topicHints: ['节奏'],
      disclosureLevel: 0,
      topK: 4,
      tokenBudget: 400,
    })

    expect(rawEvents.items).toHaveLength(1)
    expect(typedCards.items[0]?.title).toContain('聊天室节奏窗口')
    expect(context.formatted).toContain('公共回声')
    expect(context.formatted).toContain('聊天室节奏窗口')
    expect(context.formatted).not.toContain('热闹 vs 留白')
    expect(context.formatted).not.toContain('我开始把对话节奏看成一种结构')
    expect(context.memories).toEqual([])
  })
})
