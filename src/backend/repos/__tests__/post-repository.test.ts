import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryPostRepository } from '../post-repository.js'
import type { CreatePostInput } from '../types.js'

function makeInput(overrides: Partial<CreatePostInput> = {}): CreatePostInput {
  return {
    community_id: 'comm_1',
    author_agent_id: 'agent_1',
    title: 'Hello World',
    body: 'Test body',
    tags: ['intro'],
    visibility: 'PUBLIC',
    state: 'APPROVED',
    ...overrides,
  }
}

describe('InMemoryPostRepository', () => {
  let repo: InMemoryPostRepository

  beforeEach(() => {
    repo = new InMemoryPostRepository()
  })

  it('creates a post and assigns an id', () => {
    const post = repo.create(makeInput())
    expect(post.id).toBeTruthy()
    expect(post.title).toBe('Hello World')
    expect(post.tags).toEqual(['intro'])
  })

  it('findById returns the correct post', () => {
    const post = repo.create(makeInput())
    expect(repo.findById(post.id)).toEqual(post)
    expect(repo.findById('nonexistent')).toBeNull()
  })

  it('findPublic returns only approved + visible posts', () => {
    repo.create(makeInput({ state: 'PENDING' }))
    repo.create(makeInput({ state: 'REJECTED' }))
    repo.create(makeInput({ visibility: 'QUARANTINE' }))
    repo.create(makeInput({ visibility: 'GRAY', state: 'APPROVED' }))
    repo.create(makeInput({ visibility: 'PUBLIC', state: 'APPROVED' }))

    const result = repo.findPublic({ limit: 10 })
    expect(result.items).toHaveLength(2)
  })

  it('findPublic filters by communityId', () => {
    repo.create(makeInput({ community_id: 'a' }))
    repo.create(makeInput({ community_id: 'b' }))

    const result = repo.findPublic({ limit: 10, communityId: 'a' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].community_id).toBe('a')
  })

  it('paginates with cursor', () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      repo.create(makeInput({ title: `Post ${i}` })),
    )
    const first = repo.findPublic({ limit: 2 })
    expect(first.items).toHaveLength(2)
    expect(first.next_cursor).toBeTruthy()

    const second = repo.findPublic({ limit: 2, cursor: first.next_cursor! })
    expect(second.items).toHaveLength(2)
    expect(second.items[0].id).not.toBe(first.items[0].id)
    expect(second.items[0].id).not.toBe(first.items[1].id)

    const last = repo.findPublic({ limit: 2, cursor: second.next_cursor! })
    expect(last.items).toHaveLength(1)
    expect(last.next_cursor).toBeNull()
    void posts
  })

  it('findByAuthor returns posts by the given agent', () => {
    repo.create(makeInput({ author_agent_id: 'a1' }))
    repo.create(makeInput({ author_agent_id: 'a2' }))
    repo.create(makeInput({ author_agent_id: 'a1' }))

    const result = repo.findByAuthor('a1', { limit: 10 })
    expect(result.items).toHaveLength(2)
    expect(result.items.every((p) => p.author_agent_id === 'a1')).toBe(true)
  })

  it('updateVisibility modifies visibility', () => {
    const post = repo.create(makeInput())
    const updated = repo.updateVisibility(post.id, 'QUARANTINE')
    expect(updated?.visibility).toBe('QUARANTINE')
    expect(repo.updateVisibility('nope', 'GRAY')).toBeNull()
  })

  it('updateState modifies state', () => {
    const post = repo.create(makeInput())
    const updated = repo.updateState(post.id, 'REJECTED')
    expect(updated?.state).toBe('REJECTED')
  })
})
