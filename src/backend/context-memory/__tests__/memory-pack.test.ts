import { describe, expect, it } from 'vitest'
import { DefaultMemoryPackRenderer, DefaultRetrievalPacker } from '../memory-pack.js'

describe('MemoryPack', () => {
  it('packs typed retrieval state into fixed slots first', () => {
    const packer = new DefaultRetrievalPacker()
    const pack = packer.pack({
      agentId: 'agent-1',
      scene: 'forum',
      topicHints: ['播客'],
      disclosureLevel: 1,
      tokenBudget: 240,
      typed: {
        privateEpisodicCards: [],
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
        ownerRelation: null,
        selfModel: null,
        tensions: [],
        privateShadows: [],
        communityRelations: [],
        roomRelations: [],
        agentRelations: [],
        chronicleEntries: [],
      },
    })

    expect(pack.slots).toHaveLength(6)
    expect(pack.slots.find((slot) => slot.slotId === 'public_observation')?.items[0]).toContain('论坛观察')
    expect(pack.slots.find((slot) => slot.slotId === 'topic_recall')?.items[0]).toContain('播客节奏讨论')
    expect(pack.slots.find((slot) => slot.slotId === 'recent_recall')?.items[0]).toContain('播客节奏讨论')
    expect(pack.selectedMemories).toEqual([])
    expect(pack.observability.publicObservationSource).toBe('typed')
  })

  it('does not fall back to legacy memory rows when typed retrieval is empty', () => {
    const packer = new DefaultRetrievalPacker()
    const privatePack = packer.pack({
      agentId: 'agent-1',
      scene: 'private_chat',
      topicHints: ['咖啡'],
      disclosureLevel: 1,
      tokenBudget: 200,
      typed: {
        privateEpisodicCards: [],
        publicEpisodicCards: [],
        ownerRelation: null,
        communityRelations: [],
        roomRelations: [],
        agentRelations: [],
        selfModel: null,
        tensions: [],
        privateShadows: [],
        chronicleEntries: [],
      },
    })

    expect(privatePack.slots.find((slot) => slot.slotId === 'owner_private')?.items).toEqual([])
    expect(privatePack.slots.find((slot) => slot.slotId === 'safe_shadow')?.items).toEqual([])
    expect(privatePack.observability.publicObservationSource).toBe('empty')
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
      observability: {
        publicObservationSource: 'empty',
      },
    }, {
      tokenBudget: 40,
      tier: 'compact',
    })

    expect(output.text).toContain('### 私聊锚点')
    expect(output.tokenEstimate).toBeLessThanOrEqual(40)
  })

  it('never exceeds the remaining token budget even when the first section is oversized', () => {
    const renderer = new DefaultMemoryPackRenderer()
    const output = renderer.render({
      slots: [
        {
          slotId: 'owner_private',
          title: '超长标题'.repeat(10),
          items: ['超长内容'.repeat(80)],
        },
      ],
      selectedMemories: [],
      tokenEstimate: 500,
      slotTokenEstimates: {
        owner_private: 500,
      },
      observability: {
        publicObservationSource: 'empty',
      },
    }, {
      tokenBudget: 20,
      tier: 'compact',
    })

    expect(output.tokenEstimate).toBeLessThanOrEqual(20)
    expect(output.text.length).toBeLessThan('超长内容'.repeat(80).length)
  })
})
