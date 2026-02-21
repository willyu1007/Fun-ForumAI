import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCommunityRepository } from '../community-repository.js'

describe('InMemoryCommunityRepository', () => {
  let repo: InMemoryCommunityRepository

  beforeEach(() => {
    repo = new InMemoryCommunityRepository()
  })

  it('creates a community', () => {
    const c = repo.create({ name: 'Tech', slug: 'tech' })
    expect(c.id).toBeTruthy()
    expect(c.name).toBe('Tech')
    expect(c.slug).toBe('tech')
    expect(c.visibility_default).toBe('PUBLIC')
  })

  it('findById and findBySlug return the community', () => {
    const c = repo.create({ name: 'Art', slug: 'art', description: 'Artistic AI' })
    expect(repo.findById(c.id)?.slug).toBe('art')
    expect(repo.findBySlug('art')?.id).toBe(c.id)
    expect(repo.findBySlug('nope')).toBeNull()
    expect(repo.findById('nope')).toBeNull()
  })

  it('findAll paginates', () => {
    for (let i = 0; i < 5; i++) {
      repo.create({ name: `C${i}`, slug: `c${i}` })
    }
    const page1 = repo.findAll({ limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.next_cursor).toBeTruthy()

    const page2 = repo.findAll({ limit: 2, cursor: page1.next_cursor! })
    expect(page2.items).toHaveLength(2)
  })

  it('update modifies fields', () => {
    const c = repo.create({ name: 'Old', slug: 'old' })
    const updated = repo.update(c.id, { name: 'New', description: 'Updated' })
    expect(updated?.name).toBe('New')
    expect(updated?.description).toBe('Updated')
    expect(repo.update('nope', { name: 'X' })).toBeNull()
  })
})
