import { randomUUID } from 'node:crypto'
import type {
  PrismaClient,
  Room as PrismaRoom,
  RoomMembership as PrismaMembership,
} from '@prisma/client'
import type {
  Room,
  RoomMember,
  CreateRoomInput,
  PaginatedResult,
  PaginationOpts,
  RoomStatus,
  RoomMemberJoinSource,
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
    const idx = items.findIndex((i) => i.id === opts.cursor)
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
  private rooms = new Map<string, Room>()
  private members = new Map<string, RoomMember[]>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const [roomRows, memberRows] = await Promise.all([
      this.prisma.room.findMany(),
      this.prisma.roomMembership.findMany({ where: { leftAt: null } }),
    ])
    for (const row of roomRows) {
      this.rooms.set(row.id, this.roomToDomain(row))
      if (!this.members.has(row.id)) this.members.set(row.id, [])
    }
    for (const row of memberRows) {
      const list = this.members.get(row.roomId) ?? []
      list.push(this.memberToDomain(row))
      this.members.set(row.roomId, list)
    }
  }

  create(input: CreateRoomInput): Room {
    const id = randomUUID()
    const now = new Date()
    const room: Room = {
      id,
      name: input.name,
      slug: input.slug,
      description: input.description,
      community_id: input.community_id ?? null,
      created_by_agent_id: input.created_by_agent_id,
      max_agents: SYSTEM_MAX_AGENTS,
      tick_interval_base: SYSTEM_TICK_BASE,
      status: 'active',
      last_message_at: null,
      created_at: now,
      updated_at: now,
    }
    this.rooms.set(id, room)
    this.members.set(id, [])
    this.prisma.room
      .create({
        data: {
          id,
          name: room.name,
          slug: room.slug,
          description: room.description,
          communityId: room.community_id,
          createdByAgentId: room.created_by_agent_id,
          maxAgents: room.max_agents,
          tickIntervalBase: room.tick_interval_base,
          status: room.status,
          createdAt: now,
          updatedAt: now,
        },
      })
      .catch((err) => console.error('[PgRoomRepo] create error:', err))
    return room
  }

  findById(id: string): Room | null {
    return this.rooms.get(id) ?? null
  }

  findBySlug(slug: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.slug === slug) return room
    }
    return null
  }

  list(opts: PaginationOpts & { status?: RoomStatus }): PaginatedResult<Room> {
    let items = Array.from(this.rooms.values())
    if (opts.status) {
      items = items.filter((r) => r.status === opts.status)
    }
    items.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  updateStatus(id: string, status: RoomStatus): Room | null {
    const room = this.rooms.get(id)
    if (!room) return null
    room.status = status
    room.updated_at = new Date()
    this.prisma.room
      .update({ where: { id }, data: { status, updatedAt: room.updated_at } })
      .catch((err) => console.error('[PgRoomRepo] updateStatus error:', err))
    return room
  }

  updateLastMessageAt(id: string, at: Date): void {
    const room = this.rooms.get(id)
    if (!room) return
    room.last_message_at = at
    room.updated_at = at
    this.prisma.room
      .update({ where: { id }, data: { lastMessageAt: at, updatedAt: at } })
      .catch((err) => console.error('[PgRoomRepo] updateLastMessageAt error:', err))
  }

  addMember(
    roomId: string,
    memberId: string,
    joinSource: RoomMemberJoinSource,
    tickInterval: number,
  ): RoomMember {
    const list = this.members.get(roomId) ?? []
    const member: RoomMember = {
      room_id: roomId,
      member_id: memberId,
      member_type: 'agent',
      join_source: joinSource,
      personal_tick_interval: tickInterval,
      messages_this_hour: 0,
      last_spoke_at: null,
      joined_at: new Date(),
    }
    list.push(member)
    this.members.set(roomId, list)
    this.prisma.roomMembership
      .create({
        data: {
          roomId,
          agentId: memberId,
          joinSource,
          personalTickInterval: tickInterval,
          joinedAt: member.joined_at,
        },
      })
      .catch((err) => console.error('[PgRoomRepo] addMember error:', err))
    return member
  }

  removeMember(roomId: string, memberId: string): boolean {
    const list = this.members.get(roomId)
    if (!list) return false
    const idx = list.findIndex((m) => m.member_id === memberId)
    if (idx < 0) return false
    list.splice(idx, 1)
    const now = new Date()
    this.prisma.roomMembership
      .updateMany({
        where: { roomId, agentId: memberId, leftAt: null },
        data: { leftAt: now },
      })
      .catch((err) => console.error('[PgRoomRepo] removeMember error:', err))
    return true
  }

  getMembers(roomId: string): RoomMember[] {
    return this.members.get(roomId) ?? []
  }

  isMember(roomId: string, memberId: string): boolean {
    return this.getMembers(roomId).some((m) => m.member_id === memberId)
  }

  getMember(roomId: string, memberId: string): RoomMember | null {
    return this.getMembers(roomId).find((m) => m.member_id === memberId) ?? null
  }

  countMembers(roomId: string): number {
    return this.getMembers(roomId).length
  }

  getAvailableRooms(): Room[] {
    return Array.from(this.rooms.values()).filter((r) => {
      if (r.status !== 'active') return false
      return this.countMembers(r.id) < r.max_agents
    })
  }

  getRoomsByAgent(agentId: string): Room[] {
    const result: Room[] = []
    for (const [roomId, list] of this.members) {
      if (list.some((m) => m.member_id === agentId)) {
        const room = this.rooms.get(roomId)
        if (room) result.push(room)
      }
    }
    return result
  }

  countAgentRooms(agentId: string): number {
    let count = 0
    for (const list of this.members.values()) {
      if (list.some((m) => m.member_id === agentId)) count++
    }
    return count
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
