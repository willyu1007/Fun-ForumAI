import type {
  PrismaClient,
  Notification as PrismaNotification,
} from '@prisma/client'
import type {
  Notification,
  CreateNotificationInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { NotificationRepository } from '../notification-repository.js'

export class PgNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.user_id,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        targetType: input.target_type ?? null,
        targetId: input.target_id ?? null,
      },
    })
    return this.toDomain(row)
  }

  async list(
    userId: string,
    opts: PaginationOpts & { read?: boolean },
  ): Promise<PaginatedResult<Notification> & { unread_count: number }> {
    const where: Record<string, unknown> = { userId }
    if (opts.read !== undefined) where.read = opts.read

    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.limit + 1,
        ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      }),
      this.prisma.notification.count({
        where: { userId, read: false },
      }),
    ])

    const hasMore = rows.length > opts.limit
    const items = hasMore ? rows.slice(0, opts.limit) : rows

    return {
      items: items.map((r) => this.toDomain(r)),
      next_cursor: hasMore ? items[items.length - 1].id : null,
      unread_count: unreadCount,
    }
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    try {
      const row = await this.prisma.notification.findFirst({
        where: { id, userId },
      })
      if (!row) return null
      const updated = await this.prisma.notification.update({
        where: { id },
        data: { read: true },
      })
      return this.toDomain(updated)
    } catch {
      return null
    }
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
    return result.count
  }

  private toDomain(row: PrismaNotification): Notification {
    return {
      id: row.id,
      user_id: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      target_type: row.targetType,
      target_id: row.targetId,
      read: row.read,
      created_at: row.createdAt,
    }
  }
}
