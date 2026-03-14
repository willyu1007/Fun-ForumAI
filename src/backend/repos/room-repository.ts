import type {
  Room,
  RoomMember,
  CreateRoomInput,
  PaginatedResult,
  PaginationOpts,
  RoomCastRole,
  RoomStatus,
  RoomMemberJoinSource,
} from './types.js'

export interface UpdateRoomMemberControlInput {
  role_hint?: RoomCastRole | null
  wander_eligible?: boolean
  spotlight_weight?: number
  suppressed_until?: Date | null
}

export interface RoomRepository {
  create(input: CreateRoomInput): Promise<Room>
  findById(id: string): Promise<Room | null>
  findBySlug(slug: string): Promise<Room | null>
  list(opts: PaginationOpts & { status?: RoomStatus }): Promise<PaginatedResult<Room>>
  updateStatus(id: string, status: RoomStatus): Promise<Room | null>
  updateLastMessageAt(id: string, at: Date): Promise<void>

  addMember(roomId: string, memberId: string, joinSource: RoomMemberJoinSource, tickInterval: number): Promise<RoomMember>
  removeMember(roomId: string, memberId: string): Promise<boolean>
  recordMemberMessage(roomId: string, memberId: string, at: Date): Promise<void>
  getMembers(roomId: string): Promise<RoomMember[]>
  isMember(roomId: string, memberId: string): Promise<boolean>
  getMember(roomId: string, memberId: string): Promise<RoomMember | null>
  updateMemberControl(
    roomId: string,
    memberId: string,
    patch: UpdateRoomMemberControlInput,
  ): Promise<RoomMember | null>
  countMembers(roomId: string): Promise<number>

  getAvailableRooms(): Promise<Room[]>
  getRoomsByAgent(agentId: string): Promise<Room[]>
  countAgentRooms(agentId: string): Promise<number>
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

  async create(input: CreateRoomInput): Promise<Room> {
    const now = new Date()
    const room: Room = {
      id: input.id ?? cuid(),
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

  async findById(id: string): Promise<Room | null> {
    return this.rooms.get(id) ?? null
  }

  async findBySlug(slug: string): Promise<Room | null> {
    for (const room of this.rooms.values()) {
      if (room.slug === slug) return room
    }
    return null
  }

  async list(opts: PaginationOpts & { status?: RoomStatus }): Promise<PaginatedResult<Room>> {
    let items = Array.from(this.rooms.values())
    if (opts.status) {
      items = items.filter((r) => r.status === opts.status)
    }
    items.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  async updateStatus(id: string, status: RoomStatus): Promise<Room | null> {
    const room = this.rooms.get(id)
    if (!room) return null
    room.status = status
    room.updated_at = new Date()
    return room
  }

  async updateLastMessageAt(id: string, at: Date): Promise<void> {
    const room = this.rooms.get(id)
    if (room) {
      room.last_message_at = at
      room.updated_at = at
    }
  }

  async addMember(
    roomId: string,
    memberId: string,
    joinSource: RoomMemberJoinSource,
    tickInterval: number,
  ): Promise<RoomMember> {
    const list = this.members.get(roomId) ?? []
    const member: RoomMember = {
      room_id: roomId,
      member_id: memberId,
      member_type: 'agent',
      display_name: null,
      join_source: joinSource,
      personal_tick_interval: tickInterval,
      messages_this_hour: 0,
      last_spoke_at: null,
      role_hint: null,
      wander_eligible: true,
      spotlight_weight: 1,
      suppressed_until: null,
      joined_at: new Date(),
    }
    list.push(member)
    this.members.set(roomId, list)
    return member
  }

  async removeMember(roomId: string, memberId: string): Promise<boolean> {
    const list = this.members.get(roomId)
    if (!list) return false
    const idx = list.findIndex((m) => m.member_id === memberId)
    if (idx < 0) return false
    list.splice(idx, 1)
    return true
  }

  async recordMemberMessage(roomId: string, memberId: string, at: Date): Promise<void> {
    const list = this.members.get(roomId)
    if (!list) return
    const member = list.find((item) => item.member_id === memberId)
    if (!member) return
    member.last_spoke_at = at
    member.messages_this_hour += 1
  }

  async getMembers(roomId: string): Promise<RoomMember[]> {
    return this.members.get(roomId) ?? []
  }

  async isMember(roomId: string, memberId: string): Promise<boolean> {
    const members = await this.getMembers(roomId)
    return members.some((m) => m.member_id === memberId)
  }

  async getMember(roomId: string, memberId: string): Promise<RoomMember | null> {
    const members = await this.getMembers(roomId)
    return members.find((m) => m.member_id === memberId) ?? null
  }

  async updateMemberControl(
    roomId: string,
    memberId: string,
    patch: UpdateRoomMemberControlInput,
  ): Promise<RoomMember | null> {
    const members = await this.getMembers(roomId)
    const member = members.find((item) => item.member_id === memberId)
    if (!member) return null
    if (patch.role_hint !== undefined) member.role_hint = patch.role_hint
    if (patch.wander_eligible !== undefined) member.wander_eligible = patch.wander_eligible
    if (patch.spotlight_weight !== undefined) member.spotlight_weight = patch.spotlight_weight
    if (patch.suppressed_until !== undefined) member.suppressed_until = patch.suppressed_until
    return member
  }

  async countMembers(roomId: string): Promise<number> {
    const members = await this.getMembers(roomId)
    return members.length
  }

  async getAvailableRooms(): Promise<Room[]> {
    const rooms = Array.from(this.rooms.values())
    const result: Room[] = []
    for (const room of rooms) {
      if (room.status !== 'active') continue
      const memberCount = await this.countMembers(room.id)
      if (memberCount < room.max_agents) {
        result.push(room)
      }
    }
    return result
  }

  async getRoomsByAgent(agentId: string): Promise<Room[]> {
    const result: Room[] = []
    for (const [roomId, list] of this.members) {
      if (!list.some((m) => m.member_id === agentId)) continue
      const room = this.rooms.get(roomId)
      if (room) result.push(room)
    }
    return result
  }

  async countAgentRooms(agentId: string): Promise<number> {
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
