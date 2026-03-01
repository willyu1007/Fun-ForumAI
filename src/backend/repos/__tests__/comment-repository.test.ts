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

  it('creates a comment with an id', async () => {
    const comment = await repo.create(makeInput())
    expect(comment.id).toBeTruthy()
    expect(comment.body).toBe('Great post!')
    expect(comment.parent_comment_id).toBeNull()
  })

  it('supports nested comments via parent_comment_id', async () => {
    const parent = await repo.create(makeInput())
    const child = await repo.create(makeInput({ parent_comment_id: parent.id }))
    expect(child.parent_comment_id).toBe(parent.id)
  })

  it('findByPost returns approved + visible comments sorted by time', async () => {
    await repo.create(makeInput({ state: 'PENDING' }))
    await repo.create(makeInput({ visibility: 'QUARANTINE' }))
    const c1 = await repo.create(makeInput({ body: 'first' }))
    const c2 = await repo.create(makeInput({ body: 'second' }))

    const result = await repo.findByPost('post_1', { limit: 10 })
    expect(result.items).toHaveLength(2)
    expect(result.items[0].id).toBe(c1.id)
    expect(result.items[1].id).toBe(c2.id)
  })

  it('findByPostAll returns full comment set regardless of state/visibility', async () => {
    const pending = await repo.create(makeInput({ state: 'PENDING', body: 'pending' }))
    const quarantined = await repo.create(makeInput({ visibility: 'QUARANTINE', body: 'quarantine' }))
    const approved = await repo.create(makeInput({ body: 'approved' }))

    const result = await repo.findByPostAll('post_1', { limit: 10 })
    expect(result.items.map((item) => item.id)).toEqual([
      pending.id,
      quarantined.id,
      approved.id,
    ])
  })

  it('countByPost counts approved comments', async () => {
    await repo.create(makeInput())
    await repo.create(makeInput())
    await repo.create(makeInput({ state: 'REJECTED' }))
    expect(await repo.countByPost('post_1')).toBe(2)
  })

  it('findByPost paginates', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.create(makeInput({ body: `Comment ${i}` }))
    }
    const page1 = await repo.findByPost('post_1', { limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.next_cursor).toBeTruthy()

    const page2 = await repo.findByPost('post_1', { limit: 2, cursor: page1.next_cursor! })
    expect(page2.items).toHaveLength(2)
  })

  it('updateVisibility and updateState work', async () => {
    const comment = await repo.create(makeInput())
    expect((await repo.updateVisibility(comment.id, 'GRAY'))?.visibility).toBe('GRAY')
    expect((await repo.updateState(comment.id, 'REJECTED'))?.state).toBe('REJECTED')
    expect(await repo.updateVisibility('nope', 'GRAY')).toBeNull()
    expect(await repo.updateState('nope', 'REJECTED')).toBeNull()
  })
})
