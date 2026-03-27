import { randomUUID } from 'node:crypto'
import type { UserRepository } from '../repos/user-repository.js'
import type { FeedbackListOpts, FeedbackRepository } from '../repos/feedback-repository.js'
import type {
  FeedbackAttachment,
  FeedbackAttachmentFile,
  FeedbackCategory,
  FeedbackHistoryEntry,
  FeedbackStatus,
  FeedbackTicketRecord,
  HumanUser,
} from '../repos/types.js'
import type { NotificationService } from './notification-service.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const MAX_ATTACHMENTS = 3
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024
const MAX_TITLE_LENGTH = 200
const MAX_BODY_LENGTH = 5_000
const MAX_ENTRY_SURFACE_LENGTH = 80
const MAX_SOURCE_ROUTE_LENGTH = 500
const MAX_PUBLIC_NOTE_LENGTH = 5_000
const MAX_INTERNAL_NOTE_LENGTH = 5_000
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const RIFF_SIGNATURE = Buffer.from('RIFF', 'ascii')
const WEBP_SIGNATURE = Buffer.from('WEBP', 'ascii')

const STATUS_TRANSITIONS: Record<FeedbackStatus, FeedbackStatus[]> = {
  RECEIVED: ['UNDER_REVIEW', 'PLANNED', 'CLOSED'],
  UNDER_REVIEW: ['PLANNED', 'CLOSED'],
  PLANNED: ['CLOSED'],
  CLOSED: [],
}

interface UploadedAttachmentInput {
  mime_type: string
  bytes: Buffer
  original_name?: string
}

interface ActorSummary {
  id: string
  display_name: string
  email: string | null
}

export interface FeedbackAttachmentView {
  id: string
  mime_type: string
  file_size_bytes: number
  width: number | null
  height: number | null
  url: string
}

export interface FeedbackHistoryView {
  id: string
  event_type: FeedbackHistoryEntry['event_type']
  from_status: FeedbackStatus | null
  to_status: FeedbackStatus | null
  message: string | null
  visibility: FeedbackHistoryEntry['visibility']
  created_at: string
  actor: ActorSummary | null
}

export interface FeedbackTicketSummaryView {
  id: string
  category: FeedbackCategory
  title: string
  body: string
  entry_surface: string | null
  source_route: string | null
  status: FeedbackStatus
  public_resolution_note: string | null
  updated_at: string
  created_at: string
  attachments: FeedbackAttachmentView[]
}

export interface FeedbackTicketDetailView extends FeedbackTicketSummaryView {
  history: FeedbackHistoryView[]
}

export interface AdminFeedbackTicketDetailView extends FeedbackTicketDetailView {
  internal_note: string | null
  submitter: ActorSummary
}

export class FeedbackService {
  constructor(
    private readonly deps: {
      feedbackRepo: FeedbackRepository
      userRepo: UserRepository | null
      notificationService: NotificationService | null
    },
  ) {}

  async create(input: {
    created_by_user_id: string
    category: FeedbackCategory
    title: string
    body: string
    entry_surface?: string | null
    source_route?: string | null
    attachments: UploadedAttachmentInput[]
  }): Promise<FeedbackTicketDetailView> {
    const title = normalizeRequiredText(input.title, 'title', MAX_TITLE_LENGTH)
    const body = normalizeRequiredText(input.body, 'body', MAX_BODY_LENGTH)
    const entry_surface = normalizeOptionalText(
      input.entry_surface,
      'entry_surface',
      MAX_ENTRY_SURFACE_LENGTH,
    )
    const source_route = normalizeOptionalText(
      input.source_route,
      'source_route',
      MAX_SOURCE_ROUTE_LENGTH,
    )
    const attachments = this.normalizeAttachments(input.attachments)

    const created = await this.deps.feedbackRepo.create({
      ticket: {
        created_by_user_id: input.created_by_user_id,
        category: input.category,
        title,
        body,
        entry_surface,
        source_route,
        status: 'RECEIVED',
      },
      attachments,
      history: [
        {
          feedback_ticket_id: '',
          actor_user_id: input.created_by_user_id,
          visibility: 'USER',
          event_type: 'SUBMITTED',
          to_status: 'RECEIVED',
          message: '反馈已提交，等待管理员查看。',
        },
      ],
    })

    return this.toUserDetailView(created, {
      actorCache: new Map(),
    })
  }

