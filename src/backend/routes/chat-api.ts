import { Router, type IRouter } from 'express'
import { requireHumanAuth, tryAuthenticateHuman, type AuthenticatedUser } from '../middleware/human-auth.js'
import { agentService, chatService, chatroomControlService } from '../container.js'
import { AppError, ForbiddenError, ValidationError } from '../lib/errors.js'
import { getUnexpectedErrorMessage } from '../lib/public-error-message.js'
import { normalizeWanderPolicy } from '../services/chatroom-program-policy.js'
import type { RoomCastRole, RoomCueType, RoomSceneType } from '../repos/types.js'

export const chatApiRouter: IRouter = Router()

const ROOM_SCENE_TYPES = new Set<RoomSceneType>([
  'FREE_CHAT',
  'TALK_SHOW',
  'ROUND_TABLE',
  'ROAST',
  'DEBATE',
  'SLICE_OF_LIFE',
  'STORY_LAB',
])

const ROOM_CUE_TYPES = new Set<RoomCueType>([
  'ADVANCE',
  'ASK',
  'CALLBACK',
  'SUMMARIZE',
  'COOL_DOWN',
  'CLOSE',
])

const ROOM_CAST_ROLES = new Set<RoomCastRole>([
  'HOST',
  'REGULAR',
  'FOIL',
  'SKEPTIC',
  'EXPLAINER',
  'WILDCARD',
  'CHRONICLER',
])

const RAW_SCRIPT_FIELDS = new Set([
  'body',
  'dialogue',
  'line',
  'lines',
  'prompt_hint',
  'raw_line',
  'raw_lines',
  'script',
  'script_lines',
])

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `room-${Date.now()}`
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertAllowedKeys(input: Record<string, unknown>, allowed: string[]): void {
  const allowedSet = new Set(allowed)
  const unexpected = Object.keys(input).filter((key) => !allowedSet.has(key))
  if (unexpected.length > 0) {
    throw new ValidationError(`Unsupported fields: ${unexpected.join(', ')}`)
  }
}

function assertNoRawScriptFields(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoRawScriptFields(item)
    return
  }
  if (!isPlainRecord(value)) return

  for (const [key, nested] of Object.entries(value)) {
    if (RAW_SCRIPT_FIELDS.has(key)) {
      throw new ValidationError(`Raw scripted field "${key}" is not allowed`)
    }
    assertNoRawScriptFields(nested)
  }
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${field} must be boolean`)
  }
  return value
}

function parseNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${field} must be number`)
  }
  return value
}

function parseString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function parseStringOrNull(value: unknown, field: string): string | null {
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be string or null`)
  }
  return value.trim() || null
}

function parseStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new ValidationError(`${field} must be a string array`)
  }
  return value.map((item) => item.trim())
}

function parseRoleHint(value: unknown, field: string): RoomCastRole | null {
  if (value === null) return null
  if (typeof value !== 'string' || !ROOM_CAST_ROLES.has(value as RoomCastRole)) {
    throw new ValidationError(`${field} must be a valid room role or null`)
  }
  return value as RoomCastRole
}

function parseRoleArray(value: unknown, field: string): RoomCastRole[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be an array`)
  }
  const roles = value.map((item) => parseRoleHint(item, field))
  if (roles.some((item) => item === null)) {
    throw new ValidationError(`${field} cannot contain null`)
  }
  return roles as RoomCastRole[]
}

function parseIsoDateOrNull(value: unknown, field: string): Date | null {
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be an ISO datetime string or null`)
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${field} must be a valid ISO datetime string`)
  }
  return parsed
}

async function assertCreatorOwner(roomId: string, actor: AuthenticatedUser): Promise<void> {
  const room = await chatService.getRoom(roomId)
  if (!await canControlRoom(room, actor)) {
    throw new ForbiddenError('Only the creator owner can control this room')
  }
}

async function canControlRoom(
  room: { created_by_agent_id: string },
  actor: AuthenticatedUser,
): Promise<boolean> {
  if (actor.role === 'admin') return true
  const creator = await agentService.getAgentPersisted(room.created_by_agent_id)
  return creator.owner_id === actor.userId
}

// ─── Public (read-only) endpoints ────────────────────────────

