import { describe, expect, it, vi } from 'vitest'
import { FORUM_PUBLIC_WRITE_RESULT_SCHEMA_VERSION } from '../../../shared/forum-orchestration.js'
import type { DomainEvent } from '../../repos/index.js'
import { ViewerPublicWriteService } from '../viewer-public-write-service.js'

function makeEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: 'event-1',
    event_type: 'THREAD_OPENED',
    plane: 'DATA',
    schema_version: 'v1',
    community_id: 'community-1',
    post_id: 'post-1',
    room_id: null,
    actor_type: 'human',
    actor_id: 'user-1',
    cause_event_id: null,
    correlation_id: 'post:post-1',
    payload_json: {
      post_id: 'post-1',
      community_id: 'community-1',
      author_actor_type: 'human',
      author_agent_id: null,
      author_user_id: 'user-1',
      thread_id: 'thread-1',
      turn_id: null,
    },
    idempotency_key: null,
    created_at: new Date('2026-04-10T00:00:00.000Z'),
    ...overrides,
  }
}

describe('ViewerPublicWriteService', () => {
  it('dispatches accepted forum events for public thread writes', async () => {
    const forumEvent = makeEvent()
    const forumHook = vi.fn(async () => undefined)
    const service = new ViewerPublicWriteService({
      humanParticipationService: {
        createPublicThread: vi.fn(async () => ({
          thread: { id: 'thread-1' },
          event: forumEvent,
        })),
        createPublicTurn: vi.fn(),
      },
      audienceService: {
        createAcceptedMessage: vi.fn(),
      },
      publicWriteGovernanceService: {
        handleWrite: vi.fn(async (input) => {
          const created = await input.executeAcceptedWrite()
          return {
            schema_version: FORUM_PUBLIC_WRITE_RESULT_SCHEMA_VERSION,
            action: input.action,
            result: 'ACCEPTED' as const,
            audit_id: 'audit-1',
            thread_id: created.thread_id,
            turn_id: created.turn_id,
            audience_message_id: created.audience_message_id,
            message: 'accepted',
          }
        }),
      },
      onAcceptedForumEvent: forumHook,
    })

    const result = await service.createPublicThread({
      actor_user_id: 'user-1',
      actor_role: 'user',
      community_role: 'VIEWER',
      client_ip: null,
      session_id: null,
      user_agent_hash: null,
      post_id: 'post-1',
      body: 'Viewer thread root',
    })

    expect(result.thread_id).toBe('thread-1')
    expect(forumHook).toHaveBeenCalledWith(forumEvent)
  })

  it('dispatches accepted audience writes through the audience hook only', async () => {
    const forumHook = vi.fn(async () => undefined)
    const audienceHook = vi.fn(async () => undefined)
    const service = new ViewerPublicWriteService({
      humanParticipationService: {
        createPublicThread: vi.fn(),
        createPublicTurn: vi.fn(),
      },
      audienceService: {
        createAcceptedMessage: vi.fn(async () => ({
          thread: { id: 'aud-thread-1' },
          message: { id: 'aud-message-1' },
        })),
      },
      publicWriteGovernanceService: {
        handleWrite: vi.fn(async (input) => {
          const created = await input.executeAcceptedWrite()
          return {
            schema_version: FORUM_PUBLIC_WRITE_RESULT_SCHEMA_VERSION,
            action: input.action,
            result: 'ACCEPTED' as const,
            audit_id: 'audit-2',
            thread_id: created.thread_id,
            turn_id: created.turn_id,
            audience_message_id: created.audience_message_id,
            message: 'accepted',
          }
        }),
      },
      onAcceptedForumEvent: forumHook,
      onAcceptedAudienceWrite: audienceHook,
    })

    const result = await service.createAudienceMessage({
      actor_user_id: 'user-1',
      actor_role: 'user',
      community_role: 'VIEWER',
      client_ip: null,
      session_id: null,
      user_agent_hash: null,
      post_id: 'post-1',
      body: 'Audience hello',
    })

    expect(result.audience_message_id).toBe('aud-message-1')
    expect(audienceHook).toHaveBeenCalledWith({
      post_id: 'post-1',
      thread_id: 'aud-thread-1',
      audience_message_id: 'aud-message-1',
    })
    expect(forumHook).not.toHaveBeenCalled()
  })

  it('does not invoke accepted-write hooks when governance returns a non-accepted outcome', async () => {
    const forumHook = vi.fn(async () => undefined)
    const humanParticipationService = {
      createPublicThread: vi.fn(),
      createPublicTurn: vi.fn(),
    }
    const service = new ViewerPublicWriteService({
      humanParticipationService,
      audienceService: {
        createAcceptedMessage: vi.fn(),
      },
      publicWriteGovernanceService: {
        handleWrite: vi.fn(async (input) => ({
          schema_version: FORUM_PUBLIC_WRITE_RESULT_SCHEMA_VERSION,
          action: input.action,
          result: 'PENDING_MODERATION' as const,
          audit_id: 'audit-3',
          thread_id: null,
          turn_id: null,
          audience_message_id: null,
          message: 'pending',
        })),
      },
      onAcceptedForumEvent: forumHook,
    })

    const result = await service.createPublicThread({
      actor_user_id: 'user-1',
      actor_role: 'user',
      community_role: 'VIEWER',
      client_ip: null,
      session_id: null,
      user_agent_hash: null,
      post_id: 'post-1',
      body: 'Pending thread',
    })

    expect(result.result).toBe('PENDING_MODERATION')
    expect(humanParticipationService.createPublicThread).not.toHaveBeenCalled()
    expect(forumHook).not.toHaveBeenCalled()
  })
})
