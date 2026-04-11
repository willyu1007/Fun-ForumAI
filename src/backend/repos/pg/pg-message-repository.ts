import { Prisma, type PrismaClient, type RoomMessage as PrismaMessage } from '@prisma/client'
import type {
  ChatMessage,
  ChatMessageKind,
  CreateChatMessageInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { MessageRepository } from '../message-repository.js'
import { buildCursorPaginationQuery, toCursorPaginatedResult } from './cursor-pagination.js'
import {
  buildMessageModerationColumns,
  readMessageModerationColumns,
} from './pg-content-moderation.js'

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
        ...buildMessageModerationColumns(input.moderation_metadata),
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
      ...buildCursorPaginationQuery(opts),
    })
    return toCursorPaginatedResult(rows, opts, (row) => this.toDomain(row))
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
    moderationMetadata: CreateChatMessageInput['moderation_metadata'],
  ): Promise<ChatMessage | null> {
    try {
      const row = await this.prisma.roomMessage.update({
        where: { id },
        data: {
          ...buildMessageModerationColumns(moderationMetadata),
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
      moderation_metadata: readMessageModerationColumns(row),
      created_at: row.createdAt,
    }
  }
}
