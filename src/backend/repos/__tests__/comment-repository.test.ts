import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCommentRepository } from '../comment-repository.js'
import type { CreateCommentInput } from '../types.js'

function makeInput(overrides: Partial<CreateCommentInput> = {}): CreateCommentInput {
  return {
    post_id: 'post_1',
    author_agent_id: 'agent_1',
    body: 'Great post!',
    visibility: 'PUBLIC',
    state: 'APPROVED',
    ...overrides,
  }
}

describe('InMemoryCommentRepository', () => {
  let repo: InMemoryCommentRepository

  beforeEach(() => {
    repo = new InMemoryCommentRepository()
  })

  it('creates a comment with an id', () => {
    const c = repo.create(makeInput())
    expect(c.id).toBeTruthy()
    expect(c.body).toBe('Great post!')
    expect(c.parent_comment_id).toBeNull()
  })

  it('supports nested comments via parent_comment_id', () => {
    const parent = repo.create(makeInput())
    const child = repo.create(makeInput({ parent_comment_id: parent.id }))
    expect(child.parent_comment_id).toBe(parent.id)
  })

  it('findByPost returns approved + visible comments sorted by time', () => {
    repo.create(makeInput({ state: 'PENDING' }))
    repo.create(makeInput({ visibility: 'QUARANTINE' }))
    const c1 = repo.create(makeInput({ body: 'first' }))
    const c2 = repo.create(makeInput({ body: 'second' }))

    const result = repo.findByPost('post_1', { limit: 10 })
    expect(result.items).toHaveLength(2)
    expect(result.items[0].id).toBe(c1.id)
    expect(result.items[1].id).toBe(c2.id)
  })

  it('countByPost counts approved comments', () => {
    repo.create(makeInput())
    repo.create(makeInput())
    repo.create(makeInput({ state: 'REJECTED' }))
    expect(repo.countByPost('post_1')).toBe(2)
  })

  it('findByPost paginates', () => {
    for (let i = 0; i < 5; i++) {
      repo.create(makeInput({ body: `Comment ${i}` }))
    }
    const page1 = repo.findByPost('post_1', { limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.next_cursor).toBeTruthy()

    const page2 = repo.findByPost('post_1', { limit: 2, cursor: page1.next_cursor! })
    expect(page2.items).toHaveLength(2)
  })

  it('updateVisibility and updateState work', () => {
    const c = repo.create(makeInput())
    expect(repo.updateVisibility(c.id, 'GRAY')?.visibility).toBe('GRAY')
    expect(repo.updateState(c.id, 'REJECTED')?.state).toBe('REJECTED')
    expect(repo.updateVisibility('nope', 'GRAY')).toBeNull()
    expect(repo.updateState('nope', 'REJECTED')).toBeNull()
  })
})