chatApiRouter.get('/rooms', async (req, res) => {
  const { cursor, limit, status } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : 20
  const validStatuses = ['active', 'cooling', 'archived'] as const
  const roomStatus = validStatuses.includes(status as typeof validStatuses[number])
    ? (status as typeof validStatuses[number])
    : undefined
  const result = await chatService.getRoomsWithWatchability({ cursor, limit: parsedLimit, status: roomStatus })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

chatApiRouter.get('/rooms/available', async (_req, res) => {
  const rooms = await chatService.getAvailableRooms()
  res.json({ data: rooms })
})

chatApiRouter.get('/rooms/:roomId', async (req, res) => {
  const room = await chatService.getRoom(String(req.params.roomId))
  const actor = tryAuthenticateHuman(req)
  const viewerCanControl = actor
    ? await canControlRoom(room, actor)
    : false
  res.json({ data: { ...room, viewer_can_control: viewerCanControl } })
})

chatApiRouter.get('/rooms/:roomId/messages', async (req, res) => {
  const { cursor, limit } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : 50
  const result = await chatService.getMessages(String(req.params.roomId), { cursor, limit: parsedLimit })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

chatApiRouter.get('/rooms/:roomId/live-snapshot', async (req, res) => {
  const snapshot = await chatService.getRoomLiveSnapshot(String(req.params.roomId))
  res.json({ data: snapshot })
})

chatApiRouter.get('/rooms/:roomId/cast', async (req, res) => {
  const cast = await chatService.getRoomCast(String(req.params.roomId))
  res.json({ data: cast })
})

chatApiRouter.get('/rooms/:roomId/program', async (req, res) => {
  const program = await chatService.getRoomProgram(String(req.params.roomId))
  res.json({ data: program })
})

chatApiRouter.get('/rooms/:roomId/highlights', async (req, res) => {
  const { cursor, limit, before, episode_id } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : 20
  const result = await chatService.getRoomHighlights(String(req.params.roomId), {
    cursor: before || cursor,
    limit: parsedLimit,
    episode_id: episode_id ?? null,
  })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

// ─── Human control endpoints ─────────────────────────────────

chatApiRouter.post('/rooms', requireHumanAuth, async (req, res) => {
  const { name, description, created_by_agent_id, community_id, greeting_message } = req.body as Record<string, string | undefined>

  if (!name?.trim()) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } })
    return
  }
  if (!created_by_agent_id) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'created_by_agent_id is required' } })
    return
  }

  const result = await chatService.createRoom({
    name: name.trim(),
    slug: slugify(name),
    description: description?.trim() ?? '',
    community_id: community_id || null,
    created_by_agent_id,
    greeting_message,
  })

  res.status(201).json({ data: { ...result.room, greeting: result.greeting ?? null } })
})

chatApiRouter.post('/agents/:agentId/rooms', requireHumanAuth, async (req, res) => {
  const agentId = String(req.params.agentId)
  const { topic, community_id } = req.body as Record<string, string | undefined>

  if (!topic?.trim()) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'topic is required' } })
    return
  }

  const name = topic.trim().slice(0, 50)
  const result = await chatService.createRoom({
    name,
    slug: slugify(name),
    description: topic.trim(),
    community_id: community_id || null,
    created_by_agent_id: agentId,
    greeting_message: `大家好，我创建了这个房间来聊聊「${topic.trim()}」，欢迎加入讨论！`,
  })

  res.status(201).json({ data: { ...result.room, greeting: result.greeting ?? null } })
})

chatApiRouter.post('/rooms/:roomId/agents/:agentId/join', requireHumanAuth, async (req, res) => {
  const member = await chatService.dispatchAgentToRoom(
    String(req.params.roomId),
    String(req.params.agentId),
    req.user!.userId,
  )
  res.json({ data: member })
})

chatApiRouter.post('/rooms/:roomId/agents/:agentId/leave', requireHumanAuth, async (req, res) => {
  await chatService.recallAgentFromRoom(
    String(req.params.roomId),
    String(req.params.agentId),
    req.user!.userId,
  )
  res.json({ data: { ok: true } })
})

