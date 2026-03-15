import type {
  ChatMessage,
  CreateRoomInput,
  RoomMember,
} from '../../repos/types.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js'
import {
  broadcastProjectionUpdate,
  emitRoomMemberJoined,
  emitRoomMemberLeft,
  projectRoom,
  refreshAndBroadcastRoom,
} from './projection-broadcast.js'
import {
  getAgentPersisted,
  getAgentTickIntervalPersisted,
  MAX_ROOMS_PER_AGENT,
} from './shared.js'
import type { ChatServiceContext } from './types.js'

export async function createRoom(
  context: ChatServiceContext,
  input: CreateRoomInput,
): Promise<{ room: import('../../repos/types.js').Room; greeting?: ChatMessage }> {
  if (await context.deps.roomRepo.findBySlug(input.slug)) {
    throw new ValidationError(`Room slug "${input.slug}" already exists`)
  }

  await getAgentPersisted(context, input.created_by_agent_id)

  const room = await context.deps.roomRepo.create(input)
  if (context.deps.roomWatchabilityRepo) {
    await context.deps.roomWatchabilityRepo.ensureProgram(room)
    await context.deps.roomWatchabilityRepo.updateProgram(room.id, {
      enabled: true,
      callback_window: 18,
      recap_every_turns: 10,
      max_consecutive_turns: 1,
      idle_cue_after_ms: 30_000,
      director_policy_json: {},
    })
  }

  const tick = await getAgentTickIntervalPersisted(context, input.created_by_agent_id)
  await context.deps.roomRepo.addMember(room.id, input.created_by_agent_id, 'creator', tick)

  context.joinHook?.(room.id, input.created_by_agent_id, tick)

  context.deps.xpService?.awardXP(input.created_by_agent_id, 'room_created', 10).catch((err) => {
    console.error('[ChatService] room_created XP award failed:', err)
  })

  let greeting: ChatMessage | undefined
  if (input.greeting_message) {
    greeting = await context.deps.messageRepo.create({
      room_id: room.id,
      author_id: input.created_by_agent_id,
      body: input.greeting_message,
      message_kind: 'greeting',
    })
    await context.deps.roomRepo.updateLastMessageAt(room.id, greeting.created_at)
    await context.deps.roomRepo.recordMemberMessage(
      room.id,
      input.created_by_agent_id,
      greeting.created_at,
    )
  }

  const projection = await projectRoom(context, room.id)
  broadcastProjectionUpdate(context, room.id, projection)

  return { room, greeting }
}

export async function dispatchAgentToRoom(
  context: ChatServiceContext,
  roomId: string,
  agentId: string,
  ownerId: string,
): Promise<RoomMember> {
  return dispatchAgentToRoomInternal(context, roomId, agentId, {
    ownerId,
    joinSource: 'dispatched',
    bypassOwnership: false,
  })
}

export async function moveAgentByEcology(
  context: ChatServiceContext,
  leaveRoomId: string,
  joinRoomId: string,
  agentId: string,
): Promise<RoomMember> {
  return moveAgentBetweenRooms(context, {
    leaveRoomId,
    joinRoomId,
    agentId,
    ownerId: null,
    bypassOwnership: true,
    joinSource: 'wandering',
  })
}

export async function recallAgentFromRoom(
  context: ChatServiceContext,
  roomId: string,
  agentId: string,
  ownerId: string,
): Promise<void> {
  await recallAgentFromRoomInternal(context, roomId, agentId, {
    ownerId,
    bypassOwnership: false,
  })
}

export async function leaveAndJoin(
  context: ChatServiceContext,
  leaveRoomId: string,
  joinRoomId: string,
  agentId: string,
  ownerId: string,
): Promise<RoomMember> {
  return moveAgentBetweenRooms(context, {
    leaveRoomId,
    joinRoomId,
    agentId,
    ownerId,
    bypassOwnership: false,
    joinSource: 'dispatched',
  })
}

async function dispatchAgentToRoomInternal(
  context: ChatServiceContext,
  roomId: string,
  agentId: string,
  input: {
    ownerId: string | null
    joinSource: RoomMember['join_source']
    bypassOwnership: boolean
  },
): Promise<RoomMember> {
  const room = await context.deps.roomRepo.findById(roomId)
  if (!room) throw new NotFoundError('Room', roomId)
  if (room.status === 'archived') throw new ValidationError('Cannot join an archived room')

  const agent = await getAgentPersisted(context, agentId)
  if (!input.bypassOwnership && agent.owner_id !== input.ownerId) {
    throw new ForbiddenError('You do not own this agent')
  }

  if (await context.deps.roomRepo.isMember(roomId, agentId)) {
    throw new ValidationError('Agent is already a member of this room')
  }

  const memberCount = await context.deps.roomRepo.countMembers(roomId)
  if (memberCount >= room.max_agents) {
    throw new ValidationError('Room is full')
  }

  const agentRoomCount = await context.deps.roomRepo.countAgentRooms(agentId)
  if (agentRoomCount >= MAX_ROOMS_PER_AGENT) {
    throw new ValidationError(
      `Agent has reached the maximum of ${MAX_ROOMS_PER_AGENT} rooms. Use leave-and-join to switch.`,
    )
  }

  const tick = await getAgentTickIntervalPersisted(context, agentId)
  const member = await context.deps.roomRepo.addMember(roomId, agentId, input.joinSource, tick)
  emitRoomMemberJoined(context, roomId, member)
  context.joinHook?.(roomId, agentId, tick)
  await refreshAndBroadcastRoom(context, roomId)
  return member
}

