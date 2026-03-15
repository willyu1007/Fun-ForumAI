import type {
  PaginatedResult,
  PaginationOpts,
  Room,
  RoomCastMemberView,
  RoomHighlight,
  RoomLiveSnapshot,
  RoomMember,
  RoomProgramReadModel,
  RoomWatchabilitySummary,
} from '../../repos/types.js'
import type { RoomWatchabilityRepository } from '../../repos/room-watchability-repository.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js'
import { normalizeWanderPolicy } from '../chatroom-program-policy.js'
import { hasNoRecommendTag } from '../hot-topic-policy-config.js'
import {
  buildCastView,
  buildWatchabilitySummary,
  enrichSnapshot,
  projectRoom,
} from './projection-broadcast.js'
import { enrichMessage } from './message-pipeline.js'
import {
  getAgentPersisted,
  sanitizeVisibleText,
  toAgentChatConfig,
} from './shared.js'
import type { ChatServiceContext } from './types.js'

async function getProgramsByRoomId(
  context: ChatServiceContext,
  roomIds: string[],
): Promise<Map<string, Awaited<ReturnType<RoomWatchabilityRepository['getProgram']>>>> {
  if (!context.deps.roomWatchabilityRepo || roomIds.length === 0) return new Map()
  const programs = await context.deps.roomWatchabilityRepo.listPrograms(roomIds)
  return new Map(programs.map((program) => [program.room_id, program]))
}

function filterNoRecommendRooms<T extends Room>(
  rooms: T[],
  programsByRoomId: Map<string, Awaited<ReturnType<RoomWatchabilityRepository['getProgram']>>>,
): T[] {
  return rooms.filter(
    (room) => !hasNoRecommendTag(programsByRoomId.get(room.id)?.discoverability_tags),
  )
}

async function listVisibleRoomsPage(
  context: ChatServiceContext,
  opts: PaginationOpts & { status?: Room['status'] },
): Promise<{
  items: Room[]
  next_cursor: string | null
  programsByRoomId: Map<string, Awaited<ReturnType<RoomWatchabilityRepository['getProgram']>>>
}> {
  const collected: Room[] = []
  const programsByRoomId = new Map<
    string,
    Awaited<ReturnType<RoomWatchabilityRepository['getProgram']>>
  >()
  let cursor = opts.cursor
  let hasMoreVisible = false
  let safety = 0

  while (safety < 1000 && !hasMoreVisible) {
    safety += 1
    const rooms = await context.deps.roomRepo.list({
      ...opts,
      cursor,
      limit: opts.limit,
    })
    if (rooms.items.length === 0) break

    const pagePrograms = await getProgramsByRoomId(
      context,
      rooms.items.map((room) => room.id),
    )
    for (const room of rooms.items) {
      const program = pagePrograms.get(room.id)
      if (program) {
        programsByRoomId.set(room.id, program)
      }
      if (hasNoRecommendTag(program?.discoverability_tags)) continue

      collected.push(room)
      if (collected.length > opts.limit) {
        hasMoreVisible = true
        break
      }
    }

    if (!rooms.next_cursor || rooms.next_cursor === cursor) {
      break
    }
    cursor = rooms.next_cursor
  }

  const items = collected.slice(0, opts.limit)
  return {
    items,
    next_cursor: hasMoreVisible && items.length > 0 ? items[items.length - 1]!.id : null,
    programsByRoomId,
  }
}

export async function getRooms(
  context: ChatServiceContext,
  opts: PaginationOpts & { status?: Room['status'] },
): Promise<PaginatedResult<Room>> {
  return context.deps.roomRepo.list(opts)
}

export async function getRoomsWithWatchability(
  context: ChatServiceContext,
  opts: PaginationOpts & { status?: Room['status'] },
): Promise<PaginatedResult<Room & { watchability: RoomWatchabilitySummary | null }>> {
  const rooms = await listVisibleRoomsPage(context, opts)
  const visibleRooms = rooms.items
  const programsByRoom = rooms.programsByRoomId
  const snapshots = context.deps.roomWatchabilityRepo
    ? await context.deps.roomWatchabilityRepo.listLiveSnapshots(
        visibleRooms.map((room) => room.id),
      )
    : []
  const snapshotsByRoom = new Map(snapshots.map((snapshot) => [snapshot.room_id, snapshot]))

  const items = await Promise.all(
    visibleRooms.map(async (room) => {
      const snapshot = await enrichSnapshot(
        context,
        snapshotsByRoom.get(room.id) ?? null,
        room.id,
      )
      return {
        ...room,
        watchability: buildWatchabilitySummary(
          context,
          room,
          snapshot,
          programsByRoom.get(room.id) ?? null,
        ),
      }
    }),
  )

  return {
    items,
    next_cursor: rooms.next_cursor,
  }
}