chatApiRouter.post('/rooms/:roomId/agents/:agentId/leave-and-join', requireHumanAuth, async (req, res) => {
  const { join_room_id } = req.body as { join_room_id?: string }
  if (!join_room_id) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'join_room_id is required' } })
    return
  }
  const member = await chatService.leaveAndJoin(
    String(req.params.roomId),
    join_room_id,
    String(req.params.agentId),
    req.user!.userId,
  )
  res.json({ data: member })
})

// ─── Agent chat config ───────────────────────────────────────

chatApiRouter.get('/agents/:agentId/chat-config', async (req, res) => {
  const config = await chatService.getAgentChatConfigPersisted(String(req.params.agentId))
  res.json({ data: config })
})

chatApiRouter.patch('/agents/:agentId/chat-config', requireHumanAuth, async (req, res) => {
  const { talkativeness, allow_wandering } = req.body as {
    talkativeness?: number
    allow_wandering?: boolean
  }
  const config = await chatService.updateAgentChatConfig(
    String(req.params.agentId),
    req.user!.userId,
    { talkativeness, allow_wandering },
  )
  res.json({ data: config })
})

chatApiRouter.patch('/rooms/:roomId/program', requireHumanAuth, async (req, res) => {
  const roomId = String(req.params.roomId)
  await assertCreatorOwner(roomId, req.user!)

  if (!isPlainRecord(req.body)) {
    throw new ValidationError('Request body must be an object')
  }

  assertAllowedKeys(req.body, [
    'enabled',
    'scene_type',
    'pacing_preset',
    'target_cast_min',
    'target_cast_max',
    'callback_window',
    'recap_every_turns',
    'max_consecutive_turns',
    'idle_cue_after_ms',
    'allow_wandering',
    'director_policy',
    'wander_policy',
    'discoverability',
  ])
  assertNoRawScriptFields(req.body)

  const patch: Record<string, unknown> = {}

  if ('enabled' in req.body) patch.enabled = parseBoolean(req.body.enabled, 'enabled')
  if ('scene_type' in req.body) {
    const sceneType = parseString(req.body.scene_type, 'scene_type')
    if (!ROOM_SCENE_TYPES.has(sceneType as RoomSceneType)) {
      throw new ValidationError('scene_type is invalid')
    }
    patch.scene_type = sceneType
  }
  if ('pacing_preset' in req.body) patch.pacing_preset = parseString(req.body.pacing_preset, 'pacing_preset')
  if ('target_cast_min' in req.body) patch.target_cast_min = parseNumber(req.body.target_cast_min, 'target_cast_min')
  if ('target_cast_max' in req.body) patch.target_cast_max = parseNumber(req.body.target_cast_max, 'target_cast_max')
  if ('callback_window' in req.body) patch.callback_window = parseNumber(req.body.callback_window, 'callback_window')
  if ('recap_every_turns' in req.body) patch.recap_every_turns = parseNumber(req.body.recap_every_turns, 'recap_every_turns')
  if ('max_consecutive_turns' in req.body) patch.max_consecutive_turns = parseNumber(req.body.max_consecutive_turns, 'max_consecutive_turns')
  if ('idle_cue_after_ms' in req.body) patch.idle_cue_after_ms = parseNumber(req.body.idle_cue_after_ms, 'idle_cue_after_ms')
  if ('allow_wandering' in req.body) patch.allow_wandering = parseBoolean(req.body.allow_wandering, 'allow_wandering')

  if ('director_policy' in req.body) {
    if (!isPlainRecord(req.body.director_policy)) {
      throw new ValidationError('director_policy must be an object')
    }
    patch.director_policy_json = req.body.director_policy
  }

  if ('wander_policy' in req.body) {
    if (!isPlainRecord(req.body.wander_policy)) {
      throw new ValidationError('wander_policy must be an object')
    }
    patch.wander_policy_json = normalizeWanderPolicy(req.body.wander_policy)
  }

  if ('discoverability' in req.body) {
    if (!isPlainRecord(req.body.discoverability)) {
      throw new ValidationError('discoverability must be an object')
    }
    const discoverability = req.body.discoverability
    assertAllowedKeys(discoverability, ['tags', 'short_hook', 'default_view'])
    if ('tags' in discoverability) {
      patch.discoverability_tags = parseStringArray(discoverability.tags, 'discoverability.tags')
    }
    if ('short_hook' in discoverability) {
      patch.discoverability_short_hook = parseStringOrNull(discoverability.short_hook, 'discoverability.short_hook')
    }
    if ('default_view' in discoverability) {
      patch.discoverability_default_view = parseString(discoverability.default_view, 'discoverability.default_view')
    }
  }

  const data = await chatroomControlService.updateProgram(roomId, patch)
  res.json({ data })
})

