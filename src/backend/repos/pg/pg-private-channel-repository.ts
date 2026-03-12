import type {
  PrismaClient,
  PrivateSession as PrismaSession,
  PrivateMessage as PrismaMessage,
} from '@prisma/client'
import { Prisma } from '@prisma/client'
import type {
  PrivateSession,
  PrivateMessage,
  CreatePrivateSessionInput,
  CreatePrivateMessageInput,
  PaginatedResult,
  PaginationOpts,
  PrivateSessionStatus,
  SessionInitiator,
  DigestStatus,
} from '../types.js'
import type { PrivateChannelRepository } from '../private-channel-repository.js'

export class PgPrivateChannelRepository implements PrivateChannelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createSession(input: CreatePrivateSessionInput): Promise<PrivateSession> {
    const row = await this.prisma.privateSession.create({
      data: {
        agentId: input.agent_id,
        humanUserId: input.human_user_id,
        initiator: input.initiator ?? 'HUMAN',
        triggerType: input.trigger_type ?? null,
        triggerRef: input.trigger_ref ?? null,
      },
    })
    return this.sessionToDomain(row)
  }

  async findSessionById(id: string): Promise<PrivateSession | null> {
    const row = await this.prisma.privateSession.findUnique({ where: { id } })
    return row ? this.sessionToDomain(row) : null
  }

  async listSessions(
    agentId: string,
    opts: PaginationOpts & { status?: PrivateSessionStatus; initiator?: SessionInitiator },
  ): Promise<PaginatedResult<PrivateSession>> {
    const where: Record<string, unknown> = { agentId }
    if (opts.status) where.status = opts.status
    if (opts.initiator) where.initiator = opts.initiator

    const rows = await this.prisma.privateSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    })

    const hasMore = rows.length > opts.limit
    const items = hasMore ? rows.slice(0, opts.limit) : rows

    return {
      items: items.map((r) => this.sessionToDomain(r)),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    }
  }

  async updateSessionStatus(
    id: string,
    status: PrivateSessionStatus,
    endedAt?: Date,
  ): Promise<PrivateSession | null> {
    try {
      const row = await this.prisma.privateSession.update({
        where: { id },
        data: {
          status,
          ...(endedAt ? { endedAt } : {}),
        },
      })
      return this.sessionToDomain(row)
    } catch {
      return null
    }
  }

  async updateDigestStatus(
    id: string,
    digestStatus: DigestStatus,
  ): Promise<PrivateSession | null> {
    try {
      const row = await this.prisma.privateSession.update({
        where: { id },
        data: { digestStatus },
      })
      return this.sessionToDomain(row)
    } catch {
      return null
    }
  }

  async findTimedOutSessions(timeoutMs: number): Promise<PrivateSession[]> {
    const threshold = new Date(Date.now() - timeoutMs)

    const rows = await this.prisma.$queryRaw<PrismaSession[]>`
      SELECT ps.* FROM private_sessions ps
      WHERE ps.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM private_messages pm
          WHERE pm.session_id = ps.id
            AND pm.created_at > ${threshold}
        )
        AND ps.started_at < ${threshold}
    `
    return rows.map((r) => this.sessionToDomain(r))
  }

  async createMessage(input: CreatePrivateMessageInput): Promise<PrivateMessage> {
    const row = await this.prisma.privateMessage.create({
      data: {
        sessionId: input.session_id,
        authorType: input.author_type,
        content: input.content,
        deliveryStatus: input.delivery_status ?? 'DELIVERED',
        moderationMetadataJson:
          (input.moderation_metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    })
    return this.messageToDomain(row)
  }

  async listMessages(
    sessionId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<PrivateMessage>> {
    const rows = await this.prisma.privateMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    })

    const hasMore = rows.length > opts.limit
    const items = hasMore ? rows.slice(0, opts.limit) : rows

    return {
      items: items.map((r) => this.messageToDomain(r)),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    }
  }

  async countMessages(sessionId: string): Promise<number> {
    return this.prisma.privateMessage.count({ where: { sessionId } })
  }

  private sessionToDomain(row: PrismaSession): PrivateSession {
    return {
      id: row.id,
      agent_id: row.agentId,
      human_user_id: row.humanUserId,
      status: row.status,
      initiator: row.initiator,
      trigger_type: row.triggerType,
      trigger_ref: row.triggerRef,
      started_at: row.startedAt,
      ended_at: row.endedAt,
      digest_status: row.digestStatus,
    }
  }

  private messageToDomain(row: PrismaMessage): PrivateMessage {
    return {
      id: row.id,
      session_id: row.sessionId,
      author_type: row.authorType,
      content: row.content,
      delivery_status: row.deliveryStatus,
      moderation_metadata:
        row.moderationMetadataJson
          ? row.moderationMetadataJson as Record<string, unknown>
          : null,
      created_at: row.createdAt,
    }
  }
}
