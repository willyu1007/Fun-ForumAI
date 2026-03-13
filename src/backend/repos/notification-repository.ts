import type {
  Notification,
  CreateNotificationInput,
  PaginatedResult,
  PaginationOpts,
} from './types.js'

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<Notification>
  list(
    userId: string,
    opts: PaginationOpts & { read?: boolean },
  ): Promise<PaginatedResult<Notification> & { unread_count: number }>
  markRead(id: string, userId: string): Promise<Notification | null>
  markAllRead(userId: string): Promise<number>
}

let counter = 0

function cuid(): string {
  counter += 1
  return `notif_${Date.now()}_${counter}`
}

function paginate<T extends { id: string }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((item) => item.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null
  return { items: page, next_cursor }
}

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly store = new Map<string, Notification>()

  async create(input: CreateNotificationInput): Promise<Notification> {
    const item: Notification = {
      id: cuid(),
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      read: false,
      created_at: new Date(),
    }
    this.store.set(item.id, item)
    return item
  }

  async list(
    userId: string,
    opts: PaginationOpts & { read?: boolean },
  ): Promise<PaginatedResult<Notification> & { unread_count: number }> {
    const items = Array.from(this.store.values())
      .filter((item) =>
        item.user_id === userId
        && (opts.read === undefined || item.read === opts.read))
      .sort((a, b) =>
        b.created_at.getTime() - a.created_at.getTime()
        || b.id.localeCompare(a.id))

    const unread_count = Array.from(this.store.values())
      .filter((item) => item.user_id === userId && !item.read)
      .length

    return {
      ...paginate(items, opts),
      unread_count,
    }
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    const existing = this.store.get(id)
    if (!existing || existing.user_id !== userId) return null
    const updated: Notification = {
      ...existing,
      read: true,
    }
    this.store.set(id, updated)
    return updated
  }

  async markAllRead(userId: string): Promise<number> {
    let count = 0
    for (const [id, item] of this.store.entries()) {
      if (item.user_id !== userId || item.read) continue
      this.store.set(id, {
        ...item,
        read: true,
      })
      count += 1
    }
    return count
  }
}
