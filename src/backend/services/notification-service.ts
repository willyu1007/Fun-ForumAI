import type { NotificationRepository } from '../repos/notification-repository.js'
import type {
  Notification,
  PaginatedResult,
  PaginationOpts,
  NotificationType,
} from '../repos/types.js'

export class NotificationService {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async create(input: {
    userId: string
    type: NotificationType
    title: string
    body?: string
    targetType?: string
    targetId?: string
  }): Promise<Notification> {
    return this.notificationRepo.create({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
    })
  }

  async list(
    userId: string,
    opts: PaginationOpts & { read?: boolean },
  ): Promise<PaginatedResult<Notification> & { unread_count: number }> {
    return this.notificationRepo.list(userId, opts)
  }

  async markRead(notificationId: string): Promise<Notification | null> {
    return this.notificationRepo.markRead(notificationId)
  }

  async markAllRead(userId: string): Promise<number> {
    return this.notificationRepo.markAllRead(userId)
  }
}
