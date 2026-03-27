import type {
  CreateFeedbackAttachmentInput,
  CreateFeedbackHistoryEntryInput,
  CreateFeedbackTicketInput,
  FeedbackAttachmentFile,
  FeedbackCategory,
  FeedbackHistoryEntry,
  FeedbackStatus,
  FeedbackTicket,
  FeedbackTicketRecord,
  PaginatedResult,
  PaginationOpts,
  UpdateFeedbackTicketInput,
} from './types.js'

export interface FeedbackListOpts extends PaginationOpts {
  status?: FeedbackStatus
  category?: FeedbackCategory
  source_route?: string
}

export interface FeedbackRepository {
  create(input: {
    ticket: CreateFeedbackTicketInput
    attachments: CreateFeedbackAttachmentInput[]
    history: CreateFeedbackHistoryEntryInput[]
  }): Promise<FeedbackTicketRecord>
  listForUser(userId: string, opts: FeedbackListOpts): Promise<PaginatedResult<FeedbackTicketRecord>>
  listForAdmin(opts: FeedbackListOpts): Promise<PaginatedResult<FeedbackTicketRecord>>
  findByIdForUser(id: string, userId: string): Promise<FeedbackTicketRecord | null>
  findByIdForAdmin(id: string): Promise<FeedbackTicketRecord | null>
  update(input: {
    ticket: UpdateFeedbackTicketInput
    history: CreateFeedbackHistoryEntryInput[]
  }): Promise<FeedbackTicketRecord | null>
  getAttachmentFileById(id: string): Promise<{
    attachment: FeedbackAttachmentFile
    ticket: FeedbackTicket
  } | null>
}

let feedbackTicketCounter = 0
let feedbackAttachmentCounter = 0
let feedbackHistoryCounter = 0

function nextTicketId(): string {
  feedbackTicketCounter += 1
  return `feedback_${Date.now()}_${feedbackTicketCounter}`
}

function nextAttachmentId(): string {
  feedbackAttachmentCounter += 1
  return `feedback_attachment_${Date.now()}_${feedbackAttachmentCounter}`
}

function nextHistoryId(): string {
  feedbackHistoryCounter += 1
  return `feedback_history_${Date.now()}_${feedbackHistoryCounter}`
}

function paginate<T extends { ticket: { id: string } }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const index = items.findIndex((item) => item.ticket.id === opts.cursor)
    start = index >= 0 ? index + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].ticket.id
      : null
  return { items: page, next_cursor }
}

function compareUserTickets(left: FeedbackTicket, right: FeedbackTicket): number {
  return right.updated_at.getTime() - left.updated_at.getTime()
    || right.created_at.getTime() - left.created_at.getTime()
    || right.id.localeCompare(left.id)
}

const ADMIN_STATUS_ORDER: Record<FeedbackStatus, number> = {
  RECEIVED: 0,
  UNDER_REVIEW: 1,
  PLANNED: 2,
  CLOSED: 3,
}

function compareAdminTickets(left: FeedbackTicket, right: FeedbackTicket): number {
  const statusDelta = ADMIN_STATUS_ORDER[left.status] - ADMIN_STATUS_ORDER[right.status]
  if (statusDelta !== 0) return statusDelta
  return compareUserTickets(left, right)
}

export class InMemoryFeedbackRepository implements FeedbackRepository {
  private readonly tickets = new Map<string, FeedbackTicket>()
  private readonly attachments = new Map<
    string,
    FeedbackAttachmentFile
  >()
  private readonly historyEntries = new Map<string, FeedbackHistoryEntry>()

  async create(input: {
    ticket: CreateFeedbackTicketInput
    attachments: CreateFeedbackAttachmentInput[]
    history: CreateFeedbackHistoryEntryInput[]
  }): Promise<FeedbackTicketRecord> {
    const now = new Date()
    const ticket: FeedbackTicket = {
      id: nextTicketId(),
      created_by_user_id: input.ticket.created_by_user_id,
      category: input.ticket.category,
      title: input.ticket.title,
      body: input.ticket.body,
      entry_surface: input.ticket.entry_surface ?? null,
      source_route: input.ticket.source_route ?? null,
      status: input.ticket.status ?? 'RECEIVED',
      public_resolution_note: input.ticket.public_resolution_note ?? null,
      internal_note: input.ticket.internal_note ?? null,
      updated_by_user_id: input.ticket.updated_by_user_id ?? null,
      created_at: now,
      updated_at: now,
    }
    this.tickets.set(ticket.id, ticket)

    for (const inputAttachment of input.attachments) {
      const attachment: FeedbackAttachmentFile = {
        attachment: {
          id: nextAttachmentId(),
          feedback_ticket_id: ticket.id,
          storage_key: inputAttachment.storage_key,
          mime_type: inputAttachment.mime_type,
          file_size_bytes: inputAttachment.file_size_bytes,
          width: inputAttachment.width ?? null,
          height: inputAttachment.height ?? null,
          created_at: now,
        },
        data: Buffer.from(inputAttachment.data),
      }
      this.attachments.set(attachment.attachment.id, attachment)
    }

    for (const inputHistory of input.history) {
      const history: FeedbackHistoryEntry = {
        id: nextHistoryId(),
        feedback_ticket_id: ticket.id,
        actor_user_id: inputHistory.actor_user_id ?? null,
        visibility: inputHistory.visibility,
        event_type: inputHistory.event_type,
        from_status: inputHistory.from_status ?? null,
        to_status: inputHistory.to_status ?? null,
        message: inputHistory.message ?? null,
        created_at: now,
      }
      this.historyEntries.set(history.id, history)
    }

    return this.getRecord(ticket.id)!
  }

