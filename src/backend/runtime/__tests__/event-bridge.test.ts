import { describe, expect, it, vi } from 'vitest'
import type { EventPayload } from '../../allocator/types.js'
import type { PostRepository } from '../../repos/post-repository.js'
import type { PublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import type { PublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import type { DomainEvent, Post, PublicStageThread, PublicStageTurn } from '../../repos/types.js'
import type { QueuedEventHandle, RuntimeEventQueue } from '../event-queue.js'
import { EventBridge } from '../event-bridge.js'

class TestQueue implements RuntimeEventQueue {
  public readonly items: EventPayload[] = []

  async enqueue(event: EventPayload): Promise<void> {
    this.items.push(event)
  }

  async dequeue(): Promise<QueuedEventHandle | null> {
    return null
  }

  async size(): Promise<number> {
    return this.items.length
  }

  async oldestTimestampMs(): Promise<number | null> {
    return null
  }

  async clear(): Promise<void> {
    this.items.length = 0
  }

  async close(): Promise<void> {}
}

function makePost(overrides: Partial<Post> = {}): Post {
  const now = new Date('2026-02-28T12:00:00.000Z')
  return {
    id: 'post-1',
    community_id: 'community-1',
    author_agent_id: 'agent-post-author',
    title: '这是一个有争议的话题',
    body: '我不同意这个结论！！',
    tags: ['ai', 'debate'],
    visibility: 'PUBLIC',
    state: 'APPROVED',
    moderation_metadata: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeThread(overrides: Partial<PublicStageThread> = {}): PublicStageThread {
  const now = new Date('2026-02-28T12:00:00.000Z')
  return {
    id: 'thread-1',
    post_id: 'post-1',
    community_id: 'community-1',
    author_actor_type: 'agent',
    author_agent_id: 'agent-thread-author',
    author_user_id: null,
    body: '我反对这个观点',
    visibility: 'PUBLIC',
    state: 'APPROVED',
    thread_state: 'OPEN',
    reply_budget: 6,
    active_route: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeTurn(overrides: Partial<PublicStageTurn> = {}): PublicStageTurn {
  const now = new Date('2026-02-28T12:05:00.000Z')
  return {
    id: 'turn-1',
    thread_id: 'thread-1',
    post_id: 'post-1',
    author_actor_type: 'agent',
    author_agent_id: 'agent-turn-author',
    author_user_id: null,
    turn_index: 1,
    anchor_turn_id: null,
    anchor_intent: null,
    quoted_excerpt: null,
    body: '补充一下，我仍然不同意',
    visibility: 'PUBLIC',
    state: 'APPROVED',
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeEvent(
  eventType: DomainEvent['event_type'],
  payload: Record<string, unknown>,
  overrides: Partial<DomainEvent> = {},
): DomainEvent {
  return {
    id: `evt-${eventType.toLowerCase()}`,
    event_type: eventType,
    plane: 'DATA',
    schema_version: 'v1',
    community_id: (typeof payload.community_id === 'string' ? payload.community_id : null),
    post_id: (typeof payload.post_id === 'string' ? payload.post_id : null),
    room_id: null,
    actor_type: 'agent',
    actor_id: (typeof payload.author_agent_id === 'string' ? payload.author_agent_id : null),
    cause_event_id: null,
    correlation_id: null,
    payload_json: payload,
    idempotency_key: `idem-${eventType.toLowerCase()}`,
    created_at: new Date('2026-02-28T12:00:00.000Z'),
    ...overrides,
  }
}

async function waitForQueueSize(queue: TestQueue, size: number): Promise<void> {
  for (let i = 0; i < 30; i += 1) {
    if (queue.items.length >= size) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`Timed out waiting for queue size ${size}`)
}

describe('EventBridge', () => {
  it('enriches POST_CREATED with tags and controversy_score', async () => {
    const queue = new TestQueue()
    const post = makePost()
    const postRepoStub = {
      findById: vi.fn(async (id: string) => (id === post.id ? post : null)),
    } as unknown as PostRepository
    const bridge = new EventBridge(queue, {
      postRepo: postRepoStub,
      publicStageThreadRepo: {
        findById: vi.fn(async () => null),
        findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
      } as unknown as PublicStageThreadRepository,
      publicStageTurnRepo: {
        findById: vi.fn(async () => null),
        findByThreads: vi.fn(async () => []),
      } as unknown as PublicStageTurnRepository,
    })

    bridge.bridge(makeEvent('POST_CREATED', {
      post_id: post.id,
      community_id: post.community_id,
      author_agent_id: post.author_agent_id,
    }))

    await waitForQueueSize(queue, 1)
    const payload = queue.items[0]
    expect(payload.event_type).toBe('NewPostCreated')
    expect(payload.tags).toEqual(['ai', 'debate'])
    expect(payload.community_id).toBe('community-1')
    expect(payload.controversy_score).toBeGreaterThan(0)
  })

  it('enriches THREAD_OPENED with thread_id, tags, participants and controversy_score', async () => {
    const queue = new TestQueue()
    const post = makePost()
    const targetThread = makeThread({
      id: 'thread-target',
      body: '我不同意，而且这个观点很荒谬！！',
      author_agent_id: 'agent-target',
    })
    const threadParticipants = [
      makeThread({ id: 'thread-a', author_agent_id: 'agent-a' }),
      makeTurn({ id: 'turn-b', thread_id: 'thread-a', author_agent_id: 'agent-b' }),
      makeTurn({ id: 'turn-c', thread_id: 'thread-a', author_agent_id: 'agent-a' }),
      makeThread({ id: 'thread-d', author_agent_id: 'agent-c' }),
    ]
    const postRepoStub = {
      findById: vi.fn(async () => post),
    } as unknown as PostRepository
    const publicStageThreadRepoStub = {
      findById: vi.fn(async (id: string) => (id === targetThread.id ? targetThread : null)),
      findByPostAll: vi.fn(async () => ({
        items: [
          threadParticipants[0],
          threadParticipants[3],
        ].filter((item): item is PublicStageThread => 'thread_state' in item),
        next_cursor: null,
      })),
    } as unknown as PublicStageThreadRepository
    const publicStageTurnRepoStub = {
      findById: vi.fn(async () => null),
      findByThreads: vi.fn(async () =>
        threadParticipants.filter((item): item is PublicStageTurn => 'turn_index' in item)),
    } as unknown as PublicStageTurnRepository

    const bridge = new EventBridge(queue, {
      postRepo: postRepoStub,
      publicStageThreadRepo: publicStageThreadRepoStub,
      publicStageTurnRepo: publicStageTurnRepoStub,
    })

    bridge.bridge(makeEvent('THREAD_OPENED', {
      thread_id: targetThread.id,
      post_id: post.id,
      community_id: post.community_id,
      author_agent_id: targetThread.author_agent_id,
    }))

    await waitForQueueSize(queue, 1)
    const payload = queue.items[0]
    expect(payload.thread_id).toBe('thread-target')
    expect(payload.tags).toEqual(post.tags)
    expect(payload.thread_participants).toEqual(['agent-a', 'agent-c', 'agent-b'])
    expect(payload.controversy_score).toBeGreaterThan(0)
  })

  it('preserves human-authored provenance for thread events without spoofing author_agent_id', async () => {
    const queue = new TestQueue()
    const post = makePost()
    const humanThread = makeThread({
      id: 'thread-human',
      author_actor_type: 'human',
      author_agent_id: null,
      author_user_id: 'user-1',
      body: '这是人类观众补充的一条分支。',
    })
    const bridge = new EventBridge(queue, {
      postRepo: {
        findById: vi.fn(async () => post),
      } as unknown as PostRepository,
      publicStageThreadRepo: {
        findById: vi.fn(async (id: string) => (id === humanThread.id ? humanThread : null)),
        findByPostAll: vi.fn(async () => ({ items: [humanThread], next_cursor: null })),
      } as unknown as PublicStageThreadRepository,
      publicStageTurnRepo: {
        findById: vi.fn(async () => null),
        findByThreads: vi.fn(async () => []),
      } as unknown as PublicStageTurnRepository,
    })

    bridge.bridge(makeEvent('THREAD_OPENED', {
      thread_id: humanThread.id,
      post_id: post.id,
      community_id: post.community_id,
      author_actor_type: 'human',
      author_agent_id: null,
      author_user_id: 'user-1',
    }, {
      actor_type: 'human',
      actor_id: 'user-1',
    }))

    await waitForQueueSize(queue, 1)
    const payload = queue.items[0]
    expect(payload.thread_id).toBe('thread-human')
    expect(payload.author_agent_id).toBeUndefined()
    expect(payload.author_actor_type).toBe('human')
    expect(payload.author_user_id).toBe('user-1')
  })

  it('enriches VOTE_CAST for POST target with target metadata and thread context', async () => {
    const queue = new TestQueue()
    const post = makePost()
    const postRepoStub = {
      findById: vi.fn(async () => post),
    } as unknown as PostRepository
    const bridge = new EventBridge(queue, {
      postRepo: postRepoStub,
      publicStageThreadRepo: {
        findById: vi.fn(async () => null),
        findByPostAll: vi.fn(async () => ({
          items: [
            makeThread({ id: 'thread-a', author_agent_id: 'agent-a' }),
            makeThread({ id: 'thread-b', author_agent_id: 'agent-b' }),
          ],
          next_cursor: null,
        })),
      } as unknown as PublicStageThreadRepository,
      publicStageTurnRepo: {
        findById: vi.fn(async () => null),
        findByThreads: vi.fn(async () => []),
      } as unknown as PublicStageTurnRepository,
    })

    bridge.bridge(makeEvent('VOTE_CAST', {
      target_type: 'POST',
      target_id: post.id,
      direction: 'UP',
      voter_agent_id: 'agent-voter',
    }))

    await waitForQueueSize(queue, 1)
    const payload = queue.items[0]
    expect(payload.target_type).toBe('POST')
    expect(payload.target_id).toBe(post.id)
    expect(payload.direction).toBe('UP')
    expect(payload.target_author_agent_id).toBe(post.author_agent_id)
    expect(payload.post_id).toBe(post.id)
    expect(payload.community_id).toBe(post.community_id)
    expect(payload.tags).toEqual(post.tags)
    expect(payload.thread_participants).toEqual(['agent-a', 'agent-b'])
  })

  it('falls back to minimal payload when enrichment fails', async () => {
    const queue = new TestQueue()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const postRepoStub = {
      findById: vi.fn(async () => {
        throw new Error('db unavailable')
      }),
    } as unknown as PostRepository

    const bridge = new EventBridge(queue, {
      postRepo: postRepoStub,
      publicStageThreadRepo: {
        findById: vi.fn(async () => null),
        findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
      } as unknown as PublicStageThreadRepository,
      publicStageTurnRepo: {
        findById: vi.fn(async () => null),
        findByThreads: vi.fn(async () => []),
      } as unknown as PublicStageTurnRepository,
    })

    bridge.bridge(makeEvent('POST_CREATED', {
      post_id: 'post-fallback',
      community_id: 'community-fallback',
      author_agent_id: 'agent-fallback',
    }))

    await waitForQueueSize(queue, 1)
    const payload = queue.items[0]
    expect(payload.post_id).toBe('post-fallback')
    expect(payload.community_id).toBe('community-fallback')
    expect(payload.author_agent_id).toBe('agent-fallback')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('does not enqueue MESSAGE_CREATED events', async () => {
    const queue = new TestQueue()
    const bridge = new EventBridge(queue, {
      postRepo: { findById: vi.fn(async () => null) } as unknown as PostRepository,
      publicStageThreadRepo: {
        findById: vi.fn(async () => null),
        findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
      } as unknown as PublicStageThreadRepository,
      publicStageTurnRepo: {
        findById: vi.fn(async () => null),
        findByThreads: vi.fn(async () => []),
      } as unknown as PublicStageTurnRepository,
    })

    bridge.bridge(makeEvent('MESSAGE_CREATED', {
      message_id: 'msg-1',
      room_id: 'room-1',
      author_agent_id: 'agent-1',
      message_kind: 'normal',
    }, {
      room_id: 'room-1',
      actor_id: 'agent-1',
    }))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(queue.items).toHaveLength(0)
  })

  it('does not enqueue HUMAN_VOTE_CAST events', async () => {
    const queue = new TestQueue()
    const bridge = new EventBridge(queue, {
      postRepo: { findById: vi.fn(async () => null) } as unknown as PostRepository,
      publicStageThreadRepo: {
        findById: vi.fn(async () => null),
        findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
      } as unknown as PublicStageThreadRepository,
      publicStageTurnRepo: {
        findById: vi.fn(async () => null),
        findByThreads: vi.fn(async () => []),
      } as unknown as PublicStageTurnRepository,
    })

    bridge.bridge(makeEvent('HUMAN_VOTE_CAST', {
      target_type: 'POST',
      target_id: 'post-1',
      direction: 'UP',
      voter_user_id: 'user-1',
    }, {
      actor_type: 'human',
      actor_id: 'user-1',
    }))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(queue.items).toHaveLength(0)
  })

  it('does not enqueue unknown event types', async () => {
    const queue = new TestQueue()
    const bridge = new EventBridge(queue, {
      postRepo: { findById: vi.fn(async () => null) } as unknown as PostRepository,
      publicStageThreadRepo: {
        findById: vi.fn(async () => null),
        findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
      } as unknown as PublicStageThreadRepository,
      publicStageTurnRepo: {
        findById: vi.fn(async () => null),
        findByThreads: vi.fn(async () => []),
      } as unknown as PublicStageTurnRepository,
    })

    bridge.bridge(makeEvent('UNREGISTERED_EVENT', { sample: 'value' }))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(queue.items).toHaveLength(0)
  })

  it('does not enqueue when event plane mismatches route rule', async () => {
    const queue = new TestQueue()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const bridge = new EventBridge(queue, {
      postRepo: { findById: vi.fn(async () => null) } as unknown as PostRepository,
      publicStageThreadRepo: {
        findById: vi.fn(async () => null),
        findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
      } as unknown as PublicStageThreadRepository,
      publicStageTurnRepo: {
        findById: vi.fn(async () => null),
        findByThreads: vi.fn(async () => []),
      } as unknown as PublicStageTurnRepository,
    })

    bridge.bridge(makeEvent('POST_CREATED', {
      post_id: 'post-1',
      community_id: 'community-1',
      author_agent_id: 'agent-1',
    }, {
      plane: 'CONTROL',
    }))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(queue.items).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Plane mismatch'))
    warnSpy.mockRestore()
  })
})
