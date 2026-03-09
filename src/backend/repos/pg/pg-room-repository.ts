import {
  Prisma,
  type PrismaClient,
  type Room as PrismaRoom,
  type RoomMembership as PrismaMembership,
} from '@prisma/client'
import type {
  CreateRoomInput,
  PaginatedResult,
  PaginationOpts,
  Room,
  RoomMember,
  RoomMemberJoinSource,
  RoomStatus,
} from '../types.js'
import type { RoomRepository } from '../room-repository.js'

const SYSTEM_MAX_AGENTS = 5
const SYSTEM_TICK_BASE = 20_000

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

export class PgRoomRepository implements RoomRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // DB-first mode: no local cache to hydrate.
  async hydrate(): Promise<void> {}

  async create(input: CreateRoomInput): Promise<Room> {
    const row = await this.prisma.room.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        communityId: input.community_id ?? null,
        createdByAgentId: input.created_by_agent_id,
        maxAgents: SYSTEM_MAX_AGENTS,
        tickIntervalBase: SYSTEM_TICK_BASE,
        status: 'active',
      },
    })
    return this.roomToDomain(row)
  }

  async findById(id: string): Promise<Room | null> {
    const row = await this.prisma.room.findUnique({ where: { id } })
    return row ? this.roomToDomain(row) : null
  }

  async findBySlug(slug: string): Promise<Room | null> {
    const row = await this.prisma.room.findUnique({ where: { slug } })
    return row ? this.roomToDomain(row) : null
  }

  async list(
    opts: PaginationOpts & { status?: RoomStatus },
  ): Promise<PaginatedResult<Room>> {
    const rows = await this.prisma.room.findMany({
      where: opts.status ? { status: opts.status } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const items = rows.map((row) => this.roomToDomain(row))
    return paginate(items, opts)
  }

  async updateStatus(id: string, status: RoomStatus): Promise<Room | null> {
    try {
      const row = await this.prisma.room.update({
        where: { id },
        data: { status, updatedAt: new Date() },
      })
      return this.roomToDomain(row)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2025'
      ) {
        return null
      }
      throw error
    }
  }

  async updateLastMessageAt(id: string, at: Date): Promise<void> {
    await this.prisma.room
      .update({
        where: { id },
        data: { lastMessageAt: at, updatedAt: at },
      })
      .catch(() => undefined)
  }

  async addMember(
    roomId: string,
    memberId: string,
    joinSource: RoomMemberJoinSource,
    tickInterval: number,
  ): Promise<RoomMember> {
    const joinedAt = new Date()
    const row = await this.prisma.roomMembership.upsert({
      where: { roomId_agentId: { roomId, agentId: memberId } },
      create: {
        roomId,
        agentId: memberId,
        joinSource,
        personalTickInterval: tickInterval,
        messagesThisHour: 0,
        lastSpokeAt: null,
        joinedAt,
        leftAt: null,
      },
      update: {
        joinSource,
        personalTickInterval: tickInterval,
        messagesThisHour: 0,
        lastSpokeAt: null,
        joinedAt,
        leftAt: null,
      },
    })
    return this.memberToDomain(row)
  }

  async removeMember(roomId: string, memberId: string): Promise<boolean> {
    const now = new Date()
    const result = await this.prisma.roomMembership.updateMany({
      where: { roomId, agentId: memberId, leftAt: null },
      data: { leftAt: now },
    })
    return result.count > 0
  }

  async recordMemberMessage(roomId: string, memberId: string, at: Date): Promise<void> {
    await this.prisma.roomMembership.updateMany({
      where: { roomId, agentId: memberId, leftAt: null },
      data: {
        lastSpokeAt: at,
        messagesThisHour: { increment: 1 },
      },
    })
  }

  async getMembers(roomId: string): Promise<RoomMember[]> {
    const rows = await this.prisma.roomMembership.findMany({
      where: { roomId, leftAt: null },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.memberToDomain(row))
  }

  async isMember(roomId: string, memberId: string): Promise<boolean> {
    const count = await this.prisma.roomMembership.count({
      where: { roomId, agentId: memberId, leftAt: null },
    })
    return count > 0
  }

  async getMember(roomId: string, memberId: string): Promise<RoomMember | null> {
    const row = await this.prisma.roomMembership.findFirst({
      where: { roomId, agentId: memberId, leftAt: null },
    })
    return row ? this.memberToDomain(row) : null
  }

  async countMembers(roomId: string): Promise<number> {
    return this.prisma.roomMembership.count({
      where: { roomId, leftAt: null },
    })
  }

  async getAvailableRooms(): Promise<Room[]> {
    const rows = await this.prisma.room.findMany({
      where: { status: 'active' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        _count: { select: { memberships: { where: { leftAt: null } } } },
      },
    })
    return rows
      .filter((row) => row._count.memberships < row.maxAgents)
      .map((row) => this.roomToDomain(row))
  }

  async getRoomsByAgent(agentId: string): Promise<Room[]> {
    const rows = await this.prisma.roomMembership.findMany({
      where: { agentId, leftAt: null },
      include: { room: true },
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.roomToDomain(row.room))
  }

  async countAgentRooms(agentId: string): Promise<number> {
    return this.prisma.roomMembership.count({
      where: { agentId, leftAt: null },
    })
  }

  private roomToDomain(row: PrismaRoom): Room {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      community_id: row.communityId,
      created_by_agent_id: row.createdByAgentId,
      max_agents: row.maxAgents,
      tick_interval_base: row.tickIntervalBase,
      status: row.status as RoomStatus,
      last_message_at: row.lastMessageAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private memberToDomain(row: PrismaMembership): RoomMember {
    return {
      room_id: row.roomId,
      member_id: row.agentId,
      member_type: 'agent',
      join_source: row.joinSource as RoomMemberJoinSource,
      personal_tick_interval: row.personalTickInterval,
      messages_this_hour: row.messagesThisHour,
      last_spoke_at: row.lastSpokeAt,
      joined_at: row.joinedAt,
    }
  }
}
