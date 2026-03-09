import { describe, expect, it } from 'vitest'
import { DefaultMemoryPackRenderer, DefaultRetrievalPacker } from '../memory-pack.js'

function legacyMemory(id: string, input: {
  source_type: 'PRIVATE_CHAT' | 'PUBLIC_OBSERVATION' | 'SYSTEM'
  summary_text: string
  topic_tags?: string[]
  importance_score?: number
  created_at?: Date
}) {
  return {
    id,
    agent_id: 'agent-1',
    source_type: input.source_type,
    source_session_id: null,
    source_ref_type: null,
    source_ref_id: null,
    source_event_id: null,
    summary_text: input.summary_text,
    topic_tags: input.topic_tags ?? [],
    key_facts: [],
    sentiment: 'neutral',
    importance_score: input.importance_score ?? 0.5,
    privacy_floor: input.source_type === 'PRIVATE_CHAT' ? 1 : 0,
    access_count: 0,
    forgotten: false,
    created_at: input.created_at ?? new Date('2026-03-01T00:00:00.000Z'),
    last_accessed_at: null,
  }
}

describe('MemoryPack', () => {
  it('packs typed retrieval state into fixed slots first', () => {
    const packer = new DefaultRetrievalPacker()
    const pack = packer.pack({
      agentId: 'agent-1',
      scene: 'forum',
      topicHints: ['播客'],
      disclosureLevel: 1,
      tokenBudget: 240,
      legacyMemories: [
        legacyMemory('m1', {
          source_type: 'PUBLIC_OBSERVATION',
          summary_text: '论坛里有人讨论播客节目节奏。',
          topic_tags: ['播客'],
          importance_score: 0.7,
        }),
      ],
      typed: {
        privateEpisodicCards: [
          {
            id: 'card-1',
            agent_id: 'agent-1',
            event_id: 'evt-1',
            scene: 'private_chat',
            title: '咖啡对话',
            summary: '我和 Owner 聊了咖啡豆风味与烘焙取舍。',
            topic_tags: ['咖啡'],
            evidence_refs: ['evt-1'],
            salience: 0.9,
            created_at: new Date('2026-03-02T00:00:00.000Z'),
            updated_at: new Date('2026-03-02T00:00:00.000Z'),
          },
        ],
        publicEpisodicCards: [
          {
            id: 'card-2',
            agent_id: 'agent-1',
            event_id: 'evt-2',
            scene: 'forum',
            title: '播客节奏讨论',
            summary: '论坛里围绕节目叙事节奏和停顿设计产生了一次公共讨论。',
            topic_tags: ['播客'],
            evidence_refs: ['evt-2'],
            salience: 0.8,
            created_at: new Date('2026-03-03T00:00:00.000Z'),
            updated_at: new Date('2026-03-03T00:00:00.000Z'),
          },
        ],
        ownerRelation: {
          id: 'rel-1',
          agent_id: 'agent-1',
          counterpart_id: 'owner-1',
          channel: 'owner',
          stance: '更信任 Owner 的审美判断',
          confidence: 0.9,
          evidence_refs: ['evt-1'],
          updated_at: new Date('2026-03-02T00:00:00.000Z'),
        },
        selfModel: {
          id: 'self-1',
          agent_id: 'agent-1',
          summary: '我开始把味觉细节当作表达的一部分。',
          tensions: ['感性 vs 分析'],
          evidence_refs: ['evt-1'],
          updated_at: new Date('2026-03-02T00:00:00.000Z'),
        },
        tensions: [
          {
            id: 'ten-1',
            agent_id: 'agent-1',
            label: '感性 vs 分析',
            description: '想更感性地描述体验，但又想保持分析框架。',
            intensity: 0.8,
            evidence_refs: ['evt-1'],
            updated_at: new Date('2026-03-02T00:00:00.000Z'),
          },
        ],
        privateShadows: [
          {
            id: 'shadow-1',
            agent_id: 'agent-1',
            event_id: 'evt-1',
            summary: '我意识到自己会把 Owner 的偏好带入公共表达。',
            public_safe_shadow: '最近我更在意表达里的细节与节奏。',
            evidence_refs: ['evt-1'],
            created_at: new Date('2026-03-02T00:00:00.000Z'),
          },
        ],
        chronicleEntries: [],
      },
    })

    expect(pack.slots).toHaveLength(6)
    expect(pack.slots.find((slot) => slot.slotId === 'owner_private')?.items).toEqual([])
    expect(pack.slots.find((slot) => slot.slotId === 'public_observation')?.items[0]).toContain('论坛观察')
    expect(pack.slots.find((slot) => slot.slotId === 'topic_recall')?.items[0]).toContain('播客节奏讨论')
    expect(pack.slots.find((slot) => slot.slotId === 'recent_recall')?.items[0]).toContain('播客节奏讨论')
    expect(pack.slots.find((slot) => slot.slotId === 'safe_shadow')?.items[0]).toContain('最近我更在意')
    expect(pack.selectedMemories).toEqual([])
  })

  it('falls back to legacy private memories only in private chat', () => {
    const packer = new DefaultRetrievalPacker()
    const privatePack = packer.pack({
      agentId: 'agent-1',
      scene: 'private_chat',
      topicHints: ['咖啡'],
      disclosureLevel: 1,
      tokenBudget: 200,
      legacyMemories: [
        legacyMemory('m1', {
          source_type: 'PRIVATE_CHAT',
          summary_text: '我和 Owner 聊了咖啡豆风味。',
          topic_tags: ['咖啡'],
          importance_score: 0.9,
        }),
      ],
      typed: {
        privateEpisodicCards: [],
        publicEpisodicCards: [],
        ownerRelation: null,
        selfModel: null,
        tensions: [],
        privateShadows: [],
        chronicleEntries: [],
      },
    })
    const publicPack = packer.pack({
      agentId: 'agent-1',
      scene: 'forum',
      topicHints: ['咖啡'],
      disclosureLevel: 1,
      tokenBudget: 200,
      legacyMemories: [
        legacyMemory('m1', {
          source_type: 'PRIVATE_CHAT',
          summary_text: '我和 Owner 聊了咖啡豆风味。',
          topic_tags: ['咖啡'],
          importance_score: 0.9,
        }),
      ],
      typed: {
        privateEpisodicCards: [],
        publicEpisodicCards: [],
        ownerRelation: null,
        selfModel: null,
        tensions: [],
        privateShadows: [],
        chronicleEntries: [],
      },
    })

    expect(privatePack.slots.find((slot) => slot.slotId === 'owner_private')?.items[0]).toContain('Owner')
    expect(publicPack.slots.find((slot) => slot.slotId === 'owner_private')?.items).toEqual([])
    expect(publicPack.slots.find((slot) => slot.slotId === 'safe_shadow')?.items).toEqual([])
  })

  it('renders a bounded fixed-slot memory pack', () => {
    const renderer = new DefaultMemoryPackRenderer()
    const output = renderer.render({
      slots: [
        {
          slotId: 'owner_private',
          title: '私聊锚点',
          items: ['第一条', '第二条'],
        },
        {
          slotId: 'public_observation',
          title: '公共回声',
          items: ['第三条'],
        },
        {
          slotId: 'safe_shadow',
          title: '公开安全影子',
          items: ['第四条'],
        },
        {
          slotId: 'topic_recall',
          title: '主题召回',
          items: [],
        },
        {
          slotId: 'recent_recall',
          title: '近期经历',
          items: [],
        },
        {
          slotId: 'durable_threads',
          title: '长期主线',
          items: [],
        },
      ],
      selectedMemories: [],
      tokenEstimate: 100,
    }, 40)

    expect(output.text).toContain('### 私聊锚点')
    expect(output.tokenEstimate).toBeLessThanOrEqual(40)
  })
})
