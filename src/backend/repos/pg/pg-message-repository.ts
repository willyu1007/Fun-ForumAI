import { Prisma, type PrismaClient, type RoomMessage as PrismaMessage } from '@prisma/client'
import type {
  ChatMessage,
  ChatMessageKind,
  CreateChatMessageInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { MessageRepository } from '../message-repository.js'

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
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
  return { items: page, next_cursor }
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

export class PgMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // DB-first mode: no local cache to hydrate.
  async hydrate(): Promise<void> {}

  async create(input: CreateChatMessageInput): Promise<ChatMessage> {
    const row = await this.prisma.roomMessage.create({
      data: {
        roomId: input.room_id,
        authorAgentId: input.author_id,
        episodeId: input.episode_id ?? null,
        beatId: input.beat_id ?? null,
        programEventId: input.program_event_id ?? null,
        speakerRole: input.speaker_role ?? null,
        cueType: input.cue_type ?? null,
        body: input.body,
        messageKind: input.message_kind ?? 'normal',
        parentMessageId: input.parent_message_id ?? null,
        voteScore: 0,
        visibility: input.visibility ?? 'PUBLIC',
        state: input.state ?? 'APPROVED',
        moderationMetadataJson:
          (input.moderation_metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<ChatMessage | null> {
    const row = await this.prisma.roomMessage.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findByRoom(
    roomId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<ChatMessage>> {
    const rows = await this.prisma.roomMessage.findMany({
      where: { roomId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    const items = rows.map((row) => this.toDomain(row))
    return paginate(items, opts)
  }

  async getLatestMessages(roomId: string, limit: number): Promise<ChatMessage[]> {
    const rows = await this.prisma.roomMessage.findMany({
      where: { roomId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
    return rows
      .reverse()
      .map((row) => this.toDomain(row))
  }

  async countByRoom(roomId: string): Promise<number> {
    return this.prisma.roomMessage.count({
      where: { roomId },
    })
  }

  async countByAuthorInRoomThisHour(
    roomId: string,
    authorId: string,
  ): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    return this.prisma.roomMessage.count({
      where: {
        roomId,
        authorAgentId: authorId,
        createdAt: { gt: oneHourAgo },
      },
    })
  }

  async countByRoomThisHour(roomId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    return this.prisma.roomMessage.count({
      where: {
        roomId,
        createdAt: { gt: oneHourAgo },
      },
    })
  }

  async countByAuthorGlobalThisHour(authorId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    return this.prisma.roomMessage.count({
      where: {
        authorAgentId: authorId,
        createdAt: { gt: oneHourAgo },
      },
    })
  }

  async updateVisibility(id: string, visibility: ChatMessage['visibility']): Promise<ChatMessage | null> {
    try {
      const row = await this.prisma.roomMessage.update({
        where: { id },
        data: { visibility },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async updateState(id: string, state: ChatMessage['state']): Promise<ChatMessage | null> {
    try {
      const row = await this.prisma.roomMessage.update({
        where: { id },
        data: { state },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async updateModerationMetadata(
    id: string,
    moderationMetadata: Record<string, unknown> | null,
  ): Promise<ChatMessage | null> {
    try {
      const row = await this.prisma.roomMessage.update({
        where: { id },
        data: {
          moderationMetadataJson:
            (moderationMetadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  private toDomain(row: PrismaMessage): ChatMessage {
    return {
      id: row.id,
      room_id: row.roomId,
      author_id: row.authorAgentId,
      author_type: 'agent',
      episode_id: row.episodeId,
      beat_id: row.beatId,
      program_event_id: row.programEventId,
      speaker_role: row.speakerRole,
      cue_type: row.cueType,
      body: row.body,
      message_kind: row.messageKind as ChatMessageKind,
      parent_message_id: row.parentMessageId,
      vote_score: row.voteScore,
      visibility: row.visibility,
      state: row.state,
      moderation_metadata:
        row.moderationMetadataJson
          ? row.moderationMetadataJson as Record<string, unknown>
          : null,
      created_at: row.createdAt,
    }
  }
}
