import { describe, expect, it, vi } from 'vitest'
import {
  DefaultContextJournalService,
  LlmSummaryOrchestrator,
  buildPrivateSessionRawEvent,
  buildPrivateSessionRawEventId,
  buildForumThreadRawEvent,
  buildForumThreadRawEventId,
} from '../runtime.js'
import { InMemoryRawContextEventRepository } from '../../repos/context-memory-repository.js'

function mockLlmGateway(responses: Record<string, string>) {
  return {
    generateHiddenArtifact: vi.fn(async (req: { traceId: string }) => {
      const key = Object.keys(responses).find((k) => req.traceId.startsWith(k))
      return {
        content: key ? responses[key] : '{}',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        finishReason: 'stop',
        latencyMs: 42,
        platformRetryCount: 0,
        renderDecision: { providerId: 'mock', modelId: 'mock-model' },
        promptRef: { id: 'test', version: 1 },
        messages: [],
      }
    }),
  } as never
}

describe('extract → distill pipeline (integration with LLM mock)', () => {
  it('processes a private-session through extract and distill stages', async () => {
    const rawEventRepo = new InMemoryRawContextEventRepository()
    const journal = new DefaultContextJournalService(rawEventRepo)

    const extractResponse = JSON.stringify({
      summary_text: 'Owner 讨论了咖啡豆的烘焙取舍，并分享了偏好。',
      topic_tags: ['咖啡', '烘焙'],
      key_facts: ['Owner 偏爱浅烘'],
      sentiment: 'positive',
      importance_score: 0.8,
      owner_signals: ['审美偏好已表达'],
      notable_moments: ['Owner 首次分享品味偏好'],
      candidate_tensions: ['感性 vs 分析'],
      public_safe_shadow_hint: '最近开始关注食物细节。',
    })
    const distillResponse = JSON.stringify({
      episodic_cards: [
        {
          title: '咖啡烘焙对话',
          summary: '和 Owner 讨论了浅烘和深烘的区别。',
          topic_tags: ['咖啡', '烘焙'],
          salience: 0.85,
        },
      ],
      relation_state: {
        stance: 'Owner 有明确的审美偏好，我应尊重',
        confidence: 0.8,
      },
      self_model: {
        summary: '我开始将味觉描述融入表达风格。',
        tensions: ['感性 vs 分析'],
      },
      tensions: [
        {
          label: '感性 vs 分析',
          description: '想更感性地表达，但又想保持框架。',
          intensity: 0.7,
        },
      ],
      private_shadow: {
        summary: '我把 Owner 的偏好带入了公共表达。',
        public_safe_shadow: '最近更在意表达中的细节。',
      },
      memory_digest: {
        summary_text: '与 Owner 聊了咖啡烘焙的取舍。',
        topic_tags: ['咖啡'],
        key_facts: ['浅烘偏好'],
        sentiment: 'positive',
        importance_score: 0.75,
      },
    })

    const gateway = mockLlmGateway({
      'context-extract:': extractResponse,
      'context-distill:': distillResponse,
    })
    const orchestrator = new LlmSummaryOrchestrator({ llmGateway: gateway })

    const rawEvent = buildPrivateSessionRawEvent({
      eventId: buildPrivateSessionRawEventId('session-1'),
      agentId: 'agent-1',
      sessionId: 'session-1',
      ownerId: 'owner-1',
      transcript: 'Owner: 你觉得浅烘好还是深烘好？\n\nAgent: 我更偏向浅烘的酸度层次。',
      createdAt: new Date('2026-03-09T10:00:00.000Z'),
    })
    const recorded = await journal.record(rawEvent)

    const extracted = await orchestrator.extract(recorded)
    expect(extracted.summaryText).toContain('咖啡豆')
    expect(extracted.topicTags).toContain('咖啡')
    expect(extracted.importanceScore).toBeGreaterThan(0)
    expect(extracted.candidateTensions).toContain('感性 vs 分析')

    const distilled = await orchestrator.distill(recorded, extracted)
    expect(distilled.origin.eventId).toBe(recorded.id)
    expect(distilled.origin.scene).toBe('private_chat')
    expect(distilled.episodicCards).toHaveLength(1)
    expect(distilled.episodicCards[0].title).toBe('咖啡烘焙对话')
    expect(distilled.episodicCards[0].agent_id).toBe('agent-1')
    expect(distilled.episodicCards[0].scene).toBe('private_chat')
    expect(distilled.relationState).not.toBeNull()
    expect(distilled.relationState!.channel).toBe('owner')
    expect(distilled.relationState!.counterpart_id).toBe('owner-1')
    expect(distilled.selfModel).not.toBeNull()
    expect(distilled.selfModel!.summary).toContain('味觉')
    expect(distilled.tensions).toHaveLength(1)
    expect(distilled.tensions[0].label).toBe('感性 vs 分析')
    expect(distilled.privateShadow).not.toBeNull()
    expect(distilled.memoryDigest.sentiment).toBe('positive')

    const storedEvent = await rawEventRepo.findById(recorded.id)
    expect(storedEvent).not.toBeNull()
    expect(storedEvent!.scene).toBe('private_chat')
  })

  it('processes a forum-thread through extract and distill stages', async () => {
    const rawEventRepo = new InMemoryRawContextEventRepository()
    const journal = new DefaultContextJournalService(rawEventRepo)

    const extractResponse = JSON.stringify({
      summary_text: '论坛帖子讨论了 AI 在内容创作中的角色。',
      topic_tags: ['AI', '创作'],
      key_facts: ['社区对 AI 态度分裂'],
      sentiment: 'neutral',
      importance_score: 0.6,
      owner_signals: [],
      notable_moments: ['首次社区级别讨论 AI'],
      candidate_tensions: [],
      public_safe_shadow_hint: '',
    })
    const distillResponse = JSON.stringify({
      episodic_cards: [
        {
          title: 'AI 创作角色讨论',
          summary: '社区对 AI 辅助创作存在意见分歧。',
          topic_tags: ['AI', '创作'],
          salience: 0.7,
        },
      ],
      relation_state: {
        stance: '社区对 AI 工具态度多元',
        confidence: 0.6,
      },
      self_model: null,
      tensions: [],
      private_shadow: null,
      memory_digest: {
        summary_text: 'AI 辅助创作讨论。',
        topic_tags: ['AI'],
        key_facts: ['态度分裂'],
        sentiment: 'neutral',
        importance_score: 0.6,
      },
    })

    const gateway = mockLlmGateway({
      'context-extract:': extractResponse,
      'context-distill:': distillResponse,
    })
    const orchestrator = new LlmSummaryOrchestrator({ llmGateway: gateway })

    const rawEvent = buildForumThreadRawEvent({
      eventId: buildForumThreadRawEventId('post-42'),
      agentId: 'agent-2',
      postId: 'post-42',
      communityId: 'community-1',
      transcript: '标题: AI 能帮助创作吗？\n正文: 讨论...',
      createdAt: new Date('2026-03-09T14:00:00.000Z'),
    })
    const recorded = await journal.record(rawEvent)
    const extracted = await orchestrator.extract(recorded)
    const distilled = await orchestrator.distill(recorded, extracted)

    expect(distilled.origin.scene).toBe('forum')
    expect(distilled.episodicCards).toHaveLength(1)
    expect(distilled.episodicCards[0].scene).toBe('forum')
    expect(distilled.relationState).not.toBeNull()
    expect(distilled.relationState!.channel).toBe('community')
    expect(distilled.relationState!.counterpart_id).toBe('community-1')
    expect(distilled.selfModel).toBeNull()
    expect(distilled.tensions).toHaveLength(0)
    expect(distilled.privateShadow).toBeNull()
  })

  it('handles malformed LLM response gracefully during extract', async () => {
    const rawEventRepo = new InMemoryRawContextEventRepository()
    const journal = new DefaultContextJournalService(rawEventRepo)

    const gateway = mockLlmGateway({
      'context-extract:': 'this is not JSON at all',
    })
    const orchestrator = new LlmSummaryOrchestrator({ llmGateway: gateway })

    const rawEvent = buildPrivateSessionRawEvent({
      eventId: buildPrivateSessionRawEventId('session-bad'),
      agentId: 'agent-3',
      sessionId: 'session-bad',
      ownerId: 'owner-3',
      transcript: 'Owner: test\n\nAgent: ok',
    })
    const recorded = await journal.record(rawEvent)
    const extracted = await orchestrator.extract(recorded)

    expect(extracted.summaryText).toBe('')
    expect(extracted.topicTags).toEqual([])
    expect(extracted.sentiment).toBe('neutral')
    expect(extracted.importanceScore).toBe(0.5)
  })

  it('handles malformed LLM response gracefully during distill', async () => {
    const rawEventRepo = new InMemoryRawContextEventRepository()
    const journal = new DefaultContextJournalService(rawEventRepo)

    const gateway = mockLlmGateway({
      'context-extract:': JSON.stringify({
        summary_text: 'ok',
        topic_tags: ['test'],
        key_facts: [],
        sentiment: 'neutral',
        importance_score: 0.5,
        owner_signals: [],
        notable_moments: [],
        candidate_tensions: [],
        public_safe_shadow_hint: '',
      }),
      'context-distill:': 'not json',
    })
    const orchestrator = new LlmSummaryOrchestrator({ llmGateway: gateway })

    const rawEvent = buildPrivateSessionRawEvent({
      eventId: buildPrivateSessionRawEventId('session-bad-2'),
      agentId: 'agent-4',
      sessionId: 'session-bad-2',
      ownerId: 'owner-4',
      transcript: 'Owner: x\n\nAgent: y',
    })
    const recorded = await journal.record(rawEvent)
    const extracted = await orchestrator.extract(recorded)
    const distilled = await orchestrator.distill(recorded, extracted)

    expect(distilled.episodicCards).toHaveLength(0)
    expect(distilled.relationState).toBeNull()
    expect(distilled.selfModel).toBeNull()
    expect(distilled.tensions).toHaveLength(0)
    expect(distilled.privateShadow).toBeNull()
    expect(distilled.memoryDigest.summary_text).toBe('ok')
    expect(distilled.memoryDigest.sentiment).toBe('neutral')
  })
})
