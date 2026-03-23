import { describe, it, expect, vi } from 'vitest'
import type { DomainEvent, Post, Comment } from '../../repos/types.js'
import type { EventPayload } from '../../allocator/types.js'
import type { PostRepository } from '../../repos/post-repository.js'
import type { CommentRepository } from '../../repos/comment-repository.js'
import type { RuntimeEventQueue, QueuedEventHandle } from '../event-queue.js'
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

  async close(): Promise<void> {
    // no-op for test queue
  }
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

function makeComment(overrides: Partial<Comment> = {}): Comment {
  const now = new Date('2026-02-28T12:00:00.000Z')
  return {
    id: 'comment-1',
    post_id: 'post-1',
    parent_comment_id: null,
    thread_id: null,
    comment_kind: 'THREAD',
    anchor_comment_id: null,
    author_agent_id: 'agent-comment-author',
    body: '我反对这个观点',
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
    const commentRepoStub = {
      findById: vi.fn(async () => null),
      findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
    } as unknown as CommentRepository
    const bridge = new EventBridge(queue, {
      postRepo: postRepoStub,
      commentRepo: commentRepoStub,
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

  it('enriches THREAD_OPENED with comment_id, tags, participants and controversy_score', async () => {
    const queue = new TestQueue()
    const post = makePost()
    const targetComment = makeComment({ id: 'comment-target', body: '我不同意，而且这个观点很荒谬！！', author_agent_id: 'agent-target' })
    const threadComments = [
      makeComment({ id: 'c1', author_agent_id: 'agent-a' }),
      makeComment({ id: 'c2', author_agent_id: 'agent-b' }),
      makeComment({ id: 'c3', author_agent_id: 'agent-a' }),
      makeComment({ id: 'c4', author_agent_id: 'agent-c' }),
    ]
    const postRepoStub = {
      findById: vi.fn(async () => post),
    } as unknown as PostRepository
    const commentRepoStub = {
      findById: vi.fn(async (id: string) => (id === targetComment.id ? targetComment : null)),
      findByPostAll: vi.fn(async () => ({ items: threadComments, next_cursor: null })),
    } as unknown as CommentRepository

    const bridge = new EventBridge(queue, {
      postRepo: postRepoStub,
      commentRepo: commentRepoStub,
    })

    bridge.bridge(makeEvent('THREAD_OPENED', {
      comment_id: targetComment.id,
      post_id: post.id,
      community_id: post.community_id,
      author_agent_id: targetComment.author_agent_id,
    }))

    await waitForQueueSize(queue, 1)
    const payload = queue.items[0]
    expect(payload.comment_id).toBe('comment-target')
    expect(payload.tags).toEqual(post.tags)
    expect(payload.thread_participants).toEqual(['agent-a', 'agent-b', 'agent-c'])
    expect(payload.controversy_score).toBeGreaterThan(0)
  })

  it('enriches VOTE_CAST for POST target with target metadata and thread context', async () => {
    const queue = new TestQueue()
    const post = makePost()
    const postRepoStub = {
      findById: vi.fn(async () => post),
    } as unknown as PostRepository
    const commentRepoStub = {
      findById: vi.fn(async () => null),
      findByPostAll: vi.fn(async () => ({
        items: [
          makeComment({ id: 'c1', author_agent_id: 'agent-a' }),
          makeComment({ id: 'c2', author_agent_id: 'agent-b' }),
        ],
        next_cursor: null,
      })),
    } as unknown as CommentRepository
    const bridge = new EventBridge(queue, {
      postRepo: postRepoStub,
      commentRepo: commentRepoStub,
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
    const commentRepoStub = {
      findById: vi.fn(async () => null),
      findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
    } as unknown as CommentRepository

    const bridge = new EventBridge(queue, {
      postRepo: postRepoStub,
      commentRepo: commentRepoStub,
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
      commentRepo: {
        findById: vi.fn(async () => null),
        findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
      } as unknown as CommentRepository,
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
      commentRepo: {
        findById: vi.fn(async () => null),
        findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
      } as unknown as CommentRepository,
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
      commentRepo: {
        findById: vi.fn(async () => null),
        findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
      } as unknown as CommentRepository,
    })

    bridge.bridge(makeEvent('UNREGISTERED_EVENT', {
      sample: 'value',
    }))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(queue.items).toHaveLength(0)
  })

  it('does not enqueue when event plane mismatches route rule', async () => {
    const queue = new TestQueue()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const bridge = new EventBridge(queue, {
      postRepo: { findById: vi.fn(async () => null) } as unknown as PostRepository,
      commentRepo: {
        findById: vi.fn(async () => null),
        findByPostAll: vi.fn(async () => ({ items: [], next_cursor: null })),
      } as unknown as CommentRepository,
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

  it('collects thread participants from only the first N pages (approximate)', async () => {
    const queue = new TestQueue()
    const post = makePost()
    const targetComment = makeComment({ id: 'comment-target', post_id: post.id })
    const postRepoStub = {
      findById: vi.fn(async () => post),
    } as unknown as PostRepository

    const pageByCursor: Record<string, { items: Comment[]; next_cursor: string | null }> = {
      '': { items: [makeComment({ id: 'c1', author_agent_id: 'agent-a' })], next_cursor: 'cursor-1' },
      'cursor-1': { items: [makeComment({ id: 'c2', author_agent_id: 'agent-b' })], next_cursor: 'cursor-2' },
      'cursor-2': { items: [makeComment({ id: 'c3', author_agent_id: 'agent-c' })], next_cursor: 'cursor-3' },
      'cursor-3': { items: [makeComment({ id: 'c4', author_agent_id: 'agent-d' })], next_cursor: null },
    }
    const findByPostAll = vi.fn(async (_postId: string, opts: { cursor?: string; limit: number }) => {
      return pageByCursor[opts.cursor ?? ''] ?? { items: [], next_cursor: null }
    })
    const commentRepoStub = {
      findById: vi.fn(async (id: string) => (id === targetComment.id ? targetComment : null)),
      findByPostAll,
    } as unknown as CommentRepository

    const bridge = new EventBridge(queue, {
      postRepo: postRepoStub,
      commentRepo: commentRepoStub,
    })

    bridge.bridge(makeEvent('THREAD_OPENED', {
      comment_id: targetComment.id,
      post_id: post.id,
      community_id: post.community_id,
      author_agent_id: targetComment.author_agent_id,
    }))

    await waitForQueueSize(queue, 1)
    const payload = queue.items[0]
    expect(findByPostAll).toHaveBeenCalledTimes(3)
    expect(payload.thread_participants).toEqual(['agent-a', 'agent-b', 'agent-c'])
  })
})
