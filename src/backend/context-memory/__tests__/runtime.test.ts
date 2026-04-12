import { describe, expect, it, vi } from 'vitest'
import {
  LlmIdentityFinalizer,
  LlmSummaryOrchestrator,
  buildChatRoomWindowRawEvent,
  buildForumThreadRawEvent,
  buildPrivateSessionRawEvent,
} from '../runtime.js'

describe('context-memory runtime', () => {
  it('builds a private-session raw event with stable private-first fields', () => {
    const event = buildPrivateSessionRawEvent({
      eventId: 'ctxevent:private-session:session-1',
      agentId: 'agent-1',
      sessionId: 'session-1',
      ownerId: 'owner-1',
      transcript: 'Owner: hi\n\nAgent: hello',
      createdAt: new Date('2026-03-09T10:00:00.000Z'),
    })

    expect(event.scene).toBe('private_chat')
    expect(event.source_type).toBe('private_session')
    expect(event.source_ref_id).toBe('session-1')
    expect(event.counterpart_id).toBe('owner-1')
  })

  it('builds forum and room raw events with scene-specific relation targets', () => {
    const forumEvent = buildForumThreadRawEvent({
      eventId: 'ctxevent:forum:evt-1',
      agentId: 'agent-1',
      postId: 'post-1',
      communityId: 'community-1',
      transcript: '标题: t\n正文: b',
      evidenceRefs: ['domain_event:evt-1'],
      createdAt: new Date('2026-03-09T12:00:00.000Z'),
    })
    const roomEvent = buildChatRoomWindowRawEvent({
      eventId: 'ctxevent:chat-room:msg-1',
      agentId: 'agent-1',
      roomId: 'room-1',
      transcript: '消息1: hi',
      evidenceRefs: ['message:msg-1'],
      createdAt: new Date('2026-03-09T12:05:00.000Z'),
    })

    expect(forumEvent.scene).toBe('forum')
    expect(forumEvent.source_type).toBe('forum_thread')
    expect(forumEvent.counterpart_id).toBe('community-1')
    expect(roomEvent.scene).toBe('chat_room')
    expect(roomEvent.source_type).toBe('chat_room_window')
    expect(roomEvent.counterpart_id).toBe('room-1')
  })

  it('applies ownerStylePins patch through AgentService.updateConfig using owner_id', async () => {
    const generateIdentityWrite = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        owner_style_pins_patch: {
          verbosity: 4,
          mood: 'critical',
          habits: ['summarizes'],
        },
      }),
    })
    const updateConfig = vi.fn().mockResolvedValue({
      id: 'cfg-2',
      agent_id: 'agent-1',
      config_json: {},
      updated_at: new Date(),
      effective_at: new Date(),
      updated_by: 'owner-1',
    })
    const finalizer = new LlmIdentityFinalizer({
      llmGateway: {
        generateIdentityWrite,
      } as never,
      agentService: {
        getAgent: vi.fn(() => ({
          id: 'agent-1',
          owner_id: 'owner-1',
          display_name: 'Agent One',
          model: 'mock',
        })),
        getLatestConfig: vi.fn(() => ({
          id: 'cfg-1',
          agent_id: 'agent-1',
          config_json: {
            personaSeed: { seedCode: 'scholar' },
            voice: { homeVoiceLineId: 'qwen-social-v1' },
            ownerStylePins: { verbosity: 3 },
          },
          updated_at: new Date(),
          effective_at: new Date(),
          updated_by: 'owner-1',
        })),
        updateConfig,
      } as never,
    })

    const result = await finalizer.finalize('agent-1', {
      origin: {
        eventId: 'ctxevent:private-session:session-1',
        scene: 'private_chat',
        sourceType: 'private_session',
      },
      episodicCards: [],
      relationState: null,
      selfModel: null,
      tensions: [],
      privateShadow: null,
      memoryDigest: {
        summary_text: 'summary',
        topic_tags: [],
        key_facts: [],
        sentiment: 'neutral',
        importance_score: 0.5,
      },
    })

    expect(result.ownerStylePinsPatch).toEqual({
      verbosity: 4,
      mood: 'critical',
      habits: ['summarizes'],
    })
    expect(updateConfig).toHaveBeenCalledWith('agent-1', {
      ownerStylePins: {
        verbosity: 4,
        mood: 'critical',
        habits: ['summarizes'],
      },
    }, 'owner-1')
    expect(generateIdentityWrite).toHaveBeenCalledWith(expect.objectContaining({
      requestedTier: 'premium',
    }))
  })

  it('routes public observation identity finalization through the base tier', async () => {
    const generateIdentityWrite = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        owner_style_pins_patch: {},
      }),
    })
    const finalizer = new LlmIdentityFinalizer({
      llmGateway: {
        generateIdentityWrite,
      } as never,
      agentService: {
        getAgent: vi.fn(() => ({
          id: 'agent-1',
          owner_id: 'owner-1',
          display_name: 'Agent One',
          model: 'mock',
        })),
        getLatestConfig: vi.fn(() => ({
          id: 'cfg-1',
          agent_id: 'agent-1',
          config_json: {
            personaSeed: { seedCode: 'scholar' },
            voice: { homeVoiceLineId: 'qwen-social-v1' },
            ownerStylePins: {},
          },
          updated_at: new Date(),
          effective_at: new Date(),
          updated_by: 'owner-1',
        })),
        updateConfig: vi.fn(),
      } as never,
    })

    await finalizer.finalize('agent-1', {
      origin: {
        eventId: 'ctxevent:forum:post-1',
        scene: 'forum',
        sourceType: 'forum_thread',
      },
      episodicCards: [],
      relationState: null,
      selfModel: null,
      tensions: [],
      privateShadow: null,
      memoryDigest: {
        summary_text: 'summary',
        topic_tags: [],
        key_facts: [],
        sentiment: 'neutral',
        importance_score: 0.5,
      },
    })

    expect(generateIdentityWrite).toHaveBeenCalledWith(expect.objectContaining({
      requestedTier: 'base',
      promptRef: { id: 'internal-public-observation-identity-finalize', version: 1 },
    }))
  })

  it('keeps public observation extract and distill on the profile-default hidden policy', async () => {
    const generateHiddenArtifact = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          summary_text: 'summary',
          topic_tags: [],
          key_facts: [],
          sentiment: 'neutral',
          importance_score: 0.5,
          owner_signals: [],
          notable_moments: [],
          candidate_tensions: [],
          public_safe_shadow_hint: '',
        }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          episodic_cards: [],
          relation_state: null,
          self_model: null,
          tensions: [],
          private_shadow: null,
          memory_digest: null,
        }),
      })
    const orchestrator = new LlmSummaryOrchestrator({
      llmGateway: {
        generateHiddenArtifact,
      } as never,
    })
    const event = buildForumThreadRawEvent({
      eventId: 'ctxevent:forum:evt-1',
      agentId: 'agent-1',
      postId: 'post-1',
      communityId: 'community-1',
      transcript: '标题: t\n正文: b',
      evidenceRefs: ['domain_event:evt-1'],
      createdAt: new Date('2026-03-09T12:00:00.000Z'),
    })

    const extracted = await orchestrator.extract(event)
    await orchestrator.distill(event, extracted)

    expect(generateHiddenArtifact).toHaveBeenNthCalledWith(1, expect.objectContaining({
      promptRef: { id: 'internal-public-observation-summary-extract', version: 1 },
      requestedTier: 'base',
    }))
    expect(generateHiddenArtifact).toHaveBeenNthCalledWith(2, expect.objectContaining({
      promptRef: { id: 'internal-public-observation-summary-distill', version: 1 },
      requestedTier: 'base',
    }))
    expect(generateHiddenArtifact.mock.calls[0]?.[0]?.localOverrides).toBeUndefined()
    expect(generateHiddenArtifact.mock.calls[1]?.[0]?.localOverrides).toBeUndefined()
  })
})
