import type { Community, PaginatedResult, PaginationOpts } from './types.js'

export interface CommunityRepository {
  create(input: { name: string; slug: string; description?: string; rules_json?: Record<string, unknown> }): Community
  findById(id: string): Community | null
  findBySlug(slug: string): Community | null
  findAll(opts: PaginationOpts): PaginatedResult<Community>
  update(id: string, patch: Partial<Pick<Community, 'name' | 'description' | 'rules_json' | 'visibility_default'>>): Community | null
}

let counter = 0
function cuid(): string {
  return `comm_${Date.now()}_${++counter}`
}

export class InMemoryCommunityRepository implements CommunityRepository {
  private store = new Map<string, Community>()
  private slugIndex = new Map<string, string>()

  create(input: { name: string; slug: string; description?: string; rules_json?: Record<string, unknown> }): Community {
    const now = new Date()
    const community: Community = {
      id: cuid(),
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      rules_json: input.rules_json ?? null,
      visibility_default: 'PUBLIC',
      created_at: now,
      updated_at: now,
    }
    this.store.set(community.id, community)
    this.slugIndex.set(community.slug, community.id)
    return community
  }

  findById(id: string): Community | null {
    return this.store.get(id) ?? null
  }

  findBySlug(slug: string): Community | null {
    const id = this.slugIndex.get(slug)
    if (!id) return null
    return this.store.get(id) ?? null
  }

  findAll(opts: PaginationOpts): PaginatedResult<Community> {
    const items = Array.from(this.store.values())
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  update(id: string, patch: Partial<Pick<Community, 'name' | 'description' | 'rules_json' | 'visibility_default'>>): Community | null {
    const c = this.store.get(id)
    if (!c) return null
    if (patch.name !== undefined) c.name = patch.name
    if (patch.description !== undefined) c.description = patch.description
    if (patch.rules_json !== undefined) c.rules_json = patch.rules_json
    if (patch.visibility_default !== undefined) c.visibility_default = patch.visibility_default
    c.updated_at = new Date()
    return c
  }
}

function paginate<T extends { id: string }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((i) => i.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null
  return { items: page, next_cursor }
}
