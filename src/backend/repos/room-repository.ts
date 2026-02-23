import type {
  Room,
  RoomMember,
  CreateRoomInput,
  PaginatedResult,
  PaginationOpts,
  RoomStatus,
  RoomMemberJoinSource,
} from './types.js'

export interface RoomRepository {
  create(input: CreateRoomInput): Room
  findById(id: string): Room | null
  findBySlug(slug: string): Room | null
  list(opts: PaginationOpts & { status?: RoomStatus }): PaginatedResult<Room>
  updateStatus(id: string, status: RoomStatus): Room | null
  updateLastMessageAt(id: string, at: Date): void

  addMember(roomId: string, memberId: string, joinSource: RoomMemberJoinSource, tickInterval: number): RoomMember
  removeMember(roomId: string, memberId: string): boolean
  getMembers(roomId: string): RoomMember[]
  isMember(roomId: string, memberId: string): boolean
  getMember(roomId: string, memberId: string): RoomMember | null
  countMembers(roomId: string): number

  getAvailableRooms(): Room[]
  getRoomsByAgent(agentId: string): Room[]
  countAgentRooms(agentId: string): number
}

const SYSTEM_MAX_AGENTS = 5
const SYSTEM_TICK_BASE = 20_000

let counter = 0
function cuid(): string {
  return `room_${Date.now()}_${++counter}`
}

export class InMemoryRoomRepository implements RoomRepository {
  private rooms = new Map<string, Room>()
  private members = new Map<string, RoomMember[]>()

  create(input: CreateRoomInput): Room {
    const now = new Date()
    const room: Room = {
      id: cuid(),
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
    this.rooms.set(room.id, room)
    this.members.set(room.id, [])
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
    return room
  }

  updateLastMessageAt(id: string, at: Date): void {
    const room = this.rooms.get(id)
    if (room) {
      room.last_message_at = at
      room.updated_at = at
    }
  }

  addMember(roomId: string, memberId: string, joinSource: RoomMemberJoinSource, tickInterval: number): RoomMember {
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
    return member
  }

  removeMember(roomId: string, memberId: string): boolean {
    const list = this.members.get(roomId)
    if (!list) return false
    const idx = list.findIndex((m) => m.member_id === memberId)
    if (idx < 0) return false
    list.splice(idx, 1)
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
      const memberCount = this.countMembers(r.id)
      return memberCount < r.max_agents
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
}

function paginate<T extends { id: string }>(items: T[], opts: PaginationOpts): PaginatedResult<T> {
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