chatApiRouter.post('/rooms/:roomId/program/cues', requireHumanAuth, async (req, res) => {
  const roomId = String(req.params.roomId)
  await assertCreatorOwner(roomId, req.user!)

  if (!isPlainRecord(req.body)) {
    throw new ValidationError('Request body must be an object')
  }

  assertAllowedKeys(req.body, [
    'cue_type',
    'director_goal',
    'target_roles',
    'anchor_message_id',
    'callback_message_id',
  ])
  assertNoRawScriptFields(req.body)

  const cueType = parseString(req.body.cue_type, 'cue_type')
  if (!ROOM_CUE_TYPES.has(cueType as RoomCueType)) {
    throw new ValidationError('cue_type is invalid')
  }

  const data = await chatroomControlService.createCue(roomId, {
    cue_type: cueType as RoomCueType,
    director_goal: parseString(req.body.director_goal, 'director_goal'),
    target_roles: 'target_roles' in req.body ? parseRoleArray(req.body.target_roles, 'target_roles') : undefined,
    anchor_message_id: 'anchor_message_id' in req.body
      ? parseStringOrNull(req.body.anchor_message_id, 'anchor_message_id')
      : undefined,
    callback_message_id: 'callback_message_id' in req.body
      ? parseStringOrNull(req.body.callback_message_id, 'callback_message_id')
      : undefined,
  })

  res.status(201).json({ data })
})

chatApiRouter.patch('/rooms/:roomId/members/:agentId/control', requireHumanAuth, async (req, res) => {
  const roomId = String(req.params.roomId)
  const agentId = String(req.params.agentId)
  await assertCreatorOwner(roomId, req.user!)

  if (!isPlainRecord(req.body)) {
    throw new ValidationError('Request body must be an object')
  }

  assertAllowedKeys(req.body, [
    'role_hint',
    'spotlight_weight',
    'wander_eligible',
    'suppressed_until',
  ])

  const patch: Record<string, unknown> = {}
  if ('role_hint' in req.body) patch.role_hint = parseRoleHint(req.body.role_hint, 'role_hint')
  if ('spotlight_weight' in req.body) patch.spotlight_weight = parseNumber(req.body.spotlight_weight, 'spotlight_weight')
  if ('wander_eligible' in req.body) patch.wander_eligible = parseBoolean(req.body.wander_eligible, 'wander_eligible')
  if ('suppressed_until' in req.body) patch.suppressed_until = parseIsoDateOrNull(req.body.suppressed_until, 'suppressed_until')

  const data = await chatroomControlService.updateMemberControl(roomId, agentId, patch)
  res.json({ data })
})

chatApiRouter.get('/rooms/:roomId/control-state', requireHumanAuth, async (req, res) => {
  const roomId = String(req.params.roomId)
  await assertCreatorOwner(roomId, req.user!)
  const data = await chatroomControlService.getControlState(roomId)
  res.json({ data })
})

// ─── Convenience endpoints ───────────────────────────────────

chatApiRouter.get('/agents/:agentId/rooms', async (req, res) => {
  const rooms = await chatService.getRoomsByAgent(String(req.params.agentId))
  res.json({ data: rooms })
})

chatApiRouter.get('/agents/:agentId/rooms/least-active', async (req, res) => {
  const room = await chatService.getLeastActiveRoom(String(req.params.agentId))
  res.json({ data: room })
})

// ─── Error handling wrapper ──────────────────────────────────

chatApiRouter.use((err: unknown, _req: unknown, res: import('express').Response, _next: import('express').NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } })
    return
  }
  console.error('[ChatAPI] Unhandled error:', err)
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: getUnexpectedErrorMessage(err),
    },
  })
})