export async function getRoom(
  context: ChatServiceContext,
  roomId: string,
): Promise<Room & { members: RoomMember[] }> {
  const room = await context.deps.roomRepo.findById(roomId)
  if (!room) throw new NotFoundError('Room', roomId)
  const members = await context.deps.roomRepo.getMembers(roomId)
  return { ...room, members }
}

export async function getRoomLiveSnapshot(
  context: ChatServiceContext,
  roomId: string,
): Promise<RoomLiveSnapshot> {
  const room = await context.deps.roomRepo.findById(roomId)
  if (!room) throw new NotFoundError('Room', roomId)

  let snapshot = (await context.deps.roomWatchabilityRepo?.getLiveSnapshot(roomId)) ?? null
  if (!snapshot) {
    snapshot = (await projectRoom(context, roomId))?.snapshot ?? null
  }

  if (snapshot) {
    return (await enrichSnapshot(context, snapshot, roomId)) ?? snapshot
  }

  const now = new Date()
  return {
    id: `room-live-snapshot:${room.id}`,
    room_id: room.id,
    episode_id: null,
    scene_type: 'FREE_CHAT',
    current_beat: null,
    live_hook: room.description || `这间房正在展开一场新的 live 群聊。`,
    unresolved_question: null,
    recap_short: room.description || '房间刚开场，台上成员正在热身。',
    active_cast: [],
    last_highlight_text: null,
    energy: 0,
    tension: 0,
    message_cursor_id: null,
    continuity_summary: null,
    canonization_note: null,
    cameo_hint: null,
    version: 0,
    created_at: now,
    updated_at: now,
  }
}

export async function getRoomCast(
  context: ChatServiceContext,
  roomId: string,
): Promise<{ room_id: string; episode_id: string | null; cast: RoomCastMemberView[] }> {
  const room = await context.deps.roomRepo.findById(roomId)
  if (!room) throw new NotFoundError('Room', roomId)

  let episode = (await context.deps.roomWatchabilityRepo?.getActiveEpisode(roomId)) ?? null
  let cast = await buildCastView(context, roomId)
  if (!episode && cast.length === 0) {
    const projection = await projectRoom(context, roomId)
    episode = (await context.deps.roomWatchabilityRepo?.getActiveEpisode(roomId)) ?? null
    cast = projection?.cast ?? cast
  }

  return {
    room_id: roomId,
    episode_id: episode?.id ?? null,
    cast,
  }
}

export async function getRoomProgram(
  context: ChatServiceContext,
  roomId: string,
): Promise<RoomProgramReadModel> {
  const room = await context.deps.roomRepo.findById(roomId)
  if (!room) throw new NotFoundError('Room', roomId)

  let program = (await context.deps.roomWatchabilityRepo?.getProgram(roomId)) ?? null
  if (!program && context.deps.roomWatchabilityRepo) {
    program = await context.deps.roomWatchabilityRepo.ensureProgram(room)
  }

  const episode = (await context.deps.roomWatchabilityRepo?.getActiveEpisode(roomId)) ?? null
  const snapshot = (await context.deps.roomWatchabilityRepo?.getLiveSnapshot(roomId)) ?? null

  if (program && context.roomProjector) {
    return context.roomProjector.toProgramReadModel(program, snapshot, episode)
  }

  return {
    room_id: room.id,
    enabled: program?.enabled ?? false,
    scene_type: program?.scene_type ?? 'FREE_CHAT',
    pacing_preset: program?.pacing_preset ?? 'balanced',
    target_cast_min: program?.target_cast_min ?? Math.min(3, room.max_agents),
    target_cast_max: program?.target_cast_max ?? room.max_agents,
    callback_window: program?.callback_window ?? 18,
    recap_every_turns: program?.recap_every_turns ?? 10,
    max_consecutive_turns: program?.max_consecutive_turns ?? 1,
    idle_cue_after_ms: program?.idle_cue_after_ms ?? 30_000,
    allow_wandering: program?.allow_wandering ?? true,
    director_policy: program?.director_policy_json ?? {},
    wander_policy: normalizeWanderPolicy(program?.wander_policy_json),
    discoverability: {
      tags: program?.discoverability_tags ?? [],
      short_hook: program?.discoverability_short_hook ?? (room.description || null),
      default_view: program?.discoverability_default_view ?? 'live',
    },
    current_episode: episode
      ? {
          episode_id: episode.id,
          current_beat: snapshot?.current_beat ?? null,
          energy: episode.energy,
          tension: episode.tension,
          turn_count: episode.turn_count,
          message_count: episode.message_count,
        }
      : null,
  }
}