  async listForUser(
    userId: string,
    opts: FeedbackListOpts,
  ): Promise<{ items: FeedbackTicketSummaryView[]; next_cursor: string | null }> {
    const result = await this.deps.feedbackRepo.listForUser(userId, opts)
    return {
      items: result.items.map((item) => this.toSummaryView(item)),
      next_cursor: result.next_cursor,
    }
  }

  async getDetailForUser(userId: string, id: string): Promise<FeedbackTicketDetailView> {
    const record = await this.deps.feedbackRepo.findByIdForUser(id, userId)
    if (!record) {
      throw new NotFoundError('FeedbackTicket', id)
    }
    return this.toUserDetailView(record, { actorCache: new Map() })
  }

  async listForAdmin(
    opts: FeedbackListOpts,
  ): Promise<{ items: Array<FeedbackTicketSummaryView & { submitter: ActorSummary }>; next_cursor: string | null }> {
    const result = await this.deps.feedbackRepo.listForAdmin(opts)
    const actorCache = new Map<string, ActorSummary | null>()
    const items = await Promise.all(result.items.map(async (item) => ({
      ...this.toSummaryView(item),
      submitter: await this.requireActor(item.ticket.created_by_user_id, actorCache),
    })))

    return {
      items,
      next_cursor: result.next_cursor,
    }
  }

  async getDetailForAdmin(id: string): Promise<AdminFeedbackTicketDetailView> {
    const record = await this.deps.feedbackRepo.findByIdForAdmin(id)
    if (!record) {
      throw new NotFoundError('FeedbackTicket', id)
    }
    const actorCache = new Map<string, ActorSummary | null>()
    return this.toAdminDetailView(record, actorCache)
  }

  async updateByAdmin(input: {
    id: string
    actor_user_id: string
    status?: FeedbackStatus
    public_resolution_note?: string | null
    internal_note?: string | null
  }): Promise<AdminFeedbackTicketDetailView> {
    const existing = await this.deps.feedbackRepo.findByIdForAdmin(input.id)
    if (!existing) {
      throw new NotFoundError('FeedbackTicket', input.id)
    }

    const nextStatus = input.status
    const nextPublicNote =
      input.public_resolution_note !== undefined
        ? normalizeOptionalText(
            input.public_resolution_note,
            'public_resolution_note',
            MAX_PUBLIC_NOTE_LENGTH,
          )
        : undefined
    const nextInternalNote =
      input.internal_note !== undefined
        ? normalizeOptionalText(input.internal_note, 'internal_note', MAX_INTERNAL_NOTE_LENGTH)
        : undefined

    if (nextStatus && nextStatus !== existing.ticket.status) {
      this.assertValidStatusTransition(existing.ticket.status, nextStatus)
    }

    const history = []
    let shouldNotify = false

    if (nextStatus && nextStatus !== existing.ticket.status) {
      history.push({
        feedback_ticket_id: existing.ticket.id,
        actor_user_id: input.actor_user_id,
        visibility: 'USER' as const,
        event_type: 'STATUS_CHANGED' as const,
        from_status: existing.ticket.status,
        to_status: nextStatus,
        message: this.buildStatusMessage(nextStatus),
      })
      shouldNotify = true
    }

    if (nextPublicNote !== undefined && nextPublicNote !== existing.ticket.public_resolution_note) {
      history.push({
        feedback_ticket_id: existing.ticket.id,
        actor_user_id: input.actor_user_id,
        visibility: 'USER' as const,
        event_type: 'PUBLIC_NOTE_UPDATED' as const,
        message: nextPublicNote ?? '公开处理结论已清空。',
      })
      shouldNotify = true
    }

    if (nextInternalNote !== undefined && nextInternalNote !== existing.ticket.internal_note) {
      history.push({
        feedback_ticket_id: existing.ticket.id,
        actor_user_id: input.actor_user_id,
        visibility: 'ADMIN_ONLY' as const,
        event_type: 'INTERNAL_NOTE_UPDATED' as const,
        message: nextInternalNote ?? '内部备注已清空。',
      })
    }

    if (history.length === 0) {
      throw new ValidationError('No feedback fields changed')
    }

    const updated = await this.deps.feedbackRepo.update({
      ticket: {
        id: existing.ticket.id,
        status: nextStatus,
        public_resolution_note: nextPublicNote,
        internal_note: nextInternalNote,
        updated_by_user_id: input.actor_user_id,
      },
      history,
    })
    if (!updated) {
      throw new NotFoundError('FeedbackTicket', input.id)
    }

    if (shouldNotify && this.deps.notificationService) {
      await this.deps.notificationService.create({
        userId: updated.ticket.created_by_user_id,
        type: 'FEEDBACK',
        title: this.buildNotificationTitle(updated.ticket.status),
        body: updated.ticket.public_resolution_note ?? this.buildNotificationBody(updated.ticket.status),
        targetType: 'feedback_ticket',
        targetId: updated.ticket.id,
      })
    }

    return this.toAdminDetailView(updated, new Map())
  }

