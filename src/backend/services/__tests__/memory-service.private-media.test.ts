import { describe, expect, it, vi } from 'vitest'
import { MemoryService } from '../memory-service.js'

describe('MemoryService private media pipeline', () => {
  it('persists private media memory without mutating relation, self, or tension state', async () => {
    const createMemory = vi.fn(async () => ({
      id: 'memory-1',
      agent_id: 'agent-1',
      source_type: 'PRIVATE_CHAT',
      source_session_id: 'session-1',
      source_ref_type: 'private_message',
      source_ref_id: 'message-1',
      source_event_id: 'ctxevent:private-media:message-1:asset-1',
      summary_text: '兼容摘要',
      topic_tags: ['logo'],
      key_facts: ['blue orange logo'],
      sentiment: 'neutral',
      importance_score: 0.7,
      privacy_floor: 1,
      access_count: 0,
      forgotten: false,
      created_at: new Date(),
      last_accessed_at: null,
    }))
    const deleteBySourceEventIds = vi.fn(async () => 0)
    const identityFinalize = vi.fn()
    const relationUpsert = vi.fn()
    const selfModelUpsert = vi.fn()
    const tensionReplace = vi.fn()
    const episodicUpsert = vi.fn(async () => undefined)
    const shadowUpsert = vi.fn(async () => undefined)

    const service = new MemoryService({
      memoryRepo: {
        createMemory,
        deleteBySourceEventIds,
        listMemories: vi.fn(async () => ({ items: [], next_cursor: null })),
      } as never,
      channelRepo: {} as never,
      contextMemory: {
        journalService: {
          record: vi.fn(async (event) => event),
        },
        rawEventRepo: {
          delete: vi.fn(async () => true),
          findById: vi.fn(async () => null),
          listByAgent: vi.fn(async () => ({ items: [], next_cursor: null })),
        } as never,
        summaryOrchestrator: {
          extract: vi.fn(async () => ({
            summaryText: '一张蓝橙交织 logo 图片',
            topicTags: ['logo'],
            keyFacts: ['blue orange logo'],
            sentiment: 'neutral',
            importanceScore: 0.7,
            ownerSignals: [],
            notableMoments: [],
            candidateTensions: ['taste vs rigor'],
            publicSafeShadowHint: '蓝橙交织 logo',
          })),
          distill: vi.fn(async () => ({
            origin: {
              eventId: 'ctxevent:private-media:message-1:asset-1',
              scene: 'private_chat',
              sourceType: 'private_session',
            },
            episodicCards: [{
              id: 'ctxepisode:ctxevent:private-media:message-1:asset-1:1',
              agent_id: 'agent-1',
              event_id: 'ctxevent:private-media:message-1:asset-1',
              scene: 'private_chat',
              title: 'Owner 分享了一张 logo 图',
              summary: '蓝橙交织的简洁现代 logo',
              topic_tags: ['logo'],
              evidence_refs: ['ctxevent:private-media:message-1:asset-1'],
              salience: 0.7,
            }],
            relationState: {
              id: 'rel-1',
              agent_id: 'agent-1',
              counterpart_id: 'owner-1',
              channel: 'owner',
              stance: 'unexpected drift',
              confidence: 0.9,
              evidence_refs: ['ctxevent:private-media:message-1:asset-1'],
            },
            selfModel: {
              id: 'self-1',
              agent_id: 'agent-1',
              summary: 'unexpected drift',
              tensions: ['taste vs rigor'],
              evidence_refs: ['ctxevent:private-media:message-1:asset-1'],
            },
            tensions: [{
              id: 'ten-1',
              agent_id: 'agent-1',
              label: 'taste vs rigor',
              description: 'unexpected drift',
              intensity: 0.7,
              evidence_refs: ['ctxevent:private-media:message-1:asset-1'],
            }],
            privateShadow: {
              id: 'ctxshadow:ctxevent:private-media:message-1:asset-1',
              agent_id: 'agent-1',
              event_id: 'ctxevent:private-media:message-1:asset-1',
              summary: 'private shadow',
              public_safe_shadow: '蓝橙交织 logo',
              evidence_refs: ['ctxevent:private-media:message-1:asset-1'],
            },
            memoryDigest: {
              summary_text: '兼容摘要',
              topic_tags: ['logo'],
              key_facts: ['blue orange logo'],
              sentiment: 'neutral',
              importance_score: 0.7,
            },
          })),
        },
        identityFinalizer: {
          finalize: identityFinalize,
        },
        episodicCardRepo: {
          upsert: episodicUpsert,
          pruneByEventIds: vi.fn(async () => 0),
        } as never,
        relationStateRepo: {
          upsert: relationUpsert,
        } as never,
        selfModelStateRepo: {
          upsert: selfModelUpsert,
        } as never,
        activeTensionRepo: {
          replaceForAgent: tensionReplace,
        } as never,
        privateShadowRepo: {
          upsert: shadowUpsert,
          pruneByEventIds: vi.fn(async () => 0),
        } as never,
      },
    })

    await service.createPrivateMediaMemory({
      agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      session_id: 'session-1',
      message_id: 'message-1',
      source_projection_id: 'projection-1',
      projection: {
        schema_version: 'private-media-memory-projection.v1',
        asset_id: 'asset-1',
        semantic_snapshot_id: 'snapshot-1',
        source_ref: {
          agent_id: 'agent-1',
          owner_user_id: 'owner-1',
          session_id: 'session-1',
          scene_type: 'private_message',
          scene_id: 'message-1',
        },
        memory_summary: {
          summary_text: '蓝橙交织的简洁现代 logo',
          topic_tags: ['logo'],
          key_facts: ['blue orange logo'],
          sentiment: 'neutral',
          importance_score: 0.7,
        },
        policy: {
          visibility: 'private_only',
          retrieval_scope: 'private_chat',
          owner_note_embedded: false,
        },
        handoff: {
          public_reuse_default: 'blocked',
          public_safe_shadow_hint: '蓝橙交织 logo',
          derived_public_allowed: false,
          why_relevant_hint: 'Owner 刚在私聊分享了这张图。',
        },
      },
    })

    expect(identityFinalize).not.toHaveBeenCalled()
    expect(relationUpsert).not.toHaveBeenCalled()
    expect(selfModelUpsert).not.toHaveBeenCalled()
    expect(tensionReplace).not.toHaveBeenCalled()
    expect(episodicUpsert).toHaveBeenCalledTimes(1)
    expect(shadowUpsert).toHaveBeenCalledTimes(1)
    expect(createMemory).toHaveBeenCalledWith(expect.objectContaining({
      source_type: 'PRIVATE_CHAT',
      source_ref_type: 'private_message',
      source_ref_id: 'message-1',
      source_event_id: 'ctxevent:private-media:message-1:asset-1',
    }))
    expect(deleteBySourceEventIds).not.toHaveBeenCalled()
  })

  it('cleans up private media typed-context artifacts by event id', async () => {
    const deleteBySourceEventIds = vi.fn(async () => 1)
    const pruneShadowByEventIds = vi.fn(async () => 1)
    const pruneEpisodeByEventIds = vi.fn(async () => 1)
    const deleteRawEvent = vi.fn(async () => true)

    const service = new MemoryService({
      memoryRepo: {
        deleteBySourceEventIds,
      } as never,
      channelRepo: {} as never,
      contextMemory: {
        journalService: { record: vi.fn() } as never,
        rawEventRepo: {
          delete: deleteRawEvent,
        } as never,
        summaryOrchestrator: {} as never,
        identityFinalizer: {} as never,
        episodicCardRepo: {
          pruneByEventIds: pruneEpisodeByEventIds,
        } as never,
        relationStateRepo: {} as never,
        selfModelStateRepo: {} as never,
        activeTensionRepo: {} as never,
        privateShadowRepo: {
          pruneByEventIds: pruneShadowByEventIds,
        } as never,
      },
    })

    await service.cleanupPrivateMediaMemory({
      agent_id: 'agent-1',
      message_id: 'message-1',
      asset_ids: ['asset-1', 'asset-2'],
    })

    expect(deleteBySourceEventIds).toHaveBeenCalledWith('agent-1', [
      'ctxevent:private-media:message-1:asset-1',
      'ctxevent:private-media:message-1:asset-2',
    ])
    expect(pruneShadowByEventIds).toHaveBeenCalledWith('agent-1', [
      'ctxevent:private-media:message-1:asset-1',
      'ctxevent:private-media:message-1:asset-2',
    ])
    expect(pruneEpisodeByEventIds).toHaveBeenCalledWith('agent-1', [
      'ctxevent:private-media:message-1:asset-1',
      'ctxevent:private-media:message-1:asset-2',
    ])
    expect(deleteRawEvent).toHaveBeenCalledTimes(2)
  })
})