export async function getRoomHighlights(
  context: ChatServiceContext,
  roomId: string,
  opts: PaginationOpts & { episode_id?: string | null },
): Promise<PaginatedResult<RoomHighlight>> {
  const room = await context.deps.roomRepo.findById(roomId)
  if (!room) throw new NotFoundError('Room', roomId)
  if (!context.deps.roomWatchabilityRepo) {
    return { items: [], next_cursor: null }
  }
  const result = await context.deps.roomWatchabilityRepo.listHighlights(roomId, opts)
  return {
    ...result,
    items: result.items.flatMap((item) => {
      const text = sanitizeVisibleText(item.text)
      return text
        ? [
            {
              ...item,
              text,
            },
          ]
        : []
    }),
  }
}

export async function getMessages(
  context: ChatServiceContext,
  roomId: string,
  opts: PaginationOpts,
): Promise<PaginatedResult<import('../../repos/types.js').ChatMessage>> {
  const room = await context.deps.roomRepo.findById(roomId)
  if (!room) throw new NotFoundError('Room', roomId)
  const result = await context.deps.messageRepo.findByRoom(roomId, opts)
  return {
    ...result,
    items: result.items.flatMap((message) => {
      const enriched = enrichMessage(context, message)
      return enriched ? [enriched] : []
    }),
  }
}

export async function getAvailableRooms(context: ChatServiceContext): Promise<Room[]> {
  const rooms = await context.deps.roomRepo.getAvailableRooms()
  const programsByRoomId = await getProgramsByRoomId(
    context,
    rooms.map((room) => room.id),
  )
  return filterNoRecommendRooms(rooms, programsByRoomId)
}

export async function getRoomsByAgent(
  context: ChatServiceContext,
  agentId: string,
): Promise<Room[]> {
  return context.deps.roomRepo.getRoomsByAgent(agentId)
}

export async function getLeastActiveRoom(
  context: ChatServiceContext,
  agentId: string,
): Promise<Room | null> {
  const rooms = await context.deps.roomRepo.getRoomsByAgent(agentId)
  if (rooms.length === 0) return null

  return rooms.reduce((least, room) => {
    const leastTime = least.last_message_at?.getTime() ?? 0
    const roomTime = room.last_message_at?.getTime() ?? 0
    return roomTime < leastTime ? room : least
  })
}

export function getAgentChatConfig(
  context: ChatServiceContext,
  agentId: string,
): { talkativeness: number; allow_wandering: boolean } {
  return toAgentChatConfig(context.deps.agentService.getLatestConfig(agentId))
}

export async function getAgentChatConfigPersisted(
  context: ChatServiceContext,
  agentId: string,
): Promise<{ talkativeness: number; allow_wandering: boolean }> {
  await getAgentPersisted(context, agentId)
  return toAgentChatConfig(await context.deps.agentService.getLatestConfigPersisted(agentId))
}

export async function updateAgentChatConfig(
  context: ChatServiceContext,
  agentId: string,
  ownerId: string,
  update: { talkativeness?: number; allow_wandering?: boolean },
): Promise<{ talkativeness: number; allow_wandering: boolean }> {
  const agent = await getAgentPersisted(context, agentId)
  if (agent.owner_id !== ownerId) throw new ForbiddenError('You do not own this agent')

  if (
    update.talkativeness !== undefined &&
    (update.talkativeness < 1 || update.talkativeness > 5)
  ) {
    throw new ValidationError('talkativeness must be between 1 and 5')
  }

  const existing = await context.deps.agentService.getLatestConfigPersisted(agentId)
  const existingJson = existing?.config_json ?? {}
  const existingChat = (existingJson.chat as Record<string, unknown>) ?? {}

  const newChat = {
    ...existingChat,
    ...(update.talkativeness !== undefined
      ? { talkativeness: update.talkativeness }
      : {}),
    ...(update.allow_wandering !== undefined
      ? { allow_wandering: update.allow_wandering }
      : {}),
  }

  await context.deps.agentService.updateConfig(agentId, { chat: newChat }, ownerId)

  return getAgentChatConfigPersisted(context, agentId)
}
