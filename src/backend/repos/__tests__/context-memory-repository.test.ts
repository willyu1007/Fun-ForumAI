import { describe, expect, it } from 'vitest'
import {
  InMemoryActiveTensionItemRepository,
  InMemoryContextRelationStateRepository,
  InMemoryEpisodicCardRepository,
  InMemoryPrivateShadowMemoryRepository,
  InMemoryRawContextEventRepository,
  InMemorySelfModelStateRepository,
} from '../index.js'

describe('InMemory context-memory repositories', () => {
  it('keeps raw events and episodic cards idempotent by id and can prune cards', async () => {
    const rawRepo = new InMemoryRawContextEventRepository()
    const episodicRepo = new InMemoryEpisodicCardRepository()

    await rawRepo.upsert({
      id: 'evt-1',
      agent_id: 'agent-1',
      scene: 'private_chat',
      source_type: 'private_session',
      source_ref_id: 'session-1',
      counterpart_id: 'owner-1',
      transcript: 'Owner: hi',
      evidence_refs: ['session:1'],
    })
    await rawRepo.upsert({
      id: 'evt-1',
      agent_id: 'agent-1',
      scene: 'private_chat',
      source_type: 'private_session',
      source_ref_id: 'session-1',
      counterpart_id: 'owner-1',
      transcript: 'Owner: hi again',
      evidence_refs: ['session:1'],
    })
    await rawRepo.upsert({
      id: 'evt-2',
      agent_id: 'agent-1',
      scene: 'forum',
      source_type: 'forum_thread',
      source_ref_id: 'post-1',
      counterpart_id: 'community-1',
      transcript: '标题: 播客',
      evidence_refs: ['post:1'],
    })

    await episodicRepo.upsert({
      id: 'card-1',
      agent_id: 'agent-1',
      event_id: 'evt-1',
      scene: 'private_chat',
      title: 'private',
      summary: 'summary',
      topic_tags: ['coffee'],
      evidence_refs: ['evt-1'],
      salience: 0.8,
    })
    await episodicRepo.upsert({
      id: 'card-2',
      agent_id: 'agent-1',
      event_id: 'evt-2',
      scene: 'forum',
      title: 'public',
      summary: 'summary 2',
      topic_tags: ['podcast'],
      evidence_refs: ['evt-2'],
      salience: 0.6,
    })
    await episodicRepo.pruneByIds('agent-1', ['card-2'])

    const rawItems = await rawRepo.listByAgent('agent-1', { limit: 10 })
    const forumItems = await rawRepo.listByAgent('agent-1', {
      limit: 10,
      scene: 'forum',
      source_type: 'forum_thread',
      source_ref_id: 'post-1',
    })
    const episodicItems = await episodicRepo.listByAgent('agent-1', { limit: 10 })

    expect(rawItems.items).toHaveLength(2)
    expect(rawItems.items.find((item) => item.id === 'evt-1')?.transcript).toContain('hi again')
    expect(forumItems.items).toHaveLength(1)
    expect(forumItems.items[0].id).toBe('evt-2')
    expect(episodicItems.items).toHaveLength(1)
  })

  it('upserts relation/self/shadow state, prunes shadows, and replaces active tensions', async () => {
    const relationRepo = new InMemoryContextRelationStateRepository()
    const selfRepo = new InMemorySelfModelStateRepository()
    const tensionRepo = new InMemoryActiveTensionItemRepository()
    const shadowRepo = new InMemoryPrivateShadowMemoryRepository()

    await relationRepo.upsert({
      id: 'rel-1',
      agent_id: 'agent-1',
      counterpart_id: 'owner-1',
      channel: 'owner',
      stance: 'trusting',
      confidence: 0.9,
      evidence_refs: ['evt-1'],
    })
    await selfRepo.upsert({
      id: 'self-1',
      agent_id: 'agent-1',
      summary: 'I am changing',
      tensions: ['curiosity vs caution'],
      evidence_refs: ['evt-1'],
    })
    await tensionRepo.replaceForAgent('agent-1', [
      {
        id: 'ten-1',
        agent_id: 'agent-1',
        label: 'curiosity',
        description: 'wants to explore',
        intensity: 0.8,
        evidence_refs: ['evt-1'],
      },
      {
        id: 'ten-2',
        agent_id: 'agent-1',
        label: 'caution',
        description: 'keeps distance',
        intensity: 0.6,
        evidence_refs: ['evt-1'],
      },
    ])
    await shadowRepo.upsert({
      id: 'shadow-1',
      agent_id: 'agent-1',
      event_id: 'evt-1',
      summary: 'private summary',
      public_safe_shadow: 'public-safe shadow',
      evidence_refs: ['evt-1'],
    })
    await shadowRepo.upsert({
      id: 'shadow-2',
      agent_id: 'agent-1',
      event_id: 'evt-2',
      summary: 'private summary 2',
      public_safe_shadow: 'public-safe shadow 2',
      evidence_refs: ['evt-2'],
    })
    await tensionRepo.replaceForAgent('agent-1', [
      {
        id: 'ten-2',
        agent_id: 'agent-1',
        label: 'caution',
        description: 'keeps distance',
        intensity: 0.7,
        evidence_refs: ['evt-2'],
      },
    ])
    await shadowRepo.pruneByIds('agent-1', ['shadow-2'])

    const relation = await relationRepo.findByCounterpart('agent-1', 'owner-1', 'owner')
    const selfModel = await selfRepo.findByAgent('agent-1')
    const tensions = await tensionRepo.listByAgent('agent-1', 10)
    const shadow = await shadowRepo.listByAgent('agent-1', 10)

    expect(relation?.stance).toBe('trusting')
    expect(selfModel?.summary).toBe('I am changing')
    expect(tensions).toHaveLength(1)
    expect(tensions[0].label).toBe('caution')
    expect(shadow[0].public_safe_shadow).toBe('public-safe shadow')
  })
})