  async listForUser(
    userId: string,
    opts: FeedbackListOpts,
  ): Promise<PaginatedResult<FeedbackTicketRecord>> {
    const items = this.getFilteredTickets({
      created_by_user_id: userId,
      status: opts.status,
      category: opts.category,
      source_route: opts.source_route,
      admin: false,
    }).map((ticket) => this.getRecord(ticket.id)!)
    return paginate(items, opts)
  }

  async listForAdmin(opts: FeedbackListOpts): Promise<PaginatedResult<FeedbackTicketRecord>> {
    const items = this.getFilteredTickets({
      status: opts.status,
      category: opts.category,
      source_route: opts.source_route,
      admin: true,
    }).map((ticket) => this.getRecord(ticket.id)!)
    return paginate(items, opts)
  }

  async findByIdForUser(id: string, userId: string): Promise<FeedbackTicketRecord | null> {
    const ticket = this.tickets.get(id)
    if (!ticket || ticket.created_by_user_id !== userId) {
      return null
    }
    return this.getRecord(id)
  }

  async findByIdForAdmin(id: string): Promise<FeedbackTicketRecord | null> {
    return this.getRecord(id)
  }

  async update(input: {
    ticket: UpdateFeedbackTicketInput
    history: CreateFeedbackHistoryEntryInput[]
  }): Promise<FeedbackTicketRecord | null> {
    const existing = this.tickets.get(input.ticket.id)
    if (!existing) return null

    const updated: FeedbackTicket = {
      ...existing,
      ...(input.ticket.status !== undefined ? { status: input.ticket.status } : {}),
      ...(input.ticket.public_resolution_note !== undefined
        ? { public_resolution_note: input.ticket.public_resolution_note }
        : {}),
      ...(input.ticket.internal_note !== undefined
        ? { internal_note: input.ticket.internal_note }
        : {}),
      updated_by_user_id: input.ticket.updated_by_user_id,
      updated_at: new Date(),
    }
    this.tickets.set(updated.id, updated)

    for (const inputHistory of input.history) {
      const history: FeedbackHistoryEntry = {
        id: nextHistoryId(),
        feedback_ticket_id: updated.id,
        actor_user_id: inputHistory.actor_user_id ?? null,
        visibility: inputHistory.visibility,
        event_type: inputHistory.event_type,
        from_status: inputHistory.from_status ?? null,
        to_status: inputHistory.to_status ?? null,
        message: inputHistory.message ?? null,
        created_at: new Date(),
      }
      this.historyEntries.set(history.id, history)
    }

    return this.getRecord(updated.id)
  }

  async getAttachmentFileById(id: string): Promise<{
    attachment: FeedbackAttachmentFile
    ticket: FeedbackTicket
  } | null> {
    const attachment = this.attachments.get(id)
    if (!attachment) return null
    const ticket = this.tickets.get(attachment.attachment.feedback_ticket_id)
    if (!ticket) return null
    return {
      attachment: {
        attachment: { ...attachment.attachment },
        data: Buffer.from(attachment.data),
      },
      ticket: { ...ticket },
    }
  }

  private getRecord(id: string): FeedbackTicketRecord | null {
    const ticket = this.tickets.get(id)
    if (!ticket) return null
    const attachments = Array.from(this.attachments.values())
      .filter((item) => item.attachment.feedback_ticket_id === id)
      .map((item) => ({ ...item.attachment }))
      .sort((left, right) =>
        left.created_at.getTime() - right.created_at.getTime() || left.id.localeCompare(right.id))
    const history = Array.from(this.historyEntries.values())
      .filter((item) => item.feedback_ticket_id === id)
      .map((item) => ({ ...item }))
      .sort((left, right) =>
        left.created_at.getTime() - right.created_at.getTime() || left.id.localeCompare(right.id))
    return {
      ticket: { ...ticket },
      attachments,
      history,
    }
  }

  private getFilteredTickets(filters: {
    created_by_user_id?: string
    status?: FeedbackStatus
    category?: FeedbackCategory
    source_route?: string
    admin: boolean
  }): FeedbackTicket[] {
    const items = Array.from(this.tickets.values()).filter((ticket) => {
      if (filters.created_by_user_id && ticket.created_by_user_id !== filters.created_by_user_id) {
        return false
      }
      if (filters.status && ticket.status !== filters.status) return false
      if (filters.category && ticket.category !== filters.category) return false
      if (filters.source_route && ticket.source_route !== filters.source_route) return false
      return true
    })
    items.sort(filters.admin ? compareAdminTickets : compareUserTickets)
    return items
  }
}