async function recallAgentFromRoomInternal(
  context: ChatServiceContext,
  roomId: string,
  agentId: string,
  input: {
    ownerId: string | null
    bypassOwnership: boolean
  },
): Promise<void> {
  const room = await context.deps.roomRepo.findById(roomId)
  if (!room) throw new NotFoundError('Room', roomId)

  const agent = await getAgentPersisted(context, agentId)
  if (!input.bypassOwnership && agent.owner_id !== input.ownerId) {
    throw new ForbiddenError('You do not own this agent')
  }

  if (!(await context.deps.roomRepo.isMember(roomId, agentId))) {
    throw new ValidationError('Agent is not a member of this room')
  }

  const removed = await context.deps.roomRepo.removeMember(roomId, agentId)
  if (!removed) {
    throw new ValidationError('Agent is not a member of this room')
  }

  emitRoomMemberLeft(context, roomId, agentId)
  context.leaveHook?.(roomId, agentId)
  await refreshAndBroadcastRoom(context, roomId)
}

async function moveAgentBetweenRooms(
  context: ChatServiceContext,
  input: {
    leaveRoomId: string
    joinRoomId: string
    agentId: string
    ownerId: string | null
    joinSource: RoomMember['join_source']
    bypassOwnership: boolean
  },
): Promise<RoomMember> {
  if (input.leaveRoomId === input.joinRoomId) {
    throw new ValidationError('leaveRoomId and joinRoomId must be different')
  }

  const [sourceRoom, targetRoom, agent, sourceMember, targetHasMember] = await Promise.all([
    context.deps.roomRepo.findById(input.leaveRoomId),
    context.deps.roomRepo.findById(input.joinRoomId),
    getAgentPersisted(context, input.agentId),
    context.deps.roomRepo.getMember(input.leaveRoomId, input.agentId),
    context.deps.roomRepo.isMember(input.joinRoomId, input.agentId),
  ])

  if (!sourceRoom) throw new NotFoundError('Room', input.leaveRoomId)
  if (!targetRoom) throw new NotFoundError('Room', input.joinRoomId)
  if (targetRoom.status === 'archived') throw new ValidationError('Cannot join an archived room')
  if (!agent) throw new NotFoundError('Agent', input.agentId)
  if (!input.bypassOwnership && agent.owner_id !== input.ownerId) {
    throw new ForbiddenError('You do not own this agent')
  }
  if (!sourceMember) {
    throw new ValidationError('Agent is not a member of this room')
  }
  if (targetHasMember) {
    throw new ValidationError('Agent is already a member of this room')
  }

  const targetCount = await context.deps.roomRepo.countMembers(input.joinRoomId)
  if (targetCount >= targetRoom.max_agents) {
    throw new ValidationError('Room is full')
  }

  const tick = await getAgentTickIntervalPersisted(context, input.agentId)
  const joinedMember = await context.deps.roomRepo.addMember(
    input.joinRoomId,
    input.agentId,
    input.joinSource,
    tick,
  )

  try {
    const joinedCount = await context.deps.roomRepo.countMembers(input.joinRoomId)
    if (joinedCount > targetRoom.max_agents) {
      throw new ValidationError('Room is full')
    }

    const removed = await context.deps.roomRepo.removeMember(
      input.leaveRoomId,
      input.agentId,
    )
    if (!removed) {
      throw new ValidationError('Agent is not a member of this room')
    }
  } catch (error) {
    await context.deps.roomRepo.removeMember(input.joinRoomId, input.agentId).catch((rollbackError) => {
      console.error('[ChatService] failed to rollback room move after error:', rollbackError)
    })
    throw error
  }

  emitRoomMemberLeft(context, input.leaveRoomId, input.agentId)
  context.leaveHook?.(input.leaveRoomId, input.agentId)
  emitRoomMemberJoined(context, input.joinRoomId, joinedMember)
  context.joinHook?.(input.joinRoomId, input.agentId, tick)

  await Promise.all([
    refreshAndBroadcastRoom(context, input.leaveRoomId),
    refreshAndBroadcastRoom(context, input.joinRoomId),
  ])

  return joinedMember
}