  async getAttachmentForActor(input: {
    attachment_id: string
    actor_user_id: string
    actor_role: 'user' | 'admin'
  }): Promise<FeedbackAttachmentFile> {
    const result = await this.deps.feedbackRepo.getAttachmentFileById(input.attachment_id)
    if (!result) {
      throw new NotFoundError('FeedbackAttachment', input.attachment_id)
    }
    if (input.actor_role !== 'admin' && result.ticket.created_by_user_id !== input.actor_user_id) {
      throw new ForbiddenError('You cannot access this feedback attachment')
    }
    return result.attachment
  }

  private toSummaryView(record: FeedbackTicketRecord): FeedbackTicketSummaryView {
    return {
      id: record.ticket.id,
      category: record.ticket.category,
      title: record.ticket.title,
      body: record.ticket.body,
      entry_surface: record.ticket.entry_surface,
      source_route: record.ticket.source_route,
      status: record.ticket.status,
      public_resolution_note: record.ticket.public_resolution_note,
      updated_at: record.ticket.updated_at.toISOString(),
      created_at: record.ticket.created_at.toISOString(),
      attachments: record.attachments.map((attachment) => this.toAttachmentView(attachment)),
    }
  }

  private async toUserDetailView(
    record: FeedbackTicketRecord,
    opts: { actorCache: Map<string, ActorSummary | null> },
  ): Promise<FeedbackTicketDetailView> {
    return {
      ...this.toSummaryView(record),
      history: await Promise.all(
        record.history
          .filter((item) => item.visibility === 'USER')
          .map((item) => this.toHistoryView(item, opts.actorCache)),
      ),
    }
  }

  private async toAdminDetailView(
    record: FeedbackTicketRecord,
    actorCache: Map<string, ActorSummary | null>,
  ): Promise<AdminFeedbackTicketDetailView> {
    const base = this.toSummaryView(record)
    return {
      ...base,
      history: await Promise.all(
        record.history.map((item) => this.toHistoryView(item, actorCache)),
      ),
      internal_note: record.ticket.internal_note,
      submitter: await this.requireActor(record.ticket.created_by_user_id, actorCache),
    }
  }

