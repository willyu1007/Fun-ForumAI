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
  markRead(id: string): Promise<Notification | null>
  markAllRead(userId: string): Promise<number>
}
