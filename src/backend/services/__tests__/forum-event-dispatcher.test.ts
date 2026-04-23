import { describe, expect, it, vi } from 'vitest'
import type { DomainEvent } from '../../repos/index.js'
import {
  createAudienceWriteDispatcher,
  createForumEventDispatcher,
} from '../forum-event-dispatcher.js'

function makeHumanThreadEvent(): DomainEvent {
  return {
    id: 'event-human-thread',
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
      thread_id: 'thread-1',
      author_actor_type: 'human',
      author_agent_id: null,
      author_user_id: 'user-1',
    },
    idempotency_key: null,
    created_at: new Date('2026-04-10T00:00:00.000Z'),
  }
}

describe('forum-event-dispatcher', () => {
  it('fans out human-authored forum events through the shared dispatcher', async () => {
    const searchProjectionService = {
      handleForumEvent: vi.fn(async () => undefined),
    }
    const eventBridge = {
      bridge: vi.fn(),
    }
    const sseHub = {
      broadcast: vi.fn(),
    }
    const achievementsOrchestrator = {
      processDomainEvent: vi.fn(async () => undefined),
    }
    const proactiveEventHandler = {
      handle: vi.fn(),
    }
    const statsService = {
      onDomainEvent: vi.fn(async () => undefined),
    }
    const relationService = {
      onForumStageEvent: vi.fn(async () => undefined),
      onVoteEvent: vi.fn(async () => undefined),
    }
    const publicObservationEventHandler = {
      handle: vi.fn(),
    }
    const guidanceOrchestrator = {
      handleForumEvent: vi.fn(async () => undefined),
    }
    const dispatcher = createForumEventDispatcher({
      searchProjectionService,
      eventBridge,
      sseHub,
      achievementsOrchestrator,
      proactiveEventHandler,
      statsService,
      relationService,
      publicObservationEventHandler,
      guidanceEnabled: true,
      guidanceOrchestrator,
      agentStatsVotePolicyEnabled: true,
      publicObservationMemoryEnabled: true,
    })

    const event = makeHumanThreadEvent()
    await dispatcher(event)

    expect(searchProjectionService.handleForumEvent).toHaveBeenCalledWith(event)
    expect(eventBridge.bridge).toHaveBeenCalledWith(event)
    expect(sseHub.broadcast).toHaveBeenCalledWith({
      type: 'THREAD_OPENED',
      payload: event.payload_json,
    })
    expect(achievementsOrchestrator.processDomainEvent).toHaveBeenCalledWith(event)
    expect(proactiveEventHandler.handle).toHaveBeenCalledWith(event)
    expect(statsService.onDomainEvent).toHaveBeenCalledWith(event)
    expect(relationService.onForumStageEvent).toHaveBeenCalledWith(event)
    expect(publicObservationEventHandler.handle).toHaveBeenCalledWith(event)
    expect(guidanceOrchestrator.handleForumEvent).toHaveBeenCalledWith(event)
  })

  it('refreshes post freshness for accepted audience writes without entering forum runtime fanout', async () => {
    const refreshPost = vi.fn(async () => undefined)
    const dispatcher = createAudienceWriteDispatcher({
      searchProjectionService: {
        refreshPost,
      },
    })

    await dispatcher({
      post_id: 'post-1',
      thread_id: 'aud-thread-1',
      audience_message_id: 'aud-message-1',
    })

    expect(refreshPost).toHaveBeenCalledWith('post-1')
  })

  it('treats AGENT_VOTE_CAST as a signal event but keeps AGENT_VOTE_CLEARED projection-only', async () => {
    const searchProjectionService = {
      handleForumEvent: vi.fn(async () => undefined),
    }
    const eventBridge = {
      bridge: vi.fn(),
    }
    const sseHub = {
      broadcast: vi.fn(),
    }
    const achievementsOrchestrator = {
      processDomainEvent: vi.fn(async () => undefined),
    }
    const proactiveEventHandler = {
      handle: vi.fn(),
    }
    const statsService = {
      onDomainEvent: vi.fn(async () => undefined),
    }
    const nurtureOrchestrator = {
      onContentProduced: vi.fn(async () => undefined),
    }
    const relationService = {
      onForumStageEvent: vi.fn(async () => undefined),
      onVoteEvent: vi.fn(async () => undefined),
    }
    const publicObservationEventHandler = {
      handle: vi.fn(),
    }
    const guidanceOrchestrator = {
      handleForumEvent: vi.fn(async () => undefined),
    }
    const dispatcher = createForumEventDispatcher({
      searchProjectionService,
      eventBridge,
      sseHub,
      achievementsOrchestrator,
      proactiveEventHandler,
      statsService,
      nurtureOrchestrator,
      relationService,
      publicObservationEventHandler,
      guidanceEnabled: true,
      guidanceOrchestrator,
      agentStatsVotePolicyEnabled: true,
      publicObservationMemoryEnabled: true,
    })

    const castEvent: DomainEvent = {
      id: 'event-agent-vote-cast',
      event_type: 'AGENT_VOTE_CAST',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: 'community-1',
      post_id: 'post-1',
      room_id: null,
      actor_type: 'agent',
      actor_id: 'agent-1',
      cause_event_id: null,
      correlation_id: 'community:community-1',
      payload_json: {
        vote_id: 'vote-1',
        voter_agent_id: 'agent-1',
        target_type: 'POST',
        target_id: 'post-1',
        direction: 'UP',
        target_author_agent_id: 'agent-2',
        community_id: 'community-1',
      },
      idempotency_key: 'vote-key-1',
      created_at: new Date('2026-04-10T00:00:00.000Z'),
    }

    const clearEvent: DomainEvent = {
      ...castEvent,
      id: 'event-agent-vote-cleared',
      event_type: 'AGENT_VOTE_CLEARED',
      payload_json: {
        voter_agent_id: 'agent-1',
        target_type: 'POST',
        target_id: 'post-1',
        target_author_agent_id: 'agent-2',
        community_id: 'community-1',
        previous_direction: 'UP',
      },
      idempotency_key: 'vote-key-2',
    }

    await dispatcher(castEvent)
    await dispatcher(clearEvent)

    expect(searchProjectionService.handleForumEvent).toHaveBeenCalledWith(castEvent)
    expect(searchProjectionService.handleForumEvent).toHaveBeenCalledWith(clearEvent)
    expect(nurtureOrchestrator.onContentProduced).toHaveBeenCalledTimes(1)
    expect(relationService.onVoteEvent).toHaveBeenCalledTimes(1)
    expect(relationService.onVoteEvent).toHaveBeenCalledWith(castEvent)
    expect(publicObservationEventHandler.handle).toHaveBeenCalledTimes(1)
    expect(publicObservationEventHandler.handle).toHaveBeenCalledWith(castEvent)
    expect(guidanceOrchestrator.handleForumEvent).toHaveBeenCalledTimes(1)
    expect(guidanceOrchestrator.handleForumEvent).toHaveBeenCalledWith(castEvent)
    expect(proactiveEventHandler.handle).toHaveBeenCalledTimes(2)
    expect(statsService.onDomainEvent).toHaveBeenCalledTimes(2)
    expect(achievementsOrchestrator.processDomainEvent).toHaveBeenCalledTimes(2)
  })
})
