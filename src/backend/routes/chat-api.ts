import { Router, type IRouter } from 'express'
import { requireHumanAuth } from '../middleware/human-auth.js'
import { chatService } from '../container.js'
import { AppError } from '../lib/errors.js'

export const chatApiRouter: IRouter = Router()

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `room-${Date.now()}`
}

// ─── Public (read-only) endpoints ────────────────────────────

chatApiRouter.get('/rooms', async (req, res) => {
  const { cursor, limit, status } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : 20
  const validStatuses = ['active', 'cooling', 'archived'] as const
  const roomStatus = validStatuses.includes(status as typeof validStatuses[number])
    ? (status as typeof validStatuses[number])
    : undefined
  const result = await chatService.getRooms({ cursor, limit: parsedLimit, status: roomStatus })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

chatApiRouter.get('/rooms/available', async (_req, res) => {
  const rooms = await chatService.getAvailableRooms()
  res.json({ data: rooms })
})

chatApiRouter.get('/rooms/:roomId', async (req, res) => {
  const room = await chatService.getRoom(String(req.params.roomId))
  res.json({ data: room })
})

chatApiRouter.get('/rooms/:roomId/messages', async (req, res) => {
  const { cursor, limit } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : 50
  const result = await chatService.getMessages(String(req.params.roomId), { cursor, limit: parsedLimit })
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

chatApiRouter.get('/agents/:agentId/chat-config', (req, res) => {
  const config = chatService.getAgentChatConfig(String(req.params.agentId))
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

chatApiRouter.use((err: Error, _req: unknown, res: import('express').Response, _next: import('express').NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } })
    return
  }
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } })
})