  private async toHistoryView(
    entry: FeedbackHistoryEntry,
    actorCache: Map<string, ActorSummary | null>,
  ): Promise<FeedbackHistoryView> {
    const actor = entry.actor_user_id
      ? await this.loadActor(entry.actor_user_id, actorCache)
      : null
    return {
      id: entry.id,
      event_type: entry.event_type,
      from_status: entry.from_status,
      to_status: entry.to_status,
      message: entry.message,
      visibility: entry.visibility,
      created_at: entry.created_at.toISOString(),
      actor,
    }
  }

  private toAttachmentView(attachment: FeedbackAttachment): FeedbackAttachmentView {
    return {
      id: attachment.id,
      mime_type: attachment.mime_type,
      file_size_bytes: attachment.file_size_bytes,
      width: attachment.width,
      height: attachment.height,
      url: `/v1/feedback/attachments/${attachment.id}`,
    }
  }

  private normalizeAttachments(
    attachments: UploadedAttachmentInput[],
  ): Array<{
    feedback_ticket_id: string
    storage_key: string
    mime_type: string
    file_size_bytes: number
    width: number | null
    height: number | null
    data: Buffer
  }> {
    if (attachments.length > MAX_ATTACHMENTS) {
      throw new ValidationError(`attachments exceed ${MAX_ATTACHMENTS} file limit`)
    }

    return attachments.map((attachment, index) => {
      const mimeType = attachment.mime_type.toLowerCase()
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new ValidationError('attachments must be png, jpeg, or webp')
      }
      if (attachment.bytes.byteLength <= 0) {
        throw new ValidationError('attachment file is empty')
      }
      if (attachment.bytes.byteLength > MAX_ATTACHMENT_SIZE_BYTES) {
        throw new ValidationError('media exceeds 10MB limit')
      }
      assertImageSignature(mimeType, attachment.bytes)
      const dimensions = readImageDimensions(mimeType, attachment.bytes)
      return {
        feedback_ticket_id: '',
        storage_key: buildStorageKey(index, mimeType, attachment.original_name),
        mime_type: normalizeMimeType(mimeType),
        file_size_bytes: attachment.bytes.byteLength,
        width: dimensions.width,
        height: dimensions.height,
        data: Buffer.from(attachment.bytes),
      }
    })
  }

  private assertValidStatusTransition(current: FeedbackStatus, next: FeedbackStatus): void {
    if (!STATUS_TRANSITIONS[current].includes(next)) {
      throw new ValidationError(`Invalid feedback status transition: ${current} -> ${next}`)
    }
  }

  private buildStatusMessage(status: FeedbackStatus): string {
    switch (status) {
      case 'UNDER_REVIEW':
        return '管理员已开始查看这条反馈。'
      case 'PLANNED':
        return '这条反馈已进入计划中。'
      case 'CLOSED':
        return '这条反馈已处理完成。'
      case 'RECEIVED':
      default:
        return '反馈状态已更新。'
    }
  }

  private buildNotificationTitle(status: FeedbackStatus): string {
    switch (status) {
      case 'UNDER_REVIEW':
        return '你的意见已进入处理中'
      case 'PLANNED':
        return '你的意见已被纳入计划'
      case 'CLOSED':
        return '你的意见已处理完成'
      case 'RECEIVED':
      default:
        return '你的意见有新进展'
    }
  }

  private buildNotificationBody(status: FeedbackStatus): string {
    switch (status) {
      case 'UNDER_REVIEW':
        return '管理员已开始查看你的反馈。'
      case 'PLANNED':
        return '管理员已将你的反馈纳入后续计划。'
      case 'CLOSED':
        return '管理员已结束这条反馈的处理。'
      case 'RECEIVED':
      default:
        return '你的反馈状态发生了变化。'
    }
  }

  private async requireActor(
    userId: string,
    actorCache: Map<string, ActorSummary | null>,
  ): Promise<ActorSummary> {
    const actor = await this.loadActor(userId, actorCache)
    if (!actor) {
      return {
        id: userId,
        display_name: userId,
        email: null,
      }
    }
    return actor
  }

  private async loadActor(
    userId: string,
    actorCache: Map<string, ActorSummary | null>,
  ): Promise<ActorSummary | null> {
    if (actorCache.has(userId)) {
      return actorCache.get(userId) ?? null
    }
    if (!this.deps.userRepo) {
      actorCache.set(userId, null)
      return null
    }
    const user = await this.deps.userRepo.findById(userId)
    const summary = user ? toActorSummary(user) : null
    actorCache.set(userId, summary)
    return summary
  }
}

