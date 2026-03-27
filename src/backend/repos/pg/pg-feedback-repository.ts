import { Prisma } from '@prisma/client'
import type {
  PrismaClient,
  FeedbackTicket as PrismaFeedbackTicket,
  FeedbackTicketHistoryEntry as PrismaFeedbackTicketHistoryEntry,
} from '@prisma/client'
import type {
  CreateFeedbackAttachmentInput,
  CreateFeedbackHistoryEntryInput,
  CreateFeedbackTicketInput,
  FeedbackAttachment,
  FeedbackAttachmentFile,
  FeedbackCategory,
  FeedbackHistoryEntry,
  FeedbackStatus,
  FeedbackTicket,
  FeedbackTicketRecord,
  PaginatedResult,
  UpdateFeedbackTicketInput,
} from '../types.js'
import type { FeedbackListOpts, FeedbackRepository } from '../feedback-repository.js'

function toTicket(row: PrismaFeedbackTicket): FeedbackTicket {
  return {
    id: row.id,
    created_by_user_id: row.createdByUserId,
    category: row.category,
    title: row.title,
    body: row.body,
    entry_surface: row.entrySurface,
    source_route: row.sourceRoute,
    status: row.status,
    public_resolution_note: row.publicResolutionNote,
    internal_note: row.internalNote,
    updated_by_user_id: row.updatedByUserId,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

const feedbackAttachmentSelect = Prisma.validator<Prisma.FeedbackAttachmentSelect>()({
  id: true,
  feedbackTicketId: true,
  storageKey: true,
  mimeType: true,
  fileSizeBytes: true,
  width: true,
  height: true,
  createdAt: true,
})

const feedbackTicketDetailArgs = Prisma.validator<Prisma.FeedbackTicketDefaultArgs>()({
  include: {
    attachments: {
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: feedbackAttachmentSelect,
    },
    historyEntries: {
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    },
  },
})

type FeedbackAttachmentSummaryRow = Prisma.FeedbackAttachmentGetPayload<{
  select: typeof feedbackAttachmentSelect
}>

type FeedbackTicketDetailRow = Prisma.FeedbackTicketGetPayload<typeof feedbackTicketDetailArgs>

function toAttachment(row: FeedbackAttachmentSummaryRow): FeedbackAttachment {
  return {
    id: row.id,
    feedback_ticket_id: row.feedbackTicketId,
    storage_key: row.storageKey,
    mime_type: row.mimeType,
    file_size_bytes: row.fileSizeBytes,
    width: row.width,
    height: row.height,
    created_at: row.createdAt,
  }
}

function toHistory(row: PrismaFeedbackTicketHistoryEntry): FeedbackHistoryEntry {
  return {
    id: row.id,
    feedback_ticket_id: row.feedbackTicketId,
    actor_user_id: row.actorUserId,
    visibility: row.visibility,
    event_type: row.eventType,
    from_status: row.fromStatus,
    to_status: row.toStatus,
    message: row.message,
    created_at: row.createdAt,
  }
}

export class PgFeedbackRepository implements FeedbackRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    ticket: CreateFeedbackTicketInput
    attachments: CreateFeedbackAttachmentInput[]
    history: CreateFeedbackHistoryEntryInput[]
  }): Promise<FeedbackTicketRecord> {
    const row = await this.prisma.feedbackTicket.create({
      data: {
        createdByUserId: input.ticket.created_by_user_id,
        category: input.ticket.category,
        title: input.ticket.title,
        body: input.ticket.body,
        entrySurface: input.ticket.entry_surface ?? null,
        sourceRoute: input.ticket.source_route ?? null,
        status: input.ticket.status ?? 'RECEIVED',
        publicResolutionNote: input.ticket.public_resolution_note ?? null,
        internalNote: input.ticket.internal_note ?? null,
        updatedByUserId: input.ticket.updated_by_user_id ?? null,
        attachments: {
          create: input.attachments.map((attachment) => ({
            storageKey: attachment.storage_key,
            mimeType: attachment.mime_type,
            fileSizeBytes: attachment.file_size_bytes,
            width: attachment.width ?? null,
            height: attachment.height ?? null,
            blobData: toPrismaBytes(attachment.data),
          })),
        },
        historyEntries: {
          create: input.history.map((history) => ({
            actorUserId: history.actor_user_id ?? null,
            visibility: history.visibility,
            eventType: history.event_type,
            fromStatus: history.from_status ?? null,
            toStatus: history.to_status ?? null,
            message: history.message ?? null,
          })),
        },
      },
      include: feedbackTicketDetailArgs.include,
    })

    return this.toRecord(row)
  }

  async listForUser(
    userId: string,
    opts: FeedbackListOpts,
  ): Promise<PaginatedResult<FeedbackTicketRecord>> {
    const where = this.buildWhere({
      createdByUserId: userId,
      status: opts.status,
      category: opts.category,
      sourceRoute: opts.source_route,
    })

    const rows = await this.prisma.feedbackTicket.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      include: feedbackTicketDetailArgs.include,
    })

    return this.toPaginatedResult(rows, opts.limit)
  }

  async listForAdmin(opts: FeedbackListOpts): Promise<PaginatedResult<FeedbackTicketRecord>> {
    const where = this.buildWhere({
      status: opts.status,
      category: opts.category,
      sourceRoute: opts.source_route,
    })

    const rows = await this.prisma.feedbackTicket.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      include: feedbackTicketDetailArgs.include,
    })

    return this.toPaginatedResult(rows, opts.limit)
  }

  async findByIdForUser(id: string, userId: string): Promise<FeedbackTicketRecord | null> {
    const row = await this.prisma.feedbackTicket.findFirst({
      where: { id, createdByUserId: userId },
      include: feedbackTicketDetailArgs.include,
    })
    return row ? this.toRecord(row) : null
  }

  async findByIdForAdmin(id: string): Promise<FeedbackTicketRecord | null> {
    const row = await this.prisma.feedbackTicket.findUnique({
      where: { id },
      include: feedbackTicketDetailArgs.include,
    })
    return row ? this.toRecord(row) : null
  }

  async update(input: {
    ticket: UpdateFeedbackTicketInput
    history: CreateFeedbackHistoryEntryInput[]
  }): Promise<FeedbackTicketRecord | null> {
    const existing = await this.prisma.feedbackTicket.findUnique({
      where: { id: input.ticket.id },
      select: { id: true },
    })
    if (!existing) return null

    const row = await this.prisma.feedbackTicket.update({
      where: { id: input.ticket.id },
      data: {
        ...(input.ticket.status !== undefined ? { status: input.ticket.status } : {}),
        ...(input.ticket.public_resolution_note !== undefined
          ? { publicResolutionNote: input.ticket.public_resolution_note }
          : {}),
        ...(input.ticket.internal_note !== undefined
          ? { internalNote: input.ticket.internal_note }
          : {}),
        updatedByUserId: input.ticket.updated_by_user_id,
        historyEntries: input.history.length > 0
          ? {
              create: input.history.map((history) => ({
                actorUserId: history.actor_user_id ?? null,
                visibility: history.visibility,
                eventType: history.event_type,
                fromStatus: history.from_status ?? null,
                toStatus: history.to_status ?? null,
                message: history.message ?? null,
              })),
            }
          : undefined,
      },
      include: feedbackTicketDetailArgs.include,
    })

    return this.toRecord(row)
  }

  async getAttachmentFileById(id: string): Promise<{
    attachment: FeedbackAttachmentFile
    ticket: FeedbackTicket
  } | null> {
    const row = await this.prisma.feedbackAttachment.findUnique({
      where: { id },
      include: {
        ticket: true,
      },
    })
    if (!row) return null

    return {
      attachment: {
        attachment: toAttachment(row),
        data: Buffer.from(row.blobData),
      },
      ticket: toTicket(row.ticket),
    }
  }

  private buildWhere(filters: {
    createdByUserId?: string
    status?: FeedbackStatus
    category?: FeedbackCategory
    sourceRoute?: string
  }): Prisma.FeedbackTicketWhereInput {
    return {
      ...(filters.createdByUserId ? { createdByUserId: filters.createdByUserId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.sourceRoute ? { sourceRoute: filters.sourceRoute } : {}),
    }
  }

  private toPaginatedResult(
    rows: FeedbackTicketDetailRow[],
    limit: number,
  ): PaginatedResult<FeedbackTicketRecord> {
    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    return {
      items: items.map((row) => this.toRecord(row)),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    }
  }

  private toRecord(
    row: FeedbackTicketDetailRow,
  ): FeedbackTicketRecord {
    return {
      ticket: toTicket(row),
      attachments: row.attachments.map(toAttachment),
      history: row.historyEntries.map(toHistory),
    }
  }
}

function toPrismaBytes(bytes: Buffer): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(bytes.byteLength)
  const data = new Uint8Array(buffer)
  data.set(bytes)
  return data
}
