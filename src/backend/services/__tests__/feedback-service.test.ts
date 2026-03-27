import { describe, expect, it } from 'vitest'
import { ForbiddenError, ValidationError } from '../../lib/errors.js'
import { InMemoryNotificationRepository } from '../../repos/notification-repository.js'
import { InMemoryFeedbackRepository } from '../../repos/feedback-repository.js'
import { InMemoryUserRepository } from '../../repos/user-repository.js'
import { NotificationService } from '../notification-service.js'
import { FeedbackService } from '../feedback-service.js'

const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5NQAAAAASUVORK5CYII=',
  'base64',
)

async function setup() {
  const feedbackRepo = new InMemoryFeedbackRepository()
  const userRepo = new InMemoryUserRepository()
  const notificationService = new NotificationService(new InMemoryNotificationRepository())
  await userRepo.upsertDevIdentity({ id: 'user-1', email: 'user1@test.com', role: 'user' })
  await userRepo.upsertDevIdentity({ id: 'user-2', email: 'user2@test.com', role: 'user' })
  await userRepo.upsertDevIdentity({ id: 'admin-1', email: 'admin1@test.com', role: 'admin' })

  return {
    feedbackRepo,
    userRepo,
    notificationService,
    service: new FeedbackService({
      feedbackRepo,
      userRepo,
      notificationService,
    }),
  }
}

describe('FeedbackService', () => {
  it('creates feedback with protected attachments and returns user-visible history', async () => {
    const { service } = await setup()

    const created = await service.create({
      created_by_user_id: 'user-1',
      category: 'UX_ISSUE',
      title: '帖子页切图会闪烁',
      body: '切换第二张图时会出现明显闪烁。',
      entry_surface: 'post_detail',
      source_route: '/posts/post-1',
      attachments: [
        {
          mime_type: 'image/png',
          bytes: VALID_PNG_BUFFER,
          original_name: 'flicker.png',
        },
      ],
    })

    expect(created.status).toBe('RECEIVED')
    expect(created.attachments).toHaveLength(1)
    expect(created.attachments[0]).toMatchObject({
      mime_type: 'image/png',
      width: 1,
      height: 1,
      url: expect.stringMatching(/^\/v1\/feedback\/attachments\//),
    })
    expect(created.history).toHaveLength(1)
    expect(created.history[0]).toMatchObject({
      event_type: 'SUBMITTED',
      to_status: 'RECEIVED',
      actor: {
        id: 'user-1',
        display_name: '开发用户',
      },
    })

    const list = await service.listForUser('user-1', { limit: 20, cursor: undefined })
    expect(list.items).toHaveLength(1)
    expect(list.items[0]?.id).toBe(created.id)

    const detail = await service.getDetailForUser('user-1', created.id)
    expect(detail.history).toHaveLength(1)

    const attachment = await service.getAttachmentForActor({
      attachment_id: created.attachments[0]!.id,
      actor_user_id: 'user-1',
      actor_role: 'user',
    })
    expect(Buffer.compare(attachment.data, VALID_PNG_BUFFER)).toBe(0)

    await expect(service.getAttachmentForActor({
      attachment_id: created.attachments[0]!.id,
      actor_user_id: 'user-2',
      actor_role: 'user',
    })).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('updates status and public note from admin, and emits a single feedback notification', async () => {
    const { service, notificationService } = await setup()
    const created = await service.create({
      created_by_user_id: 'user-1',
      category: 'PRODUCT_SUGGESTION',
      title: '建议增加意见箱入口',
      body: '希望在资源区固定展示意见入口。',
      attachments: [],
    })

    const updated = await service.updateByAdmin({
      id: created.id,
      actor_user_id: 'admin-1',
      status: 'PLANNED',
      public_resolution_note: '已纳入下个迭代。',
      internal_note: '和帮助中心入口一起发布。',
    })

    expect(updated.status).toBe('PLANNED')
    expect(updated.public_resolution_note).toBe('已纳入下个迭代。')
    expect(updated.internal_note).toBe('和帮助中心入口一起发布。')
    expect(updated.history.some((entry) => entry.event_type === 'INTERNAL_NOTE_UPDATED')).toBe(true)

    const userDetail = await service.getDetailForUser('user-1', created.id)
    expect(userDetail.history.map((entry) => entry.event_type)).toEqual([
      'SUBMITTED',
      'STATUS_CHANGED',
      'PUBLIC_NOTE_UPDATED',
    ])
    expect(userDetail.public_resolution_note).toBe('已纳入下个迭代。')

    const notifications = await notificationService.list('user-1', {
      limit: 20,
      cursor: undefined,
      read: false,
    })
    expect(notifications.items).toHaveLength(1)
    expect(notifications.items[0]).toMatchObject({
      type: 'FEEDBACK',
      title: '你的意见已被纳入计划',
      body: '已纳入下个迭代。',
      target_type: 'feedback_ticket',
      target_id: created.id,
    })
  })

  it('does not notify the user when only internal notes change', async () => {
    const { service, notificationService } = await setup()
    const created = await service.create({
      created_by_user_id: 'user-1',
      category: 'BUG_REPORT',
      title: '首页接口偶发 500',
      body: '刷新几次后会出现报错。',
      attachments: [],
    })

    const updated = await service.updateByAdmin({
      id: created.id,
      actor_user_id: 'admin-1',
      internal_note: '已在 staging 复现，等待后端修复。',
    })

    expect(updated.internal_note).toContain('staging')
    const userDetail = await service.getDetailForUser('user-1', created.id)
    expect(userDetail.history.map((entry) => entry.event_type)).toEqual(['SUBMITTED'])

    const notifications = await notificationService.list('user-1', {
      limit: 20,
      cursor: undefined,
      read: false,
    })
    expect(notifications.items).toHaveLength(0)
  })

  it('rejects invalid status transitions after a ticket is closed', async () => {
    const { service } = await setup()
    const created = await service.create({
      created_by_user_id: 'user-1',
      category: 'OTHER',
      title: '一般反馈',
      body: '先关闭再尝试重开。',
      attachments: [],
    })

    await service.updateByAdmin({
      id: created.id,
      actor_user_id: 'admin-1',
      status: 'CLOSED',
      public_resolution_note: '当前先关闭处理。',
    })

    await expect(service.updateByAdmin({
      id: created.id,
      actor_user_id: 'admin-1',
      status: 'UNDER_REVIEW',
    })).rejects.toBeInstanceOf(ValidationError)
  })

  it('validates attachment count and mime type', async () => {
    const { service } = await setup()

    await expect(service.create({
      created_by_user_id: 'user-1',
      category: 'UX_ISSUE',
      title: '附件过多',
      body: '超过限制时应报错。',
      attachments: [1, 2, 3, 4].map((index) => ({
        mime_type: 'image/png',
        bytes: VALID_PNG_BUFFER,
        original_name: `capture-${index}.png`,
      })),
    })).rejects.toBeInstanceOf(ValidationError)

    await expect(service.create({
      created_by_user_id: 'user-1',
      category: 'UX_ISSUE',
      title: '非法格式',
      body: '非图片文件应被拒绝。',
      attachments: [{
        mime_type: 'text/plain',
        bytes: Buffer.from('hello'),
        original_name: 'note.txt',
      }],
    })).rejects.toBeInstanceOf(ValidationError)
  })
})