function toActorSummary(user: HumanUser): ActorSummary {
  return {
    id: user.id,
    display_name: user.display_name,
    email: user.email,
  }
}

function normalizeRequiredText(value: string, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} is required`)
  }
  const normalized = value.trim()
  if (!normalized) {
    throw new ValidationError(`${field} is required`)
  }
  if (normalized.length > maxLength) {
    throw new ValidationError(`${field} exceeds ${maxLength} chars`)
  }
  return normalized
}

function normalizeOptionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) {
    return value ?? null
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string`)
  }
  const normalized = value.trim()
  if (!normalized) {
    return null
  }
  if (normalized.length > maxLength) {
    throw new ValidationError(`${field} exceeds ${maxLength} chars`)
  }
  return normalized
}

function normalizeMimeType(mimeType: string): string {
  return mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
}

function buildStorageKey(index: number, mimeType: string, originalName?: string): string {
  return `feedback/${Date.now()}-${index + 1}-${randomUUID()}${extensionFromMimeType(mimeType, originalName)}`
}

function extensionFromMimeType(mimeType: string, originalName?: string): string {
  const normalized = normalizeMimeType(mimeType)
  if (normalized === 'image/png') return '.png'
  if (normalized === 'image/jpeg') return '.jpg'
  if (normalized === 'image/webp') return '.webp'
  if (originalName?.includes('.')) {
    return `.${originalName.split('.').pop() ?? 'bin'}`
  }
  return ''
}

function assertImageSignature(mimeType: string, bytes: Buffer): void {
  const normalized = normalizeMimeType(mimeType)
  if (normalized === 'image/png') {
    if (
      bytes.length < PNG_SIGNATURE.length
      || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
    ) {
      throw new ValidationError('corrupted image file')
    }
    return
  }

  if (normalized === 'image/webp') {
    if (
      bytes.length < 12
      || !bytes.subarray(0, 4).equals(RIFF_SIGNATURE)
      || !bytes.subarray(8, 12).equals(WEBP_SIGNATURE)
    ) {
      throw new ValidationError('corrupted image file')
    }
    return
  }

  if (normalized === 'image/jpeg' && (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)) {
    throw new ValidationError('corrupted image file')
  }
}

function readImageDimensions(
  mimeType: string,
  bytes: Buffer,
): { width: number | null; height: number | null } {
  const normalized = normalizeMimeType(mimeType)
  try {
    if (normalized === 'image/png' && bytes.length >= 24) {
      return {
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
      }
    }
    if (normalized === 'image/webp' && bytes.length >= 30) {
      const chunkType = bytes.subarray(12, 16).toString('ascii')
      if (chunkType === 'VP8X') {
        return {
          width: 1 + bytes.readUIntLE(24, 3),
          height: 1 + bytes.readUIntLE(27, 3),
        }
      }
    }
    if (normalized === 'image/jpeg') {
      let offset = 2
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1
          continue
        }
        const marker = bytes[offset + 1]
        const length = bytes.readUInt16BE(offset + 2)
        const isSofMarker =
          marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
        if (isSofMarker && offset + 8 < bytes.length) {
          return {
            height: bytes.readUInt16BE(offset + 5),
            width: bytes.readUInt16BE(offset + 7),
          }
        }
        offset += 2 + length
      }
    }
  } catch {
    return { width: null, height: null }
  }
  return { width: null, height: null }
}
