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

chatApiRouter.get('/rooms', (req, res) => {
  const { cursor, limit, status } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : 20
  const validStatuses = ['active', 'cooling', 'archived'] as const
  const roomStatus = validStatuses.includes(status as typeof validStatuses[number])
    ? (status as typeof validStatuses[number])
    : undefined
  const result = chatService.getRooms({ cursor, limit: parsedLimit, status: roomStatus })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

chatApiRouter.get('/rooms/available', (_req, res) => {
  const rooms = chatService.getAvailableRooms()
  res.json({ data: rooms })
})

chatApiRouter.get('/rooms/:roomId', (req, res) => {
  const room = chatService.getRoom(req.params.roomId)
  res.json({ data: room })
})

chatApiRouter.get('/rooms/:roomId/messages', (req, res) => {
  const { cursor, limit } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : 50
  const result = chatService.getMessages(req.params.roomId, { cursor, limit: parsedLimit })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

// ─── Human control endpoints ─────────────────────────────────

chatApiRouter.post('/rooms', requireHumanAuth, (req, res) => {
  const { name, description, created_by_agent_id, community_id, greeting_message } = req.body as Record<string, string | undefined>

  if (!name?.trim()) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } })
    return
  }
  if (!created_by_agent_id) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'created_by_agent_id is required' } })
    return
  }

  const result = chatService.createRoom({
    name: name.trim(),
    slug: slugify(name),
    description: description?.trim() ?? '',
    community_id: community_id || null,
    created_by_agent_id,
    greeting_message,
  })

  res.status(201).json({ data: { ...result.room, greeting: result.greeting ?? null } })
})

chatApiRouter.post('/agents/:agentId/rooms', requireHumanAuth, (req, res) => {
  const { agentId } = req.params
  const { topic, community_id } = req.body as Record<string, string | undefined>

  if (!topic?.trim()) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'topic is required' } })
    return
  }

  const name = topic.trim().slice(0, 50)
  const result = chatService.createRoom({
    name,
    slug: slugify(name),
    description: topic.trim(),
    community_id: community_id || null,
    created_by_agent_id: agentId,
    greeting_message: `大家好，我创建了这个房间来聊聊「${topic.trim()}」，欢迎加入讨论！`,
  })

  res.status(201).json({ data: { ...result.room, greeting: result.greeting ?? null } })
})

chatApiRouter.post('/rooms/:roomId/agents/:agentId/join', requireHumanAuth, (req, res) => {
  const member = chatService.dispatchAgentToRoom(
    req.params.roomId,
    req.params.agentId,
    req.user!.userId,
  )
  res.json({ data: member })
})

chatApiRouter.post('/rooms/:roomId/agents/:agentId/leave', requireHumanAuth, (req, res) => {
  chatService.recallAgentFromRoom(
    req.params.roomId,
    req.params.agentId,
    req.user!.userId,
  )
  res.json({ data: { ok: true } })
})

chatApiRouter.post('/rooms/:roomId/agents/:agentId/leave-and-join', requireHumanAuth, (req, res) => {
  const { join_room_id } = req.body as { join_room_id?: string }
  if (!join_room_id) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'join_room_id is required' } })
    return
  }
  const member = chatService.leaveAndJoin(
    req.params.roomId,
    join_room_id,
    req.params.agentId,
    req.user!.userId,
  )
  res.json({ data: member })
})

// ─── Agent chat config ───────────────────────────────────────

chatApiRouter.get('/agents/:agentId/chat-config', (req, res) => {
  const config = chatService.getAgentChatConfig(req.params.agentId)
  res.json({ data: config })
})

chatApiRouter.patch('/agents/:agentId/chat-config', requireHumanAuth, (req, res) => {
  const { talkativeness, allow_wandering } = req.body as {
    talkativeness?: number
    allow_wandering?: boolean
  }
  const config = chatService.updateAgentChatConfig(
    req.params.agentId,
    req.user!.userId,
    { talkativeness, allow_wandering },
  )
  res.json({ data: config })
})

// ─── Convenience endpoints ───────────────────────────────────

chatApiRouter.get('/agents/:agentId/rooms', (req, res) => {
  const rooms = chatService.getRoomsByAgent(req.params.agentId)
  res.json({ data: rooms })
})

chatApiRouter.get('/agents/:agentId/rooms/least-active', (req, res) => {
  const room = chatService.getLeastActiveRoom(req.params.agentId)
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
